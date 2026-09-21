"""Strict, local-only parser for the canonical clinical-input CSV contract."""

from __future__ import annotations

import csv
import io
from typing import Any

from .features import FEATURE_BY_NAME, FEATURE_NAMES, parse_patient_data


def parse_clinical_csv(
    text: str, *, source_label: str = "local clinical inputs CSV"
) -> dict[str, Any]:
    """Parse ``Field,Value,Unit`` rows without returning identifiers or raw CSV."""

    if not isinstance(text, str):
        raise ValueError("clinical CSV must be text")
    if len(text.encode("utf-8")) > 5 * 1024 * 1024:
        raise ValueError("clinical CSV exceeds the 5 MB local limit")
    rows = list(csv.DictReader(io.StringIO(text.lstrip("\ufeff"))))
    if not rows:
        raise ValueError("clinical CSV is empty")
    fieldnames = {
        str(name).strip().lower() for name in (rows[0].keys() if rows else ()) if name
    }
    if not {"field", "value"}.issubset(fieldnames):
        raise ValueError("clinical CSV requires Field,Value,Unit columns")
    values: dict[str, Any] = {}
    units: dict[str, str] = {}
    unknown: list[str] = []
    for row_number, row in enumerate(rows, start=2):
        field = str(row.get("Field", row.get("field", "")) or "").strip()
        if not field:
            continue
        if field not in FEATURE_BY_NAME:
            if field not in unknown:
                unknown.append(field)
            continue
        if field in values:
            raise ValueError(f"row {row_number}: duplicate field {field}")
        raw = row.get("Value", row.get("value", ""))
        values[field] = (
            None if raw is None or str(raw).strip() == "" else str(raw).strip()
        )
        unit = row.get("Unit", row.get("unit", ""))
        if unit and str(unit).strip():
            units[field] = str(unit).strip()
    if unknown:
        raise ValueError("unknown clinical field(s): " + ", ".join(sorted(unknown)))
    typed_values: dict[str, Any] = {}
    for field, value in values.items():
        if value is None:
            typed_values[field] = None
            continue
        spec = FEATURE_BY_NAME[field]
        typed_values[field] = float(value) if spec.kind == "numeric" else value
    normalized = parse_patient_data(
        {"patient_id": "local-mcp", "measurements": typed_values}
    ).values
    safe_values = {name: normalized[name] for name in FEATURE_NAMES}
    present = [name for name in FEATURE_NAMES if safe_values[name] is not None]
    return {
        "format": "canonical-clinical-inputs-csv-v1",
        "source_label": source_label,
        "values": safe_values,
        "units": units,
        "present_fields": present,
        "missing_fields": [name for name in FEATURE_NAMES if name not in present],
        "complete": len(present) == len(FEATURE_NAMES),
    }
