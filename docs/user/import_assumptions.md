# Import Report

Generated: 2026-01-01 17:30:05
Sync ID: e9ff67ae-d3db-4fae-939a-b4f826cc8ba0

# Actions Taken During This Import

This section documents the actual transformations and actions
performed during this specific import run.

## Print Name Standardizations

The following print names were standardized during import:

| Original | Standardized |
|----------|--------------|
| `A. MERMAIDS` | A Seaview Mermaids |
| `B. SVYCM` | B Seaview Yacht Club Mermaids |
| `BEMLBSL` | Bembridge Lifeboat Station Landscape |
| `CLASS RACING LYM` | Class Racing Lym |
| `COWES RACE DAY` | Cowes Race Day |
| `Contessa32` | Contessa 32 |
| `Lifeboat Station` | Bembridge Lifeboat Station |
| `NEEDLES LIGHTHOUSE` | The Needles Lighthouse |
| `NERTHEK` | Nerthek |
| `Needles` | The Needles |
| `NoMansFort` | No Man's Fort |
| `OTTO` | Otto |
| `PUFFIN` | Puffin |
| `QUAYROCKS LANDSCAPE` | Quay Rocks Landscape |
| `Regatta` | Seaview Regatta |
| `SCOWS` | Scows |
| `SEAGROVE` | Seagrove |
| `SEAGV2L` | Seagrove Landscape |
| `SVYCMERMAIDS` | Svycmermaids |
| `St Catherines` | St Catherine's |
| `miscellaneous` | Miscellaneous |
| `wrong flag race day` | Wrong Flag Race Day |

## Distributor Name Standardizations

The following distributor names were standardized:

| Original | Standardized |
|----------|--------------|
| `AQUALIBRUM` | Aqualibrum |
| `DIRECT OLD` | Direct Old |
| `KENDALLS` | Kendalls |

## Size Normalizations

Size values were normalized to standard values:

| Original | Normalized To | Count |
|----------|---------------|-------|
| `Unknown` | Small | 211 |
| `nan` | Small | 3753 |

## Frame Type Normalizations

Frame types were normalized to standard values:

| Original | Normalized To | Count |
|----------|---------------|-------|
| `B&Q` | Framed | 5 |
| `Ikea` | Framed | 30 |
| `Unknown Frame` | Framed | 163 |
| `nan` | Framed | 3944 |

## Duplicate Editions Handled

**76 duplicate editions were skipped** based on pre-computed decisions:

- Bembridge - 64: KEEP_LARGE_SOLD
- Bembridge - 73: KEEP_LARGE_SOLD
- Brambles - 79: KEEP_SOLD
- COWES RACE DAY - 44: KEEP_FRAMED
- COWES RACE DAY - 52: KEEP_FRAMED
- ... and 71 more

## Editions Skipped (Missing Print)

**1 editions were skipped** because their print was not found:

-  - 49 (print: `airtable_id: nan`)

## Default Values Applied

Default values were applied for missing data:

| Field | Default Value | Times Applied |
|-------|---------------|---------------|
| frame_type | Framed | 3944 |
| size | Small | 3964 |

## Summary

- **Print names standardized:** 22
- **Distributor names standardized:** 3
- **Sizes normalized:** 8251
- **Frame types normalized:** 8251
- **Dates corrected:** 0
- **Duplicate editions skipped:** 76
- **Editions missing print (skipped):** 1
- **Duplicate prints skipped:** 0

## Post-Processing Actions

- **Old sales auto-settled:** 109 editions (sales >6 months old)
- **Direct Old marked legacy_unknown:** 52 editions

---

# Import Assumptions (Reference)

This section documents the rules and assumptions the import process follows.
These are the configured behaviors, not necessarily what happened in this run.

## Data Quality

### All imported data defaults to 'verified' status_confidence
**Reason:** CSV data is considered the current best source of truth

## Missing Data

### If print name not found in database, edition record is skipped
**Reason:** Editions require a valid print foreign key reference

### If distributor name not found, distributor_id is set to NULL
**Reason:** Distributor is optional - editions can exist without a distributor

## Defaults

### Unknown or missing sizes default to 'Small'
**Reason:** Small is the most common edition size

### Unknown or missing frame types default to 'Framed'
**Reason:** Most editions are framed when sold

## Date Handling

### Dates with year 1920 are corrected to 2020
**Reason:** Common typo in manual data entry

### Multiple date formats are tried (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
**Reason:** Historical data may have inconsistent date formatting

## Commission

### Commission percentage is a snapshot at sale time, not synced with current distributor rates
**Reason:** Historical sales should reflect the commission at time of sale

## Duplicates

### Duplicate airtable_ids are rejected via ON CONFLICT DO NOTHING
**Reason:** Each edition should have a unique source record

## Settlement

### Sales over 6 months old with sold=true are auto-marked as settled=true
**Reason:** Old sales are unlikely to still be awaiting payment - conservative assumption for historical data

## Legacy Data

### Editions with 'Direct Old' distributor are marked as status_confidence='legacy_unknown'
**Reason:** Direct Old indicates historical records with uncertain final status/location

---

To review editions marked as legacy_unknown, use the frontend toggle or query:
```sql
SELECT * FROM editions WHERE status_confidence = 'legacy_unknown';
```