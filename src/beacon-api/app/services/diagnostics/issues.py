"""
Issue extraction for stored diagnostics.

Every evidence fact produced by the profile-driven engine is a finding about a
component, so each one becomes an issue. Title, severity and component come from
the evidence itself (and therefore from the profile), not from a fixed catalog.
"""
from typing import Any, Dict, List, Optional

SEVERITY_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def extract_issues(active_evidences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert evaluator evidence dicts into issue dicts, most severe first."""
    by_code: Dict[str, Dict[str, Any]] = {}
    for evidence in active_evidences or []:
        code = evidence.get("code")
        if not code:
            continue
        confidence = evidence.get("confidence")
        existing = by_code.get(code)
        if existing and (existing["confidence"] or 0.0) >= (confidence or 0.0):
            continue
        by_code[code] = {
            "code": code,
            "check": evidence.get("check") or code.split(":", 1)[0],
            "title": evidence.get("title") or code,
            "subsystem": evidence.get("component_type") or "unknown",
            "component_name": evidence.get("component_name"),
            "metric": evidence.get("metric"),
            "severity": evidence.get("severity") or "MEDIUM",
            "confidence": confidence,
            "description": evidence.get("description"),
            "value": evidence.get("value"),
        }

    return sorted(
        by_code.values(),
        key=lambda i: (SEVERITY_RANK.get(i["severity"], 0), i["confidence"] or 0.0),
        reverse=True,
    )


def max_severity(issues: List[Dict[str, Any]]) -> Optional[str]:
    if not issues:
        return None
    return max((i["severity"] for i in issues), key=lambda s: SEVERITY_RANK.get(s, 0))
