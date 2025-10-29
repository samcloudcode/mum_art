"""Error handling for data import issues."""

from typing import Dict, Any
import logging

class ImportErrorHandler:
    """Handles and logs import errors."""

    def __init__(self):
        self.error_counts = {}
        self.handled_errors = []

    def handle_edition_error(self, row_idx: int, error: Exception, row_data: Dict[str, Any]) -> bool:
        """
        Handle an edition import error.

        Returns True if error was handled and import should continue,
        False if error is critical and should stop.
        """
        error_str = str(error)

        # Known issues we can handle
        if "check_size" in error_str or "Unknown" in error_str:
            # Size constraint - already fixed by normalization
            self._log_error("size_constraint", row_idx, "Invalid size value")
            return True

        elif "check_frame_type" in error_str:
            # Frame type constraint - already fixed by normalization
            self._log_error("frame_constraint", row_idx, "Invalid frame type")
            return True

        elif "value too long" in error_str:
            # String truncation needed
            if "variation" in error_str.lower():
                self._log_error("long_variation", row_idx, "Variation field too long")
                return True
            elif "notes" in error_str.lower():
                self._log_error("long_notes", row_idx, "Notes field too long")
                return True

        elif "duplicate key value" in error_str:
            # Duplicate edition number
            self._log_error("duplicate_edition", row_idx, f"Duplicate edition number")
            return True

        elif "foreign key violation" in error_str:
            # Missing print or distributor
            if "print_id" in error_str:
                self._log_error("missing_print", row_idx, "Print not found")
            else:
                self._log_error("missing_distributor", row_idx, "Distributor not found")
            return True

        elif "invalid input syntax for type numeric" in error_str:
            # Bad price data
            self._log_error("invalid_price", row_idx, "Invalid price format")
            return True

        elif "date/time field value out of range" in error_str:
            # Bad date
            self._log_error("invalid_date", row_idx, "Invalid date format")
            return True

        else:
            # Unknown error - log but continue
            self._log_error("unknown", row_idx, error_str[:100])
            return True

    def _log_error(self, error_type: str, row_idx: int, message: str):
        """Log an error occurrence."""
        if error_type not in self.error_counts:
            self.error_counts[error_type] = 0
        self.error_counts[error_type] += 1

        self.handled_errors.append({
            'row': row_idx,
            'type': error_type,
            'message': message
        })

        # Only print first few of each type
        if self.error_counts[error_type] <= 3:
            print(f"   ⚠️ Row {row_idx}: {message}", flush=True)

    def get_summary(self) -> Dict[str, Any]:
        """Get error summary."""
        return {
            'total_errors': len(self.handled_errors),
            'error_types': self.error_counts,
            'sample_errors': self.handled_errors[:10]
        }

    def print_summary(self):
        """Print error summary."""
        if not self.handled_errors:
            print("   ✅ No errors encountered")
            return

        print(f"\n   ⚠️ Error Summary:")
        print(f"      Total errors handled: {len(self.handled_errors)}")

        print(f"      Error types:")
        for error_type, count in sorted(self.error_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"        - {error_type}: {count}")

        # Suggest fixes
        if self.error_counts:
            print(f"\n   💡 Suggested fixes:")
            if 'duplicate_edition' in self.error_counts:
                print(f"      - {self.error_counts['duplicate_edition']} duplicate editions (already handled)")
            if 'missing_print' in self.error_counts:
                print(f"      - {self.error_counts['missing_print']} editions reference missing prints")
            if 'invalid_price' in self.error_counts:
                print(f"      - {self.error_counts['invalid_price']} editions have invalid prices")
            if 'size_constraint' in self.error_counts:
                print(f"      - {self.error_counts['size_constraint']} editions have invalid sizes (normalized to Small)")