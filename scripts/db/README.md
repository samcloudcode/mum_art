# Database scripts

One-off SQL for data fixes and investigations, written to be run from your local
machine against the live database. Each script is committed so the change is
reviewable before it runs and there's a record of it afterwards.

## Setup

Needs `DATABASE_URL` in `.env` (see `.env.example`) — the same connection string
the import scripts use.

## Running

```bash
# Read-only scripts: just run them
uv run python scripts/db/run_sql.py scripts/db/01_diagnose_kendalls_reset.sql

# Write scripts: dry run first (prints what would change, then rolls back)
uv run python scripts/db/run_sql.py scripts/db/02_restore_kendalls_stock_check.sql

# Apply for real
uv run python scripts/db/run_sql.py scripts/db/02_restore_kendalls_stock_check.sql --commit
```

`psql -f` works too, but prefer the runner for anything that writes: psql
commits an open transaction at end-of-file, so a script's `BEGIN` without a
matching `ROLLBACK` applies rather than discards.

### What the runner guarantees

- **Everything runs in one transaction.** Any error rolls back the whole script,
  including statements that already succeeded. Exit code is 1.
- **Dry run by default.** Without `--commit` the transaction is always rolled
  back, so you see the real output — including `RETURNING` rows — having changed
  nothing.
- **Scripts can't defeat the dry run.** `BEGIN`/`COMMIT`/`ROLLBACK` inside a
  script are skipped with a warning; the runner owns the transaction.

Options: `--url` to override `DATABASE_URL`, `--max-rows` to raise the 100-row
output cap.

## Conventions for new scripts

- Numbered by order of use; diagnosis and restore split into separate files so
  the read-only part can be run freely.
- Header comment explains what happened, why the fix is correct, and what it
  **cannot** do. The limits matter more than the mechanism.
- No transaction control inside the file.
- Prefer additive writes (only ever setting a flag on, never off) so re-running
  is harmless.

## Current scripts

| Script | Writes | Purpose |
|---|---|---|
| `01_diagnose_kendalls_reset.sql` | no | What the Kendalls stock-check reset destroyed, and how much of it is recoverable from `activity_log`. |
| `02_restore_kendalls_stock_check.sql` | yes | Restores it, using the last explicit per-edition intent in the log. Additive and idempotent. |
| `03_find_bad_sale_dates.sql` | no | Finds the out-of-range `date_sold` behind the "-6657898 days ago" dashboard stat. |

## Testing

The Kendalls recovery was verified against a local Postgres 16 fixture built
from `supabase/migrations/`, reproducing the reset — including an edition that
was ticked and then deliberately unticked (correctly not restored) and one whose
log insert failed (correctly not recoverable). Worth doing for anything
non-trivial before pointing it at live data:

```bash
PGDATA=/tmp/pgtest
/usr/lib/postgresql/16/bin/initdb -D $PGDATA -A trust -U postgres
/usr/lib/postgresql/16/bin/pg_ctl -D $PGDATA -o '-p 15433 -k /tmp' start
createdb -h /tmp -p 15433 -U postgres mumtest
# stub the Supabase-only objects the migrations reference, then apply them
psql -h /tmp -p 15433 -U postgres -d mumtest \
  -c "CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;"
for f in supabase/migrations/*.sql; do
  psql -h /tmp -p 15433 -U postgres -d mumtest -v ON_ERROR_STOP=1 -f "$f"
done
```

Then point the runner at it with
`--url postgresql://postgres@127.0.0.1:15433/mumtest`.
