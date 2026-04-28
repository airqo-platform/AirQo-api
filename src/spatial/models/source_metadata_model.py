"""Source metadata inference from OSM context and satellite pollutant signals.

This module combines:
1. Nearby OpenStreetMap-derived site context (category, land use, roads, natural features).
2. Optional Sentinel-5P pollutant summaries over a date window.

It returns ranked source-type candidates and supporting evidence for downstream APIs.
"""

from datetime import datetime, timedelta, timezone
import math
from statistics import mean
from typing import Dict, List, Tuple

from configure import Config
from models.pull_satellite_model import Sentinel5PModel
from models.site_category_model import SiteCategoryModel


class SourceMetadataModel:
    """Build source-attribution metadata for a latitude/longitude point.

    The model produces a normalized ranking across source types:
    `transport`, `industrial`, `biomass_burning`, `dust_resuspension`, and
    `mixed_urban`.
    """

    MODEL_VERSION = "1.0.0"
    DEFAULT_POLLUTANTS = ["NO2", "SO2", "CO", "O3", "HCHO", "AOD", "PM2_5", "PM10"]

    @staticmethod
    def _clean_numeric(value, default=0.0):
        """Safely coerce numeric-like input to float, falling back on invalid values."""
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
        """Normalize non-negative scores to probabilities that sum to ~1.0."""
        total = sum(max(v, 0.0) for v in scores.values())
        if total <= 0:
            n = len(scores)
            return {k: round(1.0 / n, 4) for k in scores.keys()} if n else {}
        return {k: round(max(v, 0.0) / total, 4) for k, v in scores.items()}

    @staticmethod
    def _public_source_type(source_type: str) -> str:
        """Return API-facing source type labels."""
        return "transport" if source_type == "traffic" else source_type

    @staticmethod
    def _looks_like_forest_context(category: str, landuse: str, natural: str, area_name: str) -> bool:
        context = " ".join(
            [
                category or "",
                landuse or "",
                natural or "",
                area_name or "",
            ]
        ).lower()
        forest_markers = {
            "forest",
            "wood",
            "rainforest",
            "national park",
            "reserve",
            "parc national",
            "forêt",
            "foret",
        }
        return any(marker in context for marker in forest_markers)

    @staticmethod
    def _looks_like_remote_context(category: str, area_name: str, highway: str, landuse: str, natural: str) -> bool:
        if highway:
            return False
        context = " ".join([category or "", area_name or "", landuse or "", natural or ""]).lower()
        remote_markers = {
            "background site",
            "forest",
            "wood",
            "reserve",
            "national park",
            "village",
            "hamlet",
            "messaména",
            "haut-nyong",
        }
        return any(marker in context for marker in remote_markers)

    @staticmethod
    def _format_value(value, unit: str = "") -> str:
        try:
            if value is None:
                return "unavailable"
            numeric = float(value)
            if not math.isfinite(numeric):
                return "unavailable"
            if abs(numeric) >= 100:
                formatted = f"{numeric:.1f}"
            elif abs(numeric) >= 10:
                formatted = f"{numeric:.2f}"
            else:
                formatted = f"{numeric:.3f}"
            return f"{formatted} {unit}".strip()
        except Exception:
            return "unavailable"

    @staticmethod
    def _value_available(value) -> bool:
        try:
            return value is not None and math.isfinite(float(value))
        except Exception:
            return False

    @staticmethod
    def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
        return max(lower, min(upper, value))

    def _scaled_signal(self, value, low: float, high: float) -> float:
        if not self._value_available(value):
            return 0.0
        numeric = float(value)
        if numeric <= low:
            return 0.0
        return self._clamp((numeric - low) / (high - low))

    def _infer_from_site_category(
        self,
        category: str,
        landuse: str,
        natural: str,
        highway: str,
    ) -> Tuple[Dict[str, float], List[str]]:
        """Infer source likelihoods from OSM-derived categorical context.

        Returns a tuple of:
        - score dict by source type
        - human-readable evidence statements explaining applied heuristics
        """
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
            score["traffic"] += 0.75
            evidence.append("Site category indicates direct transport corridor influence.")
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
            score["traffic"] += 0.45
            evidence.append(f"Nearby highway type '{highway}' strongly supports transport emissions.")
        elif highway in {"residential", "tertiary", "unclassified", "service"}:
            score["traffic"] += 0.20
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
        """Infer source likelihoods from pollutant threshold heuristics."""
        if Config.SOURCE_METADATA_SATELLITE_PROVIDER == "noaa_nomads":
            return self._infer_from_noaa_nomads(pollutant_means)

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

    def _infer_from_noaa_nomads(
        self, pollutant_means: Dict[str, float]
    ) -> Tuple[Dict[str, float], List[str]]:
        """Infer source likelihoods from NOAA NOMADS GEFS-Chem aerosol fields."""
        score = {
            "traffic": 0.0,
            "industrial": 0.0,
            "biomass_burning": 0.0,
            "dust_resuspension": 0.0,
            "mixed_urban": 0.0,
        }
        evidence = []

        raw_aod = pollutant_means.get("AOD")
        raw_pm25 = pollutant_means.get("PM2_5")
        raw_pm10 = pollutant_means.get("PM10")
        raw_no2 = pollutant_means.get("NO2")
        raw_so2 = pollutant_means.get("SO2")
        raw_co = pollutant_means.get("CO")
        raw_o3 = pollutant_means.get("O3")
        raw_hcho = pollutant_means.get("HCHO")

        aod = self._clean_numeric(raw_aod)
        pm25 = self._clean_numeric(raw_pm25)
        pm10 = self._clean_numeric(raw_pm10)
        no2 = self._clean_numeric(raw_no2)
        so2 = self._clean_numeric(raw_so2)
        co = self._clean_numeric(raw_co)
        o3 = self._clean_numeric(raw_o3)
        hcho = self._clean_numeric(raw_hcho)

        if self._value_available(raw_no2):
            evidence.append(
                f"NO2 mean is {self._format_value(no2, 'ug/m3')}; this is a transport/combustion tracer."
            )
        if self._value_available(raw_so2):
            evidence.append(
                f"SO2 mean is {self._format_value(so2, 'ug/m3')}; this is an industrial or sulfur-fuel tracer."
            )
        if self._value_available(raw_co):
            evidence.append(
                f"CO mean is {self._format_value(co, 'ug/m3')}; elevated values indicate incomplete combustion."
            )
        if self._value_available(raw_hcho):
            evidence.append(
                f"Formaldehyde mean is {self._format_value(hcho, 'ug/m3')}; elevated values indicate VOC oxidation or biomass/urban combustion."
            )
        if self._value_available(raw_o3):
            evidence.append(
                f"O3 mean is {self._format_value(o3, 'ug/m3')}; elevated values indicate secondary regional photochemical pollution."
            )
        if self._value_available(raw_aod):
            evidence.append(
                f"AOD mean is {self._format_value(aod)}; high values indicate column aerosol loading from dust, smoke, or haze."
            )
        if self._value_available(raw_pm25):
            evidence.append(
                f"PM2.5 mean is {self._format_value(pm25, 'ug/m3')}; elevated values indicate fine smoke, combustion, or regional haze."
            )
        if self._value_available(raw_pm10):
            evidence.append(
                f"PM10 mean is {self._format_value(pm10, 'ug/m3')}; elevated values indicate coarse dust or resuspended particles."
            )

        no2_signal = self._scaled_signal(raw_no2, 5.0, 35.0)
        so2_signal = self._scaled_signal(raw_so2, 3.0, 25.0)
        co_signal = self._scaled_signal(raw_co, 200.0, 700.0)
        hcho_signal = self._scaled_signal(raw_hcho, 4.0, 12.0)
        o3_signal = self._scaled_signal(raw_o3, 60.0, 140.0)
        aod_signal = self._scaled_signal(raw_aod, 0.3, 1.5)
        pm25_signal = self._scaled_signal(raw_pm25, 8.0, 45.0)
        pm10_signal = self._scaled_signal(raw_pm10, 30.0, 150.0)
        coarse_ratio = pm10 / pm25 if pm10 > 0 and pm25 > 0 else 0.0
        coarse_signal = self._scaled_signal(coarse_ratio, 1.5, 3.5)

        score["traffic"] += 0.40 * no2_signal + 0.12 * co_signal
        score["industrial"] += 0.35 * so2_signal + 0.10 * no2_signal + 0.10 * pm10_signal
        score["biomass_burning"] += (
            0.22 * co_signal + 0.20 * hcho_signal + 0.18 * pm25_signal
        )
        score["dust_resuspension"] += (
            0.24 * pm10_signal + 0.20 * aod_signal + 0.18 * coarse_signal
        )
        score["mixed_urban"] += (
            0.15 * o3_signal + 0.12 * hcho_signal + 0.10 * pm25_signal
        )

        if no2_signal > 0:
            evidence.append(
                f"NO2 signal contributes {no2_signal:.2f} to transport/combustion scoring."
            )
        if so2_signal > 0:
            evidence.append(
                f"SO2 signal contributes {so2_signal:.2f} to industrial scoring."
            )
        if co_signal > 0:
            evidence.append(
                f"CO signal contributes {co_signal:.2f} to incomplete-combustion scoring."
            )
        if hcho_signal > 0:
            evidence.append(
                f"Formaldehyde signal contributes {hcho_signal:.2f} to biomass/VOC scoring."
            )
        if o3_signal > 0:
            evidence.append(
                f"O3 signal contributes {o3_signal:.2f} to secondary urban/regional scoring."
            )
        if aod_signal > 0:
            evidence.append(
                f"AOD signal contributes {aod_signal:.2f} to aerosol/dust scoring."
            )
        if pm25_signal > 0:
            evidence.append(
                f"PM2.5 signal contributes {pm25_signal:.2f} to smoke/haze scoring."
            )
        if pm10_signal > 0:
            evidence.append(
                f"PM10 signal contributes {pm10_signal:.2f} to coarse-particle scoring."
            )
        if coarse_signal > 0:
            evidence.append(
                f"Coarse PM ratio signal contributes {coarse_signal:.2f} to dust/resuspension scoring."
            )

        if no2 > 25.0:
            evidence.append(
                "NO2 exceeds 25 ug/m3, so transport is strongly weighted and industry is weakly weighted."
            )
        elif no2 > 10.0:
            evidence.append("NO2 exceeds 10 ug/m3, so local transport/combustion is weakly weighted.")

        if so2 > 20.0:
            evidence.append("SO2 exceeds 20 ug/m3, so industrial/sulfur-fuel influence is strongly weighted.")
        elif so2 > 8.0:
            evidence.append("SO2 exceeds 8 ug/m3, so possible industrial/sulfur-fuel influence is weakly weighted.")

        if co > 400.0:
            evidence.append("CO exceeds 400 ug/m3, so incomplete-combustion sources are weighted.")

        if hcho > 8.0:
            evidence.append(
                "Formaldehyde exceeds 8 ug/m3, so biomass burning/VOC oxidation is weighted."
            )

        if o3 > 100.0:
            evidence.append("O3 exceeds 100 ug/m3, so secondary urban/regional pollution is weighted.")

        if aod > 1.0:
            evidence.append("AOD exceeds 1.0, so dust/smoke aerosol loading is weighted.")
        if pm25 > 35.0:
            evidence.append("PM2.5 exceeds 35 ug/m3, so fine combustion/smoke influence is weighted.")
        if pm10 > 100.0:
            evidence.append("PM10 exceeds 100 ug/m3, so coarse dust/industrial particulate influence is weighted.")
        if pm10 > 0 and pm25 > 0 and (pm10 / pm25) > 2.0:
            ratio = pm10 / pm25
            evidence.append(
                f"PM10/PM2.5 ratio is {ratio:.2f}, which supports coarse-particle dust/resuspension influence."
            )

        if not any(value > 0 for value in score.values()):
            evidence.append(
                "No pollutant exceeded the configured attribution thresholds; satellite evidence remains neutral."
            )

        return score, evidence

    def _aggregate_satellite_means(
        self,
        longitude: float,
        latitude: float,
        start_date: str,
        end_date: str,
        pollutants: List[str],
    ) -> Dict[str, float]:
        """Compute per-pollutant means from the configured satellite provider."""
        aggregated = {}
        model = Sentinel5PModel()

        df = model.get_pollutant_data(
            longitude=longitude,
            latitude=latitude,
            start_date=start_date,
            end_date=end_date,
            pollutants=pollutants,
        )

        for pollutant in pollutants:
            values = []
            if pollutant in df.columns:
                for raw_value in df[pollutant].tolist():
                    value = self._clean_numeric(raw_value, default=None)
                    if value is not None:
                        values.append(value)
            aggregated[pollutant] = round(mean(values), 10) if values else None

        return aggregated

    def _adjust_scores_for_context(
        self,
        site_scores: Dict[str, float],
        satellite_scores: Dict[str, float],
        site_evidence: List[str],
        satellite_evidence: List[str],
        category: str,
        landuse: str,
        natural: str,
        highway: str,
        area_name: str,
        satellite_means: Dict[str, float],
    ) -> Tuple[Dict[str, float], Dict[str, float], List[str], List[str]]:
        highway = (highway or "").lower()
        category = category or ""
        landuse = (landuse or "").lower()
        natural = (natural or "").lower()
        area_name = area_name or ""

        if category == "Major Highway" or highway in {"motorway", "trunk", "primary", "secondary"}:
            site_scores["traffic"] = max(site_scores.get("traffic", 0.0), 0.85)
            if not any("transport corridor" in item for item in site_evidence):
                site_evidence.append("Coordinate is on or near a major transport corridor.")

        forest_context = self._looks_like_forest_context(
            category, landuse, natural, area_name
        )
        remote_context = self._looks_like_remote_context(
            category, area_name, highway, landuse, natural
        )

        if forest_context:
            site_scores["biomass_burning"] += 0.18
            site_scores["dust_resuspension"] = max(
                0.0, site_scores.get("dust_resuspension", 0.0) - 0.10
            )
            site_scores["mixed_urban"] = max(
                0.0, site_scores.get("mixed_urban", 0.0) - 0.10
            )
            site_evidence.append("Forest context increases biomass/vegetation-fire plausibility.")

        if remote_context:
            satellite_scores["mixed_urban"] *= 0.35
            satellite_scores["traffic"] *= 0.50
            satellite_evidence.append(
                f"Context '{area_name or category}' appears remote/background, so urban and transport satellite interpretations are downweighted."
            )

        pm10 = self._clean_numeric((satellite_means or {}).get("PM10"))
        pm25 = self._clean_numeric((satellite_means or {}).get("PM2_5"))
        aod = self._clean_numeric((satellite_means or {}).get("AOD"))
        if remote_context and pm10 < 75.0 and aod < 0.8:
            satellite_scores["dust_resuspension"] *= 0.45
            satellite_evidence.append(
                "Dust interpretation is downweighted because "
                f"PM10 is {self._format_value(pm10, 'ug/m3')} and AOD is {self._format_value(aod)}, "
                "below strong dust thresholds."
            )
        if forest_context and pm25 >= 8.0:
            satellite_scores["biomass_burning"] += 0.10
            satellite_evidence.append(
                f"Forest context plus PM2.5 of {self._format_value(pm25, 'ug/m3')} supports smoke or biomass-burning influence."
            )

        return site_scores, satellite_scores, site_evidence, satellite_evidence

    def _candidate_drivers(
        self, source_type: str, pollutant_means: Dict[str, float], category: str, highway: str
    ) -> List[str]:
        pollutant_means = pollutant_means or {}
        no2 = self._clean_numeric(pollutant_means.get("NO2"))
        so2 = self._clean_numeric(pollutant_means.get("SO2"))
        co = self._clean_numeric(pollutant_means.get("CO"))
        hcho = self._clean_numeric(pollutant_means.get("HCHO"))
        o3 = self._clean_numeric(pollutant_means.get("O3"))
        aod = self._clean_numeric(pollutant_means.get("AOD"))
        pm25 = self._clean_numeric(pollutant_means.get("PM2_5"))
        pm10 = self._clean_numeric(pollutant_means.get("PM10"))
        drivers = []

        if source_type == "traffic":
            if category == "Major Highway" or highway:
                drivers.append("road proximity")
            if self._scaled_signal(no2, 5.0, 35.0) > 0:
                drivers.append(f"NO2 {self._format_value(no2, 'ug/m3')}")
            if self._scaled_signal(co, 200.0, 700.0) > 0:
                drivers.append(f"CO {self._format_value(co, 'ug/m3')}")
        elif source_type == "industrial":
            if self._scaled_signal(so2, 3.0, 25.0) > 0:
                drivers.append(f"SO2 {self._format_value(so2, 'ug/m3')}")
            if self._scaled_signal(no2, 5.0, 35.0) > 0:
                drivers.append(f"NO2 {self._format_value(no2, 'ug/m3')}")
            if self._scaled_signal(pm10, 30.0, 150.0) > 0:
                drivers.append(f"PM10 {self._format_value(pm10, 'ug/m3')}")
        elif source_type == "biomass_burning":
            if self._scaled_signal(hcho, 4.0, 12.0) > 0:
                drivers.append(f"HCHO {self._format_value(hcho, 'ug/m3')}")
            if self._scaled_signal(co, 200.0, 700.0) > 0:
                drivers.append(f"CO {self._format_value(co, 'ug/m3')}")
            if self._scaled_signal(pm25, 8.0, 45.0) > 0:
                drivers.append(f"PM2.5 {self._format_value(pm25, 'ug/m3')}")
        elif source_type == "dust_resuspension":
            if self._scaled_signal(pm10, 30.0, 150.0) > 0:
                drivers.append(f"PM10 {self._format_value(pm10, 'ug/m3')}")
            if self._scaled_signal(aod, 0.3, 1.5) > 0:
                drivers.append(f"AOD {self._format_value(aod)}")
            if pm10 > 0 and pm25 > 0:
                drivers.append(f"PM10/PM2.5 ratio {pm10 / pm25:.2f}")
        elif source_type == "mixed_urban":
            if self._scaled_signal(o3, 60.0, 140.0) > 0:
                drivers.append(f"O3 {self._format_value(o3, 'ug/m3')}")
            if self._scaled_signal(hcho, 4.0, 12.0) > 0:
                drivers.append(f"HCHO {self._format_value(hcho, 'ug/m3')}")
            if self._scaled_signal(pm25, 8.0, 45.0) > 0:
                drivers.append(f"PM2.5 {self._format_value(pm25, 'ug/m3')}")

        return drivers[:4]

    def build_source_metadata(
        self,
        latitude: float,
        longitude: float,
        start_date: str = None,
        end_date: str = None,
        pollutants: List[str] = None,
        include_satellite: bool = True,
    ) -> Dict:
        """Build ranked source metadata for a coordinate and time window.

        Args:
            latitude: Target latitude.
            longitude: Target longitude.
            start_date: Inclusive UTC date in `%Y-%m-%d`. Defaults to 7 days before now.
            end_date: Inclusive UTC date in `%Y-%m-%d`. Defaults to today.
            pollutants: Pollutants to aggregate when satellite data is enabled.
            include_satellite: Whether to include Sentinel-5P-derived scoring.

        Returns:
            A dictionary containing primary and candidate source types, evidence,
            and computation metadata.
        """
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

        site_scores, satellite_scores, site_evidence, satellite_evidence = (
            self._adjust_scores_for_context(
                site_scores=site_scores,
                satellite_scores=satellite_scores,
                site_evidence=site_evidence,
                satellite_evidence=satellite_evidence,
                category=category,
                landuse=landuse,
                natural=natural,
                highway=highway,
                area_name=area_name,
                satellite_means=satellite_means or {},
            )
        )

        combined_scores = {
            k: round(site_scores.get(k, 0.0) + satellite_scores.get(k, 0.0), 6)
            for k in site_scores.keys()
        }
        normalized = self._normalize_scores(combined_scores)
        ranked = sorted(normalized.items(), key=lambda x: x[1], reverse=True)

        primary_source = self._public_source_type(ranked[0][0]) if ranked else "unknown"
        primary_confidence = ranked[0][1] if ranked else 0.0

        candidates = [
            {
                "source_type": self._public_source_type(source),
                "confidence": conf,
                "drivers": self._candidate_drivers(
                    source,
                    satellite_means or {},
                    category,
                    highway,
                ),
            }
            for source, conf in ranked[:3]
            if conf > 0
        ]

        data_sources = ["OpenStreetMap (Overpass)"]
        if include_satellite and satellite_error is None:
            if Config.SOURCE_METADATA_SATELLITE_PROVIDER == "noaa_nomads":
                data_sources.append("NOAA NOMADS GEFS-Chem + gas model API")
            else:
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
                "computed_at_utc": datetime.now(timezone.utc).isoformat(),
                "date_range": {"start_date": start_date, "end_date": end_date},
                "data_sources": data_sources,
                "disclaimer": "Source is inferred from heuristics and satellite/context signals; further study and ground validation are required.",
            },
        }
