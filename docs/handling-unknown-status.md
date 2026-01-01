# Handling Artwork with Unknown Status

Sometimes you have older pieces where you're not sure if they were sold, where they ended up, or what happened to them. Rather than guessing or cluttering your active inventory, you can mark these as "legacy unknown."

## What Happens to Unknown Items

When an edition is marked as legacy unknown:

- **Dashboard stats stay accurate** — unknown items don't inflate your sold count or revenue figures
- **Edition lists stay clean** — you only see pieces you're actively tracking
- **Nothing is deleted** — the data is preserved and can be viewed anytime

## Viewing Hidden Legacy Items

On the Editions page, you'll see a checkbox:

```
☐ Show legacy items (12 hidden)
```

Check this box to reveal all legacy editions. They'll display with an amber "Unknown" badge so you can easily spot them.

## When to Mark Something as Unknown

Consider marking editions as legacy unknown when:

- You inherited records from an old system with gaps
- A gallery closed and you lost track of consigned pieces
- You're unsure if something was sold or returned years ago
- Records exist but you can't verify their accuracy

## Recovering Unknown Items

If you later find out what happened to a piece:

1. Find the edition (use "Show legacy items" toggle)
2. Update its status (sold, location, etc.)
3. The system will automatically include it in your active inventory again

## Bulk Updates

To mark many editions as unknown at once, contact your administrator or use the Supabase dashboard to run:

```sql
UPDATE editions
SET status_confidence = 'legacy_unknown'
WHERE <your conditions>;
```

---

This approach keeps your working inventory clean while preserving historical data for when you need it.
