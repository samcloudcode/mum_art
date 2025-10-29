#!/usr/bin/env python
"""Enhanced data cleaning utilities for 8000+ edition records."""

import re
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
from decimal import Decimal
import pandas as pd

class AirtableDataCleaner:
    """Enhanced cleaner for large-scale Airtable data with name standardization."""

    # Mapping for consistent, friendly print names
    PRINT_NAME_MAPPING = {
        # Fix spacing and formatting
        'nomanfort': "No Man's Fort",
        'nomansfort': "No Man's Fort",
        'stcatherines': "St Catherine's",
        'st catherines': "St Catherine's",
        'seaviewtwo': 'Seaview Two',
        'seaview twooo': 'Seaview Two',

        # Standardize abbreviations
        'bemlbsl': 'Bembridge Lifeboat Station',
        'seagv2l': 'Seaview V2 Large',
        'seagrove': 'Seagrove',
        'rys': 'Royal Yacht Squadron',

        # Fix capitalization
        'cowes race day': 'Cowes Race Day',
        'quay rocks': 'Quay Rocks',
        'quayrocks': 'Quay Rocks',
        'quayrocks landscape': 'Quay Rocks Landscape',
        'lifeboat station': 'Lifeboat Station',
        'priory': 'Priory',

        # Proper names
        'ducie': 'Ducie',
        'etchells': 'Etchells',
        'lymington': 'Lymington',
        'bembridge': 'Bembridge',
        'osborne': 'Osborne',
        'contessa32': 'Contessa 32',

        # Wildlife
        'puffin': 'Puffin',
        'seagull': 'Seagull',

        # Special editions
        'jubilee': 'Jubilee',
        'classics': 'Classics',
        'regatta': 'Regatta',

        # Landscape names
        'nerthek': 'Nerthek',
        'quarr': 'Quarr',
        'seauew': 'Sea View',
        'seaview': 'Seaview',

        # From actual data
        'a.mermaids': 'Mermaids',
        'amermaids': 'Mermaids',
        'a mermaids': 'Mermaids',
    }

    @staticmethod
    def standardize_print_name(name: Any) -> Optional[str]:
        """
        Standardize print names to be consistent and friendly.

        Examples:
        - "NoMansFort " -> "No Man's Fort"
        - "COWES RACE DAY" -> "Cowes Race Day"
        - "BEMLBSL" -> "Bembridge Lifeboat Station"
        """
        if not name or str(name).lower() in ['nan', 'none', '']:
            return None

        # Clean whitespace and convert to string
        clean_name = str(name).strip()

        # Check if we have a direct mapping (case-insensitive)
        lookup_key = clean_name.lower().replace('-', '').replace('_', '').replace(' ', '')
        if lookup_key in AirtableDataCleaner.PRINT_NAME_MAPPING:
            return AirtableDataCleaner.PRINT_NAME_MAPPING[lookup_key]

        # If no direct mapping, apply smart title casing
        words = clean_name.split()
        result = []

        # Words that should stay uppercase
        uppercase_words = {'RYS', 'IOW', 'UK', 'V2', 'V2L'}

        # Words that should stay lowercase (unless first word)
        lowercase_words = {'and', 'the', 'of', 'at', 'in', 'on'}

        for i, word in enumerate(words):
            # Remove extra characters
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
        except:
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
        except:
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
        except:
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

    @staticmethod
    def clean_print_data(row: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a row from the Prints CSV."""
        return {
            'airtable_id': row.get('Record_id'),
            'name': AirtableDataCleaner.standardize_print_name(row.get('Print Name')),
            'description': AirtableDataCleaner.clean_text(row.get('Description')),
            'total_editions': AirtableDataCleaner.clean_integer(row.get('Total Editions')),
            'web_link': AirtableDataCleaner.clean_text(row.get('Web link')),
            'notes': AirtableDataCleaner.clean_text(row.get('Notes')),
            'image_urls': AirtableDataCleaner.parse_image_urls(row.get('Image')),
        }

    @staticmethod
    def clean_distributor_data(row: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a row from the Distributors CSV."""
        return {
            'airtable_id': row.get('Record_id'),
            'name': AirtableDataCleaner.standardize_distributor_name(row.get('Name')),
            'commission_percentage': AirtableDataCleaner.clean_percentage(row.get('Commission')),
            'notes': AirtableDataCleaner.clean_text(row.get('Notes')),
            'contact_number': AirtableDataCleaner.clean_text(row.get('Contact Number')),
            'web_address': AirtableDataCleaner.clean_text(row.get('Web address')),
            'net_revenue': AirtableDataCleaner.clean_currency(row.get('Net Revenue')),
            'distributor_revenue': AirtableDataCleaner.clean_currency(row.get('Distributor Revenue')),
            'retail_amount_sold': AirtableDataCleaner.clean_currency(row.get('Retail Amount Sold')),
            'net_revenue_unpaid': AirtableDataCleaner.clean_currency(row.get('Net Revenue Unpaid')),
            'net_revenue_unpaid_by_invoice_month': AirtableDataCleaner.clean_currency(
                row.get('Net Revenue Unpaid by Invoice Month')
            ),
            'last_update_date': AirtableDataCleaner.parse_date(row.get('Date')),
        }

    @staticmethod
    def clean_edition_data(row: Dict[str, Any]) -> Dict[str, Any]:
        """Clean a row from the Editions CSV with 8000+ records."""

        # Extract print name and edition number
        print_name, edition_number = AirtableDataCleaner.extract_edition_info(
            row.get('Print - Edition', '')
        )

        # If we couldn't parse from "Print - Edition", try "Print" field
        if not print_name:
            print_name = AirtableDataCleaner.standardize_print_name(row.get('Print'))

        # Clean month sold field that has #ERROR! issues
        month_sold = AirtableDataCleaner.clean_text(row.get('Month Sold'))
        if month_sold == '#ERROR!' or month_sold == 'ERROR':
            month_sold = None

        # Clean weeks in gallery (has many NaN values)
        weeks_in_gallery = AirtableDataCleaner.clean_integer(row.get('Weeks in Gallery'))

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
            'size': AirtableDataCleaner.normalize_size(row.get('Size')),
            'frame_type': AirtableDataCleaner.normalize_frame_type(row.get('Frame')),
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
            'invoice_amount': AirtableDataCleaner.clean_currency(row.get('Invoice Amount')),
            'commission_percentage': AirtableDataCleaner.clean_percentage(row.get('Commission')),
            'commission_amount': AirtableDataCleaner.clean_currency(row.get('Commissions')),

            # Gallery tracking
            'date_in_gallery': AirtableDataCleaner.parse_date(row.get('Date in Gallery')),
            'weeks_in_gallery': weeks_in_gallery,

            # Additional info
            'notes': AirtableDataCleaner.clean_text(row.get('Notes')),
            'payment_note': AirtableDataCleaner.clean_text(row.get('Payment')),
            'month_sold': month_sold,
            'year_sold': AirtableDataCleaner.clean_integer(row.get('Year Sold')),

            # Distributor name (for lookup)
            'distributor_name': AirtableDataCleaner.standardize_distributor_name(
                row.get('Distributor')
            )
        }

    @staticmethod
    def standardize_distributor_name(name: Any) -> Optional[str]:
        """Standardize distributor names."""
        if not name or str(name).lower() in ['nan', 'none', '']:
            return None

        clean_name = str(name).strip()

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


def test_cleaner():
    """Test the enhanced data cleaner with real data."""

    # Test print name standardization
    test_names = [
        'NoMansFort ',
        'COWES RACE DAY',
        'BEMLBSL',
        'St Catherines',
        'SEAGV2L',
        'quayrocks landscape',
        'Royal Yacht Squadron',
        'NERTHEK',
    ]

    print("Testing Print Name Standardization:")
    print("-" * 50)
    for name in test_names:
        clean = AirtableDataCleaner.standardize_print_name(name)
        print(f"{name:25} -> {clean}")

    print("\n\nTesting Edition Parsing:")
    print("-" * 50)
    test_editions = [
        'St Catherines - 87',
        'COWES RACE DAY - 83',
        'Royal Yacht Squadron - 131',
        'NoMansFort - -5',  # Negative edition number
        'BEMLBSL - 200',
    ]

    for edition in test_editions:
        print_name, edition_num = AirtableDataCleaner.extract_edition_info(edition)
        print(f"{edition:30} -> Print: {print_name:25} Edition: {edition_num}")


if __name__ == "__main__":
    test_cleaner()

    # If CSV exists, test with real data
    try:
        import pandas as pd

        print("\n\nAnalyzing Real Data:")
        print("=" * 50)

        df = pd.read_csv('airtable_export/Editions-All Records.csv', encoding='utf-8-sig')
        print(f"Total records: {len(df)}")

        # Skip empty records and clean first 10 valid records as sample
        valid_df = df[(df['Print - Edition'] != ' - ') & (df['Print - Edition'].notna())]
        print(f"Valid records: {len(valid_df)} out of {len(df)} total")

        print("\nCleaning first 10 valid records...")
        issues_found = []

        for idx, row in valid_df.head(10).iterrows():
            cleaned = AirtableDataCleaner.clean_edition_data(row.to_dict())
            validation_issues = AirtableDataCleaner.validate_cleaned_edition(cleaned)

            if validation_issues:
                issues_found.append((idx, cleaned['edition_display_name'], validation_issues))

            print(f"\nRecord {idx}:")
            print(f"  Original: {row.get('Print - Edition')}")
            print(f"  Print: {cleaned['print_name']}")
            print(f"  Edition: {cleaned['edition_number']}")
            print(f"  Price: £{cleaned['retail_price'] if cleaned['retail_price'] else 'N/A'}")
            print(f"  Sold: {cleaned['is_sold']}")

        if issues_found:
            print("\n\nValidation Issues Found:")
            print("-" * 50)
            for idx, name, issues in issues_found:
                print(f"Record {idx} ({name}):")
                for issue in issues:
                    print(f"  - {issue}")

    except FileNotFoundError:
        print("\nCSV file not found. Skipping real data test.")