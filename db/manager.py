"""Database manager for PostgreSQL operations."""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

from .models import Base, Print, Distributor, Edition, SyncLog

# Override system env vars with .env file
load_dotenv(override=True)


class DatabaseManager:
    """Manage PostgreSQL database operations independently of imports."""

    def __init__(self, connection_string=None):
        """
        Initialize database manager.

        Args:
            connection_string: PostgreSQL connection string.
                             If None, uses DATABASE_URL from environment.
        """
        self.connection_string = connection_string or os.getenv('DATABASE_URL')
        if not self.connection_string:
            raise ValueError("No database connection string provided. Set DATABASE_URL in .env")

        # Add connection pooling for better performance
        self.engine = create_engine(
            self.connection_string,
            pool_size=10,           # Number of connections to maintain in pool
            max_overflow=20,        # Maximum overflow connections beyond pool_size
            pool_pre_ping=True,     # Test connections before using them
            echo=False              # Disable SQL logging for better performance
        )
        self.SessionLocal = sessionmaker(bind=self.engine)

    def create_tables(self):
        """Create all tables in the database."""
        Base.metadata.create_all(self.engine)
        print("✅ Database tables created successfully")
        return True

    def drop_tables(self, force=False):
        """Drop all tables (use with caution!)."""
        if not force:
            response = input("⚠️ WARNING: This will delete all data! Type 'DROP' to confirm: ")
            if response != 'DROP':
                print("❌ Drop operation cancelled")
                return False
        Base.metadata.drop_all(self.engine)
        print("❌ Database tables dropped")
        return True

    def reset_database(self, force=False):
        """Reset database to clean state."""
        print("🔄 Resetting database...")
        if self.drop_tables(force=force):
            self.create_tables()
            print("✅ Database reset complete")
            return True
        return False

    @contextmanager
    def get_session(self):
        """
        Provide a transactional scope for database operations.

        Usage:
            with db.get_session() as session:
                session.add(new_record)
                # Automatically commits on success, rolls back on error
        """
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_table_stats(self):
        """Get current record counts for all tables."""
        with self.get_session() as session:
            stats = {
                'prints': session.query(Print).count(),
                'distributors': session.query(Distributor).count(),
                'editions': session.query(Edition).count(),
                'editions_sold': session.query(Edition).filter(Edition.is_sold == True).count(),
                'editions_unsold': session.query(Edition).filter(Edition.is_sold == False).count(),
                'sync_logs': session.query(SyncLog).count(),
            }
            return stats

    def get_detailed_stats(self):
        """Get detailed statistics about the database."""
        with self.get_session() as session:
            stats = self.get_table_stats()

            # Add financial stats
            total_revenue = session.query(
                Edition.retail_price
            ).filter(Edition.is_sold == True).all()

            if total_revenue:
                total = sum(price[0] for price in total_revenue if price[0])
                stats['total_revenue'] = float(total)
            else:
                stats['total_revenue'] = 0

            # Latest sync info
            latest_sync = session.query(SyncLog).order_by(
                SyncLog.started_at.desc()
            ).first()

            if latest_sync:
                stats['last_sync'] = {
                    'date': latest_sync.started_at,
                    'type': latest_sync.sync_type,
                    'status': latest_sync.status
                }
            else:
                stats['last_sync'] = None

            return stats

    def check_connection(self):
        """Test database connection."""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                print("✅ Database connection successful")
                return True
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            return False

    def backup_metadata(self, filepath='backup_metadata.json'):
        """Export database metadata and stats to JSON."""
        import json

        stats = self.get_detailed_stats()
        stats['backup_date'] = datetime.now(timezone.utc).isoformat()
        stats['database_url'] = self.connection_string.split('@')[-1]  # Hide credentials

        with open(filepath, 'w') as f:
            json.dump(stats, f, indent=2, default=str)

        print(f"✅ Metadata backed up to {filepath}")
        return filepath

    def verify_schema(self):
        """Verify that all expected tables and columns exist."""
        issues = []

        try:
            # Check tables exist
            from sqlalchemy import inspect
            inspector = inspect(self.engine)
            existing_tables = inspector.get_table_names()

            expected_tables = ['prints', 'distributors', 'editions', 'sync_logs']
            for table in expected_tables:
                if table not in existing_tables:
                    issues.append(f"Missing table: {table}")

            # Check for critical columns
            if 'editions' in existing_tables:
                columns = [col['name'] for col in inspector.get_columns('editions')]
                required_cols = ['id', 'print_id', 'distributor_id', 'airtable_id']
                for col in required_cols:
                    if col not in columns:
                        issues.append(f"Missing column: editions.{col}")

            if issues:
                print("❌ Schema verification failed:")
                for issue in issues:
                    print(f"  - {issue}")
                return False
            else:
                print("✅ Schema verification passed")
                return True

        except Exception as e:
            print(f"❌ Schema verification error: {e}")
            return False

    def get_orphaned_editions(self):
        """Find editions without valid print or distributor references."""
        with self.get_session() as session:
            orphaned = session.query(Edition).filter(
                (Edition.print_id.is_(None)) |
                (~Edition.print_id.in_(
                    session.query(Print.id)
                ))
            ).all()
            return orphaned

    def get_duplicate_editions(self):
        """Find duplicate print-edition combinations."""
        with self.get_session() as session:
            from sqlalchemy import func

            duplicates = session.query(
                Edition.print_id,
                Edition.edition_number,
                func.count(Edition.id).label('count')
            ).group_by(
                Edition.print_id,
                Edition.edition_number
            ).having(
                func.count(Edition.id) > 1
            ).all()

            return duplicates