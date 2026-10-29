import math
from typing import List, Dict, Any, Optional
from app.services.diagnostics.evidence import EvidenceFact


class DiagnosticReasoner:
    """
    Probabilistic Evidential Reasoner for IoT Diagnostics.
    Combines active Evidence Facts against Candidate Failure Hypotheses using weighted Log-Odds aggregation.
    """

    def diagnose(
        self,
        active_evidences: List[EvidenceFact],
        candidate_causes: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Evaluates active evidence against candidate root causes.

        Each candidate cause structure:
        {
            "code": "CAUSE_BATTERY_DEGRADATION",
            "title": "Battery Capacity Loss / Cell Degradation",
            "category": "HARDWARE_FAILURE",
            "recommended_action": "Replace LiFePO4 battery pack at next site visit.",
            "rules": [
                {"evidence_code": "EVID_BATTERY_RAPID_NIGHT_DISCHARGE", "weight": 3.5, "is_mandatory": True},
                {"evidence_code": "EVID_SOLAR_INPUT_NORMAL", "weight": 2.0, "is_mandatory": False},
                {"evidence_code": "EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY", "weight": -3.0, "is_mandatory": False},
                {"evidence_code": "EVID_POOR_WEATHER_CONDITIONS", "weight": -2.5, "is_mandatory": False}
            ]
        }
        """
        evidence_map: Dict[str, EvidenceFact] = {e.code: e for e in active_evidences}
        diagnoses: List[Dict[str, Any]] = []

        for cause in candidate_causes:
            cause_code = cause.get("code")
            title = cause.get("title")
            action = cause.get("recommended_action")
            rules = cause.get("rules", [])

            log_odds = 0.0
            supporting_evidence: List[Dict[str, Any]] = []
            refuting_evidence: List[Dict[str, Any]] = []
            mandatory_passed = True

            for rule in rules:
                ev_code = rule.get("evidence_code")
                weight = float(rule.get("weight", 0.0))
                is_mandatory = bool(rule.get("is_mandatory", False))

                if ev_code in evidence_map:
                    ev = evidence_map[ev_code]
                    contribution = weight * float(ev.confidence)
                    log_odds += contribution

                    if contribution > 0:
                        supporting_evidence.append({
                            "evidence": ev.description,
                            "contribution": round(contribution, 2),
                        })
                    elif contribution < 0:
                        refuting_evidence.append({
                            "evidence": ev.description,
                            "contribution": round(contribution, 2),
                        })
                else:
                    # If mandatory evidence is not present, cause cannot be confirmed
                    if is_mandatory:
                        mandatory_passed = False

            if not mandatory_passed:
                continue

            # Only evaluate causes that have at least one supporting evidence
            if not supporting_evidence:
                continue

            # Logistic Sigmoid conversion from log-odds to probability [0.0, 1.0]
            if log_odds > 15.0:
                confidence = 0.999
            elif log_odds < -15.0:
                confidence = 0.001
            else:
                confidence = 1.0 / (1.0 + math.exp(-log_odds))

            confidence_pct = round(confidence * 100.0, 1)

            # Include if confidence is >= 50%
            if confidence_pct >= 50.0:
                diagnoses.append({
                    "cause_code": cause_code,
                    "title": title,
                    "confidence_percentage": confidence_pct,
                    "supporting_evidence": supporting_evidence,
                    "refuting_evidence": refuting_evidence,
                    "recommended_action": action,
                })

        # Sort highest confidence first
        diagnoses.sort(key=lambda d: d["confidence_percentage"], reverse=True)
        return diagnoses
