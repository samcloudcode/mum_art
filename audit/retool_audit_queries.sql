-- =====================================================
-- RETOOL AUDIT/CHANGE LOG QUERIES
-- =====================================================
-- Copy these queries into your Retool resources

-- 1. RECENT CHANGES TABLE
-- Main view for displaying recent activity
-- Use this for a table component showing latest changes
SELECT
    al.id,
    al.table_name,
    al.record_id,
    al.action,
    al.changed_at,
    al.changed_by,
    al.changed_fields,
    -- Add human-readable description
    CASE
        WHEN al.table_name = 'editions' THEN
            COALESCE(e.edition_display_name, 'Edition #' || al.record_id)
        WHEN al.table_name = 'prints' THEN
            COALESCE(p.name, 'Print #' || al.record_id)
        WHEN al.table_name = 'distributors' THEN
            COALESCE(d.name, 'Distributor #' || al.record_id)
        ELSE al.table_name || ' #' || al.record_id
    END AS record_name,
    -- Add action color coding
    CASE al.action
        WHEN 'INSERT' THEN 'green'
        WHEN 'UPDATE' THEN 'blue'
        WHEN 'DELETE' THEN 'red'
    END AS action_color,
    -- Format changed fields for display
    CASE
        WHEN al.changed_fields IS NOT NULL THEN
            array_to_string(al.changed_fields, ', ')
        ELSE '-'
    END AS fields_changed
FROM audit_log al
LEFT JOIN editions e ON al.table_name = 'editions' AND al.record_id = e.id
LEFT JOIN prints p ON al.table_name = 'prints' AND al.record_id = p.id
LEFT JOIN distributors d ON al.table_name = 'distributors' AND al.record_id = d.id
WHERE al.changed_at > NOW() - INTERVAL '{{days_back || 7}} days'
ORDER BY al.changed_at DESC
LIMIT {{limit || 100}};


-- 2. CHANGE DETAILS VIEW
-- For displaying details when user clicks on a change
-- Use with {{table1.selectedRow.data.id}}
SELECT
    al.*,
    -- Format old and new values for display
    CASE
        WHEN al.old_values IS NOT NULL THEN
            jsonb_pretty(al.old_values)
        ELSE NULL
    END AS old_values_formatted,
    CASE
        WHEN al.new_values IS NOT NULL THEN
            jsonb_pretty(al.new_values)
        ELSE NULL
    END AS new_values_formatted
FROM audit_log al
WHERE al.id = {{audit_log_id}};


-- 3. FIELD CHANGES COMPARISON
-- Shows before/after for specific fields
-- Great for a comparison component
WITH change_details AS (
    SELECT
        al.id,
        al.changed_at,
        al.changed_by,
        field,
        al.old_values->field AS old_value,
        al.new_values->field AS new_value
    FROM audit_log al,
    LATERAL unnest(al.changed_fields) AS field
    WHERE al.id = {{audit_log_id}}
        AND al.action = 'UPDATE'
)
SELECT
    field AS field_name,
    COALESCE(old_value::text, 'NULL') AS before,
    COALESCE(new_value::text, 'NULL') AS after,
    CASE
        WHEN old_value != new_value THEN true
        ELSE false
    END AS changed
FROM change_details
ORDER BY field;


-- 4. DAILY ACTIVITY CHART
-- For a bar/line chart showing activity over time
SELECT
    DATE(changed_at) AS date,
    COUNT(*) AS total_changes,
    COUNT(*) FILTER (WHERE action = 'INSERT') AS inserts,
    COUNT(*) FILTER (WHERE action = 'UPDATE') AS updates,
    COUNT(*) FILTER (WHERE action = 'DELETE') AS deletes
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '{{days || 30}} days'
GROUP BY DATE(changed_at)
ORDER BY date DESC;


-- 5. CHANGES BY TABLE
-- For a pie chart or stats component
SELECT
    table_name,
    COUNT(*) AS change_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS percentage
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '{{days || 7}} days'
GROUP BY table_name
ORDER BY change_count DESC;


-- 6. CHANGES BY USER
-- Shows who's making changes
SELECT
    changed_by AS user_name,
    COUNT(*) AS total_changes,
    COUNT(DISTINCT DATE(changed_at)) AS active_days,
    MAX(changed_at) AS last_activity
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '{{days || 30}} days'
GROUP BY changed_by
ORDER BY total_changes DESC;


-- 7. RECORD HISTORY
-- Complete history for a specific record
-- Use with dropdown selects for table_name and record_id
SELECT
    al.id,
    al.action,
    al.changed_at,
    al.changed_by,
    CASE
        WHEN al.changed_fields IS NOT NULL THEN
            array_to_string(al.changed_fields, ', ')
        ELSE '-'
    END AS fields_changed,
    al.old_values,
    al.new_values
FROM audit_log al
WHERE al.table_name = {{table_name}}
    AND al.record_id = {{record_id}}
ORDER BY al.changed_at DESC;


-- 8. MOST FREQUENTLY CHANGED RECORDS
-- Identifies records that change often (might indicate issues)
SELECT
    table_name,
    record_id,
    COUNT(*) AS change_count,
    MAX(changed_at) AS last_changed,
    array_agg(DISTINCT changed_by) AS changed_by_users
FROM audit_log
WHERE changed_at > NOW() - INTERVAL '{{days || 30}} days'
GROUP BY table_name, record_id
HAVING COUNT(*) > 1
ORDER BY change_count DESC
LIMIT 20;


-- 9. DELETED RECORDS
-- Shows what was deleted (for potential recovery)
SELECT
    al.id,
    al.table_name,
    al.record_id,
    al.changed_at,
    al.changed_by,
    -- Extract key fields from deleted data
    CASE
        WHEN al.table_name = 'editions' THEN
            al.old_values->>'edition_display_name'
        WHEN al.table_name = 'prints' THEN
            al.old_values->>'name'
        WHEN al.table_name = 'distributors' THEN
            al.old_values->>'name'
    END AS deleted_item_name,
    al.old_values
FROM audit_log al
WHERE al.action = 'DELETE'
    AND al.changed_at > NOW() - INTERVAL '{{days || 30}} days'
ORDER BY al.changed_at DESC;


-- 10. PRICE CHANGE HISTORY
-- Specific view for tracking price changes
SELECT
    al.record_id AS edition_id,
    e.edition_display_name,
    al.changed_at,
    al.changed_by,
    (al.old_values->>'retail_price')::numeric AS old_price,
    (al.new_values->>'retail_price')::numeric AS new_price,
    ROUND(
        ((al.new_values->>'retail_price')::numeric -
         (al.old_values->>'retail_price')::numeric), 2
    ) AS price_change,
    ROUND(
        ((al.new_values->>'retail_price')::numeric -
         (al.old_values->>'retail_price')::numeric) * 100.0 /
        NULLIF((al.old_values->>'retail_price')::numeric, 0), 1
    ) AS percent_change
FROM audit_log al
LEFT JOIN editions e ON al.record_id = e.id
WHERE al.table_name = 'editions'
    AND 'retail_price' = ANY(al.changed_fields)
    AND al.changed_at > NOW() - INTERVAL '{{days || 90}} days'
ORDER BY al.changed_at DESC;


-- 11. AUDIT STATS FOR HEADER
-- Use for statistic components
SELECT
    COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '24 hours') AS changes_today,
    COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '7 days') AS changes_week,
    COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '30 days') AS changes_month,
    COUNT(DISTINCT changed_by) FILTER (WHERE changed_at > NOW() - INTERVAL '7 days') AS active_users,
    MAX(changed_at) AS last_change
FROM audit_log;