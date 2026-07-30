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
carries over between visits. Nothing clears it in bulk.

### Unconfirmed and Confirmed
Unconfirmed comes first: recorded at this gallery, not yet seen. Confirmed is
collapsed by default; open it to review or undo a confirmation. Within each,
editions are grouped by artwork name (e.g. all "Bembridge" prints together),
which matches how you'd scan a gallery wall.

### Search
The search bar filters this gallery's stock:
- Type `Bembridge 47` to find edition 47 of Bembridge
- Or just type `Bembridge` to see all Bembridge editions

## Working through the stock

### Confirm an item
Tap the large box next to an edition when you physically see it. It turns green
and moves to Confirmed. Tap it again to undo.

### Confirm a whole artwork
If you've seen every edition of an artwork, click **Confirm all X** in that
group's header.

### It isn't here
Tap **Not here** on an edition that isn't at the gallery. After a confirmation
prompt, its location becomes **Unknown**, its in-gallery date is cleared, and it
leaves this gallery's stock — so it stops counting as being here while you work
out where it went. It stays findable by searching for the artwork on the
Editions page.

### Add stock
Type an artwork and edition number into **Add stock to <gallery>** — e.g.
`Bembridge 47`. Matches held anywhere else appear with their current location;
click **Add** and that edition moves here, dated from the **In gallery from**
date (today unless you change it), marked printed, and counted as confirmed.

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
