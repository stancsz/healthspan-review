"""Regression tests for the local MCP measurement-review surface."""

import json
from pathlib import Path

from frailty_engine.mcp_server import call_tool, dispatch


ROOT = Path(__file__).parents[1]


def _text(result: dict) -> dict:
    return json.loads(result["content"][0]["text"])


def test_mcp_lists_only_local_review_tools() -> None:
    response = dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert response is not None
    names = [tool["name"] for tool in response["result"]["tools"]]
    assert names == ["parse_seca_csv", "parse_clinical_csv", "build_measurement_review"]


def test_complete_synthetic_review_returns_35_of_35_without_raw_csv() -> None:
    seca = (ROOT / "docs" / "example-seca-tableview.csv").read_text(encoding="utf-8")
    clinical = (ROOT / "docs" / "example-clinical-inputs.csv").read_text(
        encoding="utf-8"
    )
    result = _text(
        call_tool(
            "build_measurement_review",
            {
                "seca_csv": seca,
                "clinical_csv": clinical,
                "estimated_ages": [
                    {
                        "key": "joint_age",
                        "label": "Joint age",
                        "value": 35,
                        "unit": "years",
                        "status": "illustrative_estimate",
                    }
                ],
            },
        )
    )
    assert result["complete_profile"] == {
        "present_count": 35,
        "total_count": 35,
        "complete": True,
    }
    assert result["missing_fields"] == []
    assert result["assessment_readiness"]["assessment_ready"] is True
    assert result["estimated_ages"][0]["label"] == "Joint age"
    assert result["estimated_ages"][0]["value"] == 35
    assert "csv_text" not in json.dumps(result)
    assert "patient_id" not in json.dumps(result)


def test_mcp_dispatches_notifications_without_response() -> None:
    assert dispatch({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
