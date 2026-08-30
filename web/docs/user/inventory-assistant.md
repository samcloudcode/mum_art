# Inventory Assistant

Use the assistant to investigate inventory, review recent changes and prepare
stock updates in natural language. The assistant can inspect records and refine
its interpretation, but it cannot change live inventory by itself.

## Asking about inventory

Open **Assistant** from the main navigation and ask questions such as:

- `What changed recently?`
- `How did Bembridge 12 end up at Kendalls?`
- `What stock should be at Kendalls?`
- `I printed Ducie 4 and AP 1.`
- `Bembridge 9 is not at the gallery where it is recorded.`

The assistant searches the current database rather than relying on a fixed list.
It can also review the app's activity history. Older imported changes may have no
activity record, so no history is not proof that an edition never changed.

## Reviewing proposed changes

For a requested update, the assistant first resolves the exact artwork,
edition type, edition number and location. If a phrase could mean more than one
record — for example, numbered edition 1 and AP 1 — it asks before continuing.

The proposal card shows every affected edition and each value that would change:

```text
Location          Direct → Kendalls
Printed           Not printed → Printed
In gallery from   Not set → 30 August 2026
```

Nothing in live inventory changes until you press **Confirm**. Confirmation
rechecks that the records have not changed since the preview, then applies the
whole proposal and its history entries together. If any record is now different,
the proposal becomes stale and must be prepared again; it is never partly
applied.

## Photographing handwritten inventory

Tap the camera button to photograph or attach a handwritten inventory note. Add
a sentence explaining what the list represents when it is not obvious — for
example, `These are the editions I saw at Kendalls today`.

The assistant will:

1. Transcribe only the entries it can read.
2. Match artwork names and abbreviations against the catalogue.
3. Check edition numbers, types, locations and statuses against current records.
4. Point out discrepancies or uncertain handwriting.
5. Suggest an exact proposal only for unambiguous entries.

A tick, column or handwritten mark is not treated as a stock instruction unless
its meaning is clear. The attached photo is sent for that assistant turn but is
not stored in the application's database.

## Stock checks

Tell the assistant which gallery you are checking and which editions are present
or missing. Unreported stock is not automatically considered missing. The
assistant can propose confirmations for editions you saw, move explicitly
missing stock to **Unknown**, or receive unexpectedly found stock into the
gallery.

For the existing tap-by-tap workflow, continue to use the gallery's dedicated
**Stock Check** screen.
