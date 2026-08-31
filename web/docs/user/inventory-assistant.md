# Inventory Assistant

Use the assistant to investigate inventory, review recent changes and prepare
stock updates in natural language. The assistant can inspect records and refine
its interpretation, but it cannot change live inventory by itself.

## Asking about inventory

Open **Assistant** from the navigation on any inventory page (or use the floating
assistant button on desktop). It opens over the current page so you can ask:

- `What changed recently?`
- `How did Bembridge 12 end up at Kendalls?`
- `What stock should be at Kendalls?`
- `I printed Ducie 4 and AP 1.`
- `I sold Bembridge 12 for £425 on 30 August 2026.`
- `Bembridge 9 is not at the gallery where it is recorded.`

The assistant searches the current database rather than relying on a fixed list.
It can also review the app's activity history. Older imported changes may have no
activity record, so no history is not proof that an edition never changed.
Artwork, edition, gallery and activity names in its replies can link directly to
the corresponding page in the app. These links use the same routes as the app's
navigation; the assistant cannot create links to database or admin endpoints.

The assistant keeps its header and message box visible while the conversation
itself scrolls. Choose **New** at any time to begin a new topic. Choose
**History** to reopen one of your previous conversations.

## Dictating a request

Where the browser supports speech recognition, use the microphone beside the
message box to dictate a request in British English. The app supplies current
artwork names, artwork abbreviations and gallery names as recognition hints on
browsers that support contextual biasing. The transcript appears in the message
box first so you can correct it before sending; dictation never submits or
changes inventory by itself.

Speech recognition is provided by the browser and may use the browser vendor's
online speech service. If it is unavailable, the microphone is disabled and all
typed and photographed assistant features continue to work.

## Reviewing proposed changes

For a requested update, the assistant first resolves the exact artwork,
edition type, edition number and location. If a phrase could mean more than one
record — for example, numbered edition 1 and AP 1 — it asks before continuing.
It looks up current locations and statuses itself rather than asking you to
repeat information already in the database. If essential details are missing,
it asks for them together in one short question.

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

This confirmation rule applies to every inventory write the assistant can
prepare, including sales and undo. Read-only searches and history questions do
not need confirmation because they do not change inventory.

## Recording a sale

Tell the assistant the exact edition, gross sale price in pounds and sale date.
It asks for anything missing or ambiguous, then shows the sale fields in the
proposal card. Confirming the proposal marks the edition sold and unsettled,
keeps its recorded location, snapshots that location's current commission, and
clears its stock-check confirmation. The edition must already be printed and
unsold.

Each named sale refers to one exact edition. You can still request several
sales in one message; they appear together in one proposal and are applied
atomically only after confirmation.

## Undoing an assistant change

After a newly applied assistant proposal, choose **Undo this change**. The
assistant prepares a second proposal showing the exact reverse values. Review
and confirm it like any other change; pressing Undo never changes inventory
immediately.

Undo uses the machine-readable before-values captured with the original
proposal. It refuses the reversal if a relevant field changed afterwards, the
proposal was already undone, or the original proposal predates undo snapshots.
An undo cannot itself be automatically undone. Changes made manually elsewhere
in the app remain visible in history but are not offered as automatic undo.

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
