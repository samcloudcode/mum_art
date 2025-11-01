# TODO: Database Optimization - Single Source of Truth

## Remove Calculated/Redundant Fields

### Distributor Table
These fields should be calculated from Edition records, not stored:
- [ ] `net_revenue` - Calculate from SUM of editions where is_sold=true
- [ ] `distributor_revenue` - Calculate from commissions on sold editions
- [ ] `retail_amount_sold` - Calculate from SUM of retail_price where is_sold=true
- [ ] `net_revenue_unpaid` - Calculate from editions where is_sold=true AND is_settled=false
- [ ] `net_revenue_unpaid_by_invoice_month` - Calculate with GROUP BY month_sold

### Edition Table
These fields are redundant or can be derived:
- [ ] `commission_amount` - Calculate from retail_price * commission_percentage
- [ ] `invoice_amount` - Redundant with retail_price minus commission?
- [ ] `month_sold` - Can be extracted from date_sold
- [ ] `year_sold` - Can be extracted from date_sold
- [ ] `weeks_in_gallery` - Calculate from date_in_gallery and (date_sold OR current_date)
- [ ] `edition_display_name` - Can be generated from print.name + edition_number

### Print Table
- [ ] `total_editions` - Calculate from COUNT of related editions

## Implementation Steps

1. **Create Database Views**
   - [ ] Create view for distributor financials (calculate revenues from editions)
   - [ ] Create view for print statistics (count editions, sold count, etc.)
   - [ ] Create view for edition calculated fields

2. **Add Model Properties/Methods**
   - [ ] Add @property methods to SQLAlchemy models for calculated fields
   - [ ] Example: `distributor.net_revenue` as a property that queries editions

3. **Update Import Process**
   - [ ] Stop importing calculated fields from CSVs
   - [ ] Only import raw data, let database/app calculate derived values

4. **Migration Script**
   - [ ] Create migration to drop redundant columns
   - [ ] Backup current data first
   - [ ] Test views work correctly before dropping columns

## Benefits
- Single source of truth (no data inconsistency)
- Smaller database size
- Always up-to-date calculations
- Easier to maintain
- No sync issues between calculated fields

## Example SQL Views

```sql
-- Distributor revenue view
CREATE VIEW distributor_stats AS
SELECT
    d.id,
    d.name,
    COUNT(e.id) as total_editions,
    SUM(CASE WHEN e.is_sold THEN 1 ELSE 0 END) as sold_count,
    SUM(CASE WHEN e.is_sold THEN e.retail_price ELSE 0 END) as retail_amount_sold,
    SUM(CASE WHEN e.is_sold THEN e.retail_price * (1 - COALESCE(e.commission_percentage, d.commission_percentage, 0) / 100) ELSE 0 END) as net_revenue,
    SUM(CASE WHEN e.is_sold THEN e.retail_price * (COALESCE(e.commission_percentage, d.commission_percentage, 0) / 100) ELSE 0 END) as distributor_revenue
FROM distributors d
LEFT JOIN editions e ON e.distributor_id = d.id
GROUP BY d.id, d.name;

-- Print statistics view
CREATE VIEW print_stats AS
SELECT
    p.id,
    p.name,
    COUNT(e.id) as total_editions,
    SUM(CASE WHEN e.is_sold THEN 1 ELSE 0 END) as sold_count,
    SUM(CASE WHEN e.is_sold THEN e.retail_price ELSE 0 END) as revenue
FROM prints p
LEFT JOIN editions e ON e.print_id = p.id
GROUP BY p.id, p.name;
```