#!/usr/bin/env python
"""Enhanced data cleaning utilities for 8000+ edition records."""

import re
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING
from datetime import datetime
from decimal import Decimal, InvalidOperation

if TYPE_CHECKING:
    from sync.import_report import ImportReport


class AirtableDataCleaner:
    """Enhanced cleaner for large-scale Airtable data with name standardization."""

    def __init__(self, report: Optional['ImportReport'] = None):
        """Initialize cleaner with optional import report for tracking."""
        self.report = report

    # Canonical print names: maps raw input variations to (short_name, full_name)
    # short_name: abbreviated for handwritten notes (max ~10 chars)
    # full_name: complete display name
    PRINT_NAMES = {
        # === Isle of Wight Locations ===
        'bembridge': ('Bemb', 'Bembridge'),
        'bemlbsl': ('Bemb LS', 'Bembridge Lifeboat Station'),
        'lifeboatstation': ('Bemb LS', 'Bembridge Lifeboat Station'),
        'eastcowes': ('E Cowes', 'East Cowes'),
        'westcowes': ('W Cowes', 'West Cowes'),
        'cowesraceday': ('Cowes RD', 'Cowes Race Day'),
        'hurst': ('Hurst', 'Hurst'),
        'needles': ('Needles', 'Needles'),
        'needleslighthouse': ('Needles LH', 'Needles Lighthouse'),
        'nomanfort': ("NMF", "No Man's Fort"),
        'nomansfort': ("NMF", "No Man's Fort"),
        'osborne': ('Osborne', 'Osborne'),
        'priory': ('Priory', 'Priory'),
        'quarr': ('Quarr', 'Quarr'),
        'quayrocks': ('Quay Rks', 'Quay Rocks'),
        'quayrockslandscape': ('Quay Rks L', 'Quay Rocks Landscape'),
        'roundtheisland': ('RTI', 'Round the Island'),
        'stcatherines': ("St Cath", "St Catherine's"),
        'seagrove': ('Seagrove', 'Seagrove'),
        'seaview': ('Seaview', 'Seaview'),
        'seagv2l': ('Seaview V2L', 'Seaview V2 Large'),
        'yarmouth': ('Yarm', 'Yarmouth'),
        'yarmouthpier': ('Yarm Pier', 'Yarmouth Pier'),
        'lymington': ('Lym', 'Lymington'),
        'nerthek': ('Nerthek', 'Nerthek'),

        # === Sailing & Boats ===
        'royalyachtsquadron': ('RYS', 'Royal Yacht Squadron'),
        'rys': ('RYS', 'Royal Yacht Squadron'),
        'etchells': ('Etchells', 'Etchells'),
        'contessa32': ('C32', 'Contessa 32'),
        'scooter': ('Scooter', 'Scooter'),
        'sb20': ('SB20', 'SB20'),
        'scows': ('Scows', 'Scows'),
        'regatta': ('Regatta', 'Regatta'),
        'classics': ('Classics', 'Classics'),
        'classracinglym': ('Class Lym', 'Class Racing Lymington'),
        'ducie': ('Ducie', 'Ducie'),
        'corby': ('Corby', 'Corby'),
        'galatea': ('Galatea', 'Galatea'),
        'beatrice': ('Beatrice', 'Beatrice'),
        'otto': ('Otto', 'Otto'),
        'brambles': ('Brambles', 'Brambles'),

        # === Mermaids variations ===
        'amermaids': ('Mermaids', 'Mermaids'),
        'a.mermaids': ('Mermaids', 'Mermaids'),
        'mermaids': ('Mermaids', 'Mermaids'),
        'svycmermaids': ('SVYC Merm', 'SVYC Mermaids'),
        'bsvycm': ('B SVYCM', 'B SVYC Mermaids'),

        # === Wildlife ===
        'puffin': ('Puffin', 'Puffin'),

        # === Special/Other ===
        'wrongflagraceday': ('Wrong Flag', 'Wrong Flag Race Day'),
        'miscellaneous': ('Misc', 'Miscellaneous'),
    }


    @staticmethod
    def _normalize_lookup_key(name: str) -> str:
        """Normalize a name to a lookup key (lowercase, no spaces/dashes/underscores/dots)."""
        return name.lower().replace('-', '').replace('_', '').replace(' ', '').replace('.', '')

    @staticmethod
    def get_print_names(name: Any) -> Tuple[Optional[str], Optional[str]]:
        """
        Get both short and full names for a print.

        Returns:
            Tuple of (short_name, full_name), or (None, None) if invalid input.

        Examples:
            "NoMansFort " -> ("NMF", "No Man's Fort")
            "RYS" -> ("RYS", "Royal Yacht Squadron")
            "BEMLBSL" -> ("Bemb LS", "Bembridge Lifeboat Station")
        """
        if not name or str(name).lower() in ['nan', 'none', '']:
            return None, None

        clean_name = str(name).strip()
        lookup_key = AirtableDataCleaner._normalize_lookup_key(clean_name)

        # Check canonical mapping first
        if lookup_key in AirtableDataCleaner.PRINT_NAMES:
            return AirtableDataCleaner.PRINT_NAMES[lookup_key]

        # Fallback: use smart title casing for full name
        # For short name, use first word or abbreviation of multi-word names
        full_name = AirtableDataCleaner._apply_title_casing(clean_name)
        if not full_name:
            return None, None

        words = full_name.split()
        if len(words) == 1:
            short_name = full_name
        else:
            # For multi-word names, create initials (e.g., "New Print" -> "NP")
            short_name = ''.join(w[0].upper() for w in words if w)

        return short_name, full_name

    @staticmethod
    def _apply_title_casing(name: str) -> str:
        """Apply smart title casing rules to a name."""
        words = name.split()
        result = []

        # Words that should stay uppercase
        uppercase_words = {'RYS', 'IOW', 'UK', 'V2', 'V2L', 'SVYC', 'SB20'}

        # Words that should stay lowercase (unless first word)
        lowercase_words = {'and', 'the', 'of', 'at', 'in', 'on'}

        for i, word in enumerate(words):
            clean_word = word.strip('.,;:')

            if clean_word.upper() in uppercase_words:
                result.append(clean_word.upper())
            elif i > 0 and clean_word.lower() in lowercase_words:
                result.append(clean_word.lower())
            else:
                # Preserve apostrophes and title case
                if "'" in clean_word:
                    parts = clean_word.split("'")
                    result.append("'".join(p.capitalize() for p in parts))
                else:
                    result.append(clean_word.capitalize())

        return ' '.join(result)

    @staticmethod
    def standardize_print_name(name: Any) -> Optional[str]:
        """
        Standardize print names to be consistent and friendly.
        Returns the full display name only (for backwards compatibility).

        Examples:
        - "NoMansFort " -> "No Man's Fort"
        - "COWES RACE DAY" -> "Cowes Race Day"
        - "BEMLBSL" -> "Bembridge Lifeboat Station"
        """
        _, full_name = AirtableDataCleaner.get_print_names(name)
        return full_name

    @staticmethod
    def clean_text(value: Any) -> Optional[str]:
        """Clean text fields - remove extra whitespace and #ERROR!"""
        if not value or str(value).lower() in ['nan', 'none', '#error!']:
            return None
        return str(value).strip()

    @staticmethod
    def clean_currency(value: Any) -> Optional[Decimal]:
        """Convert currency strings to Decimal."""
        if not value or str(value).lower() in ['nan', 'none', '', '#error!']:
            return None

        # Remove currency symbols and commas
        clean_val = re.sub(r'[£$€,]', '', str(value))

        try:
            return Decimal(clean_val)
        except (ValueError, TypeError, InvalidOperation):
            return None

    @staticmethod
    def clean_percentage(value: Any) -> Optional[Decimal]:
        """Convert percentage strings to Decimal."""
        if not value or str(value).lower() in ['nan', 'none', '', '#error!']:
            return None

        # Remove % symbol
        clean_val = str(value).replace('%', '').strip()

        try:
            return Decimal(clean_val)
        except (ValueError, TypeError, InvalidOperation):
            return None

    @staticmethod
    def clean_boolean(value: Any) -> bool:
        """Convert various boolean representations."""
        if not value:
            return False

        val_lower = str(value).lower().strip()
        return val_lower in ['checked', 'true', 'yes', '1']

    @staticmethod
    def clean_integer(value: Any) -> Optional[int]:
        """Convert to integer, handling empty values and #ERROR!"""
        if not value or str(value).lower() in ['nan', 'none', '', '#error!']:
            return None

        try:
            # Remove any decimal points for whole numbers
            if '.' in str(value):
                return int(float(value))
            return int(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def parse_date(value: Any) -> Optional[datetime]:
        """Parse various date formats, handling errors."""
        if not value or str(value).lower() in ['nan', 'none', '', '#error!']:
            return None

        date_str = str(value).strip()

        # Handle obvious errors
        if '1920' in date_str:
            # Likely typo - assume 2020
            date_str = date_str.replace('1920', '2020')

        # Try different date formats
        formats = [
            '%m/%d/%Y',      # 10/24/2023
            '%d/%m/%Y',      # 24/10/2023
            '%Y-%m-%d',      # 2023-10-24
            '%B %d, %Y',     # October 24, 2023
            '%b %d, %Y',     # Oct 24, 2023
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue

        return None

    @staticmethod
    def parse_image_urls(value: Any) -> List[str]:
        """Extract URLs from Airtable image field format."""
        if not value or str(value).lower() in ['nan', 'none', '', '#error!']:
            return []

        urls = []
        # Pattern to match URLs in parentheses
        pattern = r'\(https?://[^)]+\)'

        matches = re.findall(pattern, str(value))
        for match in matches:
            # Remove parentheses
            url = match.strip('()')
            urls.append(url)

        return urls

    @staticmethod
    def normalize_size(value: Any) -> str:
        """Normalize size to match database constraints."""
        if not value or str(value).lower() in ['nan', 'none', '', 'unknown']:
            return 'Small'  # Default to Small for unknown sizes

        size_str = str(value).strip().lower()
        if 'extra' in size_str and 'large' in size_str:
            return 'Extra Large'
        elif 'large' in size_str:
            return 'Large'
        else:
            return 'Small'  # Default for unrecognized sizes

    @staticmethod
    def normalize_frame_type(frame_type: Any) -> Optional[str]:
        """Normalize frame type to match database constraints."""
        if not frame_type or str(frame_type).lower() in ['nan', 'none', '']:
            return None

        frame_str = str(frame_type).strip().lower()

        # Map various frame types to allowed values
        if frame_str in ['ikea', 'b&q', 'framed', 'frame']:
            return 'Framed'
        elif frame_str in ['tube', 'tube only', 'tubed']:
            return 'Tube only'
        elif frame_str in ['mounted', 'mount', 'unmounted']:
            return 'Mounted'
        else:
            # Default to Framed for unknown types
            return 'Framed'

    @staticmethod
    def extract_edition_info(edition_name: str) -> Tuple[str, Optional[int]]:
        """
        Extract print name and edition number from edition string.
        Returns tuple of (print_name, edition_number)
        """
        if not edition_name:
            return None, None

        # Pattern: "Print Name - Edition Number"
        pattern = r'^(.+?)\s*-\s*(-?\d+)$'
        match = re.match(pattern, edition_name.strip())

        if match:
            print_name = AirtableDataCleaner.standardize_print_name(match.group(1))
            edition_num = int(match.group(2))
            return print_name, edition_num

        # If no pattern match, return the whole thing as print name
        return AirtableDataCleaner.standardize_print_name(edition_name), None

    def clean_print_data(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a row from the Prints CSV."""
        original_name = row.get('Print Name')
        short_name, full_name = AirtableDataCleaner.get_print_names(original_name)

        # Record the transformation if it changed
        if self.report and original_name and full_name:
            self.report.record_print_name_transform(str(original_name), full_name)

        return {
            'airtable_id': row.get('Record_id'),
            'name': full_name,
            'short_name': short_name,
            'description': AirtableDataCleaner.clean_text(row.get('Description')),
            'total_editions': AirtableDataCleaner.clean_integer(row.get('Total Editions')),
            'web_link': AirtableDataCleaner.clean_text(row.get('Web link')),
            'notes': AirtableDataCleaner.clean_text(row.get('Notes')),
            'image_urls': AirtableDataCleaner.parse_image_urls(row.get('Image')),
        }

    def clean_distributor_data(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a row from the Distributors CSV."""
        original_name = row.get('Name')
        standardized_name = AirtableDataCleaner.standardize_distributor_name(original_name)

        # Record the transformation if it changed
        if self.report and original_name and standardized_name:
            self.report.record_distributor_name_transform(str(original_name), standardized_name)

        return {
            'airtable_id': row.get('Record_id'),
            'name': standardized_name,
            'commission_percentage': AirtableDataCleaner.clean_percentage(row.get('Commission')),
            'notes': AirtableDataCleaner.clean_text(row.get('Notes')),
            'contact_number': AirtableDataCleaner.clean_text(row.get('Contact Number')),
            'web_address': AirtableDataCleaner.clean_text(row.get('Web address')),
            # Removed calculated fields - these should be computed on-demand:
            # - net_revenue: sum of (retail_price * (1 - commission_percentage/100)) for sold editions
            # - distributor_revenue: sum of (retail_price * commission_percentage/100) for sold editions
            # - retail_amount_sold: sum of retail_price for sold editions
            # - net_revenue_unpaid: sum of net amounts where settled = false
            'last_update_date': AirtableDataCleaner.parse_date(row.get('Date')),
        }

    def clean_edition_data(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a row from the Editions CSV with 8000+ records."""

        # Extract print name and edition number
        print_name, edition_number = AirtableDataCleaner.extract_edition_info(
            row.get('Print - Edition', '')
        )

        # If we couldn't parse from "Print - Edition", try "Print" field
        if not print_name:
            print_name = AirtableDataCleaner.standardize_print_name(row.get('Print'))

        # Track size normalization
        original_size = row.get('Size')
        normalized_size = AirtableDataCleaner.normalize_size(original_size)
        if self.report:
            self.report.record_size_normalization(original_size, normalized_size)
            # Track if default was applied
            if not original_size or str(original_size).lower() in ['nan', 'none', '', 'unknown']:
                self.report.record_default_applied('size')

        # Track frame type normalization
        original_frame = row.get('Frame')
        normalized_frame = AirtableDataCleaner.normalize_frame_type(original_frame)
        if self.report:
            self.report.record_frame_type_normalization(original_frame, normalized_frame or 'Framed')
            # Track if default was applied
            if not original_frame or str(original_frame).lower() in ['nan', 'none', '']:
                self.report.record_default_applied('frame_type')

        # Track distributor name transformation
        original_distributor = row.get('Distributor')
        standardized_distributor = AirtableDataCleaner.standardize_distributor_name(original_distributor)
        if self.report and original_distributor and standardized_distributor:
            self.report.record_distributor_name_transform(str(original_distributor), standardized_distributor)

        return {
            'airtable_id': row.get('record_id'),
            'print_airtable_id': row.get('print_record_id'),
            'distributor_airtable_id': row.get('distributor_record_id'),

            # Core identity
            'edition_display_name': row.get('Print - Edition'),
            'print_name': print_name,
            'edition_number': edition_number or AirtableDataCleaner.clean_integer(
                row.get('Print Edition')
            ),

            # Physical attributes
            'size': normalized_size,
            'frame_type': normalized_frame,
            'variation': AirtableDataCleaner.clean_text(row.get('Variation'))[:20] if AirtableDataCleaner.clean_text(row.get('Variation')) else None,

            # Status flags
            'is_printed': AirtableDataCleaner.clean_boolean(row.get('Printed')),
            'is_sold': AirtableDataCleaner.clean_boolean(row.get('Sold')),
            'is_settled': AirtableDataCleaner.clean_boolean(row.get('Settled')),
            'is_stock_checked': AirtableDataCleaner.clean_boolean(row.get('Stock Checked')),
            'to_check_in_detail': AirtableDataCleaner.clean_boolean(row.get('To check in detail')),

            # Sales information
            'retail_price': AirtableDataCleaner.clean_currency(row.get('Retail Price')),
            'date_sold': AirtableDataCleaner.parse_date(row.get('Date Sold')),
            'commission_percentage': AirtableDataCleaner.clean_percentage(row.get('Commission')),
            # Removed calculated fields - computed on-demand:
            # - invoice_amount: retail_price * (1 - commission_percentage/100)
            # - commission_amount: retail_price * commission_percentage/100
            # - weeks_in_gallery: days between date_in_gallery and date_sold / 7
            # - month_sold: extracted from date_sold
            # - year_sold: extracted from date_sold

            # Gallery tracking
            'date_in_gallery': AirtableDataCleaner.parse_date(row.get('Date in Gallery')),

            # Additional info
            'notes': AirtableDataCleaner.clean_text(row.get('Notes')),
            'payment_note': AirtableDataCleaner.clean_text(row.get('Payment')),

            # Distributor name (for lookup)
            'distributor_name': standardized_distributor
        }

    @staticmethod
    def standardize_distributor_name(name: Any) -> Optional[str]:
        """Standardize distributor names."""
        if not name or str(name).lower() in ['nan', 'none', '']:
            return None

        clean_name = str(name).strip()

        # Filter out values that aren't valid distributor names
        # 'checked' is a boolean value that ended up in the distributor field
        invalid_distributors = ['checked']
        if clean_name.lower() in invalid_distributors:
            return None

        # Specific mappings
        distributor_mapping = {
            'kendalls': 'Kendalls',
            'kendall': 'Kendalls',
            'seaview gallery': 'Seaview Gallery',
            'bramble and berry': 'Bramble and Berry',
            'green buoy': 'Green Buoy',
            'tapnell farm': 'Tapnell Farm',
            'direct': 'Direct',
            'unknown': 'Unknown',
            'perera': 'Perera',
            'framers': 'Framers',
        }

        lookup_key = clean_name.lower()
        if lookup_key in distributor_mapping:
            return distributor_mapping[lookup_key]

        # Default: title case
        return clean_name.title()

    @staticmethod
    def validate_cleaned_edition(data: Dict[str, Any]) -> List[str]:
        """Validate cleaned edition data and return list of issues."""
        issues = []

        # Required fields
        if not data.get('edition_display_name'):
            issues.append("Missing edition display name")
        if not data.get('airtable_id'):
            issues.append("Missing Airtable ID")
        if not data.get('print_name'):
            issues.append("Missing or unparseable print name")

        # Price validation
        if data.get('retail_price'):
            price = data['retail_price']
            if price < 0:
                issues.append(f"Negative retail price: {price}")
            elif price < 10:
                issues.append(f"Suspiciously low price: {price}")
            elif price > 1000:
                issues.append(f"Suspiciously high price: {price}")

        # Date logic
        if data.get('date_sold') and data.get('date_in_gallery'):
            if data['date_in_gallery'] > data['date_sold']:
                issues.append("Date in gallery is after date sold")

        # Sold but no price
        if data.get('is_sold') and not data.get('retail_price'):
            issues.append("Marked as sold but no price")

        # Commission validation
        if data.get('commission_percentage'):
            comm = data['commission_percentage']
            if comm < 0 or comm > 100:
                issues.append(f"Invalid commission percentage: {comm}")

        return issues