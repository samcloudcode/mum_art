"""SQLAlchemy models for the art prints database."""

from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DECIMAL, Boolean,
    Date, TIMESTAMP, ForeignKey, ARRAY, CheckConstraint, UniqueConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

Base = declarative_base()


class Print(Base):
    """Master catalog of art print designs."""
    __tablename__ = 'prints'

    id = Column(Integer, primary_key=True)
    airtable_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    total_editions = Column(Integer)
    web_link = Column(String(500))
    notes = Column(Text)
    image_urls = Column(ARRAY(Text))

    # Sync metadata
    last_synced_at = Column(TIMESTAMP)
    sync_version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    editions = relationship("Edition", back_populates="print")

    def __repr__(self):
        return f"<Print(name='{self.name}', editions={self.total_editions})>"


class Distributor(Base):
    """Galleries and distributors."""
    __tablename__ = 'distributors'

    id = Column(Integer, primary_key=True)
    airtable_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False, unique=True)
    commission_percentage = Column(DECIMAL(5, 2))
    notes = Column(Text)
    contact_number = Column(String(50))
    web_address = Column(String(500))

    # Financial fields (removed calculated fields - kept only for reference)
    # These fields should be calculated on-demand from editions data:
    # - net_revenue: sum of (retail_price * (1 - commission_percentage/100)) for sold editions
    # - distributor_revenue: sum of (retail_price * commission_percentage/100) for sold editions
    # - retail_amount_sold: sum of retail_price for sold editions
    # - net_revenue_unpaid: sum of net amounts where settled = false
    last_update_date = Column(Date)

    # Sync metadata
    last_synced_at = Column(TIMESTAMP)
    sync_version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    editions = relationship("Edition", back_populates="distributor")

    def __repr__(self):
        return f"<Distributor(name='{self.name}', commission={self.commission_percentage}%)>"


class Edition(Base):
    """Individual print editions - each physical print with a specific edition number."""
    __tablename__ = 'editions'

    id = Column(Integer, primary_key=True)
    airtable_id = Column(String(20), unique=True, nullable=False)

    # Foreign Keys (One edition belongs to one print and one distributor)
    print_id = Column(Integer, ForeignKey('prints.id'), nullable=False)
    distributor_id = Column(Integer, ForeignKey('distributors.id'))

    # Edition Identity
    edition_number = Column(Integer)
    edition_display_name = Column(String(100), nullable=False)

    # Physical Attributes
    size = Column(String(20))
    frame_type = Column(String(20))
    variation = Column(String(20))

    # Status Flags
    is_printed = Column(Boolean, default=False)
    is_sold = Column(Boolean, default=False)
    is_settled = Column(Boolean, default=False)
    is_stock_checked = Column(Boolean, default=False)
    to_check_in_detail = Column(Boolean, default=False)

    # Sales Information
    retail_price = Column(DECIMAL(10, 2))
    date_sold = Column(Date)
    # Removed calculated fields:
    # - invoice_amount: calculated as retail_price * (1 - commission_percentage/100)
    # - commission_amount: calculated as retail_price * commission_percentage/100
    commission_percentage = Column(DECIMAL(5, 2))

    # Gallery Tracking
    date_in_gallery = Column(Date)
    # Removed calculated field:
    # - weeks_in_gallery: calculated from date_in_gallery to date_sold

    # Additional Info
    notes = Column(Text)
    payment_note = Column(Text)
    # Removed calculated fields:
    # - month_sold: extracted from date_sold
    # - year_sold: extracted from date_sold

    # Sync metadata
    last_synced_at = Column(TIMESTAMP)
    sync_version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    print = relationship("Print", back_populates="editions")
    distributor = relationship("Distributor", back_populates="editions")

    # Constraints
    __table_args__ = (
        UniqueConstraint('print_id', 'edition_number', name='unique_print_edition'),
        CheckConstraint("size IN ('Small', 'Large', 'Extra Large')", name='check_size'),
        CheckConstraint("frame_type IN ('Framed', 'Tube only', 'Mounted')", name='check_frame_type'),
    )

    def __repr__(self):
        return f"<Edition(name='{self.edition_display_name}', sold={self.is_sold})>"


class SyncLog(Base):
    """Track sync operations for audit and rollback capability."""
    __tablename__ = 'sync_logs'

    id = Column(Integer, primary_key=True)
    sync_id = Column(String(50), nullable=False)  # UUID for this sync operation
    sync_type = Column(String(20))  # 'full', 'incremental', 'manual'
    table_name = Column(String(50))

    records_processed = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_deleted = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)

    started_at = Column(TIMESTAMP, nullable=False)
    completed_at = Column(TIMESTAMP)
    status = Column(String(20))  # 'running', 'completed', 'failed', 'rolled_back'
    error_message = Column(Text)

    source_file = Column(String(255))
    source_hash = Column(String(64))  # SHA256 of source file for deduplication

    def __repr__(self):
        return f"<SyncLog(id='{self.sync_id}', status='{self.status}')>"