"""Air-pollution source inference from free OpenStreetMap context."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from models.sentinel2_context_model import Sentinel2ContextModel
from models.site_category_model import SiteCategoryModel


class SourceMetadataModel:
    """Rank likely source types without satellite or paid data services."""

    MODEL_VERSION = "2.0.0"
    SOURCE_TYPES = (
        "traffic",
        "industrial",
        "domestic_combustion",
        "biomass_burning",
        "waste_burning",
        "dust_resuspension",
        "mixed_urban",
    )

    @classmethod
    def _empty_scores(cls):
        return {source_type: 0.0 for source_type in cls.SOURCE_TYPES}

    @staticmethod
    def _normalize_scores(scores):
        total = sum(max(value, 0.0) for value in scores.values())
        if total <= 0:
            return {source_type: 0.0 for source_type in scores}
        return {
            source_type: round(max(value, 0.0) / total, 4)
            for source_type, value in scores.items()
        }

    def _infer_from_context(self, category, tags, feature_counts):
        scores = self._empty_scores()
        evidence = []
        landuse = str(tags.get("landuse") or "").lower()
        natural = str(tags.get("natural") or "").lower()
        highway = str(tags.get("highway") or "").lower()
        amenity = str(tags.get("amenity") or "").lower()
        man_made = str(tags.get("man_made") or "").lower()
        power = str(tags.get("power") or "").lower()

        if category == "Major Highway":
            scores["traffic"] += 0.8
            scores["dust_resuspension"] += 0.15
            evidence.append("A major road is the strongest nearby mapped feature.")
        elif category == "Urban Commercial":
            scores["mixed_urban"] += 0.35
            scores["traffic"] += 0.2
            evidence.append("Commercial or industrial urban activity is mapped nearby.")
        elif category == "Urban Background":
            scores["mixed_urban"] += 0.4
            scores["traffic"] += 0.2
            scores["domestic_combustion"] += 0.15
            evidence.append("The point is in a built-up urban or residential context.")
        elif category == "Background Site":
            scores["biomass_burning"] += 0.25
            scores["dust_resuspension"] += 0.2
            evidence.append("The point is in a rural, green, or low-density context.")
        elif category == "Water Body":
            scores["mixed_urban"] += 0.1
            evidence.append("The strongest mapped context is a water feature; local sources are uncertain.")

        if highway in SiteCategoryModel.MAJOR_HIGHWAYS:
            scores["traffic"] += 0.5
            scores["dust_resuspension"] += 0.1
            evidence.append(f"Highway type '{highway}' supports traffic and road-dust influence.")
        elif highway in SiteCategoryModel.LOCAL_HIGHWAYS:
            scores["traffic"] += 0.2
            evidence.append(f"Road type '{highway}' supports local traffic influence.")

        if landuse in {"industrial", "quarry", "mine"} or man_made in {"chimney", "works", "petroleum_well"}:
            scores["industrial"] += 0.75
            scores["dust_resuspension"] += 0.2
            evidence.append(f"Mapped industrial context '{landuse or man_made}' supports industrial emissions.")
        elif landuse == "construction":
            scores["dust_resuspension"] += 0.65
            scores["industrial"] += 0.15
            evidence.append("Mapped construction activity supports fugitive dust.")
        elif landuse in {"commercial", "retail"}:
            scores["mixed_urban"] += 0.3
            scores["traffic"] += 0.15
            evidence.append(f"Land use '{landuse}' supports mixed commercial activity.")
        elif landuse in {"farmland", "farmyard", "forest", "orchard", "scrub"}:
            scores["biomass_burning"] += 0.4
            scores["dust_resuspension"] += 0.15
            evidence.append(f"Land use '{landuse}' may support seasonal biomass or soil-dust influence.")

        if natural in {"bare_rock", "sand", "scrub", "heath"}:
            scores["dust_resuspension"] += 0.35
            evidence.append(f"Natural cover '{natural}' supports wind-blown or resuspended dust.")
        if power in {"plant", "generator"}:
            scores["industrial"] += 0.55
            evidence.append(f"Mapped power infrastructure '{power}' supports stationary combustion.")
        if amenity in {"waste_transfer_station", "waste_disposal", "recycling"}:
            scores["waste_burning"] += 0.6
            evidence.append(f"Mapped waste amenity '{amenity}' supports waste-related emissions.")
        elif amenity == "fuel":
            scores["traffic"] += 0.2
            scores["mixed_urban"] += 0.1
            evidence.append("A mapped fuel station supports transport activity.")

        road_count = int(feature_counts.get("highway", 0) or 0)
        industry_count = (
            int(feature_counts.get("industrial", 0) or 0)
            + int(feature_counts.get("man_made", 0) or 0)
            + int(feature_counts.get("power", 0) or 0)
        )
        if road_count >= 5:
            scores["traffic"] += min(0.3, road_count * 0.015)
            evidence.append(f"{road_count} mapped road features indicate a connected road environment.")
        if industry_count >= 2:
            scores["industrial"] += min(0.3, industry_count * 0.05)
            evidence.append(f"{industry_count} mapped infrastructure features strengthen industrial evidence.")

        if not any(scores.values()):
            scores["mixed_urban"] = 0.1
            evidence.append("No strong mapped source signal was found; attribution confidence is low.")
        return scores, evidence

    def _infer_from_sentinel2(self, satellite_context):
        scores = self._empty_scores()
        evidence = []
        indices = satellite_context.get("indices") or {}
        ndvi = indices.get("ndvi")
        ndbi = indices.get("ndbi")
        ndwi = indices.get("ndwi")
        bare_soil = indices.get("bare_soil_index")
        burn_ratio = indices.get("normalized_burn_ratio")
        aerosol = satellite_context.get("aerosol_optical_thickness")

        if ndvi is not None and ndvi >= 0.45:
            scores["biomass_burning"] += 0.2
            evidence.append(
                f"Sentinel-2 NDVI {ndvi:.2f} indicates substantial vegetation or biomass."
            )
        elif ndvi is not None and ndvi <= 0.15:
            scores["dust_resuspension"] += 0.12
            scores["mixed_urban"] += 0.08
            evidence.append(
                f"Sentinel-2 NDVI {ndvi:.2f} indicates sparse vegetation."
            )

        if ndbi is not None and ndbi >= 0.1:
            scores["mixed_urban"] += 0.25
            scores["domestic_combustion"] += 0.12
            scores["traffic"] += 0.08
            evidence.append(
                f"Sentinel-2 NDBI {ndbi:.2f} supports a built-up surface context."
            )
        if bare_soil is not None and bare_soil >= 0.1:
            scores["dust_resuspension"] += 0.35
            evidence.append(
                f"Sentinel-2 bare-soil index {bare_soil:.2f} supports exposed-soil dust."
            )
        if ndwi is not None and ndwi >= 0.2:
            scores["dust_resuspension"] *= 0.5
            evidence.append(
                f"Sentinel-2 NDWI {ndwi:.2f} indicates water or a wet surface."
            )
        if burn_ratio is not None and burn_ratio < 0.1 and (ndvi or 0) < 0.3:
            scores["biomass_burning"] += 0.18
            evidence.append(
                f"Sentinel-2 burn ratio {burn_ratio:.2f} is consistent with a dry or disturbed surface."
            )
        if aerosol is not None and aerosol >= 0.25:
            scores["dust_resuspension"] += 0.12
            scores["biomass_burning"] += 0.08
            evidence.append(
                f"Sentinel-2 aerosol optical thickness {aerosol:.3f} indicates elevated optical aerosol loading."
            )

        return scores, evidence

    def build_source_metadata(
        self,
        latitude,
        longitude,
        start_date=None,
        end_date=None,
        pollutants=None,
        include_satellite=False,
    ):
        """Build context-only source metadata.

        Satellite context uses the free Sentinel-2 L2A STAC archive.
        """
        site_model = SiteCategoryModel()
        satellite_context = None
        satellite_error = None
        if include_satellite:
            sentinel_model = Sentinel2ContextModel()
            with ThreadPoolExecutor(max_workers=2) as executor:
                site_future = executor.submit(
                    site_model.categorize_site_osm,
                    latitude,
                    longitude,
                )
                satellite_future = executor.submit(
                    sentinel_model.get_context,
                    latitude,
                    longitude,
                    start_date,
                    end_date,
                )
                site_result = site_future.result()
                try:
                    satellite_context = satellite_future.result()
                except Exception as error:
                    satellite_error = str(error)
        else:
            site_result = site_model.categorize_site_osm(latitude, longitude)

        (
            category,
            distance_m,
            area_name,
            landuse,
            natural,
            waterway,
            highway,
            debug_info,
        ) = site_result

        details = site_model.last_details
        matched_feature = details.get("matched_feature") or {}
        tags = dict(matched_feature.get("tags") or {})
        tags.update(
            {
                key: value
                for key, value in {
                    "landuse": landuse,
                    "natural": natural,
                    "waterway": waterway,
                    "highway": highway,
                }.items()
                if value and not tags.get(key)
            }
        )
        raw_scores, evidence = self._infer_from_context(
            category,
            tags,
            details.get("nearby_feature_counts") or {},
        )
        if satellite_context:
            satellite_scores, satellite_evidence = self._infer_from_sentinel2(
                satellite_context
            )
            raw_scores = {
                source_type: raw_scores.get(source_type, 0.0)
                + satellite_scores.get(source_type, 0.0)
                for source_type in self.SOURCE_TYPES
            }
            evidence.extend(satellite_evidence)
        normalized = self._normalize_scores(raw_scores)
        ranked = sorted(normalized.items(), key=lambda item: item[1], reverse=True)
        primary_source, primary_confidence = ranked[0] if ranked else ("unknown", 0.0)
        candidates = [
            {"source_type": source_type, "confidence": confidence}
            for source_type, confidence in ranked
            if confidence > 0
        ][:4]

        return {
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "area_name": area_name,
            },
            "primary_source": {
                "source_type": primary_source,
                "confidence": primary_confidence,
            },
            "candidate_sources": candidates,
            "evidence": {
                "site_category": {
                    "category": category,
                    "distance_to_matched_feature_m": distance_m,
                    "landuse": landuse,
                    "natural": natural,
                    "waterway": waterway,
                    "highway": highway,
                    "classification_method": details.get("classification_method"),
                    "classification_confidence": details.get("confidence"),
                },
                "matched_feature": matched_feature,
                "nearby_feature_counts": details.get("nearby_feature_counts", {}),
                "sentinel2_context": satellite_context,
                "sentinel2_error": satellite_error,
                "reasoning": evidence,
                "osm_debug_info": debug_info,
            },
            "metadata": {
                "model_version": self.MODEL_VERSION,
                "computed_at_utc": datetime.now(timezone.utc).isoformat(),
                "data_sources": [
                    "OpenStreetMap Overpass API",
                    "OpenStreetMap Nominatim",
                    *(
                        ["Copernicus Sentinel-2 L2A via Element 84 Earth Search"]
                        if satellite_context
                        else []
                    ),
                ],
                "satellite_data_used": satellite_context is not None,
                "satellite_provider": (
                    "Copernicus Sentinel-2 L2A via Element 84 Earth Search"
                    if satellite_context
                    else None
                ),
                "elapsed_ms": details.get("elapsed_ms"),
                "cache_hit": details.get("cache_hit", False),
                "disclaimer": (
                    "Sources are inferred from mapped geographic context and require "
                    "ground validation; unmapped or mobile sources may be missed."
                ),
            },
        }
