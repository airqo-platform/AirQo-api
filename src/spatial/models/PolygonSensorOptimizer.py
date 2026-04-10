"""Polygon-based sensor siting with bounded on-disk OSMnx caching.

This module uses OSMnx to fetch OpenStreetMap features when generating
candidate sensor locations. OSMnx caches HTTP responses as JSON files on disk.
Without pruning, that cache can grow indefinitely in ``src/spatial/cache``.

Maintenance notes:
- ``OSMNX_CACHE_DIR`` keeps the cache local to the spatial service.
- ``_prune_osmnx_cache`` applies a simple retention policy on startup.
- The retention knobs are controlled through:
  - ``OSMNX_CACHE_MAX_FILES``
  - ``OSMNX_CACHE_MAX_AGE_HOURS``
"""

import logging
import os
import random
import time
from pathlib import Path
from typing import Dict, List, Tuple, Union

import numpy as np
import geopandas as gpd
import osmnx as ox
from shapely.geometry import Polygon, Point, box
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans
from scipy.spatial import KDTree
import pandas as pd 

from models.polygon_sensor_labels import (
    SITE_CATEGORIES,
    classify_site_category,
    compute_label_score,
)

logger = logging.getLogger(__name__)

# Configure OSMnx to use a service-local cache directory instead of a global one.
OSMNX_CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
try:
    OSMNX_CACHE_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    print(f"Warning: Failed to create OSMnx cache directory at {OSMNX_CACHE_DIR}. Caching will be disabled.")
    pass
ox.settings.use_cache = True
ox.settings.log_console = True
ox.settings.cache_folder = str(OSMNX_CACHE_DIR)


def _get_int_env(var_name: str, default: int) -> int:
    """Return an integer env var value or fall back to the provided default."""
    raw_value = os.getenv(var_name, default)
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid value for %s; using fallback %d.",
            var_name,
            default,
        )
        return default


def _prune_osmnx_cache() -> None:
    """Delete stale OSMnx cache files so the cache directory stays bounded.

    Files are removed in two passes:
    1. Drop anything older than ``OSMNX_CACHE_MAX_AGE_HOURS``.
    2. Keep only the newest ``OSMNX_CACHE_MAX_FILES`` JSON files.
    """
    max_files = _get_int_env("OSMNX_CACHE_MAX_FILES", 100)
    max_age_hours = _get_int_env("OSMNX_CACHE_MAX_AGE_HOURS", 168)

    try:
        cache_files = sorted(
            OSMNX_CACHE_DIR.glob("*.json"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
    except OSError:
        return

    if max_age_hours > 0:
        expiry_seconds = max_age_hours * 3600
        now = time.time()
        for cache_file in list(cache_files):
            try:
                if now - cache_file.stat().st_mtime > expiry_seconds:
                    cache_file.unlink(missing_ok=True)
            except OSError:
                continue

    if max_files > 0:
        try:
            cache_files = sorted(
                OSMNX_CACHE_DIR.glob("*.json"),
                key=lambda path: path.stat().st_mtime,
                reverse=True,
            )
        except OSError:
            return

        for cache_file in cache_files[max_files:]:
            try:
                cache_file.unlink(missing_ok=True)
            except OSError:
                continue


def _is_transient_osm_error(error: Exception) -> bool:
    message = str(error).lower()
    transient_markers = (
        "server load too high",
        "too many requests",
        "rate limit",
        "timed out",
        "timeout",
        "gateway timeout",
        "temporarily unavailable",
        "connection reset",
        "remote end closed",
        "429",
        "502",
        "503",
        "504",
    )
    return any(marker in message for marker in transient_markers)


def _fetch_osm_features_with_retries(*, bounds, tags, description: str, retries: int = 3, base_delay: int = 2):
    last_error = None

    for attempt in range(1, retries + 1):
        try:
            return ox.features_from_bbox(*bounds, tags=tags)
        except Exception as error:
            last_error = error
            if attempt == retries or not _is_transient_osm_error(error):
                break

            delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, 0.5)
            logger.warning(
                "Transient OSM error while fetching %s on attempt %d/%d: %s. Retrying in %.1f seconds.",
                description,
                attempt,
                retries,
                error,
                delay,
            )
            time.sleep(delay)

    raise last_error


class PolygonSensorOptimizer:
    """
    Advanced sensor placement optimizer with improved spatial distribution:
    - Takes any user-drawn polygon as input
    - Enforces minimum distance between sensors with spatial dispersion
    - Provides detailed justification for each location
    - Uses adaptive grid sizing with uniform cell distribution
    - Categorizes sites as Commercial, Urban Background, Background, or Rural
    - Prioritizes air quality data using hybrid K-Means clustering
    - Ensures representation of all site categories
    - Avoids deployment in water bodies
    - Uses stratified sampling for random points within grid cells
    - Recommends a subset of sites for optimal coverage and even distribution
    - Reports maximum, minimum, and recommended sensor sites 
    """

    def __init__(self):
        # Prune before new OSMnx requests are made so cache growth stays bounded
        # during normal API traffic without requiring a separate cleanup job.
        _prune_osmnx_cache()
        self.default_config = {
            'grid': {
                'auto_size': True,
                'base_cell_area': 0.0001,
                'min_cells': 50,
                'max_cells': 5000,
                'user_override': None,
                'exclude_water': True,
            },
            'distance': {
                'min_sensor_distance': 0,
                'enforce_method': 'hybrid'  # New method for spatial dispersion
            },
            'weights': {
                'transport': {
                    'motorway': 0.20, 'trunk': 0.15, 'primary': 0.12,
                    'secondary': 0.08, 'tertiary': 0.06, 'residential': 0.04,
                    'intersection': 0.30
                },
                'urban': {
                    'poi_health': 0.08, 'poi_education': 0.07,
                    'poi_commercial': 0.06, 'building_density': 0.12
                },
                'industry': {
                    'industrial_zones': 0.15, 'construction_sites': 0.5
                },
                'environment': {
                    'green_spaces': -0.05, 'water_proximity': -0.20
                }
            },
            'sensor_density': {
                'base_density': 0.75,
                'score_multiplier': 2.0,
                'max_sensors': 200,
                'recommended_fraction': 0.2
            }
        }
        self.config = self.default_config.copy()
        self.water_features = gpd.GeoDataFrame()  # Initialize as empty GeoDataFrame
        self.response_options = {
            'include_candidate_sites': False,
            'candidate_site_limit': 0,
        }

    def configure(self, **kwargs):
        for category, settings in kwargs.items():
            if category in self.config:
                self.config[category].update(settings)
            else:
                self.config[category] = settings

        if 'min_sensor_distance' in kwargs.get('distance', {}):
            self.config['distance']['min_sensor_distance_degrees'] = \
                self.config['distance']['min_sensor_distance'] / 111320

    def configure_response(self, **kwargs):
        self.response_options.update(kwargs)

    def create_adaptive_grid(self, polygon: Polygon) -> gpd.GeoDataFrame:
        # Reset water_features to empty GeoDataFrame
        self.water_features = gpd.GeoDataFrame()
        if self.config['grid'].get('exclude_water', True):
            try:
                features = _fetch_osm_features_with_retries(
                    bounds=polygon.bounds,
                    tags={'natural': ['water', 'wetland'], 'waterway': True},
                    description="water features",
                )
                if isinstance(features, gpd.GeoDataFrame):
                    self.water_features = features
            except Exception as e:
                logger.warning(
                    "Failed to fetch water features for polygon bounds %s; continuing without water exclusion: %s",
                    polygon.bounds,
                    e,
                )
                self.water_features = gpd.GeoDataFrame()

        if self.config['grid']['user_override']:
            grid_size = self.config['grid']['user_override']
        elif self.config['grid']['auto_size']:
            area = polygon.area
            target_cells = area / self.config['grid']['base_cell_area']
            grid_size = int(np.clip(target_cells,
                                 self.config['grid']['min_cells'],
                                 self.config['grid']['max_cells']))
        else:
            grid_size = 100

        minx, miny, maxx, maxy = polygon.bounds
        aspect_ratio = (maxx - minx) / (maxy - miny)
        n_cols = int(np.sqrt(grid_size * aspect_ratio))
        n_rows = int(grid_size / n_cols)
        cell_width = (maxx - minx) / n_cols
        cell_height = (maxy - miny) / n_rows
        water_sindex = (
            self.water_features.sindex
            if isinstance(self.water_features, gpd.GeoDataFrame)
            and not self.water_features.empty
            else None
        )

        grid_cells = []
        for i in range(n_cols):
            for j in range(n_rows):
                x = minx + i * cell_width
                y = miny + j * cell_height
                cell = box(x, y, x + cell_width, y + cell_height)
                valid_cell = cell.intersection(polygon)
                if not valid_cell.is_empty and valid_cell.area > 0:
                    if not isinstance(self.water_features, gpd.GeoDataFrame) or self.water_features.empty:
                        grid_cells.append({
                            'geometry': valid_cell,
                            'cell_area': valid_cell.area,
                            'grid_metrics': {
                                'grid_size': grid_size,
                                'cell_width': cell_width,
                                'cell_height': cell_height
                            }
                        })
                    else:
                        intersects_water = not self._subset_intersections(
                            self.water_features,
                            valid_cell,
                            water_sindex,
                        ).empty
                        if not intersects_water:
                            grid_cells.append({
                                'geometry': valid_cell,
                                'cell_area': valid_cell.area,
                                'grid_metrics': {
                                    'grid_size': grid_size,
                                    'cell_width': cell_width,
                                    'cell_height': cell_height
                                }
                            })

        return gpd.GeoDataFrame(grid_cells, crs="EPSG:4326")

    def random_point_in_cell(self, geometry: Polygon) -> Point:
        minx, miny, maxx, maxy = geometry.bounds
        for _ in range(5):
            # Stratified sampling: divide cell into sub-regions
            sub_x = minx + random.uniform(0, 1) * (maxx - minx)
            sub_y = miny + random.uniform(0, 1) * (maxy - miny)
            point = Point(sub_x, sub_y)
            if geometry.contains(point):
                if not isinstance(self.water_features, gpd.GeoDataFrame) or self.water_features.empty:
                    return point
                in_water = any(
                    point.distance(geom) < 1e-6 for geom in self.water_features.geometry
                )
                if not in_water:
                    return point
        return geometry.centroid

    @staticmethod
    def _normalize_score_columns(
        grid: gpd.GeoDataFrame, score_columns: List[str]
    ) -> gpd.GeoDataFrame:
        """Normalize score columns while preserving constant columns.

        ``MinMaxScaler`` collapses constant columns to 0.0, which makes
        otherwise valid raw scores such as a uniform suitability baseline
        disappear from API output. For constant columns, keep the raw value.
        """
        for column in score_columns:
            column_min = float(grid[column].min())
            column_max = float(grid[column].max())

            if np.isclose(column_min, column_max):
                grid[column] = grid[column].clip(0.0, 1.0)
                continue

            grid[column] = (grid[column] - column_min) / (column_max - column_min)

        return grid

    @staticmethod
    def _subset_intersections(
        features: gpd.GeoDataFrame,
        geometry,
        spatial_index=None,
    ) -> gpd.GeoDataFrame:
        """Return intersecting rows using a spatial index when available."""
        if features.empty:
            return features

        try:
            if spatial_index is not None and not spatial_index.is_empty:
                matches = spatial_index.query(geometry, predicate="intersects")
                if len(matches) == 0:
                    return features.iloc[0:0]
                return features.iloc[matches]
        except Exception:
            pass

        return features[features.intersects(geometry)]

    def calculate_features_and_scores(self, grid: gpd.GeoDataFrame, polygon: Polygon) -> gpd.GeoDataFrame:
        """
        Calculate feature scores for grid cells based on real geographic data.
        Scores are computed for transport, urban, industry, and environment features
        using OSM data and weighted according to the configuration.
        """
        # Initialize score columns
        grid['transport_score'] = 0.0
        grid['urban_score'] = 0.0
        grid['industry_score'] = 0.0
        grid['environment_score'] = 0.0
        grid['suitability_score'] = 0.0

        # Define buffer distance for proximity calculations (in degrees, ~50m)
        buffer_dist = 50 / 111320  # Convert 50 meters to degrees

        # Fetch OSM features for the entire polygon bounding box
        try:
            # Transport features (roads)
            road_tags = {
                'highway': [
                    'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'
                ]
            }
            roads = ox.features_from_bbox(*polygon.bounds, tags=road_tags)
            roads = roads[roads.geometry.type.isin(['LineString', 'MultiLineString'])]

            # Urban features (POIs and buildings)
            poi_tags = {
                'amenity': ['hospital', 'clinic', 'school', 'university', 'college', 'marketplace', 'retail']
            }
            pois = ox.features_from_bbox(*polygon.bounds, tags=poi_tags)
            buildings = ox.features_from_bbox(*polygon.bounds, tags={'building': True})

            # Industry features
            industry_tags = {'landuse': ['industrial', 'construction']}
            industrial = ox.features_from_bbox(*polygon.bounds, tags=industry_tags)

            # Environment features (green spaces and water)
            env_tags = {'landuse': ['forest', 'park'], 'natural': ['wood', 'grassland']}
            green_spaces = ox.features_from_bbox(*polygon.bounds, tags=env_tags)
            water = self.water_features if not self.water_features.empty else gpd.GeoDataFrame()

        except Exception as e:
            logger.warning("Failed to fetch OSM features for suitability scoring: %s", e)
            # Initialize empty GeoDataFrames on failure
            roads = gpd.GeoDataFrame()
            pois = gpd.GeoDataFrame()
            buildings = gpd.GeoDataFrame()
            industrial = gpd.GeoDataFrame()
            green_spaces = gpd.GeoDataFrame()
            water = gpd.GeoDataFrame()

        road_sindex = roads.sindex if not roads.empty else None
        poi_sindex = pois.sindex if not pois.empty else None
        building_sindex = buildings.sindex if not buildings.empty else None
        industrial_sindex = industrial.sindex if not industrial.empty else None
        green_sindex = green_spaces.sindex if not green_spaces.empty else None
        water_sindex = water.sindex if not water.empty else None

        # Calculate scores for each grid cell
        for idx, row in grid.iterrows():
            cell = row['geometry']
            cell_buffer = cell.buffer(buffer_dist)

            # Transport score
            transport_score = 0.0
            if not roads.empty:
                nearby_roads = self._subset_intersections(
                    roads,
                    cell_buffer,
                    road_sindex,
                )
                for _, road in nearby_roads.iterrows():
                    road_type = road.get('highway', 'residential')
                    weight = self.config['weights']['transport'].get(road_type, 0.04)
                    # Approximate contribution based on road length within buffer
                    intersection = road.geometry.intersection(cell_buffer)
                    if intersection.length > 0:
                        transport_score += weight * (intersection.length / (buffer_dist * 2))
                # Approximate junction density without an O(n^2) geometry loop.
                if len(nearby_roads) > 1:
                    transport_score += min(
                        len(nearby_roads) - 1,
                        3,
                    ) * self.config['weights']['transport']['intersection']
            grid.at[idx, 'transport_score'] = min(transport_score, 1.0)

            # Urban score
            urban_score = 0.0
            if not pois.empty:
                nearby_pois = self._subset_intersections(
                    pois,
                    cell_buffer,
                    poi_sindex,
                )
                for _, poi in nearby_pois.iterrows():
                    poi_type = poi.get('amenity', '')
                    if poi_type in ['hospital', 'clinic']:
                        urban_score += self.config['weights']['urban']['poi_health']
                    elif poi_type in ['school', 'university', 'college']:
                        urban_score += self.config['weights']['urban']['poi_education']
                    elif poi_type in ['marketplace', 'retail']:
                        urban_score += self.config['weights']['urban']['poi_commercial']
            if not buildings.empty:
                nearby_buildings = self._subset_intersections(
                    buildings,
                    cell_buffer,
                    building_sindex,
                )
                # Building density: count of buildings scaled by cell area
                building_count = len(nearby_buildings)
                density = building_count / (cell.area * 111320 * 111320)  # Buildings per km²
                urban_score += self.config['weights']['urban']['building_density'] * min(density * 1000, 1.0)
            grid.at[idx, 'urban_score'] = min(urban_score, 1.0)

            # Industry score
            industry_score = 0.0
            if not industrial.empty:
                nearby_industrial = self._subset_intersections(
                    industrial,
                    cell_buffer,
                    industrial_sindex,
                )
                for _, ind in nearby_industrial.iterrows():
                    ind_type = ind.get('landuse', '')
                    if ind_type == 'industrial':
                        industry_score += self.config['weights']['industry']['industrial_zones']
                    elif ind_type == 'construction':
                        industry_score += self.config['weights']['industry']['construction_sites']
            grid.at[idx, 'industry_score'] = min(industry_score, 1.0)

            # Environment score
            environment_score = 0.0
            if not green_spaces.empty:
                nearby_green = self._subset_intersections(
                    green_spaces,
                    cell_buffer,
                    green_sindex,
                )
                if not nearby_green.empty:
                    green_area = sum(geom.intersection(cell_buffer).area for geom in nearby_green.geometry)
                    environment_score += self.config['weights']['environment']['green_spaces'] * (green_area / cell_buffer.area)
            if not water.empty:
                nearby_water = self._subset_intersections(
                    water,
                    cell_buffer,
                    water_sindex,
                )
                if not nearby_water.empty:
                    water_area = sum(geom.intersection(cell_buffer).area for geom in nearby_water.geometry)
                    environment_score += self.config['weights']['environment']['water_proximity'] * (water_area / cell_buffer.area)
            grid.at[idx, 'environment_score'] = max(environment_score, 0.0)  # Negative weights, so ensure non-negative

            # Calculate suitability score
            suitability_score = (
                0.4 * grid.at[idx, 'transport_score'] +
                0.3 * grid.at[idx, 'urban_score'] +
                0.2 * grid.at[idx, 'industry_score'] +
                0.1 * (1 - grid.at[idx, 'environment_score'])
            )
            grid.at[idx, 'suitability_score'] = min(max(suitability_score, 0.0), 1.0)

        score_columns = ['transport_score', 'urban_score', 'industry_score', 'environment_score', 'suitability_score']
        grid = self._normalize_score_columns(grid, score_columns)

        return grid

    @staticmethod
    def _ranking_column(gdf: gpd.GeoDataFrame) -> str:
        return 'label_score' if 'label_score' in gdf.columns else 'suitability_score'

    def enforce_min_distance(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        min_dist = self.config['distance'].get('min_sensor_distance_degrees', 0)
        if min_dist <= 0:
            return gdf

        ranking_column = self._ranking_column(gdf)
        points = np.array([[p.x, p.y] for p in gdf['sensor_point']])
        tree = KDTree(points)
        too_close = tree.query_pairs(min_dist)

        indexes_to_drop = set()
        for i, j in too_close:
            if gdf.iloc[i][ranking_column] >= gdf.iloc[j][ranking_column]:
                indexes_to_drop.add(j)
            else:
                indexes_to_drop.add(i)

        return gdf.drop(index=list(indexes_to_drop))

    def select_with_spacing(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        min_dist = self.config['distance'].get('min_sensor_distance_degrees', 0)
        selected_points = []
        selected_indices = []
        ranking_column = self._ranking_column(gdf)

        sorted_gdf = gdf.sort_values(ranking_column, ascending=False)

        for idx, row in sorted_gdf.iterrows():
            point = row['sensor_point']
            if all(point.distance(other) >= min_dist for other in selected_points):
                selected_points.append(point)
                selected_indices.append(idx)

        return gdf.loc[selected_indices]

    def hybrid_selection(self, gdf: gpd.GeoDataFrame, n_sensors: int) -> gpd.GeoDataFrame:
        """
        Hybrid selection combining suitability scores and spatial dispersion.
        """
        min_dist = self.config['distance'].get('min_sensor_distance_degrees', 0)
        selected_points = []
        selected_indices = []
        ranking_column = self._ranking_column(gdf)

        # Start with the highest-scoring point
        sorted_gdf = gdf.sort_values(ranking_column, ascending=False)
        selected_points.append(sorted_gdf.iloc[0]['sensor_point'])
        selected_indices.append(sorted_gdf.index[0])

        while len(selected_points) < n_sensors and len(selected_indices) < len(gdf):
            best_idx = None
            best_score = -np.inf
            for idx, row in sorted_gdf.iterrows():
                if idx in selected_indices:
                    continue
                point = row['sensor_point']
                if all(point.distance(other) >= min_dist for other in selected_points):
                    # Calculate spatial dispersion score
                    if len(selected_points) > 1:
                        min_dist_to_others = min(point.distance(other) for other in selected_points)
                        dispersion_score = min_dist_to_others / min_dist
                    else:
                        dispersion_score = 1.0
                    # Combine suitability and dispersion
                    combined_score = 0.7 * row[ranking_column] + 0.3 * dispersion_score
                    if combined_score > best_score:
                        best_score = combined_score
                        best_idx = idx

            if best_idx is None:
                break
            selected_points.append(sorted_gdf.loc[best_idx]['sensor_point'])
            selected_indices.append(best_idx)

        return gdf.loc[selected_indices]

    def generate_justification(self, row) -> Dict:
        return {
            'primary': 'Optimized for air quality data and spatial coverage',
            'detailed': [
                f"Transport score (traffic pollution): {row['transport_score']:.2f}",
                f"Urban score (building density): {row['urban_score']:.2f}",
                f"Industry score (emissions): {row['industry_score']:.2f}",
                f"Environment score (green spaces): {row['environment_score']:.2f}",
                f"ML Cluster: {row.get('cluster', 'N/A')}"
            ]
        }

    def check_proximity_warnings(self, point: Point) -> List[str]:
        warnings = []
        buffer_dist = self.config['distance'].get('min_sensor_distance_degrees', 0) * 1.5
        if buffer_dist == 0:
            return warnings

        if isinstance(self.water_features, gpd.GeoDataFrame) and not self.water_features.empty:
            min_dist = min(point.distance(geom) for geom in self.water_features.geometry)
            if min_dist <= buffer_dist:
                warnings.append(f"Water body {min_dist*111320:.1f}m away")

        return warnings

    @staticmethod
    def _grid_area_km2(grid: gpd.GeoDataFrame) -> float:
        """Compute covered area in km^2 without planar operations on EPSG:4326."""
        if grid.empty:
            return 0.0

        try:
            projected_grid = grid.to_crs(grid.estimate_utm_crs())
        except Exception:
            projected_grid = grid.to_crs("EPSG:3857")

        return float(projected_grid.geometry.area.sum() / 1_000_000)

    def prepare_results(self, optimal_locations: gpd.GeoDataFrame, grid: gpd.GeoDataFrame, max_sensors: int, min_sensors: int, recommended_sensors: int, candidate_sites: gpd.GeoDataFrame) -> Dict:
        first_cell = grid.iloc[0]
        category_counts = {
            "Commercial": 0,
            "Urban Background": 0,
            "Background": 0,
            "Rural": 0
        }

        results = {
            'grid_metrics': {
                'grid_size': first_cell['grid_metrics']['grid_size'],
                'cell_width': first_cell['grid_metrics']['cell_width'],
                'cell_height': first_cell['grid_metrics']['cell_height'],
                'total_cells': len(grid),
                'area_covered': round(self._grid_area_km2(grid), 4)
            },
            'sensor_counts': {
                'maximum_sensors': max_sensors,
                'minimum_sensors': min_sensors,
                'recommended_sensors': recommended_sensors,
                'actual_sensors': len(optimal_locations)
            },
            'candidate_site_count': int(len(candidate_sites)),
            'site_category_counts': category_counts,
            'locations': [],
            'config': {
                'min_sensor_distance': self.config['distance']['min_sensor_distance'],
                'applied_method': self.config['distance']['enforce_method']
            }
        }

        include_candidate_sites = bool(
            self.response_options.get('include_candidate_sites', False)
        )
        candidate_site_limit = int(self.response_options.get('candidate_site_limit', 0) or 0)
        if include_candidate_sites:
            results['candidate_sites'] = []

        # Store selected (optimal) locations 
        for _, loc in optimal_locations.iterrows():
            point = loc['sensor_point']
            reasons = self.generate_justification(loc)
            site_category = loc['site_category']
            category_counts[site_category] += 1
            results['locations'].append({
                'latitude': point.y,
                'longitude': point.x,
                'suitability_score': round(float(loc['suitability_score']), 4),
                'grid_cell': loc['geometry'].wkt,
                'site_category': site_category,
                'cluster_id': int(loc.get('cluster', -1)),
                'primary_reason': reasons['primary'],
                'detailed_reasons': reasons['detailed'],
                'proximity_warnings': self.check_proximity_warnings(point),
            })

        if include_candidate_sites:
            candidate_output = candidate_sites
            ranking_column = self._ranking_column(candidate_sites)
            if candidate_site_limit > 0:
                candidate_output = candidate_sites.nlargest(
                    min(candidate_site_limit, len(candidate_sites)),
                    ranking_column,
                )
                results['candidate_sites_truncated'] = len(candidate_output) < len(candidate_sites)

            for _, candidate in candidate_output.iterrows():
                point = candidate['sensor_point']
                results['candidate_sites'].append({
                    'latitude': point.y,
                    'longitude': point.x,
                    'suitability_score': round(float(candidate['suitability_score']), 4),
                    'site_category': candidate['site_category'],
                    'cluster_id': int(candidate.get('cluster', -1))
                })

        # Validate spatial distribution
        if len(optimal_locations) > 1:
            points = np.array([[p.x, p.y] for p in optimal_locations['sensor_point']])
            tree = KDTree(points)
            distances, _ = tree.query(points, k=2)
            min_distances = distances[:, 1] * 111320  # Convert to meters
            results['spatial_metrics'] = {
                'avg_min_distance_m': round(float(np.mean(min_distances)), 2),
                'std_min_distance_m': round(float(np.std(min_distances)), 2),
                'min_distance_m': round(float(np.min(min_distances)), 2)
            }

        return results

    def optimize_sensors(self, polygon: Polygon) -> Dict:
        grid = self.create_adaptive_grid(polygon)
        if len(grid) == 0:
            return {"error": "Polygon too small or invalid"}

        scored_gdf = self.calculate_features_and_scores(grid, polygon)

        # Calculate sensor counts within feasible bounds for the generated grid.
        max_sensors = min(len(grid), self.config['sensor_density']['max_sensors'])
        recommended_floor = min(4, max_sensors)
        recommended_sensors = int(
            len(grid) * self.config['sensor_density']['recommended_fraction']
        )
        recommended_sensors = max(recommended_floor, recommended_sensors)

        # Prepare features for K-Means
        centroids = np.array([[g.centroid.x, g.centroid.y] for g in scored_gdf['geometry']])
        features = np.column_stack([
            scored_gdf['transport_score'],
            scored_gdf['urban_score'],
            scored_gdf['industry_score'],
            scored_gdf['environment_score'],
            centroids[:, 0],
            centroids[:, 1]
        ])

        # Scale features
        scaler = MinMaxScaler()
        features_scaled = scaler.fit_transform(features)

        # Apply K-Means clustering (clusters ≤ samples) 
        n_clusters = min(recommended_sensors, len(scored_gdf))
        kmeans = KMeans(n_clusters=n_clusters, random_state=0)
        scored_gdf['cluster'] = kmeans.fit_predict(features_scaled)

        # Select random points and categorize (candidate sites)
        scored_gdf['sensor_point'] = [self.random_point_in_cell(row['geometry']) for _, row in scored_gdf.iterrows()]
        scored_gdf['site_category'] = [
            classify_site_category(row) for _, row in scored_gdf.iterrows()
        ]
        scored_gdf['label_score'] = [
            compute_label_score(row, row['site_category']) for _, row in scored_gdf.iterrows()
        ]

        # Minimum and recommended counts should reflect category coverage without
        # exceeding the feasible number of grid cells.
        available_categories = max(1, len(scored_gdf['site_category'].unique()))
        min_sensors = min(max_sensors, max(1, available_categories))
        recommended_sensors = min(max_sensors, max(min_sensors, recommended_sensors))

        # Ensure category diversity
        optimal_locations = gpd.GeoDataFrame()
        available_categories = scored_gdf['site_category'].unique()
        cluster_groups = scored_gdf.groupby('cluster')
        selected_clusters = set()

        # Reserve one slot per category
        target_category_counts = {
            'Commercial': max(1, recommended_sensors // 4),
            'Urban Background': max(1, recommended_sensors // 4),
            'Background': max(1, recommended_sensors // 4),
            'Rural': max(1, recommended_sensors // 4)
        }

        ranking_column = self._ranking_column(scored_gdf)
        for category in SITE_CATEGORIES:
            if category in available_categories:
                category_gdf = scored_gdf[scored_gdf['site_category'] == category]
                if not category_gdf.empty:
                    n_select = min(target_category_counts[category], len(category_gdf))
                    top_sites = category_gdf.nlargest(n_select, ranking_column)
                    optimal_locations = pd.concat([optimal_locations, top_sites])
                    selected_clusters.update(top_sites['cluster'].values)

        # Apply hybrid selection for remaining slots
        remaining_slots = recommended_sensors - len(optimal_locations)
        if remaining_slots > 0:
            remaining_gdf = scored_gdf[~scored_gdf.index.isin(optimal_locations.index)]
            if not remaining_gdf.empty:
                additional_locations = self.hybrid_selection(remaining_gdf, remaining_slots)
                optimal_locations = pd.concat([optimal_locations, additional_locations])

        # Apply minimum distance enforcement
        if self.config['distance']['min_sensor_distance'] > 0:
            if self.config['distance']['enforce_method'] == 'post-process':
                optimal_locations = self.enforce_min_distance(optimal_locations)
            elif self.config['distance']['enforce_method'] == 'hybrid':
                optimal_locations = self.hybrid_selection(optimal_locations, min(recommended_sensors, len(optimal_locations)))
            else:
                optimal_locations = self.select_with_spacing(optimal_locations)

        # Limit to recommended sensors
        optimal_locations = optimal_locations.head(min(recommended_sensors, len(optimal_locations)))

        # Store results
        results = self.prepare_results(optimal_locations, grid, max_sensors, min_sensors, recommended_sensors, scored_gdf)

        return results
