"""Import reporting - tracks actual transformations during import."""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


@dataclass
class ImportReport:
    """Tracks all transformations and actions taken during import.

    This provides a detailed report of what was actually done during import,
    not just what the code is configured to do.
    """

    # Print name transformations: original -> standardized
    print_name_transformations: Dict[str, str] = field(default_factory=dict)

    # Distributor name transformations: original -> standardized
    distributor_name_transformations: Dict[str, str] = field(default_factory=dict)

    # Size normalizations: original -> normalized (with counts)
    size_normalizations: Dict[str, Dict[str, int]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))

    # Frame type normalizations: original -> normalized (with counts)
    frame_type_normalizations: Dict[str, Dict[str, int]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))

    # Date corrections (e.g., 1920 -> 2020)
    date_corrections: List[Dict[str, str]] = field(default_factory=list)

    # Duplicate editions skipped (from decisions file)
    duplicates_skipped: List[str] = field(default_factory=list)

    # Editions skipped due to missing print
    editions_missing_print: List[Dict[str, str]] = field(default_factory=list)

    # Editions with missing distributor (set to NULL)
    editions_missing_distributor: List[str] = field(default_factory=list)

    # Default values applied
    defaults_applied: Dict[str, int] = field(default_factory=lambda: defaultdict(int))

    # Duplicate print names encountered
    duplicate_prints_skipped: List[str] = field(default_factory=list)

    def record_print_name_transform(self, original: str, standardized: str):
        """Record a print name transformation."""
        if original and standardized and original.strip() != standardized:
            key = original.strip()
            if key not in self.print_name_transformations:
                self.print_name_transformations[key] = standardized

    def record_distributor_name_transform(self, original: str, standardized: str):
        """Record a distributor name transformation."""
        if original and standardized and original.strip() != standardized:
            key = original.strip()
            if key not in self.distributor_name_transformations:
                self.distributor_name_transformations[key] = standardized

    def record_size_normalization(self, original: str, normalized: str):
        """Record a size normalization with count."""
        if original:
            orig_key = str(original).strip() if original else "(empty)"
            self.size_normalizations[orig_key][normalized] += 1

    def record_frame_type_normalization(self, original: str, normalized: str):
        """Record a frame type normalization with count."""
        orig_key = str(original).strip() if original else "(empty)"
        self.frame_type_normalizations[orig_key][normalized] += 1

    def record_date_correction(self, original: str, corrected: str, field_name: str):
        """Record a date correction (e.g., 1920 -> 2020)."""
        self.date_corrections.append({
            'original': original,
            'corrected': corrected,
            'field': field_name
        })

    def record_duplicate_skipped(self, edition_name: str, reason: str):
        """Record a duplicate edition that was skipped."""
        self.duplicates_skipped.append(f"{edition_name}: {reason}")

    def record_missing_print(self, edition_name: str, print_name: str):
        """Record an edition skipped due to missing print."""
        self.editions_missing_print.append({
            'edition': edition_name,
            'print_name': print_name
        })

    def record_missing_distributor(self, edition_name: str):
        """Record an edition with missing distributor (set to NULL)."""
        self.editions_missing_distributor.append(edition_name)

    def record_default_applied(self, field_name: str):
        """Record when a default value was applied."""
        self.defaults_applied[field_name] += 1

    def record_duplicate_print_skipped(self, print_name: str):
        """Record a duplicate print that was skipped."""
        self.duplicate_prints_skipped.append(print_name)

    def get_summary(self) -> Dict:
        """Get a summary of all transformations."""
        return {
            'print_names_standardized': len(self.print_name_transformations),
            'distributor_names_standardized': len(self.distributor_name_transformations),
            'sizes_normalized': sum(
                sum(counts.values())
                for counts in self.size_normalizations.values()
            ),
            'frame_types_normalized': sum(
                sum(counts.values())
                for counts in self.frame_type_normalizations.values()
            ),
            'dates_corrected': len(self.date_corrections),
            'duplicates_skipped': len(self.duplicates_skipped),
            'editions_missing_print': len(self.editions_missing_print),
            'editions_missing_distributor': len(self.editions_missing_distributor),
            'defaults_applied': dict(self.defaults_applied),
            'duplicate_prints_skipped': len(self.duplicate_prints_skipped),
        }

    def generate_markdown(self) -> str:
        """Generate a markdown report of all actions taken."""
        lines = []

        # Print name transformations
        if self.print_name_transformations:
            lines.append("## Print Name Standardizations")
            lines.append("")
            lines.append("The following print names were standardized during import:")
            lines.append("")
            lines.append("| Original | Standardized |")
            lines.append("|----------|--------------|")
            for orig, std in sorted(self.print_name_transformations.items()):
                lines.append(f"| `{orig}` | {std} |")
            lines.append("")

        # Distributor name transformations
        if self.distributor_name_transformations:
            lines.append("## Distributor Name Standardizations")
            lines.append("")
            lines.append("The following distributor names were standardized:")
            lines.append("")
            lines.append("| Original | Standardized |")
            lines.append("|----------|--------------|")
            for orig, std in sorted(self.distributor_name_transformations.items()):
                lines.append(f"| `{orig}` | {std} |")
            lines.append("")

        # Size normalizations
        non_trivial_sizes = {k: v for k, v in self.size_normalizations.items()
                           if k.lower() not in ['small', 'large', 'extra large']}
        if non_trivial_sizes:
            lines.append("## Size Normalizations")
            lines.append("")
            lines.append("Size values were normalized to standard values:")
            lines.append("")
            lines.append("| Original | Normalized To | Count |")
            lines.append("|----------|---------------|-------|")
            for orig, normalized_dict in sorted(non_trivial_sizes.items()):
                for normalized, count in normalized_dict.items():
                    lines.append(f"| `{orig}` | {normalized} | {count} |")
            lines.append("")

        # Frame type normalizations
        non_trivial_frames = {k: v for k, v in self.frame_type_normalizations.items()
                            if k.lower() not in ['framed', 'tube only', 'mounted', '(empty)']}
        if non_trivial_frames:
            lines.append("## Frame Type Normalizations")
            lines.append("")
            lines.append("Frame types were normalized to standard values:")
            lines.append("")
            lines.append("| Original | Normalized To | Count |")
            lines.append("|----------|---------------|-------|")
            for orig, normalized_dict in sorted(non_trivial_frames.items()):
                for normalized, count in normalized_dict.items():
                    lines.append(f"| `{orig}` | {normalized} | {count} |")
            lines.append("")

        # Date corrections
        if self.date_corrections:
            lines.append("## Date Corrections")
            lines.append("")
            lines.append(f"**{len(self.date_corrections)} dates were corrected** (e.g., 1920 → 2020 typo fixes)")
            lines.append("")
            # Show first few examples
            if len(self.date_corrections) <= 10:
                for correction in self.date_corrections:
                    lines.append(f"- `{correction['original']}` → `{correction['corrected']}` ({correction['field']})")
            else:
                for correction in self.date_corrections[:5]:
                    lines.append(f"- `{correction['original']}` → `{correction['corrected']}` ({correction['field']})")
                lines.append(f"- ... and {len(self.date_corrections) - 5} more")
            lines.append("")

        # Duplicate prints skipped
        if self.duplicate_prints_skipped:
            lines.append("## Duplicate Prints Skipped")
            lines.append("")
            lines.append(f"**{len(self.duplicate_prints_skipped)} duplicate prints were skipped:**")
            lines.append("")
            for print_name in self.duplicate_prints_skipped:
                lines.append(f"- {print_name}")
            lines.append("")

        # Duplicates skipped
        if self.duplicates_skipped:
            lines.append("## Duplicate Editions Handled")
            lines.append("")
            lines.append(f"**{len(self.duplicates_skipped)} duplicate editions were skipped** based on pre-computed decisions:")
            lines.append("")
            # Show first few examples
            if len(self.duplicates_skipped) <= 10:
                for dup in self.duplicates_skipped:
                    lines.append(f"- {dup}")
            else:
                for dup in self.duplicates_skipped[:5]:
                    lines.append(f"- {dup}")
                lines.append(f"- ... and {len(self.duplicates_skipped) - 5} more")
            lines.append("")

        # Editions with missing print
        if self.editions_missing_print:
            lines.append("## Editions Skipped (Missing Print)")
            lines.append("")
            lines.append(f"**{len(self.editions_missing_print)} editions were skipped** because their print was not found:")
            lines.append("")
            if len(self.editions_missing_print) <= 10:
                for item in self.editions_missing_print:
                    lines.append(f"- {item['edition']} (print: `{item['print_name']}`)")
            else:
                for item in self.editions_missing_print[:5]:
                    lines.append(f"- {item['edition']} (print: `{item['print_name']}`)")
                lines.append(f"- ... and {len(self.editions_missing_print) - 5} more")
            lines.append("")

        # Defaults applied
        if self.defaults_applied:
            lines.append("## Default Values Applied")
            lines.append("")
            lines.append("Default values were applied for missing data:")
            lines.append("")
            lines.append("| Field | Default Value | Times Applied |")
            lines.append("|-------|---------------|---------------|")
            default_descriptions = {
                'size': 'Small',
                'frame_type': 'Framed',
                'status_confidence': 'verified',
            }
            for field_name, count in sorted(self.defaults_applied.items()):
                default_val = default_descriptions.get(field_name, '(configured default)')
                lines.append(f"| {field_name} | {default_val} | {count} |")
            lines.append("")

        # Summary
        lines.append("## Summary")
        lines.append("")
        summary = self.get_summary()
        lines.append(f"- **Print names standardized:** {summary['print_names_standardized']}")
        lines.append(f"- **Distributor names standardized:** {summary['distributor_names_standardized']}")
        lines.append(f"- **Sizes normalized:** {summary['sizes_normalized']}")
        lines.append(f"- **Frame types normalized:** {summary['frame_types_normalized']}")
        lines.append(f"- **Dates corrected:** {summary['dates_corrected']}")
        lines.append(f"- **Duplicate editions skipped:** {summary['duplicates_skipped']}")
        lines.append(f"- **Editions missing print (skipped):** {summary['editions_missing_print']}")
        lines.append(f"- **Duplicate prints skipped:** {summary['duplicate_prints_skipped']}")
        lines.append("")

        return '\n'.join(lines)
