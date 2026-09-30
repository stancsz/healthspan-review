from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd
import pytest

from scripts import build_category_cycle_receipt_2007_2008 as builder


ROOT = Path(__file__).resolve().parents[1]
NHANES_DATA_ROOT = Path(
    os.environ.get("HEALTHSPAN_NHANES_DATA_ROOT", ROOT / "data" / "raw" / "nhanes")
)
DATA = NHANES_DATA_ROOT / "2007-2008"
REQUIRED_FILES = tuple(
    sorted(
        {
            filename
            for mappings in builder.FIELD_MAP.values()
            for filename, _ in mappings
        }
    )
)


def _install_synthetic_reader(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    fields_by_file: dict[str, set[str]] = {}
    for mappings in builder.FIELD_MAP.values():
        for filename, field in mappings:
            fields_by_file.setdefault(filename, set()).add(field)

    frames: dict[Path, pd.DataFrame] = {}
    for filename, fields in fields_by_file.items():
        path = (tmp_path / filename).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(
            b"synthetic test source; read_sas is mocked\n" + filename.encode()
        )
        frame = pd.DataFrame({"SEQN": [2001, 2001, 2002, 2003]})
        for field in fields:
            frame[field] = [1.0, 2.5, None, "not numeric"]
        frames[path] = frame

    def read_sas(path, *, format, encoding):
        assert format == "xport"
        assert encoding == "utf-8"
        return frames[Path(path).resolve()].copy()

    monkeypatch.setattr(builder.pd, "read_sas", read_sas)
    return fields_by_file


def test_synthetic_2007_2008_receipt_counts_fields_and_keeps_boundaries(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fields_by_file = _install_synthetic_reader(tmp_path, monkeypatch)
    receipt = builder.build_receipt(tmp_path)

    assert receipt["cycle"] == "NHANES_2007_2008"
    assert set(receipt["categories"]) == set(builder.FIELD_MAP)
    assert len(receipt["categories"]) == 13
    assert len(receipt["data_sources"]) == len(REQUIRED_FILES)
    for category, mappings in builder.FIELD_MAP.items():
        payload = receipt["categories"][category]
        assert [field["field"] for field in payload["fields"]] == [
            field for _, field in mappings
        ]
        for field_record in payload["fields"]:
            filename = field_record["source"]
            assert field_record["source_rows"] == 4
            assert field_record["source_columns"] == len(fields_by_file[filename]) + 1
            assert field_record["nonmissing_rows"] == 2
            assert field_record["unique_participants_with_value"] == 1

    assert set(receipt["not_collected_in_cycle"]) == {
        "bone_health",
        "brain_cognitive_health",
        "fluid_and_cellular",
        "skin_health",
    }
    assert receipt["boundary"]["participant_ids_emitted"] is False
    assert receipt["boundary"]["raw_rows_emitted"] is False
    assert receipt["boundary"]["measurements_emitted"] is False
    assert "2001" not in json.dumps(receipt)


@pytest.mark.skipif(
    not all((DATA / filename).is_file() for filename in REQUIRED_FILES),
    reason=(
        "Exact NHANES 2007-2008 receipt regeneration requires all raw XPT files; "
        "set HEALTHSPAN_NHANES_DATA_ROOT to a root containing the 2007-2008 directory."
    ),
)
def test_2007_2008_receipt_matches_checked_in_artifact() -> None:
    expected = json.loads(
        (
            ROOT / "docs/REAL_DATA_INTAKE_2007_2008_CATEGORY_RECEIPT_2026-09-11.json"
        ).read_text()
    )
    assert builder.build_receipt(DATA) == expected
