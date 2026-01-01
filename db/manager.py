"""Database manager for PostgreSQL operations."""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from contextlib import contextmanager
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Union, List, Dict, Any
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

    def get_or_create_direct_distributor(self, session) -> Distributor:
        """
        Get the 'Direct' distributor (artist's home) or create it if missing.

        The Direct distributor represents sales/inventory held by the artist
        with 0% commission.
        """
        direct = session.query(Distributor).filter(
            Distributor.name == 'Direct'
        ).first()

        if not direct:
            direct = Distributor(
                airtable_id=f"WEB_{uuid.uuid4().hex[:12].upper()}",
                name='Direct',
                commission_percentage=Decimal('0.00'),
                notes='Artist direct sales - 0% commission'
            )
            session.add(direct)
            session.flush()  # Get the ID without committing

        return direct

    def create_artwork(
        self,
        name: str,
        total_editions: int,
        image_url: Optional[Union[str, List[str]]] = None,
        description: Optional[str] = None,
        default_size: Optional[str] = None,
        default_frame_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new artwork (print) with all its edition records.

        This is the primary function for adding new artwork from the frontend.
        All editions are pre-created as unprinted, assigned to 'Direct' distributor.

        Args:
            name: The artwork name (must be unique)
            total_editions: Total number of editions to create (e.g., 350)
            image_url: Single URL string or list of image URLs
            description: Optional description of the artwork
            default_size: Optional size for editions ('Small', 'Large', 'Extra Large')
            default_frame_type: Optional frame type ('Framed', 'Tube only', 'Mounted')

        Returns:
            Dict with:
                - success: bool
                - print_id: int (if successful)
                - print_name: str (if successful)
                - editions_created: int (if successful)
                - error: str (if failed)
                - error_code: str (if failed) - 'DUPLICATE_NAME', 'INVALID_DATA', 'DB_ERROR'

        Example:
            result = db.create_artwork(
                name="Sunset Over Cowes",
                total_editions=350,
                image_url="https://example.com/sunset.jpg"
            )
            if result['success']:
                print(f"Created artwork {result['print_id']}")
        """
        # Validate inputs
        if not name or not name.strip():
            return {
                'success': False,
                'error': 'Artwork name is required',
                'error_code': 'INVALID_DATA'
            }

        name = name.strip()

        if not isinstance(total_editions, int) or total_editions < 1:
            return {
                'success': False,
                'error': 'Total editions must be a positive integer',
                'error_code': 'INVALID_DATA'
            }

        if total_editions > 10000:
            return {
                'success': False,
                'error': 'Total editions cannot exceed 10,000',
                'error_code': 'INVALID_DATA'
            }

        # Validate size and frame_type if provided
        valid_sizes = ['Small', 'Large', 'Extra Large']
        valid_frame_types = ['Framed', 'Tube only', 'Mounted']

        if default_size is not None and default_size not in valid_sizes:
            return {
                'success': False,
                'error': f"Invalid size. Must be one of: {', '.join(valid_sizes)}",
                'error_code': 'INVALID_DATA'
            }

        if default_frame_type is not None and default_frame_type not in valid_frame_types:
            return {
                'success': False,
                'error': f"Invalid frame type. Must be one of: {', '.join(valid_frame_types)}",
                'error_code': 'INVALID_DATA'
            }

        # Normalize image_url to list
        image_urls = None
        if image_url:
            if isinstance(image_url, str):
                image_urls = [image_url]
            elif isinstance(image_url, list):
                image_urls = [url for url in image_url if url and url.strip()]

        try:
            with self.get_session() as session:
                # Check for duplicate name first (better error message)
                existing = session.query(Print).filter(Print.name == name).first()
                if existing:
                    return {
                        'success': False,
                        'error': f"An artwork named '{name}' already exists",
                        'error_code': 'DUPLICATE_NAME'
                    }

                # Get or create Direct distributor
                direct_distributor = self.get_or_create_direct_distributor(session)

                # Generate unique airtable_id for the print
                print_airtable_id = f"WEB_{uuid.uuid4().hex[:12].upper()}"

                # Create the print record
                new_print = Print(
                    airtable_id=print_airtable_id,
                    name=name,
                    description=description,
                    total_editions=total_editions,
                    image_urls=image_urls,
                    is_active=True
                )
                session.add(new_print)
                session.flush()  # Get the print ID

                # Create all edition records
                editions_to_add = []
                for edition_num in range(1, total_editions + 1):
                    edition_airtable_id = f"WEB_{new_print.id}_{edition_num}_{uuid.uuid4().hex[:6].upper()}"

                    edition = Edition(
                        airtable_id=edition_airtable_id,
                        print_id=new_print.id,
                        distributor_id=direct_distributor.id,
                        edition_number=edition_num,
                        edition_display_name=f"{name} - {edition_num}",
                        size=default_size,
                        frame_type=default_frame_type,
                        is_printed=False,
                        is_sold=False,
                        is_settled=False,
                        is_stock_checked=False,
                        status_confidence='verified',
                        is_active=True
                    )
                    editions_to_add.append(edition)

                session.bulk_save_objects(editions_to_add)

                return {
                    'success': True,
                    'print_id': new_print.id,
                    'print_name': new_print.name,
                    'editions_created': total_editions,
                    'distributor': 'Direct'
                }

        except IntegrityError as e:
            # Handle race condition where name was inserted between check and insert
            if 'unique' in str(e).lower() and 'name' in str(e).lower():
                return {
                    'success': False,
                    'error': f"An artwork named '{name}' already exists",
                    'error_code': 'DUPLICATE_NAME'
                }
            return {
                'success': False,
                'error': 'Database integrity error occurred',
                'error_code': 'DB_ERROR'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to create artwork: {str(e)}',
                'error_code': 'DB_ERROR'
            }

    def get_artwork(self, print_id: int) -> Optional[Dict[str, Any]]:
        """
        Get artwork details by ID.

        Args:
            print_id: The print ID

        Returns:
            Dict with artwork details or None if not found
        """
        try:
            with self.get_session() as session:
                print_obj = session.query(Print).filter(Print.id == print_id).first()
                if not print_obj:
                    return None

                # Count editions by status
                editions_printed = session.query(Edition).filter(
                    Edition.print_id == print_id,
                    Edition.is_printed == True
                ).count()

                editions_sold = session.query(Edition).filter(
                    Edition.print_id == print_id,
                    Edition.is_sold == True
                ).count()

                return {
                    'id': print_obj.id,
                    'name': print_obj.name,
                    'description': print_obj.description,
                    'total_editions': print_obj.total_editions,
                    'image_urls': print_obj.image_urls,
                    'web_link': print_obj.web_link,
                    'editions_printed': editions_printed,
                    'editions_sold': editions_sold,
                    'editions_available': print_obj.total_editions - editions_sold if print_obj.total_editions else 0,
                    'created_at': print_obj.created_at,
                    'is_active': print_obj.is_active
                }
        except Exception:
            return None
