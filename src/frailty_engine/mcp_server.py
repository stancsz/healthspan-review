"""A dependency-free local MCP stdio server for measurement review.

The server deliberately has no persistence, network calls, patient database, or
diagnostic tool. It exposes parsing and completeness review as MCP tools so a
clinician's approved local client can keep the workflow in its own boundary.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from .clinical_csv import parse_clinical_csv
from .features import FEATURE_NAMES, parse_patient_data
from .mvv import evaluate_mvv
from .seca import read_seca_tableview_csv


SERVER_INFO = {"name": "healthspan-review-local", "version": "0.1.0"}
TOOLS = [
    {
        "name": "parse_seca_csv",
        "description": "Parse a SECA TableView CSV into observed measurements, units, segments, and warnings. No raw CSV is returned.",
        "inputSchema": {
            "type": "object",
            "required": ["csv_text"],
            "properties": {
                "csv_text": {"type": "string"},
                "source_label": {"type": "string"},
            },
        },
    },
    {
        "name": "parse_clinical_csv",
        "description": "Parse a canonical Field,Value,Unit CSV for blood, history, demographics, BIA, and function. Missing fields remain missing.",
        "inputSchema": {
            "type": "object",
            "required": ["csv_text"],
            "properties": {
                "csv_text": {"type": "string"},
                "source_label": {"type": "string"},
            },
        },
    },
    {
        "name": "build_measurement_review",
        "description": "Merge local SECA and clinical inputs into a provenance-aware 35-field completeness review. This is not a diagnosis or clinical assessment.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "seca_csv": {"type": "string"},
                "clinical_csv": {"type": "string"},
                "measurements": {"type": "object"},
                "estimated_ages": {
                    "type": "array",
                    "description": "Optional explicitly supplied age signals. They are returned unchanged in the review packet.",
                    "items": {"type": "object"},
                },
            },
        },
    },
]


def _tool_result(payload: dict[str, Any], *, is_error: bool = False) -> dict[str, Any]:
    return {
        "content": [
            {
                "type": "text",
                "text": json.dumps(payload, ensure_ascii=False, sort_keys=True),
            }
        ],
        "isError": is_error,
    }


def _seca_payload(csv_text: str, source_label: str | None) -> dict[str, Any]:
    export = read_seca_tableview_csv(csv_text)
    latest = export.latest
    return {
        "format": "seca-tableview-review-v1",
        "source_label": source_label or "local SECA TableView CSV",
        "measured_at": latest.measured_at,
        "measurements": latest.all_measurements(),
        "canonical_overlay": latest.to_measurements(),
        "units": latest.units,
        "segments": latest.segmental_skeletal_muscle_mass,
        "unmapped_labels": list(export.unmapped_labels),
        "unit_warnings": list(latest.unit_warnings),
        "derivations": list(latest.derivations),
        "dated_scan_count": len(export.scans),
        "trend": export.trend(),
        "segmental_trend": export.segmental_trend(),
    }


def _clinical_values_from_measurements(measurements: dict[str, Any]) -> dict[str, Any]:
    unknown = sorted(set(measurements) - set(FEATURE_NAMES))
    if unknown:
        raise ValueError("unknown clinical field(s): " + ", ".join(unknown))
    return parse_patient_data(
        {"patient_id": "local-mcp", "measurements": measurements}
    ).values


_AGE_RULES = (
    (
        "body_composition_age",
        "Body composition age",
        -5,
        (
            ("bmi", 24, 0.25, -3, 6, "numeric"),
            ("waist_circumference", 80, 0.12, -4, 8, "numeric"),
            ("visceral_fat", 3, 0.5, -3, 8, "numeric"),
        ),
    ),
    (
        "fluid_cellular_age",
        "Fluid & cellular age",
        -3,
        (
            ("phase_angle", 6, -4, -8, 8, "numeric"),
            ("ecw_tbw", 0.39, 40, -6, 8, "numeric"),
        ),
    ),
    (
        "muscle_age",
        "Muscle age",
        -6,
        (
            ("ffmi", 19, -0.4, -5, 6, "numeric"),
            ("skeletal_muscle_mass", 28, -0.15, -5, 5, "numeric"),
            ("grip_strength", 30, -0.35, -5, 8, "numeric"),
            ("chair_rise_time", 10, 0.75, -5, 12, "numeric"),
        ),
    ),
    (
        "joint_age",
        "Joint age",
        -10,
        (
            ("osteoarthritis", 0, 8, 0, 8, "binary"),
            ("chair_rise_time", 10, 0.25, -5, 12, "numeric"),
            ("grip_strength", 30, -0.15, -5, 8, "numeric"),
            ("bmi", 24, 0.25, -3, 6, "numeric"),
            ("ffmi", 19, -0.2, -4, 4, "numeric"),
        ),
    ),
    ("bone_age", "Bone age", 0, ()),
    ("skin_age", "Skin age", 0, ()),
    (
        "blood_age",
        "Blood age",
        -2,
        (
            ("fasting_glucose", 90, 0.05, -4, 8, "numeric"),
            ("hba1c", 5.2, 3, -4, 8, "numeric"),
            ("hs_crp", 1, 0.4, -3, 8, "numeric"),
            ("albumin", 4.2, -3, -4, 4, "numeric"),
            ("creatinine", 0.9, 2, -3, 5, "numeric"),
            ("egfr", 95, -0.08, -5, 5, "numeric"),
            ("rdw", 12.5, 0.5, -3, 6, "numeric"),
            ("fib_4", 1, 2, -3, 8, "numeric"),
        ),
    ),
    (
        "cardiovascular_age",
        "Cardiovascular age",
        -4,
        (
            ("systolic_bp", 120, 0.08, -5, 10, "numeric"),
            ("diastolic_bp", 80, 0.08, -4, 6, "numeric"),
            ("resting_hr", 65, 0.04, -3, 5, "numeric"),
            ("hypertension", 0, 6, 0, 6, "binary"),
            ("cvd", 0, 10, 0, 10, "binary"),
        ),
    ),
    (
        "cardiorespiratory_age",
        "Cardiorespiratory age",
        -4,
        (
            ("systolic_bp", 120, 0.08, -5, 10, "numeric"),
            ("diastolic_bp", 80, 0.08, -4, 6, "numeric"),
            ("resting_hr", 65, 0.04, -3, 5, "numeric"),
        ),
    ),
    (
        "immune_inflammatory_age",
        "Immune & inflammatory age",
        -1,
        (
            ("hs_crp", 1, 0.5, -3, 10, "numeric"),
            ("wbc", 6, 0.3, -3, 5, "numeric"),
            ("rdw", 12.5, 0.5, -3, 6, "numeric"),
        ),
    ),
    ("brain_cognitive_age", "Brain & cognitive age", 0, ()),
    (
        "metabolic_age",
        "Metabolic age",
        -4,
        (
            ("bmi", 24, 0.25, -3, 6, "numeric"),
            ("waist_circumference", 80, 0.12, -4, 8, "numeric"),
            ("visceral_fat", 3, 0.5, -3, 8, "numeric"),
            ("fasting_glucose", 90, 0.05, -4, 8, "numeric"),
            ("hba1c", 5.2, 3, -4, 8, "numeric"),
            ("t2d", 0, 7, 0, 7, "binary"),
        ),
    ),
    (
        "kidney_age",
        "Kidney age",
        -1,
        (
            ("creatinine", 0.9, 2, -3, 5, "numeric"),
            ("egfr", 95, -0.08, -5, 5, "numeric"),
        ),
    ),
    (
        "liver_age",
        "Liver age",
        -1,
        (
            ("albumin", 4.2, -3, -4, 4, "numeric"),
            ("alp", 80, 0.02, -3, 5, "numeric"),
            ("fib_4", 1, 2, -3, 8, "numeric"),
        ),
    ),
    (
        "sleep_recovery_age",
        "Sleep & recovery age",
        0,
        (
            ("sleep_hours", 7.5, 1.2, -1, 8, "absolute"),
            ("sleep_apnea", 0, 6, 0, 6, "binary"),
        ),
    ),
    (
        "lifestyle_function_age",
        "Lifestyle & function age",
        -5,
        (
            ("grip_strength", 30, -0.35, -5, 8, "numeric"),
            ("chair_rise_time", 10, 0.75, -5, 12, "numeric"),
            ("smoking_status", 0, 0, 0, 5, "smoking"),
            ("alcohol_heavy_use", 0, 4, 0, 4, "binary"),
            ("sleep_hours", 7.5, 1.2, -1, 8, "absolute"),
        ),
    ),
    (
        "mental_health_age",
        "Mental health age",
        0,
        (("depression", 0, 5, 0, 5, "binary"),),
    ),
)


def _estimate_age_signals(values: dict[str, Any]) -> list[dict[str, Any]]:
    """Return one deterministic category estimate for every major category."""

    def has_value(field: str) -> bool:
        return values.get(field) is not None

    def clamp(value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))

    estimates = []
    for key, label, offset, adjustments in _AGE_RULES:
        score = float(values["age"]) + offset if has_value("age") else 45 + offset
        used = ["age"] if has_value("age") else []
        fields = []
        for field, target, scale, minimum, maximum, mode in adjustments:
            fields.append(field)
            if not has_value(field):
                continue
            used.append(field)
            raw = values[field]
            if mode == "binary":
                delta = float(raw) * scale
            elif mode == "smoking":
                delta = {"current": 5, "former": 2, "never": 0}.get(str(raw).lower(), 0)
            elif mode == "absolute":
                delta = abs(float(raw) - target) * scale
            else:
                delta = (float(raw) - target) * scale
            score += clamp(delta, minimum, maximum)
        estimates.append(
            {
                "key": key,
                "label": label,
                "value": round(clamp(score, 18, 100)),
                "unit": "years",
                "status": "estimated_heuristic",
                "basis": used,
                "inputs_used": used,
                "input_coverage": f"{len(used)} / {len(fields) + 1}",
                "method": "Deterministic category estimate from the available measurements.",
                "uncertainty": "Research estimate; review alongside the underlying measurements.",
            }
        )
    return estimates


def _review(arguments: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {name: None for name in FEATURE_NAMES}
    provenance: dict[str, str | None] = {name: None for name in FEATURE_NAMES}
    units: dict[str, str] = {}
    sources: dict[str, Any] = {"seca": None, "clinical": None}
    warnings: list[str] = []
    estimated_ages = arguments.get("estimated_ages")
    if estimated_ages is None:
        estimated_ages = []
    if not isinstance(estimated_ages, list) or any(
        not isinstance(item, dict) for item in estimated_ages
    ):
        raise ValueError("estimated_ages must be an array of objects")
    if arguments.get("seca_csv"):
        seca = read_seca_tableview_csv(str(arguments["seca_csv"]))
        sources["seca"] = _seca_payload(
            str(arguments["seca_csv"]), "local SECA TableView CSV"
        )
        for field, value in seca.latest.to_measurements().items():
            merged[field] = value
            provenance[field] = "SECA TableView CSV"
            units[field] = seca.latest.units.get(field, "")
    if arguments.get("clinical_csv"):
        clinical = parse_clinical_csv(str(arguments["clinical_csv"]))
        sources["clinical"] = {
            key: value
            for key, value in clinical.items()
            if key not in {"values", "units"}
        }
        sources["clinical"]["present_fields"] = clinical["present_fields"]
        for field, value in clinical["values"].items():
            if value is None:
                continue
            if merged[field] is not None and merged[field] != value:
                warnings.append(
                    f"{field}: SECA value retained over conflicting clinical CSV value"
                )
                continue
            merged[field] = value
            provenance[field] = "Clinical inputs CSV"
            units[field] = clinical["units"].get(field, "")
    if arguments.get("measurements") is not None:
        supplied = _clinical_values_from_measurements(dict(arguments["measurements"]))
        for field, value in supplied.items():
            if value is None:
                continue
            if merged[field] is not None and merged[field] != value:
                raise ValueError(f"conflicting values supplied for {field}")
            merged[field] = value
            provenance[field] = "measurements argument"
    present = [name for name in FEATURE_NAMES if merged[name] is not None]
    readiness = evaluate_mvv(merged)
    if not estimated_ages:
        estimated_ages = _estimate_age_signals(merged)
    return {
        "format": "local-measurement-review-v1",
        "sources": sources,
        "complete_profile": {
            "present_count": len(present),
            "total_count": len(FEATURE_NAMES),
            "complete": len(present) == len(FEATURE_NAMES),
        },
        "measurements": [
            {
                "field": name,
                "value": merged[name],
                "unit": units.get(name, ""),
                "provenance": provenance[name],
            }
            for name in FEATURE_NAMES
        ],
        "missing_fields": [name for name in FEATURE_NAMES if name not in present],
        "assessment_readiness": {
            "assessment_ready": readiness["ok"],
            "missing_requirements": readiness["missing"],
        },
        "estimated_ages": estimated_ages,
        "warnings": warnings,
        "boundaries": [
            "No diagnosis or treatment advice.",
            "Estimated age signals are informational heuristic estimates, not a diagnosis or treatment recommendation.",
            "No persistence or external network calls.",
            "E-005 remains blocked.",
        ],
    }


def call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "parse_seca_csv":
        return _tool_result(
            _seca_payload(
                str(arguments.get("csv_text", "")), arguments.get("source_label")
            )
        )
    if name == "parse_clinical_csv":
        return _tool_result(
            parse_clinical_csv(
                str(arguments.get("csv_text", "")),
                source_label=arguments.get("source_label", "local clinical inputs CSV"),
            )
        )
    if name == "build_measurement_review":
        return _tool_result(_review(arguments))
    raise KeyError(name)


def dispatch(request: dict[str, Any]) -> dict[str, Any] | None:
    method = request.get("method")
    request_id = request.get("id")
    if method == "notifications/initialized" or method == "notifications/cancelled":
        return None
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": request.get("params", {}).get(
                    "protocolVersion", "2025-03-26"
                ),
                "capabilities": {"tools": {}},
                "serverInfo": SERVER_INFO,
            },
        }
    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        params = request.get("params", {})
        try:
            result = call_tool(
                str(params.get("name", "")), dict(params.get("arguments") or {})
            )
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except (KeyError, TypeError, ValueError) as error:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": _tool_result({"error": str(error)}, is_error=True),
            }
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": f"method not found: {method}"},
    }


def main() -> None:
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
            response = dispatch(request)
            if response is not None:
                sys.stdout.write(
                    json.dumps(response, ensure_ascii=False, separators=(",", ":"))
                    + "\n"
                )
                sys.stdout.flush()
        except (json.JSONDecodeError, TypeError) as error:
            sys.stdout.write(
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {"code": -32700, "message": str(error)},
                    }
                )
                + "\n"
            )
            sys.stdout.flush()


if __name__ == "__main__":
    main()
