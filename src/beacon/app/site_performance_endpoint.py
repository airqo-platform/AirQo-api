from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
import json
from datetime import datetime, timedelta
from decimal import Decimal
import math
import pandas as pd
from pydantic import BaseModel
from enum import Enum

# Import your database connection
from app.database import get_db

# Create router
router = APIRouter(prefix="/site-analytics", tags=["site-analytics"])

# Enhanced data models for comprehensive site analytics
class TimeRangeEnum(str, Enum):
    HOUR = "hour"
    DAY = "day" 
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"
    CUSTOM = "custom"

class LocationTypeEnum(str, Enum):
    COUNTRY = "country"
    CITY = "city"
    DISTRICT = "district"
    TOWN = "town"
    VILLAGE = "village"
    SITE = "site"

class AQICategory(str, Enum):
    GOOD = "good"
    MODERATE = "moderate"
    UNHEALTHY_SENSITIVE = "unhealthy_sensitive"
    UNHEALTHY = "unhealthy"
    VERY_UNHEALTHY = "very_unhealthy"
    HAZARDOUS = "hazardous"

class ComprehensiveSiteMetrics(BaseModel):
    site_key: int
    site_id: str
    site_name: str
    location_info: Dict[str, Any]  # ALL location columns
    data_quality: Dict[str, Any]   # Comprehensive data quality metrics
    sensor_performance: Dict[str, Any]  # ALL sensor performance data
    environmental_metrics: Dict[str, Any]  # Environmental analysis
    health_indicators: Dict[str, Any]  # Health and safety metrics
    operational_status: Dict[str, Any]  # Site operational information

class LocationAnalytics(BaseModel):
    location_info: Dict[str, Any]
    summary_metrics: Dict[str, Any]
    site_breakdown: List[ComprehensiveSiteMetrics]
    temporal_analysis: Dict[str, Any]
    environmental_trends: Dict[str, Any]
    health_assessment: Dict[str, Any]
    recommendations: List[str]

# Custom JSON encoder for handling special data types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            try:
                return float(obj)
            except:
                return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

class DataProcessor:
    """Centralized data processing to avoid repetition"""
    
    @staticmethod
    def convert_to_json_serializable(item):
        """Enhanced JSON serialization handling ALL data types"""
        if isinstance(item, dict):
            return {k: DataProcessor.convert_to_json_serializable(v) for k, v in item.items()}
        elif isinstance(item, list):
            return [DataProcessor.convert_to_json_serializable(i) for i in item]
        elif isinstance(item, datetime):
            return item.isoformat()
        elif isinstance(item, Decimal):
            try:
                float_val = float(item)
                if math.isnan(float_val) or math.isinf(float_val):
                    return None
                return float_val
            except (ValueError, OverflowError, TypeError):
                return None
        elif isinstance(item, float):
            if math.isnan(item) or math.isinf(item):
                return None
            return item
        elif isinstance(item, str):
            if item.lower() in ['nan', 'null', 'none', '']:
                return None
            return item
        return item
    
    @staticmethod
    def create_json_response(content):
        """Create properly encoded JSON response"""
        json_content = json.dumps(content, cls=CustomJSONEncoder)
        return Response(content=json_content, media_type="application/json")

class TimeRangeCalculator:
    """Centralized time range calculation to avoid repetition"""
    
    @staticmethod
    def calculate_time_range(time_range: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> tuple[datetime, datetime]:
        """Calculate start and end times for analysis"""
        
        current_time = datetime.now()
        
        if time_range == TimeRangeEnum.CUSTOM and start_date and end_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                return start_dt, end_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        time_deltas = {
            TimeRangeEnum.HOUR: timedelta(hours=1),
            TimeRangeEnum.DAY: timedelta(days=1),
            TimeRangeEnum.WEEK: timedelta(days=7),
            TimeRangeEnum.MONTH: timedelta(days=30),
            TimeRangeEnum.QUARTER: timedelta(days=90),
            TimeRangeEnum.YEAR: timedelta(days=365)
        }
        
        delta = time_deltas.get(time_range, timedelta(days=7))
        start_time = current_time - delta
        
        return start_time, current_time
    
    @staticmethod
    def get_aggregation_interval(time_range: str) -> str:
        """Get appropriate aggregation interval for time range"""
        
        intervals = {
            TimeRangeEnum.HOUR: "10 minutes",
            TimeRangeEnum.DAY: "1 hour",
            TimeRangeEnum.WEEK: "6 hours", 
            TimeRangeEnum.MONTH: "1 day",
            TimeRangeEnum.QUARTER: "1 day",
            TimeRangeEnum.YEAR: "1 week"
        }
        
        return intervals.get(time_range, "1 day")

class ComprehensiveDataRetriever:
    """Centralized data retrieval utilizing ALL database columns"""
    
    @staticmethod
    def get_comprehensive_locations(db: Session) -> List[Dict[str, Any]]:
        """Get comprehensive location data utilizing ALL location-related columns"""
        
        query = text("""
            WITH location_hierarchy AS (
                SELECT DISTINCT
                    -- ALL location columns from dim_site
                    s.country,
                    s.city, 
                    s.district,
                    s.town,
                    s.village,
                    s.location_name,
                    s.search_name,
                    s.data_provider,
                    s.site_category,
                    
                    -- Location statistics
                    COUNT(DISTINCT s.site_key) as site_count,
                    COUNT(DISTINCT d.device_key) as device_count,
                    
                    -- Geographic coverage
                    AVG(s.latitude) as center_latitude,
                    AVG(s.longitude) as center_longitude,
                    
                    -- Data availability
                    COUNT(DISTINCT r.reading_key) as total_readings,
                    MAX(r.timestamp) as latest_data,
                    
                    -- Location categorization
                    CASE 
                        WHEN s.village IS NOT NULL THEN s.village
                        WHEN s.town IS NOT NULL THEN s.town
                        WHEN s.city IS NOT NULL THEN s.city
                        WHEN s.district IS NOT NULL THEN s.district
                        ELSE s.country
                    END as primary_location,
                    CASE 
                        WHEN s.village IS NOT NULL THEN 'village'
                        WHEN s.town IS NOT NULL THEN 'town'
                        WHEN s.city IS NOT NULL THEN 'city'
                        WHEN s.district IS NOT NULL THEN 'district'
                        ELSE 'country'
                    END as location_type,
                    
                    -- Generate comprehensive location ID
                    CONCAT(
                        LOWER(REGEXP_REPLACE(COALESCE(s.country, 'unknown'), '[^a-zA-Z0-9]', '_', 'g')), '_',
                        LOWER(REGEXP_REPLACE(COALESCE(s.district, 'unknown'), '[^a-zA-Z0-9]', '_', 'g')), '_',
                        LOWER(REGEXP_REPLACE(COALESCE(s.city, 'unknown'), '[^a-zA-Z0-9]', '_', 'g')), '_',
                        LOWER(REGEXP_REPLACE(COALESCE(s.town, 'unknown'), '[^a-zA-Z0-9]', '_', 'g')), '_',
                        LOWER(REGEXP_REPLACE(COALESCE(s.village, 'unknown'), '[^a-zA-Z0-9]', '_', 'g'))
                    ) as comprehensive_location_id
                    
                FROM dim_site s
                LEFT JOIN dim_location l ON s.site_id = l.site_id
                LEFT JOIN dim_device d ON l.device_key = d.device_key AND d.is_active = true
                LEFT JOIN fact_device_readings r ON d.device_key = r.device_key 
                    AND r.timestamp >= NOW() - INTERVAL '30 days'
                WHERE s.country IS NOT NULL
                GROUP BY 
                    s.country, s.city, s.district, s.town, s.village,
                    s.location_name, s.search_name, s.data_provider, s.site_category
            )
            SELECT 
                *,
                -- Calculate data freshness score
                CASE 
                    WHEN latest_data >= NOW() - INTERVAL '1 hour' THEN 100
                    WHEN latest_data >= NOW() - INTERVAL '6 hours' THEN 80
                    WHEN latest_data >= NOW() - INTERVAL '1 day' THEN 60
                    WHEN latest_data >= NOW() - INTERVAL '7 days' THEN 40
                    ELSE 20
                END as data_freshness_score,
                
                -- Calculate coverage density
                (device_count::float / GREATEST(site_count, 1)) as device_per_site_ratio
                
            FROM location_hierarchy
            WHERE site_count > 0
            ORDER BY country, district, city, town, village
        """)
        
        result = db.execute(query)
        locations = []
        
        for row in result:
            location_dict = dict(row._mapping)
            location_dict = DataProcessor.convert_to_json_serializable(location_dict)
            locations.append(location_dict)
        
        return locations
    
    @staticmethod
    def get_comprehensive_site_data(
        db: Session, 
        location_filter: str, 
        filter_params: Dict[str, Any],
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """Get comprehensive site data utilizing ALL available columns"""
        
        query = text(f"""
            WITH latest_device_readings AS (
                SELECT DISTINCT ON (r.device_key) 
                    r.device_key,
                    r.site_key,
                    r.timestamp,
                    -- ALL PM sensor readings
                    r.s1_pm2_5,
                    r.s1_pm10,
                    r.s2_pm2_5,
                    r.s2_pm10,
                    -- ALL environmental readings
                    r.temperature,
                    r.humidity,
                    r.wind_speed,
                    -- ALL device hardware readings
                    r.device_temperature,
                    r.device_humidity,
                    r.battery,
                    r.altitude,
                    -- ALL GPS readings
                    r.latitude as reading_latitude,
                    r.longitude as reading_longitude,
                    r.hdop,
                    r.satellites,
                    -- Metadata
                    r.frequency,
                    r.network,
                    r.device_category
                FROM fact_device_readings r
                JOIN dim_device d ON r.device_key = d.device_key
                JOIN dim_location l ON d.device_key = l.device_key AND l.is_active = true
                JOIN dim_site s ON l.site_id = s.site_id
                WHERE r.timestamp >= :start_time
                    AND {location_filter}
                    AND d.is_active = true
                ORDER BY r.device_key, r.timestamp DESC
            ),
            site_aggregations AS (
                SELECT 
                    ldr.site_key,
                    COUNT(DISTINCT ldr.device_key) as device_count,
                    
                    -- PM sensor statistics (ALL sensors)
                    AVG(ldr.s1_pm2_5) as avg_s1_pm2_5,
                    AVG(ldr.s1_pm10) as avg_s1_pm10,
                    AVG(ldr.s2_pm2_5) as avg_s2_pm2_5,
                    AVG(ldr.s2_pm10) as avg_s2_pm10,
                    
                    -- Sensor agreement analysis
                    AVG(ABS(ldr.s1_pm2_5 - ldr.s2_pm2_5)) as pm25_sensor_difference,
                    AVG(ABS(ldr.s1_pm10 - ldr.s2_pm10)) as pm10_sensor_difference,
                    
                    -- Environmental statistics
                    AVG(ldr.temperature) as avg_temperature,
                    AVG(ldr.humidity) as avg_humidity,
                    AVG(ldr.wind_speed) as avg_wind_speed,
                    STDDEV(ldr.temperature) as temp_variability,
                    STDDEV(ldr.humidity) as humidity_variability,
                    
                    -- Device health statistics
                    AVG(ldr.device_temperature) as avg_device_temp,
                    AVG(ldr.device_humidity) as avg_device_humidity,
                    AVG(ldr.battery) as avg_battery_level,
                    MIN(ldr.battery) as min_battery_level,
                    STDDEV(ldr.battery) as battery_variability,
                    
                    -- GPS performance statistics
                    AVG(ldr.hdop) as avg_hdop,
                    AVG(ldr.satellites) as avg_satellites,
                    COUNT(CASE WHEN ldr.hdop <= 2 THEN 1 END) as good_gps_readings,
                    STDDEV(ldr.reading_latitude) as lat_stability,
                    STDDEV(ldr.reading_longitude) as lon_stability,
                    
                    -- Data completeness analysis
                    COUNT(CASE WHEN ldr.s1_pm2_5 IS NOT NULL THEN 1 END)::float / COUNT(*) * 100 as pm_s1_completeness,
                    COUNT(CASE WHEN ldr.s2_pm2_5 IS NOT NULL THEN 1 END)::float / COUNT(*) * 100 as pm_s2_completeness,
                    COUNT(CASE WHEN ldr.temperature IS NOT NULL THEN 1 END)::float / COUNT(*) * 100 as temp_completeness,
                    COUNT(CASE WHEN ldr.humidity IS NOT NULL THEN 1 END)::float / COUNT(*) * 100 as humidity_completeness,
                    COUNT(CASE WHEN ldr.battery IS NOT NULL THEN 1 END)::float / COUNT(*) * 100 as battery_completeness,
                    COUNT(CASE WHEN ldr.hdop IS NOT NULL THEN 1 END)::float / COUNT(*) * 100 as gps_completeness,
                    
                    -- Network and category distribution
                    array_agg(DISTINCT ldr.network) as networks,
                    array_agg(DISTINCT ldr.device_category) as device_categories,
                    array_agg(DISTINCT ldr.frequency) as frequencies,
                    
                    -- Temporal analysis
                    MAX(ldr.timestamp) as latest_reading,
                    MIN(ldr.timestamp) as earliest_reading,
                    COUNT(*) as total_readings
                    
                FROM latest_device_readings ldr
                GROUP BY ldr.site_key
            )
            SELECT 
                -- ALL site information columns
                s.site_key,
                s.site_id,
                s.site_name,
                s.location_name,
                s.search_name,
                s.village,
                s.town,
                s.city,
                s.district,
                s.country,
                s.data_provider,
                s.site_category,
                s.latitude,
                s.longitude,
                s.created_at,
                s.updated_at,
                
                -- Aggregated device and sensor data
                COALESCE(sa.device_count, 0) as device_count,
                
                -- PM sensor performance (ALL sensors)
                sa.avg_s1_pm2_5,
                sa.avg_s1_pm10,
                sa.avg_s2_pm2_5,
                sa.avg_s2_pm10,
                sa.pm25_sensor_difference,
                sa.pm10_sensor_difference,
                
                -- Environmental metrics
                sa.avg_temperature,
                sa.avg_humidity,
                sa.avg_wind_speed,
                sa.temp_variability,
                sa.humidity_variability,
                
                -- Device health metrics
                sa.avg_device_temp,
                sa.avg_device_humidity,
                sa.avg_battery_level,
                sa.min_battery_level,
                sa.battery_variability,
                
                -- GPS performance metrics
                sa.avg_hdop,
                sa.avg_satellites,
                sa.good_gps_readings,
                sa.lat_stability,
                sa.lon_stability,
                
                -- Data quality metrics
                sa.pm_s1_completeness,
                sa.pm_s2_completeness,
                sa.temp_completeness,
                sa.humidity_completeness,
                sa.battery_completeness,
                sa.gps_completeness,
                
                -- Network information
                sa.networks,
                sa.device_categories,
                sa.frequencies,
                
                -- Temporal metrics
                sa.latest_reading,
                sa.earliest_reading,
                sa.total_readings,
                
                -- Calculate comprehensive quality scores
                (
                    COALESCE(sa.pm_s1_completeness, 0) * 0.25 +
                    COALESCE(sa.pm_s2_completeness, 0) * 0.25 +
                    COALESCE(sa.temp_completeness, 0) * 0.15 +
                    COALESCE(sa.humidity_completeness, 0) * 0.15 +
                    COALESCE(sa.battery_completeness, 0) * 0.10 +
                    COALESCE(sa.gps_completeness, 0) * 0.10
                ) as overall_data_quality_score,
                
                -- Calculate sensor agreement score
                CASE 
                    WHEN sa.pm25_sensor_difference IS NULL THEN NULL
                    WHEN sa.pm25_sensor_difference <= 2 THEN 100
                    WHEN sa.pm25_sensor_difference <= 5 THEN 80
                    WHEN sa.pm25_sensor_difference <= 10 THEN 60
                    WHEN sa.pm25_sensor_difference <= 20 THEN 40
                    ELSE 20
                END as sensor_agreement_score,
                
                -- Calculate device health score
                CASE 
                    WHEN sa.avg_battery_level IS NULL THEN NULL
                    WHEN sa.avg_battery_level >= 90 THEN 100
                    WHEN sa.avg_battery_level >= 70 THEN 80
                    WHEN sa.avg_battery_level >= 50 THEN 60
                    WHEN sa.avg_battery_level >= 30 THEN 40
                    ELSE 20
                END as device_health_score
                
            FROM dim_site s
            LEFT JOIN site_aggregations sa ON s.site_key = sa.site_key
            WHERE {location_filter}
            ORDER BY s.site_name
        """)
        
        result = db.execute(query, filter_params)
        sites = []
        
        for row in result:
            site_dict = dict(row._mapping)
            site_dict = DataProcessor.convert_to_json_serializable(site_dict)
            sites.append(site_dict)
        
        return sites

class AdvancedAnalyticsEngine:
    """Advanced analytics calculations for comprehensive insights"""
    
    @staticmethod
    def calculate_comprehensive_metrics(sites_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate comprehensive location metrics from all site data"""
        
        if not sites_data:
            return {}
        
        # Basic counts
        total_sites = len(sites_data)
        active_sites = len([s for s in sites_data if s.get('device_count', 0) > 0])
        total_devices = sum(s.get('device_count', 0) for s in sites_data)
        
        # Data quality analysis
        quality_scores = [s.get('overall_data_quality_score') for s in sites_data if s.get('overall_data_quality_score') is not None]
        avg_data_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
        
        # Sensor performance analysis
        sensor_agreement_scores = [s.get('sensor_agreement_score') for s in sites_data if s.get('sensor_agreement_score') is not None]
        avg_sensor_agreement = sum(sensor_agreement_scores) / len(sensor_agreement_scores) if sensor_agreement_scores else 0
        
        # Device health analysis
        health_scores = [s.get('device_health_score') for s in sites_data if s.get('device_health_score') is not None]
        avg_device_health = sum(health_scores) / len(health_scores) if health_scores else 0
        
        # Environmental analysis
        temp_readings = [s.get('avg_temperature') for s in sites_data if s.get('avg_temperature') is not None]
        humidity_readings = [s.get('avg_humidity') for s in sites_data if s.get('avg_humidity') is not None]
        
        # PM sensor analysis
        pm25_s1_readings = [s.get('avg_s1_pm2_5') for s in sites_data if s.get('avg_s1_pm2_5') is not None]
        pm25_s2_readings = [s.get('avg_s2_pm2_5') for s in sites_data if s.get('avg_s2_pm2_5') is not None]
        pm10_s1_readings = [s.get('avg_s1_pm10') for s in sites_data if s.get('avg_s1_pm10') is not None]
        pm10_s2_readings = [s.get('avg_s2_pm10') for s in sites_data if s.get('avg_s2_pm10') is not None]
        
        # Network distribution
        all_networks = []
        all_categories = []
        for site in sites_data:
            if site.get('networks'):
                all_networks.extend(site['networks'])
            if site.get('device_categories'):
                all_categories.extend(site['device_categories'])
        
        network_distribution = {}
        for network in set(all_networks):
            network_distribution[network] = all_networks.count(network)
        
        category_distribution = {}
        for category in set(all_categories):
            category_distribution[category] = all_categories.count(category)
        
        return {
            # Basic metrics
            "total_sites": total_sites,
            "active_sites": active_sites,
            "total_devices": total_devices,
            "site_activation_rate": (active_sites / total_sites * 100) if total_sites > 0 else 0,
            "devices_per_site": (total_devices / active_sites) if active_sites > 0 else 0,
            
            # Quality metrics
            "avg_data_quality_score": round(avg_data_quality, 1),
            "avg_sensor_agreement_score": round(avg_sensor_agreement, 1),
            "avg_device_health_score": round(avg_device_health, 1),
            
            # Environmental metrics
            "environmental_stats": {
                "temperature": {
                    "avg": round(sum(temp_readings) / len(temp_readings), 1) if temp_readings else None,
                    "min": round(min(temp_readings), 1) if temp_readings else None,
                    "max": round(max(temp_readings), 1) if temp_readings else None,
                    "sites_reporting": len(temp_readings)
                },
                "humidity": {
                    "avg": round(sum(humidity_readings) / len(humidity_readings), 1) if humidity_readings else None,
                    "min": round(min(humidity_readings), 1) if humidity_readings else None,
                    "max": round(max(humidity_readings), 1) if humidity_readings else None,
                    "sites_reporting": len(humidity_readings)
                }
            },
            
            # PM sensor metrics
            "pm_sensor_stats": {
                "pm25": {
                    "s1_avg": round(sum(pm25_s1_readings) / len(pm25_s1_readings), 1) if pm25_s1_readings else None,
                    "s2_avg": round(sum(pm25_s2_readings) / len(pm25_s2_readings), 1) if pm25_s2_readings else None,
                    "s1_sites": len(pm25_s1_readings),
                    "s2_sites": len(pm25_s2_readings)
                },
                "pm10": {
                    "s1_avg": round(sum(pm10_s1_readings) / len(pm10_s1_readings), 1) if pm10_s1_readings else None,
                    "s2_avg": round(sum(pm10_s2_readings) / len(pm10_s2_readings), 1) if pm10_s2_readings else None,
                    "s1_sites": len(pm10_s1_readings),
                    "s2_sites": len(pm10_s2_readings)
                }
            },
            
            # Network distribution
            "network_distribution": network_distribution,
            "category_distribution": category_distribution
        }
    
    @staticmethod
    def generate_location_recommendations(
        sites_data: List[Dict[str, Any]], 
        summary_metrics: Dict[str, Any]
    ) -> List[str]:
        """Generate intelligent recommendations based on comprehensive analysis"""
        
        recommendations = []
        
        # Data quality recommendations
        if summary_metrics.get('avg_data_quality_score', 100) < 80:
            recommendations.append("Data quality below optimal (80%). Review device connectivity and sensor calibration.")
        
        # Sensor agreement recommendations
        if summary_metrics.get('avg_sensor_agreement_score', 100) < 70:
            recommendations.append("Poor sensor agreement detected. Schedule calibration for dual PM sensors.")
        
        # Device health recommendations
        if summary_metrics.get('avg_device_health_score', 100) < 60:
            recommendations.append("Device health concerns identified. Check battery systems and power supplies.")
        
        # Site activation recommendations
        activation_rate = summary_metrics.get('site_activation_rate', 100)
        if activation_rate < 90:
            inactive_sites = summary_metrics.get('total_sites', 0) - summary_metrics.get('active_sites', 0)
            recommendations.append(f"Low site activation rate ({activation_rate:.1f}%). {inactive_sites} sites need attention.")
        
        # Environmental monitoring recommendations
        env_stats = summary_metrics.get('environmental_stats', {})
        temp_sites = env_stats.get('temperature', {}).get('sites_reporting', 0)
        humidity_sites = env_stats.get('humidity', {}).get('sites_reporting', 0)
        total_active = summary_metrics.get('active_sites', 1)
        
        if temp_sites / total_active < 0.8:
            recommendations.append("Temperature monitoring coverage below 80%. Verify environmental sensor functionality.")
        
        if humidity_sites / total_active < 0.8:
            recommendations.append("Humidity monitoring coverage below 80%. Check environmental sensor systems.")
        
        # Network diversity recommendations
        networks = summary_metrics.get('network_distribution', {})
        if len(networks) == 1:
            recommendations.append("Single network dependency detected. Consider network redundancy for reliability.")
        
        # Default positive message
        if not recommendations:
            recommendations.append("Location performance is within acceptable parameters. Continue regular monitoring.")
        
        return recommendations

# Enhanced endpoint implementations
@router.get("/comprehensive-locations")
def get_comprehensive_locations(
    includeMetrics: bool = Query(True, description="Include performance metrics"),
    minSiteCount: int = Query(1, description="Minimum number of sites to include location"),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive location data utilizing ALL location-related database columns.
    Provides detailed insights into geographic distribution and performance.
    """
    try:
        locations = ComprehensiveDataRetriever.get_comprehensive_locations(db)
        
        # Filter by minimum site count
        filtered_locations = [
            loc for loc in locations 
            if loc.get('site_count', 0) >= minSiteCount
        ]
        
        # Add performance categorization
        for location in filtered_locations:
            freshness_score = location.get('data_freshness_score', 0)
            device_ratio = location.get('device_per_site_ratio', 0)
            
            # Categorize performance
            if freshness_score >= 80 and device_ratio >= 1:
                location['performance_category'] = 'excellent'
            elif freshness_score >= 60 and device_ratio >= 0.5:
                location['performance_category'] = 'good'
            elif freshness_score >= 40:
                location['performance_category'] = 'fair'
            else:
                location['performance_category'] = 'poor'
        
        response_data = {
            "total_locations": len(filtered_locations),
            "performance_summary": {
                "excellent": len([l for l in filtered_locations if l.get('performance_category') == 'excellent']),
                "good": len([l for l in filtered_locations if l.get('performance_category') == 'good']),
                "fair": len([l for l in filtered_locations if l.get('performance_category') == 'fair']),
                "poor": len([l for l in filtered_locations if l.get('performance_category') == 'poor'])
            },
            "locations": filtered_locations
        }
        
        return DataProcessor.create_json_response(response_data)
        
    except Exception as e:
        print(f"Error in get_comprehensive_locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch comprehensive locations: {str(e)}")

@router.get("/location/{location_id}/comprehensive")
def get_comprehensive_location_analytics(
    location_id: str,
    timeRange: TimeRangeEnum = Query(TimeRangeEnum.WEEK, description="Analysis time range"),
    startDate: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    endDate: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    includeRecommendations: bool = Query(True, description="Include optimization recommendations"),
    includeTrends: bool = Query(True, description="Include temporal trend analysis"),
    db: Session = Depends(get_db)
):
    """
    Comprehensive location analytics utilizing ALL database columns.
    Provides deep insights into site performance, data quality, and operational health.
    """
    try:
        # Calculate time range
        start_time, end_time = TimeRangeCalculator.calculate_time_range(timeRange, startDate, endDate)
        
        # Parse location ID to determine filter
        location_parts = location_id.split('_')
        if len(location_parts) < 5:
            raise HTTPException(status_code=400, detail="Invalid location ID format")
        
        country, district, city, town, village = location_parts[:5]
        
        # Build location filter dynamically
        location_filter_parts = []
        filter_params = {"start_time": start_time, "end_time": end_time}
        
        if country != 'unknown':
            location_filter_parts.append("s.country = :country")
            filter_params['country'] = country.replace('_', ' ')
        if district != 'unknown':
            location_filter_parts.append("s.district = :district") 
            filter_params['district'] = district.replace('_', ' ')
        if city != 'unknown':
            location_filter_parts.append("s.city = :city")
            filter_params['city'] = city.replace('_', ' ')
        if town != 'unknown':
            location_filter_parts.append("s.town = :town")
            filter_params['town'] = town.replace('_', ' ')
        if village != 'unknown':
            location_filter_parts.append("s.village = :village")
            filter_params['village'] = village.replace('_', ' ')
        
        location_filter = " AND ".join(location_filter_parts) if location_filter_parts else "1=1"
        
        # Get comprehensive site data
        sites_data = ComprehensiveDataRetriever.get_comprehensive_site_data(
            db, location_filter, filter_params, start_time, end_time
        )
        
        if not sites_data:
            return DataProcessor.create_json_response({
                "location_id": location_id,
                "message": "No sites found for this location",
                "sites": [],
                "metrics": {},
                "recommendations": ["No data available for analysis"]
            })
        
        # Calculate comprehensive metrics
        summary_metrics = AdvancedAnalyticsEngine.calculate_comprehensive_metrics(sites_data)
        
        # Generate recommendations if requested
        recommendations = []
        if includeRecommendations:
            recommendations = AdvancedAnalyticsEngine.generate_location_recommendations(
                sites_data, summary_metrics
            )
        
        # Prepare comprehensive response
        response_data = {
            "location_info": {
                "location_id": location_id,
                "analysis_period": {
                    "time_range": timeRange,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat()
                },
                "geographic_details": {
                    "country": country.replace('_', ' ') if country != 'unknown' else None,
                    "district": district.replace('_', ' ') if district != 'unknown' else None,
                    "city": city.replace('_', ' ') if city != 'unknown' else None,
                    "town": town.replace('_', ' ') if town != 'unknown' else None,
                    "village": village.replace('_', ' ') if village != 'unknown' else None
                }
            },
            "summary_metrics": summary_metrics,
            "site_details": sites_data,
            "recommendations": recommendations
        }
        
        return DataProcessor.create_json_response(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in comprehensive location analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch comprehensive analytics: {str(e)}")

# Backward compatibility endpoints
@router.get("/locations")
def get_locations_legacy(db: Session = Depends(get_db)):
    """Legacy endpoint - use /comprehensive-locations for full features"""
    try:
        locations = ComprehensiveDataRetriever.get_comprehensive_locations(db)
        
        # Simplify response for backward compatibility
        legacy_locations = []
        for location in locations:
            simplified = {
                "country": location.get('country'),
                "city": location.get('city'),
                "district": location.get('district'),
                "town": location.get('town'),
                "site_count": location.get('site_count'),
                "display_name": location.get('primary_location'),
                "location_type": location.get('location_type'),
                "location_id": location.get('comprehensive_location_id')
            }
            legacy_locations.append(simplified)
        
        return DataProcessor.create_json_response(legacy_locations)
        
    except Exception as e:
        print(f"Error in legacy locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")

@router.get("/location/{location_id}")
def get_location_analytics_legacy(
    location_id: str,
    time_range: Optional[str] = "week",
    db: Session = Depends(get_db)
):
    """Legacy endpoint - use /location/{location_id}/comprehensive for full features"""
    # Redirect to comprehensive endpoint with simplified response
    return get_comprehensive_location_analytics(
        location_id=location_id,
        timeRange=time_range,
        includeRecommendations=False,
        includeTrends=False,
        db=db
    )

def register_with_app(app):
    """Register the enhanced site analytics router with the FastAPI application"""
    app.include_router(router)