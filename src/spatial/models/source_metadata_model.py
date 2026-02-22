from datetime import datetime, timedelta
import math
from statistics import mean
from typing import Dict, List, Tuple

from models.pull_satellite_model import Sentinel5PModel
from models.site_category_model import SiteCategoryModel


class SourceMetadataModel:
    MODEL_VERSION = "1.0.0"
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

    def _aggregate_satellite_means(
        self,
        longitude: float,
        latitude: float,
        start_date: str,
        end_date: str,
        pollutants: List[str],
    ) -> Dict[str, float]:
        aggregated = {}
        model = Sentinel5PModel()

        for pollutant in pollutants:
            values = []
            try:
                # Query each pollutant independently to avoid mixed-frame NaN contamination.
                df = model.get_pollutant_data(
                    longitude=longitude,
                    latitude=latitude,
                    start_date=start_date,
                    end_date=end_date,
                    pollutants=[pollutant],
                )
                if pollutant in df.columns:
                    for raw_value in df[pollutant].tolist():
                        value = self._clean_numeric(raw_value, default=None)
                        if value is not None:
                            values.append(value)
            except Exception:
                values = []

            aggregated[pollutant] = round(mean(values), 10) if values else None

        return aggregated

    def build_source_metadata(
        self,
        latitude: float,
        longitude: float,
        start_date: str = None,
        end_date: str = None,
        pollutants: List[str] = None,
        include_satellite: bool = True,
    ) -> Dict:
        if pollutants is None or len(pollutants) == 0:
            pollutants = self.DEFAULT_POLLUTANTS

        if end_date is None:
            end_date = datetime.utcnow().strftime("%Y-%m-%d")
        if start_date is None:
            start_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")

        site_model = SiteCategoryModel(category=None)
        (
            category,
            search_radius,
            area_name,
            landuse,
            natural,
            waterway,
            highway,
            debug_info,
        ) = site_model.categorize_site_osm(latitude, longitude)

        site_scores, site_evidence = self._infer_from_site_category(
            category=category, landuse=landuse, natural=natural, highway=highway
        )

        satellite_means = None
        satellite_scores = {
            "traffic": 0.0,
            "industrial": 0.0,
            "biomass_burning": 0.0,
            "dust_resuspension": 0.0,
            "mixed_urban": 0.0,
        }
        satellite_evidence = []
        satellite_error = None

        if include_satellite:
            try:
                satellite_means = self._aggregate_satellite_means(
                    longitude=longitude,
                    latitude=latitude,
                    start_date=start_date,
                    end_date=end_date,
                    pollutants=pollutants,
                )
                satellite_scores, satellite_evidence = self._infer_from_satellite(
                    satellite_means
                )
            except Exception as ex:
                satellite_error = str(ex)

        combined_scores = {
            k: round(site_scores.get(k, 0.0) + satellite_scores.get(k, 0.0), 6)
            for k in site_scores.keys()
        }
        normalized = self._normalize_scores(combined_scores)
        ranked = sorted(normalized.items(), key=lambda x: x[1], reverse=True)

        primary_source = ranked[0][0] if ranked else "unknown"
        primary_confidence = ranked[0][1] if ranked else 0.0

        candidates = [
            {"source_type": source, "confidence": conf}
            for source, conf in ranked[:3]
        ]

        data_sources = ["OpenStreetMap (Overpass)"]
        if include_satellite:
            data_sources.append("Google Earth Engine Sentinel-5P")

        return {
            "location": {"latitude": latitude, "longitude": longitude},
            "primary_source": {
                "source_type": primary_source,
                "confidence": primary_confidence,
            },
            "candidate_sources": candidates,
            "evidence": {
                "site_category": {
                    "category": category,
                    "search_radius": search_radius,
                    "area_name": area_name,
                    "landuse": landuse,
                    "natural": natural,
                    "waterway": waterway,
                    "highway": highway,
                },
                "satellite_pollutants_mean": satellite_means,
                "site_reasoning": site_evidence,
                "satellite_reasoning": satellite_evidence,
                "osm_debug_info": debug_info,
                "satellite_error": satellite_error,
            },
            "metadata": {
                "model_version": self.MODEL_VERSION,
                "computed_at_utc": datetime.utcnow().isoformat() + "Z",
                "date_range": {"start_date": start_date, "end_date": end_date},
                "data_sources": data_sources,
            },
        }
