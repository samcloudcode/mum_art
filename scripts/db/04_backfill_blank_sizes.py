#!/usr/bin/env python3
"""Clear sizes that were guessed at import rather than actually measured.

    uv run python scripts/db/04_backfill_blank_sizes.py              # dry run
    uv run python scripts/db/04_backfill_blank_sizes.py --commit     # apply
    uv run python scripts/db/04_backfill_blank_sizes.py --rollback --commit

WHY
    normalize_size() used to return 'Small' for missing values, for 'Unknown',
    and for anything it didn't recognise. That asserted a size for editions
    nobody had measured, including ones not yet printed. The cleaner now returns
    None, but rows imported under the old behaviour still carry the guess.

HOW A GUESS IS IDENTIFIED
    From the source export, minus anything a human has touched. An edition is
    treated as guessed when its Airtable row had Size blank or 'Unknown', the
    database still holds 'Small', AND nobody has ever edited that edition's size
    in the app. A row whose source genuinely said 'Small' is never touched.

    The activity_log exclusion matters in both directions. The editions table's
    inline editor can set a size to 'Small' (making a real measurement look
    identical to the import guess) and can also clear one to blank — the '-'
    option in web/src/components/editions/edition-inline-cell.tsx. Once a human
    has expressed intent about a row's size, this script cannot second-guess it
    from the CSV, so it leaves the row alone. That costs a handful of rows that
    keep a stale guess; the alternative is silently overwriting measurements.

REVERSIBLE
    The rule is derived from the CSV plus the log, not from run-time state, so
    --rollback recomputes the same set and restores 'Small' to rows currently
    NULL. No state file to keep.

    Because human-edited rows are excluded from the set, rollback will not
    resurrect 'Small' on a size someone deliberately blanked. It still cannot
    tell a row this script blanked from one blanked by some other script
    afterwards, so roll back before running anything else that clears sizes.
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 missing. Run via `uv run python`, or `uv pip install psycopg2-binary`.")

# The export smart_import.py actually loads (see smart_import.py:43).
DEFAULT_CSV = Path("airtable_export/Editions-1 Jan 2026 export.csv")

# Source values that meant "nobody recorded a size".
UNMEASURED = {"", "unknown", "nan", "none"}


def guessed_record_ids(csv_path: Path) -> set[str]:
    """record_ids whose source Size was blank or Unknown."""
    ids: set[str] = set()
    with open(csv_path, encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for field in ("record_id", "Size"):
            if field not in reader.fieldnames:
                sys.exit(f"{csv_path} has no '{field}' column; is this the right export?")
        for row in reader:
            rid = (row.get("record_id") or "").strip()
            size = (row.get("Size") or "").strip().lower()
            if rid and size in UNMEASURED:
                ids.add(rid)
    return ids


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--commit", action="store_true", help="apply changes (default: roll back)")
    ap.add_argument("--rollback", action="store_true", help="restore 'Small' instead of clearing it")
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV, help=f"source export (default {DEFAULT_CSV})")
    ap.add_argument("--url", default=os.environ.get("DATABASE_URL"), help="defaults to $DATABASE_URL")
    args = ap.parse_args()

    if not args.url:
        sys.exit("DATABASE_URL is not set. Put it in .env or pass --url.")
    if not args.csv.exists():
        sys.exit(f"{args.csv} not found. Run from the repo root.")

    ids = guessed_record_ids(args.csv)
    print(f"source: {args.csv}")
    print(f"editions whose source size was blank or 'Unknown': {len(ids)}")
    print("MODE: " + ("ROLLBACK — " if args.rollback else "") +
          ("COMMIT — changes will be applied" if args.commit else "DRY RUN — changes rolled back at the end"))
    print()

    # Any edition whose size a human has edited in the app. Their intent wins
    # over anything inferable from the CSV, in both directions.
    HAND_EDITED = """
        id NOT IN (
            SELECT entity_id FROM activity_log
            WHERE entity_type = 'edition'
              AND field_name ILIKE '%%size%%'
              AND entity_id IS NOT NULL
        )
    """

    if args.rollback:
        # Restore only rows this script would have cleared.
        sql = f"""
            UPDATE editions SET size = 'Small'
            WHERE size IS NULL AND airtable_id = ANY(%s) AND {HAND_EDITED}
            RETURNING id, edition_display_name
        """
    else:
        # Clear only rows still holding the guess.
        sql = f"""
            UPDATE editions SET size = NULL
            WHERE size = 'Small' AND airtable_id = ANY(%s) AND {HAND_EDITED}
            RETURNING id, edition_display_name
        """

    conn = psycopg2.connect(args.url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            # Context before the write, so a surprising number is visible early.
            cur.execute(
                "SELECT size, count(*) FROM editions WHERE airtable_id = ANY(%s) GROUP BY size ORDER BY 2 DESC",
                (list(ids),),
            )
            print("current state of those editions in the database:")
            for size, count in cur.fetchall():
                print(f"  {size if size is not None else '(blank)':<12} {count}")
            print()

            # Say what the exclusion costs, so it never silently drops rows.
            cur.execute(
                f"SELECT count(*) FROM editions WHERE airtable_id = ANY(%s) AND NOT ({HAND_EDITED})",
                (list(ids),),
            )
            skipped = cur.fetchone()[0]
            print(f"skipped — size edited by hand, human intent wins: {skipped}")
            print()

            cur.execute(sql, (list(ids),))
            rows = cur.fetchall()
            print(f"{len(rows)} edition(s) {'restored to Small' if args.rollback else 'cleared to blank'}")
            for edition_id, name in rows[:10]:
                print(f"  {edition_id}  {name}")
            if len(rows) > 10:
                print(f"  ... and {len(rows) - 10} more")
            print()

        if args.commit:
            conn.commit()
            print("COMMITTED.")
            print("Re-run with --rollback --commit to undo." if not args.rollback else "Rollback applied.")
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
