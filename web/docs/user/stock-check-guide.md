# Stock Check Guide

How to verify physical inventory at a gallery location.

## When to Use

Open the stock check when you visit a gallery to confirm that:
- Items recorded in the system are physically present
- Nothing has been sold without being recorded
- Items haven't been moved or misplaced

## Opening the Stock Check

1. Go to **Galleries** and select the gallery you're visiting
2. Click **Stock Check** in the top-right corner
3. You'll see everything the system places at that gallery, split into
   **Unconfirmed** and **Confirmed**

## The Stock Check Screen

### The tally at the top
Counts in stock, confirmed and unconfirmed, with a bar for the confirmed share.
Confirmations are a standing record — "this has been seen here" — so the bar
carries over between visits. Nothing clears it unless you ask, via **Clear
confirmations** below.

### Confirmed and Unconfirmed
**Confirmed** comes first — seen at this gallery. Collapse it with the chevron
once it's long and you're only interested in what's left. **Unconfirmed** follows:
recorded at this gallery, not yet seen. Within each, editions are grouped by
artwork name (e.g. all "Bembridge" prints together), which matches how you'd scan
a gallery wall — see below for grouping by size or frame instead.

### Search, filter and group
The search bar filters this gallery's stock:
- Type `Bembridge 47` to find edition 47 of Bembridge
- Or just type `Bembridge` to see all Bembridge editions

Below it, **Group by** switches the headings between **Artwork**, **Size** and
**Frame type** — useful when you're working through a rack of one size rather
than a wall of one artwork. Grouped by size or frame, each row shows its artwork
name too. Anything with no size or frame recorded gets its own group at the
bottom rather than being hidden.

The **Artwork**, **Size** and **Frame type** dropdowns filter instead of group,
and they combine with the search. They only offer values that exist in this
gallery's stock, so a choice never comes back empty. Note that filtering by size
or frame excludes rows where it hasn't been recorded. **Clear** resets all of it.

## Working through the stock

### Confirm an item
Tap the large box next to an edition when you physically see it. It turns green
and moves to Confirmed. Tap it again to undo.

### Confirm a whole artwork
If you've seen every edition of an artwork, click **Confirm all X** in that
group's header.

### See the full record
Tap the artwork name or edition number on any row to open its record: every
attribute the system holds — size, frame, variation, printed flag, status
confidence, location and dates, sale price, commission, net and settlement,
notes — plus its **recent changes**, newest first, showing which field moved from
what to what, when, and who did it. Only edits made through this app are logged,
so an edition imported from Airtable and never touched here shows no history.
**Full record** at the bottom opens the whole edition page.

### Clear confirmations
**Clear N confirmations**, in the Confirmed heading, unticks them all — the
periodic "start again from scratch" count. It clears exactly what the section is
currently showing, so a search or filter narrows what it touches (the button says
"shown" when that's the case).

An **Undo** appears immediately afterwards, and ⌘Z / Ctrl+Z works too. Undo is
lost on a page reload, so use it there and then.

### It isn't here
Tap **Not here** on an edition that isn't at the gallery. After a confirmation
prompt, its location becomes **Unknown**, its in-gallery date is cleared, and it
leaves this gallery's stock — so it stops counting as being here while you work
out where it went. It stays findable by searching for the artwork on the
Editions page.

### Add stock
Two ways, under **Add stock to <gallery>**:

- Pick the artwork from the **Artwork** dropdown (favourites first, marked ★),
  then type just the edition number — e.g. `47`. Leave the number blank to see
  everything available for that artwork. The dropdown keeps its selection after
  each add, so a run of prints from one artwork goes in quickly.
- Or leave the dropdown on **Any artwork** and type both — e.g. `Bembridge 47`.

Matches held anywhere else appear with their current location; click **Add** and
that edition moves here, dated from the **In gallery from** date (today unless
you change it), marked printed, and counted as confirmed.

This moves the existing edition record rather than creating a new one, because
every edition in a run already exists in the catalogue. Editions already at this
gallery, sold ones and legacy-unknown rows don't appear as matches.

## Tips

- **Work systematically**: walk the gallery wall-by-wall, confirming as you go
- **Use your phone**: the large boxes are designed for easy tapping on mobile
- **Unconfirmed is not an accusation**: it only means nobody has ticked it yet.
  Use **Not here** for the ones that are genuinely missing.
- **Every change is live**: there is no draft state — a tap writes to the real
  inventory immediately
