#!/usr/bin/env python3
"""View and query audit logs from the command line."""

import os
import sys
import json
from datetime import datetime, timedelta
import argparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.manager import DatabaseManager
from sqlalchemy import text

class AuditViewer:
    """Query and display audit logs."""

    def __init__(self):
        self.db = DatabaseManager()

    def recent_changes(self, hours=24):
        """Show recent changes."""
        with self.db.get_session() as session:
            results = session.execute(text("""
                SELECT * FROM get_recent_changes(:hours)
                LIMIT 100;
            """), {"hours": hours}).fetchall()

            if not results:
                print(f"No changes in the last {hours} hours.")
                return

            print(f"\n📋 RECENT CHANGES (last {hours} hours)")
            print("="*80)

            for row in results:
                changed_fields = ', '.join(row.changed_fields) if row.changed_fields else 'N/A'
                print(f"\n{row.changed_at.strftime('%Y-%m-%d %H:%M:%S')} - {row.action}")
                print(f"  Table: {row.table_name}, Record ID: {row.record_id}")
                print(f"  Changed by: {row.changed_by}")
                if row.changed_fields:
                    print(f"  Changed fields: {changed_fields}")

    def record_history(self, table_name, record_id):
        """Show history for a specific record."""
        with self.db.get_session() as session:
            results = session.execute(text("""
                SELECT * FROM get_record_history(:table_name, :record_id);
            """), {"table_name": table_name, "record_id": record_id}).fetchall()

            if not results:
                print(f"No history found for {table_name} record #{record_id}")
                return

            print(f"\n📜 HISTORY: {table_name} record #{record_id}")
            print("="*80)

            for row in results:
                print(f"\n{row.changed_at.strftime('%Y-%m-%d %H:%M:%S')} - {row.action}")
                print(f"  Changed by: {row.changed_by}")

                if row.changed_fields:
                    print(f"  Changed fields: {', '.join(row.changed_fields)}")

                    # Show before/after values for updates
                    if row.action == 'UPDATE' and row.old_value and row.new_value:
                        print("  Changes:")
                        for field in row.changed_fields:
                            old_val = row.old_value.get(field)
                            new_val = row.new_value.get(field)
                            print(f"    • {field}: {old_val} → {new_val}")

    def field_changes(self, table_name, field_name):
        """Track changes to a specific field."""
        with self.db.get_session() as session:
            results = session.execute(text("""
                SELECT * FROM get_field_changes(:table_name, :field_name)
                LIMIT 100;
            """), {"table_name": table_name, "field_name": field_name}).fetchall()

            if not results:
                print(f"No changes found for {table_name}.{field_name}")
                return

            print(f"\n🔍 FIELD CHANGES: {table_name}.{field_name}")
            print("="*80)

            for row in results:
                print(f"\n{row.changed_at.strftime('%Y-%m-%d %H:%M:%S')} - Record #{row.record_id}")
                print(f"  {row.old_value} → {row.new_value}")
                print(f"  Changed by: {row.changed_by}")

    def summary(self, days=7):
        """Show summary of changes."""
        with self.db.get_session() as session:
            # Get summary stats
            results = session.execute(text("""
                SELECT
                    table_name,
                    action,
                    COUNT(*) as count
                FROM audit_log
                WHERE changed_at > NOW() - INTERVAL ':days days'
                GROUP BY table_name, action
                ORDER BY table_name, action;
            """), {"days": days}).fetchall()

            if not results:
                print(f"No changes in the last {days} days.")
                return

            print(f"\n📊 CHANGE SUMMARY (last {days} days)")
            print("="*80)

            current_table = None
            for row in results:
                if current_table != row.table_name:
                    if current_table:
                        print()
                    print(f"\n{row.table_name}:")
                    current_table = row.table_name
                print(f"  {row.action}: {row.count} changes")

            # Get total changes
            total = session.execute(text("""
                SELECT COUNT(*) as total
                FROM audit_log
                WHERE changed_at > NOW() - INTERVAL ':days days';
            """), {"days": days}).scalar()

            print(f"\n{'─'*40}")
            print(f"Total changes: {total}")

    def show_deletions(self, days=30):
        """Show deleted records."""
        with self.db.get_session() as session:
            results = session.execute(text("""
                SELECT
                    table_name,
                    record_id,
                    changed_at,
                    changed_by,
                    old_values
                FROM audit_log
                WHERE action = 'DELETE'
                  AND changed_at > NOW() - INTERVAL ':days days'
                ORDER BY changed_at DESC
                LIMIT 50;
            """), {"days": days}).fetchall()

            if not results:
                print(f"No deletions in the last {days} days.")
                return

            print(f"\n🗑️  DELETED RECORDS (last {days} days)")
            print("="*80)

            for row in results:
                print(f"\n{row.changed_at.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"  Table: {row.table_name}, Record ID: {row.record_id}")
                print(f"  Deleted by: {row.changed_by}")

                # Show some key fields from the deleted record
                if row.old_values:
                    data = json.loads(row.old_values) if isinstance(row.old_values, str) else row.old_values
                    # Show a few key fields
                    key_fields = ['name', 'edition_display_name', 'retail_price', 'is_sold']
                    print("  Deleted data:")
                    for field in key_fields:
                        if field in data:
                            print(f"    • {field}: {data[field]}")

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(description='View database audit logs')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Recent changes command
    recent_parser = subparsers.add_parser('recent', help='Show recent changes')
    recent_parser.add_argument('-H', '--hours', type=int, default=24,
                              help='Number of hours to look back (default: 24)')

    # Record history command
    history_parser = subparsers.add_parser('history', help='Show history for a record')
    history_parser.add_argument('table', help='Table name (editions, prints, distributors)')
    history_parser.add_argument('id', type=int, help='Record ID')

    # Field changes command
    field_parser = subparsers.add_parser('field', help='Track field changes')
    field_parser.add_argument('table', help='Table name')
    field_parser.add_argument('field', help='Field name')

    # Summary command
    summary_parser = subparsers.add_parser('summary', help='Show change summary')
    summary_parser.add_argument('-d', '--days', type=int, default=7,
                               help='Number of days to summarize (default: 7)')

    # Deletions command
    deletions_parser = subparsers.add_parser('deletions', help='Show deleted records')
    deletions_parser.add_argument('-d', '--days', type=int, default=30,
                                  help='Number of days to look back (default: 30)')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    viewer = AuditViewer()

    if args.command == 'recent':
        viewer.recent_changes(args.hours)
    elif args.command == 'history':
        viewer.record_history(args.table, args.id)
    elif args.command == 'field':
        viewer.field_changes(args.table, args.field)
    elif args.command == 'summary':
        viewer.summary(args.days)
    elif args.command == 'deletions':
        viewer.show_deletions(args.days)

if __name__ == "__main__":
    main()