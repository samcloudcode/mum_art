# Migration history

These files describe historical schema and data changes. They are not an
automated migration chain: the project has no applied-migration ledger, and a
file's presence is not evidence that production has run it.

## Safety rules

- Inspect the live schema before deciding that a migration is needed.
- Never apply every file in this directory in a loop.
- Dry-run one migration with `scripts/db/run_sql.py` before requesting approval
  to use `--commit`.
- Do not replay old migrations against production merely to make this list look
  complete. Several are data-specific and some are not fully idempotent.
- Design new schema changes to remain compatible with the currently deployed
  application. Coordinate the production write and Vercel deployment when that
  is impossible.

## Repository order

Three migrations were independently numbered `003` on 2026-01-01. Their names,
not lexical globbing, distinguish them. The historical repository order is:

1. `001_initial_schema.sql`
2. `002_add_status_confidence.sql`
3. `003_add_activity_log.sql`
4. `003_add_primary_image_path.sql`
5. `003_add_print_short_name.sql`
6. `004_add_favorites.sql`
7. `005_add_edition_type.sql`
8. `006_reclassify_edition_zero_proofs.sql` — depends on 005
9. `007_fix_sold_but_unprinted.sql`
10. `008_delete_blank_editions.sql` — expects `edition_type` from 005
11. `009_flag_unverifiable_sales.sql` — expects `status_confidence` from 002

Migrations 004–007 entered the repository in PR #44, 008 in PR #45, and 009 in
PR #46. That records Git history only; verify current production state directly.

Continue with `010` for the next migration rather than renumbering historical
files. Include dependencies, compatibility requirements, dry-run evidence, and
the production result in the migration header or release record.
