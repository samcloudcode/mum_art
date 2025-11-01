# Retool Audit Log Dashboard Setup Guide

## Overview
This guide helps you create a comprehensive audit trail viewer in Retool using the PostgreSQL audit system.

## Recommended Layout

### 1. Main Dashboard Structure

```
┌─────────────────────────────────────────────────────┐
│  Header: Audit Trail / Change Log                   │
│  ┌────────┬────────┬────────┬────────┬──────────┐ │
│  │ Today  │ Week   │ Month  │ Users  │ Last     │ │
│  │ 15     │ 142    │ 580    │ 3      │ 2min ago │ │
│  └────────┴────────┴────────┴────────┴──────────┘ │
├─────────────────────────────────────────────────────┤
│  Filters:                                           │
│  [Days Back: 7 ▼] [Table: All ▼] [User: All ▼]    │
├─────────────────────────────────────────────────────┤
│  Recent Changes Table (Main View)                   │
│  ┌─────┬──────┬────────┬──────┬─────────┬────────┐│
│  │Time │Table │Record  │Action│User     │Fields  ││
│  ├─────┼──────┼────────┼──────┼─────────┼────────┤│
│  │2:30 │edit. │Bemb #5 │UPDATE│retool   │price   ││
│  │2:25 │print │Needles │UPDATE│john     │name    ││
│  │1:15 │dist. │Kendalls│UPDATE│retool   │commis. ││
│  └─────┴──────┴────────┴──────┴─────────┴────────┘│
├─────────────────────────────────────────────────────┤
│  Selected Change Details:                           │
│  ┌─────────────────┬───────────────────────────┐   │
│  │ Field           │ Before → After            │   │
│  ├─────────────────┼───────────────────────────┤   │
│  │ retail_price    │ 150.00 → 175.00          │   │
│  │ updated_at      │ 2024-01-01 → 2024-01-15  │   │
│  └─────────────────┴───────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Component Setup

### 1. Statistics Header (Query #11)
Create 5 statistic components with:

```javascript
// Component: stat1 (Changes Today)
Query: SELECT * FROM (Query #11)
Primary Value: {{query11.data.changes_today[0]}}
Label: Changes Today

// Component: stat2 (This Week)
Primary Value: {{query11.data.changes_week[0]}}
Label: This Week

// Component: stat3 (This Month)
Primary Value: {{query11.data.changes_month[0]}}
Label: This Month

// Component: stat4 (Active Users)
Primary Value: {{query11.data.active_users[0]}}
Label: Active Users

// Component: stat5 (Last Change)
Primary Value: {{moment(query11.data.last_change[0]).fromNow()}}
Label: Last Change
```

### 2. Filter Controls

```javascript
// Days Back Selector
Component Type: Select
Options:
  - { label: "Last 24 Hours", value: 1 }
  - { label: "Last 7 Days", value: 7 }
  - { label: "Last 30 Days", value: 30 }
  - { label: "Last 90 Days", value: 90 }
Default: 7
Variable Name: days_back

// Table Filter
Component Type: Select
Options:
  - { label: "All Tables", value: "all" }
  - { label: "Editions", value: "editions" }
  - { label: "Prints", value: "prints" }
  - { label: "Distributors", value: "distributors" }
Variable Name: table_filter

// User Filter
Component Type: Select
Query: SELECT DISTINCT changed_by FROM audit_log
Options: {{query.data.map(r => r.changed_by)}}
Variable Name: user_filter
```

### 3. Main Changes Table (Query #1)

```javascript
// Component: table1
Query: Use Query #1 with {{days_back.value}} parameter
Columns:
  - changed_at (format: "MM/DD HH:mm")
  - table_name (with icon/color)
  - record_name
  - action (with color badge)
  - changed_by
  - fields_changed

// Add row color based on action
Row Color:
{{currentRow.action_color}}

// Make rows clickable
Event Handler: Row Click -> Set selectedChange.value = currentRow
```

### 4. Change Details Panel (Query #3)

```javascript
// Component: table2 (Field Comparison)
Hidden: {{!table1.selectedRow}}
Query: Use Query #3 with {{table1.selectedRow.id}}

Columns:
  - field_name (label: "Field")
  - before (label: "Before", color: red)
  - after (label: "After", color: green)

// Add highlighting for changed values
Column Colors:
  before: "#ffebee"
  after: "#e8f5e9"
```

### 5. Activity Chart (Query #4)

```javascript
// Component: chart1
Chart Type: Line/Bar Chart
Query: Use Query #4
X-axis: date
Y-axis: [inserts, updates, deletes]
Title: "Change Activity Over Time"
```

## Advanced Features

### 1. Deleted Items Recovery Panel

```javascript
// Add a modal for viewing deleted items
// Component: deletedItemsModal
Query: Use Query #9

// Add Restore button (if you implement restore functionality)
Button: "View Deleted Data"
OnClick: Show JSON modal with old_values
```

### 2. Price Change Tracker

```javascript
// Separate tab or panel for price changes
Query: Use Query #10
Show: Table with price changes and percentage changes
Highlight: Large changes (>10%) in red/green
```

### 3. Audit Search

```javascript
// Add search input
Component: textInput1
Placeholder: "Search changes..."

// Modify main query WHERE clause:
WHERE (
  al.table_name ILIKE '%{{textInput1.value}}%'
  OR al.changed_by ILIKE '%{{textInput1.value}}%'
  OR al.record_id::text = '{{textInput1.value}}'
  OR array_to_string(al.changed_fields, ' ') ILIKE '%{{textInput1.value}}%'
)
```

## Permissions & Security

### Read-Only View
For most users, create a read-only view:
```sql
-- Create read-only user for Retool
CREATE USER retool_readonly WITH PASSWORD 'your_password';
GRANT SELECT ON audit_log TO retool_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO retool_readonly;
```

### Admin Functions
For admins, add buttons for:
- Export audit log to CSV
- Clear old logs (with confirmation)
- Generate audit reports

## Color Coding Scheme

```javascript
// Action Colors
INSERT: '#4CAF50' (green)
UPDATE: '#2196F3' (blue)
DELETE: '#f44336' (red)

// Table Colors
editions: '#9C27B0' (purple)
prints: '#FF9800' (orange)
distributors: '#00BCD4' (cyan)
```

## Performance Tips

1. **Use pagination** for the main table (limit to 50-100 rows)
2. **Index frequently searched fields** in your queries
3. **Cache statistics** that don't need real-time updates
4. **Use server-side filtering** rather than client-side
5. **Implement lazy loading** for detail views

## Sample Retool Resource Setup

```sql
-- Name: getAuditLog
-- Type: PostgreSQL Query
SELECT
    al.id,
    al.table_name,
    al.record_id,
    al.action,
    al.changed_at,
    al.changed_by,
    al.changed_fields,
    CASE
        WHEN al.table_name = 'editions' THEN e.edition_display_name
        WHEN al.table_name = 'prints' THEN p.name
        WHEN al.table_name = 'distributors' THEN d.name
    END AS record_name
FROM audit_log al
LEFT JOIN editions e ON al.table_name = 'editions' AND al.record_id = e.id
LEFT JOIN prints p ON al.table_name = 'prints' AND al.record_id = p.id
LEFT JOIN distributors d ON al.table_name = 'distributors' AND al.record_id = d.id
WHERE changed_at > NOW() - INTERVAL '{{days_back}} days'
  {{table_filter.value !== 'all' ? "AND table_name = '" + table_filter.value + "'" : ""}}
  {{user_filter.value !== 'all' ? "AND changed_by = '" + user_filter.value + "'" : ""}}
ORDER BY changed_at DESC
LIMIT 100;
```

## Notification System (Optional)

Add real-time notifications for critical changes:

```javascript
// Check for recent deletes
const recentDeletes = query9.data.filter(
  r => moment(r.changed_at).isAfter(moment().subtract(1, 'hour'))
);

if (recentDeletes.length > 0) {
  utils.showNotification({
    title: "Items Deleted",
    description: `${recentDeletes.length} items deleted in the last hour`,
    notificationType: "warning"
  });
}
```