from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd
import pytest

from scripts import build_category_distribution_receipt as builder


ROOT = Path(__file__).resolve().parents[1]
NHANES_DATA_ROOT = Path(
    os.environ.get("HEALTHSPAN_NHANES_DATA_ROOT", ROOT / "data" / "raw" / "nhanes")
)
FIELDS = {
    "body_composition": (
        NHANES_DATA_ROOT / "2007-2008" / "BMX_E.XPT",
        "BMXBMI",
    ),
    "fluid_and_cellular": (NHANES_DATA_ROOT / "2003-2004" / "BIX_C.XPT", "BIDTBW"),
    "muscle_health": (
        NHANES_DATA_ROOT / "2007-2008" / "BMX_E.XPT",
        "BMXARMC",
    ),
    "joint_health": (
        NHANES_DATA_ROOT / "2007-2008" / "PFQ_E.XPT",
        "PFQ054",
    ),
    "bone_health": (NHANES_DATA_ROOT / "2005-2006" / "DXX_D.XPT", "DXDTOBMD"),
    "skin_health": (NHANES_DATA_ROOT / "2005-2006" / "DEQ_D.XPT", "DEQ034C"),
    "blood_health": (NHANES_DATA_ROOT / "2007-2008" / "CBC_E.XPT", "LBXHGB"),
    "cardiovascular_health": (
        NHANES_DATA_ROOT / "2007-2008" / "BPX_E.XPT",
        "BPXSY1",
    ),
    "cardiorespiratory_health": (
        NHANES_DATA_ROOT / "2007-2008" / "BPX_E.XPT",
        "BPXSY1",
    ),
    "immune_inflammatory_health": (
        NHANES_DATA_ROOT / "2007-2008" / "CBC_E.XPT",
        "LBXWBCSI",
    ),
    "brain_cognitive_health": (
        NHANES_DATA_ROOT / "2013-2014" / "CFQ_H.XPT",
        "CFDCCS",
    ),
    "metabolic_health": (NHANES_DATA_ROOT / "2007-2008" / "GLU_E.XPT", "LBXGLU"),
    "kidney_health": (
        NHANES_DATA_ROOT / "2007-2008" / "ALB_CR_E.XPT",
        "URXUCR",
    ),
    "liver_health": (
        NHANES_DATA_ROOT / "2007-2008" / "BIOPRO_E.XPT",
        "LBXSATSI",
    ),
    "sleep_and_recovery": (
        NHANES_DATA_ROOT / "2007-2008" / "SLQ_E.XPT",
        "SLD010H",
    ),
    "lifestyle_and_function": (
        NHANES_DATA_ROOT / "2007-2008" / "PFQ_E.XPT",
        "PFQ049",
    ),
    "mental_health_history": (
        NHANES_DATA_ROOT / "2007-2008" / "DPQ_E.XPT",
        "DPQ010",
    ),
}
REQUIRED_FILES = tuple(sorted({path for path, _ in FIELDS.values()}))


def _install_synthetic_reader(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    fields_by_path: dict[Path, set[str]] = {}
    synthetic_fields = {}
    for category, (source_path, field) in FIELDS.items():
        path = (tmp_path / source_path.parent.name / source_path.name).resolve()
        synthetic_fields[category] = (path, field)
        fields_by_path.setdefault(path, set()).add(field)

    frames: dict[Path, pd.DataFrame] = {}
    for path, fields in fields_by_path.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(
            b"synthetic test source; read_sas is mocked\n" + path.name.encode()
        )
        frame = pd.DataFrame({"SEQN": [3001, 3001, 3002, 3003]})
        for field in fields:
            frame[field] = [1.0, 2.5, None, "not numeric"]
        frames[path] = frame

    def read_sas(path, *, format, encoding):
        assert format == "xport"
        assert encoding == "utf-8"
        return frames[Path(path).resolve()].copy()

    monkeypatch.setattr(builder.pd, "read_sas", read_sas)
    return synthetic_fields


def test_synthetic_distribution_receipt_counts_values_and_keeps_boundaries(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    synthetic_fields = _install_synthetic_reader(tmp_path, monkeypatch)
    receipt = builder.build_receipt(synthetic_fields)

    assert receipt["category_count"] == 17
    assert set(receipt["distributions"]) == set(FIELDS)
    for category, (_, field) in synthetic_fields.items():
        summary = receipt["distributions"][category]
        assert summary["field"] == field
        assert summary["source_rows"] == 4
        assert summary["n"] == 2
        assert summary["unique_participants_with_value"] == 1
        assert summary["min"] == 1.0
        assert summary["median"] == 1.75
        assert summary["max"] == 2.5
        assert summary["q05"] <= summary["median"] <= summary["q95"]

    assert receipt["boundary"]["participant_ids_emitted"] is False
    assert receipt["boundary"]["raw_rows_emitted"] is False
    assert receipt["boundary"]["measurements_emitted"] is False
    assert receipt["boundary"]["clinical_validity"] == "not_established"
    assert receipt["boundary"]["numeric_category_age"] == "withheld"
    assert receipt["boundary"]["e005_status"] == "blocked"
    assert "3001" not in json.dumps(receipt)


@pytest.mark.skipif(
    not all(path.is_file() for path in REQUIRED_FILES),
    reason=(
        "Exact NHANES category-distribution regeneration requires all raw XPT files; "
        "set HEALTHSPAN_NHANES_DATA_ROOT to a root containing the 2003-2004, "
        "2005-2006, 2007-2008, and 2013-2014 directories."
    ),
)
def test_distribution_receipt_matches_checked_in_artifact() -> None:
    expected = json.loads(
        (ROOT / "docs/CATEGORY_DISTRIBUTION_RECEIPT_2026-09-11.json").read_text()
    )
    assert builder.build_receipt(FIELDS) == expected
