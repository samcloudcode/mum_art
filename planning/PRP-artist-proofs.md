# PRP: Artist's Proofs and other non-numbered editions

**Status:** shipped 2026-07-27 — migrations 005–009, deployed in PR #44.

> **What actually landed** (2026-07-27). The recommendation below was built as
> described: `edition_type` plus a widened `unique_print_edition`. The data
> turned out differently from the counts in "The problem" once checked against
> the database rather than the export:
>
> - **69 negatives** converted to proofs, as expected.
> - **6 unnumbered proofs**, not 5 "edition-zero" rows. Nothing is stored with
>   `edition_number = 0` — the importer writes NULL — so the first draft of the
>   migration matched nothing at all. Two of the six are marked only in `notes`,
>   and the Osborne row, assumed to be a stray placeholder, is marked
>   `Variation: AP` in the source: a proof not yet printed.
> - **22 blank rows deleted** (`008`) — no number, price, gallery, sale or flag.
>   They return on the next import of that export; see `docs/import_assumptions.md`.
> - **4 contradictory rows** flagged `legacy_unknown` (`009`) — marked sold with
>   nothing to evidence a sale.
>
> Verified after: 75 proofs, 0 negative numbers, and every row the source marks
> `AP` now carries `edition_type = 'ap'`.
>
> The counts in "The problem" are left as written — they were the best reading
> of the export at proposal time, and the gap between them and reality is the
> useful part.

## The problem

APs are currently stored as **negative edition numbers**. There are 69 of them in
the source export, plus 5 edition-zero rows and 110 rows with no edition number
at all.

This works, in the sense that nothing is broken. It survives because of one
constraint in `001_initial_schema.sql:109`:

```sql
CONSTRAINT unique_print_edition UNIQUE (print_id, edition_number)
```

An AP needs a slot in that constraint, and negatives are unused slots. That is
the whole reason for the convention — it is a workaround for uniqueness, not a
description of what an AP is.

What it costs today:

- **They display as nonsense.** The generated name is literally `Ducie - -1`.
- **The meaning is implicit.** `analytics.ts` excludes them via a magic-number
  rule (`shouldCountEdition`: `edition_number > 0`) with a comment explaining
  that negatives mean artist proofs. Nothing enforces or documents this at the
  database level.
- **They sort to the front.** Every ascending sort by edition number puts APs
  before edition 1.
- **You cannot tell an AP from a test print from a mistake.** `-1` could be any
  of them. Edition `0` (5 rows) is presumably a different thing again.
- **New APs can't be created in the app.** There is no UI for it; you would be
  typing a negative number into a field that means something else.

## Recommendation

Add an explicit `edition_type`, keep edition numbers positive, and widen the
uniqueness constraint to include the type.

```sql
ALTER TABLE editions
ADD COLUMN edition_type TEXT NOT NULL DEFAULT 'numbered'
CHECK (edition_type IN ('numbered', 'ap', 'pp', 'test'));

ALTER TABLE editions DROP CONSTRAINT unique_print_edition;
ALTER TABLE editions ADD CONSTRAINT unique_print_edition
    UNIQUE (print_id, edition_type, edition_number);
```

An AP then becomes `edition_type='ap', edition_number=1` — genuinely "AP 1",
not "minus one". A numbered edition 1 and an AP 1 can coexist because the type
is part of the key.

`pp` (printer's proof) and `test` are included because you already have
edition-zero rows that are *something*, and because adding a value to a CHECK
constraint later is a migration, whereas listing them now is free. Drop them
from the list if they're not real categories for you.

### Why not the alternatives

**Keep negatives, add nothing.** Cheapest, but every one of the costs above is
permanent, and the "next unprinted edition" feature I just built has to keep
special-casing `> 0` forever. It also can't distinguish AP from test print,
which you'll want the moment you have both.

**Keep negatives as storage, add a display layer.** Fixes the ugly name and
nothing else. The magic number stays, sorting stays wrong, and now there are two
concepts to keep in sync. Worst of both.

**Separate `artist_proofs` table.** Clean in theory. In practice APs move
between galleries, get sold, get stock-checked and get settled exactly like
numbered editions, so every query in the app would need to union two tables. The
cost is enormous and the benefit is zero.

## The display name problem

This is the part that needs a decision, because it's where the blast radius is.

`edition_display_name` is `NOT NULL VARCHAR(100)`, used in 26 places in the web
app — search, sort, table cells, activity log entries. Nothing parses it, which
is the good news: changing its format is a display concern, not a data one.

The bad news is it is **already generated three different ways**:

| Where | Format | Example |
|---|---|---|
| `cleaning/cleaner.py:416` | from the CSV `Print - Edition` column | `Ducie - 5` |
| `db/manager.py:379` | `f"{name} - {edition_num}"` | `Ducie - 5` |
| `artworks/page.tsx:101` | `` `${name} ${i+1}/${total}` `` | `Ducie 5/350` |

So the app already disagrees with itself about whether an edition is called
`Ducie - 5` or `Ducie 5/350`, depending on how it was created. APs would add a
fourth variant unless this is centralised.

**Proposal:** one function, used everywhere, and stop storing the derived value
where possible.

```ts
// e.g. "Ducie 5/350", "Ducie AP 1/10", "Ducie AP 1"
function editionDisplayName(print, edition): string
```

Storing a derived string in a `NOT NULL` column is what allowed the three
formats to drift. Since nothing parses it, the column could become a generated
column or be dropped in favour of computing it — but that is a bigger change
than this PRP needs, so the minimum is: one function, called from all three
sites, APs rendered as `AP n`.

## Migration of existing data

69 rows, so this is small and reversible.

```sql
UPDATE editions
SET edition_type = 'ap', edition_number = abs(edition_number)
WHERE edition_number < 0;
```

Two things to check before running it, both of which need your answer:

1. **Do the 5 edition-zero rows mean something?** They are currently counted as
   "not a real edition" by `shouldCountEdition` but are not negative. If they're
   test prints, they become `edition_type='test'`. If they're mistakes, they
   should be deleted or corrected.
2. **Could `abs()` collide?** If any print has both an AP `-1` and, say, a test
   print also stored as `-1`, they'd both become `ap`/`1` and violate the new
   constraint. The migration should run as a dry-run first and report collisions
   rather than assume there are none. Given 69 rows across many prints this is
   unlikely, but it is exactly the kind of thing worth checking rather than
   hoping.

## Blast radius

Places that assume edition numbers are positive, or that would want the type:

- `analytics.ts` `shouldCountEdition` — becomes `edition_type === 'numbered'`,
  which is what it was always trying to say
- `analytics.ts` `nextUnprintedEditionNumber` — same, and simpler for it
- Sorting by edition number in `artworks/[id]/page.tsx:48`,
  `add-editions-to-gallery-dialog.tsx:106`, `stock-check/page.tsx:115` — APs
  should probably sort after numbered editions, not before
- `prints.total_editions` — APs should not count toward "edition of 350"
- Sell-through and "remaining" maths — an AP is not part of the numbered run
- New: a way to *add* an AP, which does not exist today

## Open questions

1. **Are APs part of the edition count?** I assume no — an edition of 350 means
   350 numbered prints, with APs on top. Confirm.
2. **Do you want `AP 1/10` (a known number of APs) or just `AP 1`?** The first
   needs a per-artwork AP total, i.e. another column on `prints`. The second is
   free.
3. **What are the 5 edition-zero rows?**
4. **Do APs sell at the same commission and price as numbered editions?** If they
   are priced differently, that's worth knowing now rather than later.
5. **Are `pp` and `test` real categories for you, or is it just APs?**

## Suggested build order

1. Migration: add `edition_type`, widen the constraint, convert the 69 negatives
   (with a collision dry-run first)
2. Centralise `editionDisplayName()` and fix the three drifted call sites
3. Update the counting and sorting rules listed under blast radius
4. UI: show APs distinctly, add a way to create one

Steps 1–2 are mechanical once the open questions are answered. Step 3 is where
the behaviour actually changes, so it's worth doing as its own reviewable commit.
