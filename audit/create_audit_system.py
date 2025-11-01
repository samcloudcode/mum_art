#!/usr/bin/env python3
"""Create a comprehensive audit/change log system for PostgreSQL database."""

import os
import sys
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.manager import DatabaseManager
from sqlalchemy import text

def create_audit_system(session):
    """Create audit tables and triggers for change tracking."""

    # 1. Create audit log table
    print("Creating audit log table...")
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY,
            table_name VARCHAR(50) NOT NULL,
            record_id INTEGER NOT NULL,
            action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            changed_by VARCHAR(100) DEFAULT current_user,
            old_values JSONB,
            new_values JSONB,
            changed_fields TEXT[],
            session_info JSONB
        );
    """))

    # Create indexes for performance
    session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
        ON audit_log(table_name, record_id);

        CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
        ON audit_log(changed_at DESC);

        CREATE INDEX IF NOT EXISTS idx_audit_log_action
        ON audit_log(action);
    """))

    print("✅ Audit log table created")

    # 2. Create generic audit trigger function
    print("Creating audit trigger function...")
    session.execute(text("""
        CREATE OR REPLACE FUNCTION audit_trigger_function()
        RETURNS TRIGGER AS $$
        DECLARE
            old_data JSONB;
            new_data JSONB;
            changed_fields TEXT[];
            field TEXT;
        BEGIN
            -- Set session info (can be customized)
            -- You could pass application context here

            IF TG_OP = 'DELETE' THEN
                old_data = to_jsonb(OLD);
                INSERT INTO audit_log (
                    table_name,
                    record_id,
                    action,
                    old_values,
                    session_info
                )
                VALUES (
                    TG_TABLE_NAME,
                    OLD.id,
                    TG_OP,
                    old_data,
                    jsonb_build_object(
                        'client_ip', inet_client_addr(),
                        'client_port', inet_client_port(),
                        'backend_pid', pg_backend_pid()
                    )
                );
                RETURN OLD;

            ELSIF TG_OP = 'INSERT' THEN
                new_data = to_jsonb(NEW);
                INSERT INTO audit_log (
                    table_name,
                    record_id,
                    action,
                    new_values,
                    session_info
                )
                VALUES (
                    TG_TABLE_NAME,
                    NEW.id,
                    TG_OP,
                    new_data,
                    jsonb_build_object(
                        'client_ip', inet_client_addr(),
                        'client_port', inet_client_port(),
                        'backend_pid', pg_backend_pid()
                    )
                );
                RETURN NEW;

            ELSIF TG_OP = 'UPDATE' THEN
                old_data = to_jsonb(OLD);
                new_data = to_jsonb(NEW);

                -- Find changed fields
                changed_fields := ARRAY[]::TEXT[];
                FOR field IN SELECT jsonb_object_keys(old_data) LOOP
                    IF old_data->field IS DISTINCT FROM new_data->field THEN
                        changed_fields := array_append(changed_fields, field);
                    END IF;
                END LOOP;

                -- Only log if there are actual changes
                IF array_length(changed_fields, 1) > 0 THEN
                    INSERT INTO audit_log (
                        table_name,
                        record_id,
                        action,
                        old_values,
                        new_values,
                        changed_fields,
                        session_info
                    )
                    VALUES (
                        TG_TABLE_NAME,
                        NEW.id,
                        TG_OP,
                        old_data,
                        new_data,
                        changed_fields,
                        jsonb_build_object(
                            'client_ip', inet_client_addr(),
                            'client_port', inet_client_port(),
                            'backend_pid', pg_backend_pid()
                        )
                    );
                END IF;
                RETURN NEW;
            END IF;

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """))

    print("✅ Audit trigger function created")

    # 3. Create triggers for each table
    tables_to_audit = ['editions', 'prints', 'distributors']

    for table in tables_to_audit:
        trigger_name = f"audit_trigger_{table}"

        # Drop existing trigger if it exists
        session.execute(text(f"""
            DROP TRIGGER IF EXISTS {trigger_name} ON {table};
        """))

        # Create trigger
        session.execute(text(f"""
            CREATE TRIGGER {trigger_name}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
        """))

        print(f"✅ Audit trigger created for {table}")

    # 4. Create useful audit query functions
    print("Creating audit query functions...")

    # Function to get change history for a specific record
    session.execute(text("""
        CREATE OR REPLACE FUNCTION get_record_history(
            p_table_name VARCHAR,
            p_record_id INTEGER
        )
        RETURNS TABLE (
            action VARCHAR,
            changed_at TIMESTAMP,
            changed_by VARCHAR,
            changed_fields TEXT[],
            old_value JSONB,
            new_value JSONB
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                a.action,
                a.changed_at,
                a.changed_by,
                a.changed_fields,
                a.old_values,
                a.new_values
            FROM audit_log a
            WHERE a.table_name = p_table_name
              AND a.record_id = p_record_id
            ORDER BY a.changed_at DESC;
        END;
        $$ LANGUAGE plpgsql;
    """))

    # Function to get recent changes
    session.execute(text("""
        CREATE OR REPLACE FUNCTION get_recent_changes(
            p_hours INTEGER DEFAULT 24
        )
        RETURNS TABLE (
            table_name VARCHAR,
            record_id INTEGER,
            action VARCHAR,
            changed_at TIMESTAMP,
            changed_by VARCHAR,
            changed_fields TEXT[]
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                a.table_name,
                a.record_id,
                a.action,
                a.changed_at,
                a.changed_by,
                a.changed_fields
            FROM audit_log a
            WHERE a.changed_at > NOW() - INTERVAL '1 hour' * p_hours
            ORDER BY a.changed_at DESC;
        END;
        $$ LANGUAGE plpgsql;
    """))

    # Function to track specific field changes
    session.execute(text("""
        CREATE OR REPLACE FUNCTION get_field_changes(
            p_table_name VARCHAR,
            p_field_name VARCHAR
        )
        RETURNS TABLE (
            record_id INTEGER,
            changed_at TIMESTAMP,
            old_value TEXT,
            new_value TEXT,
            changed_by VARCHAR
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                a.record_id,
                a.changed_at,
                a.old_values->>p_field_name AS old_value,
                a.new_values->>p_field_name AS new_value,
                a.changed_by
            FROM audit_log a
            WHERE a.table_name = p_table_name
              AND p_field_name = ANY(a.changed_fields)
            ORDER BY a.changed_at DESC;
        END;
        $$ LANGUAGE plpgsql;
    """))

    print("✅ Audit query functions created")

    # 5. Create a view for easy access to recent changes
    session.execute(text("""
        CREATE OR REPLACE VIEW recent_audit_summary AS
        SELECT
            table_name,
            action,
            COUNT(*) as change_count,
            DATE(changed_at) as change_date
        FROM audit_log
        WHERE changed_at > NOW() - INTERVAL '7 days'
        GROUP BY table_name, action, DATE(changed_at)
        ORDER BY change_date DESC, table_name;
    """))

    print("✅ Audit summary view created")

    session.commit()

def test_audit_system(session):
    """Test the audit system with some sample changes."""

    print("\n" + "="*60)
    print("TESTING AUDIT SYSTEM")
    print("="*60)

    # Make a test update to trigger audit
    print("\n1. Testing UPDATE trigger...")
    session.execute(text("""
        UPDATE editions
        SET retail_price = retail_price + 0.01
        WHERE id = (SELECT id FROM editions LIMIT 1);
    """))
    session.commit()

    # Check audit log
    result = session.execute(text("""
        SELECT * FROM audit_log
        ORDER BY changed_at DESC
        LIMIT 1;
    """)).fetchone()

    if result:
        print(f"✅ Audit log captured: {result.action} on {result.table_name}")
        print(f"   Changed fields: {result.changed_fields}")

    # Test the history function
    print("\n2. Testing get_record_history function...")
    history = session.execute(text("""
        SELECT * FROM get_record_history('editions', :record_id)
        LIMIT 5;
    """), {"record_id": result.record_id if result else 1}).fetchall()

    print(f"✅ Found {len(history)} history records")

    # Test recent changes function
    print("\n3. Testing get_recent_changes function...")
    recent = session.execute(text("""
        SELECT * FROM get_recent_changes(1)
        LIMIT 5;
    """)).fetchall()

    print(f"✅ Found {len(recent)} recent changes")

    # Show summary
    print("\n4. Audit summary (last 7 days):")
    summary = session.execute(text("""
        SELECT * FROM recent_audit_summary;
    """)).fetchall()

    for row in summary:
        print(f"   {row.change_date}: {row.table_name} - {row.action} ({row.change_count} changes)")

def show_usage_examples():
    """Show how to use the audit system."""

    print("\n" + "="*60)
    print("AUDIT SYSTEM USAGE EXAMPLES")
    print("="*60)

    print("""
1. View all changes to a specific edition:
   SELECT * FROM get_record_history('editions', 123);

2. See all recent changes (last 24 hours):
   SELECT * FROM get_recent_changes(24);

3. Track price changes:
   SELECT * FROM get_field_changes('editions', 'retail_price');

4. Find who changed what and when:
   SELECT
       table_name,
       record_id,
       action,
       changed_by,
       changed_at,
       changed_fields
   FROM audit_log
   WHERE changed_at > NOW() - INTERVAL '7 days'
   ORDER BY changed_at DESC;

5. See summary of changes by table:
   SELECT * FROM recent_audit_summary;

6. Find all deleted records:
   SELECT * FROM audit_log
   WHERE action = 'DELETE'
   ORDER BY changed_at DESC;

7. Restore a deleted record (using the stored JSON):
   -- You can use old_values to restore deleted data
   SELECT old_values FROM audit_log
   WHERE table_name = 'editions'
     AND action = 'DELETE'
     AND record_id = 123;
    """)

def main():
    """Main function to create and test audit system."""
    db = DatabaseManager()

    with db.get_session() as session:
        try:
            # Create the audit system
            create_audit_system(session)

            # Test it
            test_audit_system(session)

            # Show usage examples
            show_usage_examples()

            print("\n" + "="*60)
            print("✅ AUDIT SYSTEM SUCCESSFULLY INSTALLED")
            print("="*60)
            print("\nThe database now tracks all changes to:")
            print("  • editions table")
            print("  • prints table")
            print("  • distributors table")
            print("\nAll INSERT, UPDATE, and DELETE operations are logged.")
            print("Use the provided functions to query the audit history.")

        except Exception as e:
            print(f"\n❌ Error creating audit system: {e}")
            session.rollback()
            raise

if __name__ == "__main__":
    main()