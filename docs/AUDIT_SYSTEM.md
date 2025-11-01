# Audit System Documentation

## Overview
A comprehensive change tracking system has been implemented in PostgreSQL to maintain a complete audit trail of all database modifications.

## Features

### ✅ Automatic Change Tracking
- **Tables Monitored**: `editions`, `prints`, `distributors`
- **Operations Tracked**: INSERT, UPDATE, DELETE
- **Data Captured**:
  - Table name and record ID
  - Action type (INSERT/UPDATE/DELETE)
  - Timestamp of change
  - User who made the change
  - Old values (for UPDATE/DELETE)
  - New values (for INSERT/UPDATE)
  - List of changed fields (for UPDATE)
  - Session information (IP, port, backend PID)

### 📊 Audit Log Table Structure
```sql
audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    record_id INTEGER,
    action VARCHAR(10),
    changed_at TIMESTAMP,
    changed_by VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    session_info JSONB
)
```

## Usage

### Command Line Interface

```bash
# View recent changes (last 24 hours)
uv run python audit_viewer.py recent

# View last 48 hours of changes
uv run python audit_viewer.py recent -H 48

# View history of a specific record
uv run python audit_viewer.py history editions 123

# Track changes to a specific field
uv run python audit_viewer.py field editions retail_price

# View summary of changes
uv run python audit_viewer.py summary -d 7

# View deleted records
uv run python audit_viewer.py deletions -d 30
```

### SQL Query Examples

#### View Recent Changes
```sql
-- Last 24 hours of changes
SELECT * FROM get_recent_changes(24);

-- All changes in the last week
SELECT
    table_name,
    record_id,
    action,
    changed_at,
    changed_by,
    changed_fields
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '7 days'
ORDER BY changed_at DESC;
```

#### Track Specific Record
```sql
-- Get complete history of edition #123
SELECT * FROM get_record_history('editions', 123);

-- See what fields were changed
SELECT
    changed_at,
    changed_fields,
    old_values,
    new_values
FROM audit_log
WHERE table_name = 'editions'
  AND record_id = 123
ORDER BY changed_at DESC;
```

#### Track Field Changes
```sql
-- Track all price changes
SELECT * FROM get_field_changes('editions', 'retail_price');

-- Find who changed prices and when
SELECT
    record_id,
    changed_at,
    changed_by,
    old_values->>'retail_price' as old_price,
    new_values->>'retail_price' as new_price
FROM audit_log
WHERE table_name = 'editions'
  AND 'retail_price' = ANY(changed_fields)
ORDER BY changed_at DESC;
```

#### Restore Deleted Data
```sql
-- Find deleted record
SELECT old_values
FROM audit_log
WHERE table_name = 'editions'
  AND action = 'DELETE'
  AND record_id = 123;

-- Use the JSON data to restore if needed
```

## Built-in Functions

### `get_record_history(table_name, record_id)`
Returns complete change history for a specific record.

### `get_recent_changes(hours)`
Returns all changes within the specified number of hours.

### `get_field_changes(table_name, field_name)`
Tracks all changes to a specific field across all records.

## Views

### `recent_audit_summary`
Provides a daily summary of changes by table and action type for the last 7 days.

```sql
SELECT * FROM recent_audit_summary;
```

## Performance Considerations

- Indexed on `(table_name, record_id)` for fast record lookups
- Indexed on `changed_at` for time-based queries
- Indexed on `action` for filtering by operation type
- Only logs actual changes (UPDATE triggers check for differences)

## Security Benefits

1. **Accountability**: Track who made what changes and when
2. **Recovery**: Restore accidentally deleted or modified data
3. **Compliance**: Maintain audit trail for regulatory requirements
4. **Debugging**: Investigate data issues and understand change patterns
5. **Monitoring**: Detect unusual activity or unauthorized changes

## Maintenance

The audit log table will grow over time. Consider:

1. **Archiving**: Move old audit entries to archive tables periodically
2. **Retention Policy**: Delete audit logs older than X months/years
3. **Partitioning**: Use table partitioning for very large audit logs

Example cleanup (remove logs older than 1 year):
```sql
DELETE FROM audit_log
WHERE changed_at < NOW() - INTERVAL '1 year';
```

## Adding More Tables to Audit

To add audit tracking to additional tables:

```sql
CREATE TRIGGER audit_trigger_[table_name]
AFTER INSERT OR UPDATE OR DELETE ON [table_name]
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

## Disabling Audit Temporarily

If needed for bulk operations:

```sql
-- Disable
ALTER TABLE editions DISABLE TRIGGER audit_trigger_editions;

-- Re-enable
ALTER TABLE editions ENABLE TRIGGER audit_trigger_editions;
```