# Issue: Dashboard Overview Page Needs Client-Side Cache

## Status
Complete - implemented 2024-12-20

## Description
The dashboard overview page currently shows placeholder/loading state. It needs to be wired up to display real stats once the Zustand client-side cache is implemented.

## Requirements
Once the cache is built (see `planning/PRP-client-side-cache.md`), the dashboard should show:

### Collection Overview Stats
- Total editions count
- Printed editions count
- Sold editions count (with sell-through % = sold/printed)
- Total revenue
- Unsettled amount (net after commission)
- Unsettled sales count

### Performance Stats (time-based)
- Year to Date: sales count + revenue
- Last full year: sales count + revenue
- Last 30 days: sales count + revenue
- Last 12 months: sales count + revenue

### Gallery Locations
- Sorted by current stock (highest first)
- Show: stock count, commission %, sales last 30d, sales last 12m
- Unsettled badge if applicable
- Filter out galleries with no stock and no sales history

## Implementation Notes
- Use memoized selectors from Zustand store
- All calculations derived from cached editions data
- Single source of truth - no server-side duplication

## Related Files
- `web/src/app/(dashboard)/page.tsx` - placeholder currently
- `planning/PRP-client-side-cache.md` - cache implementation plan

## Implementation Notes
All requirements implemented in `web/src/app/(dashboard)/page.tsx`:
- Collection overview stats with unsettled count
- Performance stats (YTD, last year, 30d, 12m)
- Enhanced gallery locations with commission %, time-based sales, unsettled badge
- Galleries filtered to only show those with stock or sales history
