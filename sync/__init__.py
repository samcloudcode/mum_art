"""Sync engine for importing Airtable data to PostgreSQL."""

from .importer_smart import SmartImporter

__all__ = ['SmartImporter']