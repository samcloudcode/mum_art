#!/usr/bin/env python3
"""Run a .sql file against DATABASE_URL, rolling back unless told otherwise.

    uv run python scripts/db/run_sql.py scripts/db/01_diagnose_kendalls_reset.sql
    uv run python scripts/db/run_sql.py scripts/db/02_restore_kendalls.sql --commit

Everything runs inside one transaction. Without --commit that transaction is
rolled back, so you can see exactly what a write script would do — including
its RETURNING output — before committing to it. Read-only scripts need no flag.

Scripts must not contain their own BEGIN/COMMIT/ROLLBACK; this manages the
transaction so the dry run cannot be defeated by a stray COMMIT. Any it finds
are skipped with a warning.
"""
from __future__ import annotations

import argparse
import os
import sys

try:
    import psycopg2
    from dotenv import load_dotenv
except ImportError:
    sys.exit("psycopg2 missing. Run this via `uv run python`, or `uv pip install psycopg2-binary`.")

# Not override=True, unlike db/manager.py: an exported DATABASE_URL must be able
# to beat .env, so pointing these writes at a test database actually works.
load_dotenv()


def split_statements(sql: str) -> list[str]:
    """Split on semicolons that are actually statement terminators.

    Aware of single/double quotes, dollar-quoted bodies ($$ ... $$, $tag$ ... $tag$),
    line comments and block comments, so semicolons inside any of those are ignored.
    """
    statements, buf = [], []
    i, n = 0, len(sql)
    in_single = in_double = in_line_comment = False
    block_depth = 0
    dollar_tag: str | None = None

    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if in_line_comment:
            buf.append(ch)
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if block_depth:
            buf.append(ch)
            if ch == "/" and nxt == "*":
                block_depth += 1
                buf.append(nxt)
                i += 2
                continue
            if ch == "*" and nxt == "/":
                block_depth -= 1
                buf.append(nxt)
                i += 2
                continue
            i += 1
            continue

        if dollar_tag is not None:
            buf.append(ch)
            if ch == "$" and sql.startswith(dollar_tag, i):
                buf.extend(dollar_tag[1:])
                i += len(dollar_tag)
                dollar_tag = None
                continue
            i += 1
            continue

        if in_single:
            buf.append(ch)
            if ch == "'":
                if nxt == "'":  # escaped quote
                    buf.append(nxt)
                    i += 2
                    continue
                in_single = False
            i += 1
            continue

        if in_double:
            buf.append(ch)
            if ch == '"':
                in_double = False
            i += 1
            continue

        # Not inside anything special.
        if ch == "-" and nxt == "-":
            in_line_comment = True
            buf.append(ch)
            i += 1
            continue
        if ch == "/" and nxt == "*":
            block_depth = 1
            buf.append(ch)
            buf.append(nxt)
            i += 2
            continue
        if ch == "'":
            in_single = True
            buf.append(ch)
            i += 1
            continue
        if ch == '"':
            in_double = True
            buf.append(ch)
            i += 1
            continue
        if ch == "$":
            end = sql.find("$", i + 1)
            if end != -1 and sql[i + 1 : end].replace("_", "").isalnum() or (end == i + 1):
                dollar_tag = sql[i : end + 1]
                buf.append(dollar_tag)
                i = end + 1
                continue
        if ch == ";":
            statements.append("".join(buf).strip())
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return [s for s in statements if s and not _is_only_comments(s)]


def _is_only_comments(stmt: str) -> bool:
    for line in stmt.splitlines():
        line = line.strip()
        if line and not line.startswith("--"):
            return False
    return True


def render(headers: list[str], rows: list[tuple]) -> str:
    if not rows:
        return "(0 rows)"
    cols = [str(h) for h in headers]
    text = [[("" if v is None else str(v)) for v in row] for row in rows]
    widths = [max(len(cols[c]), *(len(r[c]) for r in text)) for c in range(len(cols))]
    out = [" | ".join(cols[c].ljust(widths[c]) for c in range(len(cols)))]
    out.append("-+-".join("-" * w for w in widths))
    out.extend(" | ".join(r[c].ljust(widths[c]) for c in range(len(cols))) for r in text)
    out.append(f"({len(rows)} row{'s' if len(rows) != 1 else ''})")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", help="path to the .sql file")
    ap.add_argument("--commit", action="store_true", help="apply changes (default: roll back)")
    ap.add_argument("--url", default=os.environ.get("DATABASE_URL"), help="defaults to $DATABASE_URL")
    ap.add_argument("--max-rows", type=int, default=100, help="truncate output per statement (default 100)")
    args = ap.parse_args()

    if not args.url:
        return int(bool(sys.stderr.write("DATABASE_URL is not set. Put it in .env or pass --url.\n"))) or 1

    with open(args.file) as fh:
        statements = split_statements(fh.read())

    print(f"{args.file}: {len(statements)} statement(s)")
    print("MODE: COMMIT — changes will be applied" if args.commit else "MODE: DRY RUN — changes rolled back at the end")
    print()

    conn = psycopg2.connect(args.url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for idx, stmt in enumerate(statements, 1):
                # Label with the first real SQL line, not the file's comment header.
                body = "\n".join(
                    ln for ln in stmt.splitlines() if ln.strip() and not ln.strip().startswith("--")
                )
                first = " ".join(body.split())[:70]
                if stmt.split()[0].upper() in {"BEGIN", "COMMIT", "ROLLBACK", "START", "END"}:
                    print(f"[{idx}] SKIPPED transaction control: {first}\n")
                    continue

                print(f"[{idx}] {first}{'...' if len(' '.join(stmt.split())) > 70 else ''}")
                cur.execute(stmt)
                if cur.description:
                    rows = cur.fetchmany(args.max_rows)
                    print(render([d[0] for d in cur.description], rows))
                    if len(rows) == args.max_rows:
                        print(f"  ... truncated at {args.max_rows}; raise with --max-rows")
                else:
                    print(f"  {cur.rowcount} row(s) affected")
                print()

        if args.commit:
            conn.commit()
            print("COMMITTED.")
        else:
            conn.rollback()
            print("ROLLED BACK (dry run). Re-run with --commit to apply.")
    except Exception as exc:
        conn.rollback()
        print(f"\nERROR — transaction rolled back, nothing changed:\n  {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
