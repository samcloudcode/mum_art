# Inventory Assistant

Use the assistant to investigate inventory, review recent changes and prepare
stock updates in natural language. The assistant can inspect records and refine
its interpretation, but it cannot change live inventory by itself.

## Asking about inventory

Open **Assistant** from the navigation on any inventory page (or use the floating
assistant button on desktop). It opens over the current page so you can ask:

- `What changed recently?`
- `How did Bembridge 12 end up at Kendalls?`
- `List confirmed stock at Kendalls, including sizes.`
- `Where is my printed, unsold stock of Bembridge Lifeboat Station Landscape, split into confirmed and unconfirmed, with sizes and frames?`
- `What were my best-selling prints year to date versus the same period last year, taking current availability and seasonality into account?`
- `I printed Seagrove Landscape editions 112, 113 and 114. They are all large and framed.`
- `I moved Osborne edition 159 from Kendalls to Seaview Gallery.`
- `Bembridge Lifeboat Station Landscape edition 18 sold for £235 today.`
- `Bembridge 9 is not at the gallery where it is recorded.`

At the start of every request, the assistant loads the active artwork and gallery
names and IDs from the current database. An exact name or abbreviation can
therefore bypass an extra search, while approximate or ambiguous wording still
uses the search tools. It always inspects current edition records before
proposing a change. It can also review the app's activity history. Older
imported changes may have no activity record, so no history is not proof that an
edition never changed.
Artwork, edition, gallery and activity names in its replies can link directly to
the corresponding page in the app. These links use the same routes as the app's
navigation; the assistant cannot create links to database or admin endpoints.

The assistant keeps its header and message box visible while the conversation
itself scrolls. Choose **New** at any time to begin a new topic. Choose
**History** to reopen one of your previous conversations.

## While the assistant is working

One temporary assistant message shows what the assistant is currently checking.
Depending on the request, it may say that it is checking the catalogue, sales,
current stock, edition details or recent changes. A comparison can take several
steps, so the message updates in place rather than adding separate messages to
the conversation.

These labels describe real activity at a high level; they do not expose private
reasoning or technical database details. **Preparing proposed changes—nothing
has changed yet…** means the assistant is building the review card only. Live
inventory still cannot change until you press **Confirm**. The temporary status
disappears when the final answer or proposal is ready and is not saved in the
conversation history.

For sales questions, the assistant reads the editions' recorded sale dates and
locations rather than inferring sales from the audit log. It can list the exact
editions, calculate gross, commission and net values, and break results down by
gallery, artwork, month, edition type or settlement status. Calendar ranges are
bounded explicitly, so “last month” means the first day of that month up to—but
not including—the first day of the next month. Missing prices or commission
rates are reported rather than silently treated as zero. The audit log remains
the source for questions about who changed a record or how it changed.

## Dictating a request

Use the microphone beside the message box to dictate a request in British
English. Tap once to start recording and again to stop; recording stops
automatically after one minute. The app sends the recording securely to OpenAI
for transcription, together with the current artwork names, artwork
abbreviations and gallery names to help it recognise inventory terminology.

The transcript appears in the message box first so you can correct it before
sending. Dictation never submits or changes inventory by itself. The app does
not store the audio recording, although OpenAI processes it to produce the
transcript. Claude then handles the resulting inventory request in exactly the
same way as typed text.

If microphone permission is blocked, no microphone is available, or
transcription cannot connect, the assistant explains the problem beside the
microphone. All typed and photographed assistant features continue to work.

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

## Printing and moving stock

When recording printing, include the exact editions and any known physical
details. The assistant can prepare **Small**, **Large** or **Extra Large** sizes
and **Framed**, **Mounted** or **Tube only** presentation. It changes only the
details you supplied and never guesses an unmeasured size.

For a move, give the destination and any earlier date when the move was not
today. The assistant checks the edition's current recorded location itself.
Confirming a move means you physically handled and placed the edition, so it is
recorded as physically present at the destination as well as being assigned
there.

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

A recorded gallery location is not automatically proof that the edition is
physically there. Stock answers therefore distinguish **confirmed** editions
from older **unconfirmed** location records. Review unconfirmed records before
deciding what is present or genuinely missing; the assistant will not move them
to **Unknown** merely because they have not been checked recently.

For the existing tap-by-tap workflow, continue to use the gallery's dedicated
**Stock Check** screen.
