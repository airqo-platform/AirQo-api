from datetime import datetime
import math
from typing import Dict, List, Optional, Tuple


class SourceMetadataEngine:
    MODEL_VERSION = "0.1.0"
    DEFAULT_POLLUTANTS = ["SO2", "HCHO", "CO", "NO2", "O3", "AOD"]

    @staticmethod
    def _clean_numeric(value, default=0.0):
        try:
            if value is None:
                return default
            numeric = float(value)
            if not math.isfinite(numeric):
                return default
            return numeric
        except Exception:
            return default

    @staticmethod
    def _normalize_scores(scores: Dict[str, float]) -> Dict[str, float]:
        total = sum(max(v, 0.0) for v in scores.values())
        if total <= 0:
            n = len(scores)
            return {k: round(1.0 / n, 4) for k in scores.keys()} if n else {}
        return {k: round(max(v, 0.0) / total, 4) for k, v in scores.items()}

    def _infer_from_site_category(
        self,
        category: str,
        landuse: str,
        natural: str,
        highway: str,
    ) -> Tuple[Dict[str, float], List[str]]:
        score = {
            "traffic": 0.0,
            "industrial": 0.0,
            "biomass_burning": 0.0,
            "dust_resuspension": 0.0,
            "mixed_urban": 0.0,
        }
        evidence = []

        category = (category or "").strip()
        landuse = (landuse or "").strip().lower()
        natural = (natural or "").strip().lower()
        highway = (highway or "").strip().lower()

        if category == "Major Highway":
            score["traffic"] += 0.55
            evidence.append("Site category indicates major-road influence.")
        elif category == "Urban Commercial":
            score["mixed_urban"] += 0.35
            evidence.append("Site category indicates commercial urban activity.")
        elif category == "Urban Background":
            score["mixed_urban"] += 0.30
            score["traffic"] += 0.15
            evidence.append("Site category indicates urban background emissions.")
        elif category == "Background Site":
            score["dust_resuspension"] += 0.20
            score["biomass_burning"] += 0.10
            evidence.append("Site category indicates lower direct anthropogenic pressure.")
        elif category == "Water Body":
            score["mixed_urban"] += 0.05
            evidence.append("Site category indicates water body context.")

        if highway in {"motorway", "trunk", "primary", "secondary"}:
            score["traffic"] += 0.25
            evidence.append(f"Nearby highway type '{highway}' suggests traffic emissions.")
        elif highway in {"residential", "tertiary", "unclassified", "service"}:
            score["traffic"] += 0.12
            evidence.append(f"Nearby road type '{highway}' suggests local traffic influence.")

        if landuse in {"industrial", "quarry", "mine"}:
            score["industrial"] += 0.30
            score["dust_resuspension"] += 0.12
            evidence.append(f"Landuse '{landuse}' suggests industrial/mineral activity.")
        elif landuse in {"commercial", "retail"}:
            score["mixed_urban"] += 0.15
            evidence.append(f"Landuse '{landuse}' suggests dense human activity.")
        elif landuse in {"farmland", "grass", "forest", "scrub", "orchard"}:
            score["biomass_burning"] += 0.12
            evidence.append(f"Landuse '{landuse}' may indicate seasonal biomass influence.")

        if natural in {"bare_rock", "scrub", "heath"}:
            score["dust_resuspension"] += 0.15
            evidence.append(f"Natural feature '{natural}' may indicate dust influence.")

        return score, evidence

    def _infer_from_satellite(
        self, pollutant_means: Dict[str, float]
    ) -> Tuple[Dict[str, float], List[str]]:
        score = {
            "traffic": 0.0,
            "industrial": 0.0,
            "biomass_burning": 0.0,
            "dust_resuspension": 0.0,
            "mixed_urban": 0.0,
        }
        evidence = []

        no2 = self._clean_numeric(pollutant_means.get("NO2"))
        co = self._clean_numeric(pollutant_means.get("CO"))
        so2 = self._clean_numeric(pollutant_means.get("SO2"))
        hcho = self._clean_numeric(pollutant_means.get("HCHO"))
        aod = self._clean_numeric(pollutant_means.get("AOD"))
        o3 = self._clean_numeric(pollutant_means.get("O3"))

        if no2 > 0.00008:
            score["traffic"] += 0.25
            score["industrial"] += 0.10
            evidence.append("Elevated NO2 suggests combustion sources (traffic/industry).")
        if co > 0.03:
            score["biomass_burning"] += 0.25
            score["traffic"] += 0.10
            evidence.append("Elevated CO suggests incomplete combustion.")
        if so2 > 0.00005:
            score["industrial"] += 0.30
            evidence.append("Elevated SO2 suggests industrial/fuel sulfur emissions.")
        if hcho > 0.0001:
            score["biomass_burning"] += 0.12
            score["mixed_urban"] += 0.08
            evidence.append("Elevated HCHO suggests VOC-related oxidation/combustion.")
        if aod > 1.0:
            score["dust_resuspension"] += 0.25
            evidence.append("High AOD suggests particulate loading (dust/smoke).")
        if o3 > 0.13:
            score["mixed_urban"] += 0.10
            evidence.append("Elevated O3 supports secondary pollution formation.")

        return score, evidence

    @staticmethod
    def _validate_coordinates(latitude: float, longitude: float) -> None:
        lat = float(latitude)
        lon = float(longitude)
        if lat < -90 or lat > 90:
            raise ValueError("Latitude must be between -90 and 90.")
        if lon < -180 or lon > 180:
            raise ValueError("Longitude must be between -180 and 180.")

    def build_from_features(
        self,
        latitude: float,
        longitude: float,
        site_category: Optional[Dict] = None,
        satellite_pollutants_mean: Optional[Dict] = None,
        pollutants: Optional[List[str]] = None,
        include_satellite: bool = True,
    ) -> Dict:
        self._validate_coordinates(latitude, longitude)

        if pollutants is None or len(pollutants) == 0:
            pollutants = self.DEFAULT_POLLUTANTS

        site_category = site_category or {}
        satellite_pollutants_mean = satellite_pollutants_mean or {}

        category = site_category.get("category")
        landuse = site_category.get("landuse")
        natural = site_category.get("natural")
        highway = site_category.get("highway")

        site_scores, site_evidence = self._infer_from_site_category(
            category=category, landuse=landuse, natural=natural, highway=highway
        )

        satellite_scores = {
            "traffic": 0.0,
            "industrial": 0.0,
            "biomass_burning": 0.0,
            "dust_resuspension": 0.0,
            "mixed_urban": 0.0,
        }
        satellite_evidence = []

        if include_satellite:
            filtered = {
                key: self._clean_numeric(satellite_pollutants_mean.get(key), default=None)
                for key in pollutants
            }
            filtered = {k: v for k, v in filtered.items() if v is not None}
            satellite_scores, satellite_evidence = self._infer_from_satellite(filtered)
        else:
            filtered = None

        combined_scores = {
            key: round(site_scores.get(key, 0.0) + satellite_scores.get(key, 0.0), 6)
            for key in site_scores.keys()
        }
        normalized = self._normalize_scores(combined_scores)
        ranked = sorted(normalized.items(), key=lambda x: x[1], reverse=True)

        primary_source = ranked[0][0] if ranked else "unknown"
        primary_confidence = ranked[0][1] if ranked else 0.0

        return {
            "location": {"latitude": latitude, "longitude": longitude},
            "primary_source": {
                "source_type": primary_source,
                "confidence": primary_confidence,
            },
            "candidate_sources": [
                {"source_type": source, "confidence": conf}
                for source, conf in ranked[:3]
            ],
            "evidence": {
                "site_category": site_category,
                "satellite_pollutants_mean": filtered,
                "site_reasoning": site_evidence,
                "satellite_reasoning": satellite_evidence,
            },
            "metadata": {
                "model_version": self.MODEL_VERSION,
                "computed_at_utc": datetime.utcnow().isoformat() + "Z",
                "data_sources": [
                    "Site-category context"
                ]
                + (["Satellite pollutant summary"] if include_satellite else []),
            },
        }
