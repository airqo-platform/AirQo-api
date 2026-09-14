"""
Root-cause analysis over the profile's component graph.

- Dependency relationships (POWERS, COOLS, COMMUNICATES_VIA): a faulty upstream
  component explains faults on the components that depend on it, so one cause is
  reported instead of several.
- An unmonitored component whose dependents all show faults is reported as suspected.
- MEASURES_SAME_AS disagreements are attributed to whichever side has its own fault;
  otherwise they are reported as a disagreement between the two.

Confidence combines evidence with a noisy-OR: 1 − Π(1 − confidence × impact).
"""
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.diagnostics.evidence import DEVICE_COMPONENT, EvidenceFact
from app.services.diagnostics.profile_model import DiagnosticModel

_DISAGREEMENT = "SENSOR_DISAGREEMENT"


class RootCauseAnalyzer:
    def analyze(self, evidences: List[EvidenceFact], model: DiagnosticModel) -> List[Dict[str, Any]]:
        if not evidences:
            return []

        own: Dict[str, List[EvidenceFact]] = {}
        disagreements: List[EvidenceFact] = []
        for ev in evidences:
            if ev.check == _DISAGREEMENT:
                disagreements.append(ev)
            else:
                own.setdefault(ev.component_name, []).append(ev)
        faulty = set(own)

        explained: Dict[str, str] = {}
        for component in sorted(faulty):
            ancestor = self._nearest_faulty_ancestor(component, faulty, model)
            if ancestor:
                explained[component] = ancestor
        self._collapse_to_terminal_roots(explained)

        suspected: Dict[str, List[str]] = {}
        for name, component in model.components.items():
            if name in faulty or component.mapped_metrics:
                continue
            dependents = [
                d for d in model.downstream(name)
                if d in model.components
                and (model.components[d].mapped_metrics or d in model.transmission_components)
            ]
            root_dependents = [d for d in dependents if d in faulty and d not in explained]
            if len(dependents) >= 2 and len(root_dependents) == len(dependents):
                suspected[name] = dependents
                for d in dependents:
                    explained[d] = name

        roots = sorted(faulty - set(explained))
        attached: Dict[str, List[EvidenceFact]] = {}
        standalone: List[EvidenceFact] = []
        for ev in disagreements:
            sides = [ev.component_name] + ev.related_components
            faulty_sides = [s for s in sides if s in faulty]
            if len(faulty_sides) == 1:
                side = faulty_sides[0]
                attached.setdefault(explained.get(side, side), []).append(ev)
            elif faulty_sides:
                for side in faulty_sides:
                    attached.setdefault(explained.get(side, side), []).append(ev)
            else:
                standalone.append(ev)

        diagnoses: List[Dict[str, Any]] = []
        for root in roots:
            affected = sorted(d for d, up in explained.items() if up == root)
            contributions = [(ev, 1.0) for ev in own[root] + attached.get(root, [])]
            contributions += [
                (ev, self._factor(model, ev)) for d in affected for ev in own.get(d, []) + attached.get(d, [])
            ]
            diagnoses.append(self._component_fault(root, affected, own[root], contributions, model))

        for name, dependents in suspected.items():
            contributions = [(ev, self._factor(model, ev)) for d in dependents for ev in own.get(d, [])]
            component = model.components[name]
            diagnoses.append(self._diagnosis(
                code=f"COMPONENT_SUSPECTED:{name}",
                title=f"{name} ({component.component_type}) suspected fault",
                component_name=name,
                affected=dependents,
                contributions=contributions,
                model=model,
                action=(
                    f"{name} has no monitored metrics, but every component that depends on it "
                    f"({', '.join(dependents)}) shows faults. Inspect {name}."
                ),
            ))

        for ev in standalone:
            sides = [ev.component_name] + ev.related_components
            diagnoses.append(self._diagnosis(
                code=ev.code,
                title=ev.title,
                component_name=ev.component_name,
                affected=ev.related_components,
                contributions=[(ev, 1.0)],
                model=model,
                action=(
                    f"Compare {' and '.join(sides)} against a reference; one of them is likely drifting, "
                    f"obstructed or miscalibrated."
                ),
            ))

        threshold = model.policy["min_diagnosis_confidence"]
        diagnoses = [d for d in diagnoses if d["confidence_percentage"] >= threshold]
        diagnoses.sort(key=lambda d: d["confidence_percentage"], reverse=True)
        return diagnoses

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _collapse_to_terminal_roots(explained: Dict[str, str]) -> None:
        """
        Point every explained component at the top of its fault chain (battery -> modem -> sensor
        makes the sensor explained by the battery). A dependency cycle keeps one member as the root.
        """
        for component in sorted(explained):
            if component not in explained:
                continue
            seen = {component}
            root = explained[component]
            while root in explained and root not in seen:
                seen.add(root)
                root = explained[root]
            if root in seen:
                del explained[component]
            else:
                explained[component] = root

    @staticmethod
    def _nearest_faulty_ancestor(component: str, faulty: Set[str], model: DiagnosticModel) -> Optional[str]:
        visited = {component}
        frontier = list(model.upstream.get(component, []))
        while frontier:
            next_frontier = []
            for up in frontier:
                if up in visited:
                    continue
                visited.add(up)
                if up in faulty:
                    return up
                next_frontier.extend(model.upstream.get(up, []))
            frontier = next_frontier
        return None

    @staticmethod
    def _policy(model: DiagnosticModel, ev: EvidenceFact) -> Dict[str, Any]:
        component = model.components.get(ev.component_name)
        return component.policy if component else model.policy

    def _factor(self, model: DiagnosticModel, ev: EvidenceFact) -> float:
        return self._policy(model, ev)["downstream_evidence_factor"]

    def _component_fault(
        self,
        root: str,
        affected: List[str],
        own_evidence: List[EvidenceFact],
        contributions: List[Tuple[EvidenceFact, float]],
        model: DiagnosticModel,
    ) -> Dict[str, Any]:
        component = model.components.get(root)
        component_type = component.component_type if component else DEVICE_COMPONENT
        findings = "; ".join(dict.fromkeys(ev.title for ev in own_evidence))
        action = f"Inspect {root} ({component_type}): {findings}."
        if affected:
            action += f" Check it first — it likely explains the issues on {', '.join(affected)}."
        return self._diagnosis(
            code=f"COMPONENT_FAULT:{root}",
            title=f"{root} ({component_type}) fault",
            component_name=root,
            affected=affected,
            contributions=contributions,
            model=model,
            action=action,
        )

    def _diagnosis(
        self,
        code: str,
        title: str,
        component_name: str,
        affected: List[str],
        contributions: List[Tuple[EvidenceFact, float]],
        model: DiagnosticModel,
        action: str,
    ) -> Dict[str, Any]:
        remaining = 1.0
        supporting = []
        for ev, factor in contributions:
            impact = self._policy(model, ev)["impact"].get(ev.check, 0.5)
            contribution = max(0.0, min(1.0, ev.confidence * impact * factor))
            remaining *= 1.0 - contribution
            supporting.append({"evidence": ev.description, "contribution": round(contribution, 3)})
        supporting.sort(key=lambda s: s["contribution"], reverse=True)
        return {
            "cause_code": code,
            "title": title,
            "component_name": component_name,
            "affected_components": affected,
            "confidence_percentage": round((1.0 - remaining) * 100.0, 1),
            "supporting_evidence": supporting,
            "refuting_evidence": [],
            "recommended_action": action,
        }
