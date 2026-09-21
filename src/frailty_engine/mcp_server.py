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
                    "description": "Optional explicitly supplied illustrative age signals. They are returned unchanged and are not validated model outputs.",
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


def _review(arguments: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {name: None for name in FEATURE_NAMES}
    provenance: dict[str, str | None] = {name: None for name in FEATURE_NAMES}
    units: dict[str, str] = {}
    sources: dict[str, Any] = {"seca": None, "clinical": None}
    warnings: list[str] = []
    estimated_ages = arguments.get("estimated_ages") or []
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
            "Estimated age signals are illustrative, unvalidated, and not a biological or system age.",
            "No validated biological or system age.",
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
