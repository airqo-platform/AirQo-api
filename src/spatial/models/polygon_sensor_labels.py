"""Weak labeling helpers for polygon-based sensor siting.

These labels are not learned from historical outcomes yet. They provide a
cleanly separated, low-cost scoring layer that turns the optimizer's feature
scores into:
1. a site category label
2. a label score used internally for ranking candidate locations
"""

from typing import Mapping


SITE_CATEGORIES = (
    "Commercial",
    "Urban Background",
    "Background",
    "Rural",
)


def _clamp(value: float) -> float:
    return max(0.0, min(float(value), 1.0))


def _feature_value(scores: Mapping[str, float], key: str) -> float:
    return _clamp(scores.get(key, 0.0))


def category_signal(scores: Mapping[str, float], category: str) -> float:
    """Return a weak label confidence for the requested site category."""
    transport = _feature_value(scores, "transport_score")
    urban = _feature_value(scores, "urban_score")
    industry = _feature_value(scores, "industry_score")
    environment = _feature_value(scores, "environment_score")

    if category == "Commercial":
        return _clamp(0.55 * industry + 0.35 * transport + 0.10 * urban)

    if category == "Urban Background":
        return _clamp(
            0.55 * urban
            + 0.20 * (1.0 - transport)
            + 0.15 * (1.0 - industry)
            + 0.10 * environment
        )

    if category == "Rural":
        return _clamp(
            0.60 * environment
            + 0.20 * (1.0 - urban)
            + 0.20 * (1.0 - industry)
        )

    # Background should capture moderate exposure areas that are not strongly
    # commercial and not strongly rural.
    return _clamp(
        0.35 * (1.0 - transport)
        + 0.30 * (1.0 - industry)
        + 0.20 * urban
        + 0.15 * environment
    )


def classify_site_category(scores: Mapping[str, float]) -> str:
    """Infer a site category label from the feature-score mix."""
    return max(
        SITE_CATEGORIES,
        key=lambda category: (category_signal(scores, category), category),
    )


def compute_label_score(
    scores: Mapping[str, float],
    category: str | None = None,
) -> float:
    """Return the ranking score used by the optimizer.

    The score blends the heuristic suitability score with category confidence
    so selection remains stable even when multiple cells have similar raw
    suitability.
    """
    resolved_category = category or classify_site_category(scores)
    suitability = _feature_value(scores, "suitability_score")
    confidence = category_signal(scores, resolved_category)
    return _clamp(0.75 * suitability + 0.25 * confidence)
