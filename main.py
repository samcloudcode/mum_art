#!/usr/bin/env python
"""
Main CLI for Art Database Management System.

This tool manages PostgreSQL database operations separately from Airtable imports,
allowing for gradual transition from Airtable to PostgreSQL.
"""

import sys
import argparse
from pathlib import Path

from db import DatabaseManager
from cleaning import AirtableDataCleaner
from sync import SmartImporter


def cmd_db_create(args):
    """Create database tables."""
    db = DatabaseManager()
    if db.check_connection():
        db.create_tables()
        stats = db.get_table_stats()
        print(f"\nDatabase stats: {stats}")


def cmd_db_reset(args):
    """Reset database (caution!)."""
    db = DatabaseManager()
    if db.check_connection():
        db.reset_database(force=getattr(args, 'force', False))


def cmd_db_stats(args):
    """Show database statistics."""
    db = DatabaseManager()
    if db.check_connection():
        stats = db.get_detailed_stats()
        print("\n📊 Database Statistics:")
        print(f"   Prints: {stats['prints']}")
        print(f"   Distributors: {stats['distributors']}")
        print(f"   Editions Total: {stats['editions']}")
        print(f"   Editions Sold: {stats['editions_sold']} ({stats['editions_sold']*100//max(stats['editions'], 1)}%)")
        print(f"   Editions Unsold: {stats['editions_unsold']}")
        print(f"   Total Revenue: £{stats.get('total_revenue', 0):,.2f}")

        if stats.get('last_sync'):
            print(f"\n🔄 Last Sync:")
            print(f"   Date: {stats['last_sync']['date']}")
            print(f"   Type: {stats['last_sync']['type']}")
            print(f"   Status: {stats['last_sync']['status']}")


def cmd_sync(args):
    """Sync data from Airtable CSV exports."""
    print("Starting sync command...", flush=True)
    # Check CSV files exist - using clean versions without calculated fields
    csv_dir = Path('airtable_export')
    prints_csv = csv_dir / 'Prints-Grid view.csv'  # No clean version for prints
    dist_csv = csv_dir / 'Distributors-Grid view clean.csv'  # Use clean version
    editions_csv = csv_dir / 'Editions-All Records clean.csv'  # Use clean version

    for csv_file in [prints_csv, dist_csv, editions_csv]:
        if not csv_file.exists():
            print(f"❌ Missing CSV file: {csv_file}")
            return

    print("Initializing database...", flush=True)
    # Initialize components
    db = DatabaseManager()
    if not db.check_connection():
        return

    print("Creating cleaner and importer...", flush=True)
    cleaner = AirtableDataCleaner()
    importer = SmartImporter(db, cleaner)
    print("Ready to sync...", flush=True)

    # Run sync
    results = importer.sync_from_csvs(
        prints_csv=str(prints_csv),
        distributors_csv=str(dist_csv),
        editions_csv=str(editions_csv),
        mode=args.mode
    )

    # Show results
    print(f"\n📋 Sync Results (ID: {results['sync_id'][:8]}...):")
    print(f"   Prints: {results['prints']}")
    print(f"   Distributors: {results['distributors']}")
    print(f"   Editions: {results['editions']}")

    # Validate
    if args.validate:
        validation = importer.validate_import()
        if validation['issues']:
            print(f"\n⚠️ Validation Issues:")
            for issue in validation['issues']:
                print(f"   - {issue}")
        if validation['warnings']:
            print(f"\n📝 Warnings:")
            for warning in validation['warnings']:
                print(f"   - {warning}")
        if validation['valid']:
            print(f"\n✅ Validation passed!")


def cmd_validate(args):
    """Validate database integrity."""
    db = DatabaseManager()
    if not db.check_connection():
        return

    cleaner = AirtableDataCleaner()
    importer = SmartImporter(db, cleaner)

    validation = importer.validate_import()

    print("\n🔍 Database Validation:")
    if validation['issues']:
        print(f"\n❌ Issues Found:")
        for issue in validation['issues']:
            print(f"   - {issue}")
    if validation['warnings']:
        print(f"\n⚠️ Warnings:")
        for warning in validation['warnings']:
            print(f"   - {warning}")

    if validation['valid']:
        print(f"\n✅ Database validation passed!")
    else:
        print(f"\n❌ Database has integrity issues that need fixing")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Art Database Management System',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create database tables
  %(prog)s db create

  # Show database statistics
  %(prog)s db stats

  # Sync from Airtable (incremental)
  %(prog)s sync

  # Full sync from Airtable (replace all)
  %(prog)s sync --mode full

  # Validate database integrity
  %(prog)s validate
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Database management commands
    db_parser = subparsers.add_parser('db', help='Database management')
    db_subparsers = db_parser.add_subparsers(dest='db_command')

    db_create = db_subparsers.add_parser('create', help='Create database tables')
    db_create.set_defaults(func=cmd_db_create)

    db_reset = db_subparsers.add_parser('reset', help='Reset database (WARNING: deletes all data)')
    db_reset.add_argument('--force', action='store_true', help='Skip confirmation prompt')
    db_reset.set_defaults(func=cmd_db_reset)

    db_stats = db_subparsers.add_parser('stats', help='Show database statistics')
    db_stats.set_defaults(func=cmd_db_stats)

    # Sync command
    sync_parser = subparsers.add_parser('sync', help='Sync from Airtable CSV exports')
    sync_parser.add_argument(
        '--mode',
        choices=['incremental', 'full', 'merge'],
        default='incremental',
        help='Sync mode (default: incremental)'
    )
    sync_parser.add_argument(
        '--validate',
        action='store_true',
        help='Validate after sync'
    )
    sync_parser.set_defaults(func=cmd_sync)

    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate database integrity')
    validate_parser.set_defaults(func=cmd_validate)

    # Parse and execute
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == 'db' and not args.db_command:
        db_parser.print_help()
        sys.exit(1)

    # Execute command
    if hasattr(args, 'func'):
        args.func(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()