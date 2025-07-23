from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timedelta
import json
import pytz
from pydantic import BaseModel
from enum import Enum

from app.database import get_db
from app.utils import create_json_response

# Create router for comprehensive data transmission analytics
router = APIRouter(prefix="/api/analytics", tags=["data-analytics"])

# Enhanced data models for comprehensive analytics
class TimeRangeEnum(str, Enum):
    SEVEN_DAYS = "7days"
    THIRTY_DAYS = "30days"
    NINETY_DAYS = "90days"
    SIX_MONTHS = "6months"
    ONE_YEAR = "1year"
    CUSTOM = "custom"

class TransmissionStatus(str, Enum):
    ACTIVE = "active"
    PARTIAL = "partial"
    FAILED = "failed"
    MAINTENANCE = "maintenance"

class ComprehensiveTransmissionData(BaseModel):
    timestamp: str
    device_metrics: Dict[str, Any]  # All device transmission data
    network_summary: Dict[str, Any]  # Network-wide metrics
    quality_indicators: Dict[str, Any]  # Data quality metrics

class DeviceFailureAnalysis(BaseModel):
    device_id: str
    device_name: str
    network: str
    category: str
    location_info: Dict[str, Any]
    failure_metrics: Dict[str, Any]
    recent_status: TransmissionStatus
    recommendations: List[str]

class NetworkPerformanceMetrics(BaseModel):
    timestamp: str
    total_devices: int
    active_devices: int
    transmission_rate: float
    data_volume: int
    expected_volume: int
    quality_score: float
    network_breakdown: Dict[str, Any]
    category_breakdown: Dict[str, Any]

# Timezone configuration
KAMPALA_TZ = pytz.timezone('Africa/Kampala')
UTC_TZ = pytz.UTC

class DateRangeCalculator:
    """Centralized date range calculation to avoid repetition"""
    
    @staticmethod
    def calculate_range(
        time_range: str, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None,
        timezone: pytz.BaseTzInfo = KAMPALA_TZ
    ) -> tuple[datetime, datetime]:
        """Calculate start and end dates with timezone support"""
        
        current_time = datetime.now(timezone)
        
        if time_range == TimeRangeEnum.CUSTOM and start_date and end_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                
                # Localize to specified timezone
                start_dt = timezone.localize(start_dt)
                end_dt = timezone.localize(end_dt.replace(hour=23, minute=59, second=59))
                
                return start_dt, end_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Standard time ranges
        time_deltas = {
            TimeRangeEnum.SEVEN_DAYS: timedelta(days=7),
            TimeRangeEnum.THIRTY_DAYS: timedelta(days=30),
            TimeRangeEnum.NINETY_DAYS: timedelta(days=90),
            TimeRangeEnum.SIX_MONTHS: timedelta(days=180),
            TimeRangeEnum.ONE_YEAR: timedelta(days=365)
        }
        
        delta = time_deltas.get(time_range, timedelta(days=7))
        start_dt = current_time - delta
        
        return start_dt, current_time
    
    @staticmethod
    def get_interval_settings(time_range: str) -> Dict[str, Any]:
        """Get appropriate interval and grouping settings for time range"""
        
        settings = {
            TimeRangeEnum.SEVEN_DAYS: {
                "interval": "1 hour",
                "group_by": "hour",
                "expected_readings_per_interval": 1
            },
            TimeRangeEnum.THIRTY_DAYS: {
                "interval": "1 day", 
                "group_by": "day",
                "expected_readings_per_interval": 24
            },
            TimeRangeEnum.NINETY_DAYS: {
                "interval": "1 day",
                "group_by": "day", 
                "expected_readings_per_interval": 24
            },
            TimeRangeEnum.SIX_MONTHS: {
                "interval": "7 days",
                "group_by": "week",
                "expected_readings_per_interval": 168  # 24 * 7
            },
            TimeRangeEnum.ONE_YEAR: {
                "interval": "30 days",
                "group_by": "month",
                "expected_readings_per_interval": 720  # 24 * 30
            }
        }
        
        return settings.get(time_range, settings[TimeRangeEnum.SEVEN_DAYS])

class ComprehensiveDataRetriever:
    """Centralized data retrieval utilizing ALL database columns"""
    
    @staticmethod
    def get_complete_device_info(db: Session) -> List[Dict[str, Any]]:
        """Get comprehensive device information utilizing ALL dim_device columns"""
        
        query = text("""
            SELECT 
                -- Core device information
                d.device_key,
                d.device_id,
                d.device_name,
                d.network,
                d.category,
                d.status,
                d.is_active,
                d.is_online,
                
                -- Hardware specifications
                d.mount_type,
                d.power_type,
                d.height,
                d.next_maintenance,
                d.first_seen,
                d.last_updated,
                
                -- Location information (ALL columns)
                l.latitude,
                l.longitude,
                l.location_name,
                l.search_name,
                l.village,
                l.admin_level_country,
                l.admin_level_city,
                l.admin_level_division,
                l.site_category,
                l.deployment_date,
                l.site_id,
                l.site_name,
                
                -- Site information
                s.site_name as full_site_name,
                s.data_provider,
                s.town,
                s.city,
                s.district,
                s.country
                
            FROM dim_device d
            LEFT JOIN dim_location l ON d.device_key = l.device_key AND l.is_active = true
            LEFT JOIN dim_site s ON l.site_id = s.site_id
            WHERE d.is_active = true
            ORDER BY d.device_name
        """)
        
        result = db.execute(query)
        devices = []
        
        for row in result:
            device_dict = dict(row._mapping)
            devices.append(device_dict)
        
        return devices
    
    @staticmethod
    def get_comprehensive_transmission_data(
        db: Session,
        start_date: datetime, 
        end_date: datetime,
        interval_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get comprehensive transmission data utilizing ALL fact_device_readings columns"""
        
        query = text("""
            WITH time_series AS (
                SELECT generate_series(
                    DATE_TRUNC(:group_by, CAST(:start_date AS TIMESTAMP) AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Kampala'),
                    DATE_TRUNC(:group_by, CAST(:end_date AS TIMESTAMP) AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Kampala'),
                    CAST(:interval AS INTERVAL)
                ) AS time_bucket
            ),
            comprehensive_readings AS (
                SELECT 
                    DATE_TRUNC(:group_by, r.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Kampala') AS time_bucket,
                    d.device_id,
                    d.device_name,
                    d.network,
                    d.category,
                    d.status,
                    
                    -- Reading counts and quality metrics
                    COUNT(r.reading_key) AS reading_count,
                    COUNT(r.s1_pm2_5) AS pm25_s1_count,
                    COUNT(r.s1_pm10) AS pm10_s1_count,
                    COUNT(r.s2_pm2_5) AS pm25_s2_count,
                    COUNT(r.s2_pm10) AS pm10_s2_count,
                    COUNT(r.temperature) AS temperature_count,
                    COUNT(r.humidity) AS humidity_count,
                    COUNT(r.wind_speed) AS wind_speed_count,
                    COUNT(r.device_temperature) AS device_temp_count,
                    COUNT(r.device_humidity) AS device_humidity_count,
                    COUNT(r.battery) AS battery_count,
                    COUNT(r.altitude) AS altitude_count,
                    COUNT(r.latitude) AS gps_lat_count,
                    COUNT(r.longitude) AS gps_lon_count,
                    COUNT(r.hdop) AS hdop_count,
                    COUNT(r.satellites) AS satellites_count,
                    
                    -- Data quality indicators
                    AVG(CASE WHEN r.s1_pm2_5 IS NOT NULL AND r.s2_pm2_5 IS NOT NULL 
                             THEN ABS(r.s1_pm2_5 - r.s2_pm2_5) / GREATEST(r.s1_pm2_5, r.s2_pm2_5, 1) * 100 
                             END) AS pm25_sensor_agreement,
                    
                    AVG(r.battery) AS avg_battery_level,
                    AVG(r.device_temperature) AS avg_device_temp,
                    COUNT(CASE WHEN r.hdop <= 2 THEN 1 END) AS good_gps_readings,
                    
                    -- Completeness scores for each sensor type
                    (COUNT(r.s1_pm2_5)::float / COUNT(r.reading_key) * 100) AS pm_completeness,
                    (COUNT(r.temperature)::float / COUNT(r.reading_key) * 100) AS env_completeness,
                    (COUNT(r.battery)::float / COUNT(r.reading_key) * 100) AS hardware_completeness,
                    (COUNT(r.latitude)::float / COUNT(r.reading_key) * 100) AS gps_completeness
                    
                FROM dim_device d
                JOIN fact_device_readings r ON d.device_key = r.device_key
                WHERE r.timestamp BETWEEN CAST(:start_date AS TIMESTAMP) AND CAST(:end_date AS TIMESTAMP)
                    AND d.is_active = true
                GROUP BY 
                    DATE_TRUNC(:group_by, r.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Kampala'),
                    d.device_id, d.device_name, d.network, d.category, d.status
            )
            SELECT 
                ts.time_bucket,
                COALESCE(
                    json_object_agg(
                        cr.device_id,
                        json_build_object(
                            'device_name', cr.device_name,
                            'network', cr.network,
                            'category', cr.category,
                            'status', cr.status,
                            'reading_count', cr.reading_count,
                            'sensor_counts', json_build_object(
                                'pm25_s1', cr.pm25_s1_count,
                                'pm25_s2', cr.pm25_s2_count,
                                'pm10_s1', cr.pm10_s1_count,
                                'pm10_s2', cr.pm10_s2_count,
                                'temperature', cr.temperature_count,
                                'humidity', cr.humidity_count,
                                'wind_speed', cr.wind_speed_count,
                                'device_temp', cr.device_temp_count,
                                'device_humidity', cr.device_humidity_count,
                                'battery', cr.battery_count,
                                'altitude', cr.altitude_count,
                                'gps_lat', cr.gps_lat_count,
                                'gps_lon', cr.gps_lon_count,
                                'hdop', cr.hdop_count,
                                'satellites', cr.satellites_count
                            ),
                            'quality_metrics', json_build_object(
                                'pm25_sensor_agreement', ROUND(cr.pm25_sensor_agreement::numeric, 2),
                                'avg_battery_level', ROUND(cr.avg_battery_level::numeric, 2),
                                'avg_device_temp', ROUND(cr.avg_device_temp::numeric, 2),
                                'good_gps_readings', cr.good_gps_readings,
                                'pm_completeness', ROUND(cr.pm_completeness::numeric, 1),
                                'env_completeness', ROUND(cr.env_completeness::numeric, 1),
                                'hardware_completeness', ROUND(cr.hardware_completeness::numeric, 1),
                                'gps_completeness', ROUND(cr.gps_completeness::numeric, 1)
                            ),
                            'transmission_status', CASE 
                                WHEN cr.reading_count >= :expected_readings * 0.9 THEN 'excellent'
                                WHEN cr.reading_count >= :expected_readings * 0.7 THEN 'good'
                                WHEN cr.reading_count >= :expected_readings * 0.5 THEN 'fair'
                                WHEN cr.reading_count > 0 THEN 'poor'
                                ELSE 'failed'
                            END
                        )
                    ) FILTER (WHERE cr.device_id IS NOT NULL),
                    '{}'::json
                ) AS device_data
            FROM time_series ts
            LEFT JOIN comprehensive_readings cr ON ts.time_bucket = cr.time_bucket
            GROUP BY ts.time_bucket
            ORDER BY ts.time_bucket
        """)
        
        result = db.execute(query, {
            "start_date": start_date,
            "end_date": end_date,
            "group_by": interval_settings["group_by"],
            "interval": interval_settings["interval"],
            "expected_readings": interval_settings["expected_readings_per_interval"]
        })
        
        transmission_data = []
        for row in result:
            time_bucket = row[0]
            device_data = row[1] if row[1] else {}
            
            transmission_data.append({
                "timestamp": time_bucket.isoformat() if time_bucket else None,
                "device_data": device_data
            })
        
        return {"transmission_data": transmission_data}

class AdvancedAnalyticsCalculator:
    """Advanced analytics calculations utilizing comprehensive data"""
    
    @staticmethod
    def calculate_network_performance_metrics(
        transmission_data: List[Dict],
        total_devices: int,
        interval_settings: Dict[str, Any]
    ) -> List[NetworkPerformanceMetrics]:
        """Calculate comprehensive network performance metrics"""
        
        network_metrics = []
        
        for time_point in transmission_data:
            device_data = time_point.get("device_data", {})
            
            # Calculate network-wide metrics
            active_devices = len(device_data)
            transmission_rate = (active_devices / total_devices * 100) if total_devices > 0 else 0
            
            # Calculate data volumes
            total_readings = sum(device.get("reading_count", 0) for device in device_data.values())
            expected_total = total_devices * interval_settings["expected_readings_per_interval"]
            
            # Calculate quality score based on multiple factors
            quality_factors = []
            network_breakdown = {}
            category_breakdown = {}
            
            for device_id, device_info in device_data.items():
                network = device_info.get("network", "unknown")
                category = device_info.get("category", "unknown")
                
                # Network breakdown
                if network not in network_breakdown:
                    network_breakdown[network] = {"devices": 0, "readings": 0}
                network_breakdown[network]["devices"] += 1
                network_breakdown[network]["readings"] += device_info.get("reading_count", 0)
                
                # Category breakdown
                if category not in category_breakdown:
                    category_breakdown[category] = {"devices": 0, "readings": 0}
                category_breakdown[category]["devices"] += 1
                category_breakdown[category]["readings"] += device_info.get("reading_count", 0)
                
                # Quality factors
                quality_metrics = device_info.get("quality_metrics", {})
                if quality_metrics:
                    device_quality = (
                        quality_metrics.get("pm_completeness", 0) * 0.3 +
                        quality_metrics.get("env_completeness", 0) * 0.2 +
                        quality_metrics.get("hardware_completeness", 0) * 0.2 +
                        quality_metrics.get("gps_completeness", 0) * 0.1 +
                        (100 - min(100, quality_metrics.get("pm25_sensor_agreement", 0))) * 0.2
                    )
                    quality_factors.append(device_quality)
            
            overall_quality = sum(quality_factors) / len(quality_factors) if quality_factors else 0
            
            network_metrics.append({
                "timestamp": time_point["timestamp"],
                "total_devices": total_devices,
                "active_devices": active_devices,
                "transmission_rate": round(transmission_rate, 1),
                "data_volume": total_readings,
                "expected_volume": expected_total,
                "quality_score": round(overall_quality, 1),
                "network_breakdown": network_breakdown,
                "category_breakdown": category_breakdown
            })
        
        return network_metrics
    
    @staticmethod
    def analyze_device_failures(
        devices_info: List[Dict],
        transmission_data: List[Dict],
        time_range: str
    ) -> List[DeviceFailureAnalysis]:
        """Comprehensive device failure analysis"""
        
        device_failures = []
        
        for device in devices_info:
            device_id = device["device_id"]
            
            # Analyze transmission patterns for this device
            device_readings = []
            quality_issues = []
            
            for time_point in transmission_data:
                device_data = time_point.get("device_data", {}).get(device_id)
                if device_data:
                    device_readings.append(device_data)
                    
                    # Check for quality issues
                    quality_metrics = device_data.get("quality_metrics", {})
                    if quality_metrics.get("pm25_sensor_agreement", 0) > 25:
                        quality_issues.append("Poor sensor agreement")
                    if quality_metrics.get("pm_completeness", 100) < 70:
                        quality_issues.append("Low PM sensor completeness")
                    if quality_metrics.get("avg_battery_level", 100) < 20:
                        quality_issues.append("Low battery")
            
            # Calculate failure metrics
            total_periods = len(transmission_data)
            active_periods = len(device_readings)
            failure_rate = ((total_periods - active_periods) / total_periods * 100) if total_periods > 0 else 0
            
            # Determine status
            if failure_rate == 0:
                status = TransmissionStatus.ACTIVE
            elif failure_rate < 25:
                status = TransmissionStatus.PARTIAL
            elif device.get("status") == "maintenance":
                status = TransmissionStatus.MAINTENANCE
            else:
                status = TransmissionStatus.FAILED
            
            # Generate recommendations
            recommendations = []
            if failure_rate > 50:
                recommendations.append("Device requires immediate attention - high failure rate")
            if "Low battery" in quality_issues:
                recommendations.append("Check power supply and battery system")
            if "Poor sensor agreement" in quality_issues:
                recommendations.append("Calibrate PM sensors - readings inconsistent")
            if not recommendations:
                recommendations.append("Device performing within acceptable parameters")
            
            # Only include devices with issues for failure analysis
            if failure_rate > 10 or quality_issues:
                device_failures.append({
                    "device_id": device_id,
                    "device_name": device.get("device_name", "Unknown"),
                    "network": device.get("network", "Unknown"),
                    "category": device.get("category", "Unknown"),
                    "location_info": {
                        "country": device.get("admin_level_country") or device.get("country"),
                        "city": device.get("admin_level_city") or device.get("city"),
                        "site_name": device.get("site_name") or device.get("full_site_name"),
                        "coordinates": {
                            "latitude": device.get("latitude"),
                            "longitude": device.get("longitude")
                        }
                    },
                    "failure_metrics": {
                        "failure_rate_percent": round(failure_rate, 1),
                        "active_periods": active_periods,
                        "total_periods": total_periods,
                        "quality_issues": list(set(quality_issues))
                    },
                    "recent_status": status,
                    "recommendations": recommendations
                })
        
        # Sort by failure rate (highest first)
        device_failures.sort(key=lambda x: x["failure_metrics"]["failure_rate_percent"], reverse=True)
        
        return device_failures[:20]  # Top 20 problematic devices

# Enhanced endpoint implementations
@router.get("/comprehensive-transmission")
def get_comprehensive_transmission_analytics(
    timeRange: TimeRangeEnum = Query(TimeRangeEnum.SEVEN_DAYS, description="Time range for analysis"),
    startDate: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    endDate: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    includeQualityMetrics: bool = Query(True, description="Include data quality analysis"),
    includeNetworkBreakdown: bool = Query(True, description="Include network performance breakdown"),
    db: Session = Depends(get_db)
):
    """
    Comprehensive transmission analytics utilizing ALL database columns.
    Provides detailed insights into device performance, data quality, and network health.
    """
    try:
        # Calculate date range
        start_date, end_date = DateRangeCalculator.calculate_range(timeRange, startDate, endDate)
        interval_settings = DateRangeCalculator.get_interval_settings(timeRange)
        
        # Get comprehensive device information
        devices_info = ComprehensiveDataRetriever.get_complete_device_info(db)
        total_devices = len(devices_info)
        
        # Get comprehensive transmission data
        transmission_result = ComprehensiveDataRetriever.get_comprehensive_transmission_data(
            db, start_date, end_date, interval_settings
        )
        
        transmission_data = transmission_result["transmission_data"]
        
        # Calculate network performance metrics
        network_metrics = AdvancedAnalyticsCalculator.calculate_network_performance_metrics(
            transmission_data, total_devices, interval_settings
        )
        
        # Prepare response
        response_data = {
            "metadata": {
                "time_range": timeRange,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "timezone": "Africa/Kampala",
                "total_devices": total_devices,
                "interval_settings": interval_settings
            },
            "transmission_data": transmission_data,
            "network_metrics": network_metrics
        }
        
        return create_json_response(response_data)
        
    except Exception as e:
        print(f"Error in comprehensive transmission analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch comprehensive analytics: {str(e)}")

@router.get("/advanced-device-failures")
def get_advanced_device_failure_analysis(
    timeRange: TimeRangeEnum = Query(TimeRangeEnum.THIRTY_DAYS, description="Time range for failure analysis"),
    minFailureRate: float = Query(10.0, description="Minimum failure rate % to include device"),
    includeQualityIssues: bool = Query(True, description="Include data quality issues"),
    includeRecommendations: bool = Query(True, description="Include maintenance recommendations"),
    db: Session = Depends(get_db)
):
    """
    Advanced device failure analysis with comprehensive diagnostics.
    Identifies devices with transmission issues and provides actionable insights.
    """
    try:
        # Calculate date range
        start_date, end_date = DateRangeCalculator.calculate_range(timeRange)
        interval_settings = DateRangeCalculator.get_interval_settings(timeRange)
        
        # Get comprehensive device information
        devices_info = ComprehensiveDataRetriever.get_complete_device_info(db)
        
        # Get transmission data for analysis
        transmission_result = ComprehensiveDataRetriever.get_comprehensive_transmission_data(
            db, start_date, end_date, interval_settings
        )
        
        transmission_data = transmission_result["transmission_data"]
        
        # Perform advanced failure analysis
        device_failures = AdvancedAnalyticsCalculator.analyze_device_failures(
            devices_info, transmission_data, timeRange
        )
        
        # Filter by minimum failure rate
        filtered_failures = [
            failure for failure in device_failures 
            if failure["failure_metrics"]["failure_rate_percent"] >= minFailureRate
        ]
        
        # Summary statistics
        summary = {
            "total_devices_analyzed": len(devices_info),
            "devices_with_issues": len(filtered_failures),
            "average_failure_rate": round(
                sum(f["failure_metrics"]["failure_rate_percent"] for f in filtered_failures) / len(filtered_failures), 1
            ) if filtered_failures else 0,
            "most_common_issues": {},
            "network_breakdown": {},
            "category_breakdown": {}
        }
        
        # Calculate breakdown statistics
        for failure in filtered_failures:
            network = failure["network"]
            category = failure["category"]
            
            summary["network_breakdown"][network] = summary["network_breakdown"].get(network, 0) + 1
            summary["category_breakdown"][category] = summary["category_breakdown"].get(category, 0) + 1
        
        response_data = {
            "metadata": {
                "analysis_period": timeRange,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "min_failure_rate": minFailureRate
            },
            "summary": summary,
            "device_failures": filtered_failures
        }
        
        return create_json_response(response_data)
        
    except Exception as e:
        print(f"Error in advanced device failure analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to perform failure analysis: {str(e)}")

@router.get("/network-health-dashboard")
def get_network_health_dashboard(
    timeRange: TimeRangeEnum = Query(TimeRangeEnum.SEVEN_DAYS, description="Time range for dashboard"),
    db: Session = Depends(get_db)
):
    """
    Comprehensive network health dashboard combining all analytics.
    Provides executive-level overview of entire network performance.
    """
    try:
        # Get comprehensive analytics
        start_date, end_date = DateRangeCalculator.calculate_range(timeRange)
        interval_settings = DateRangeCalculator.get_interval_settings(timeRange)
        
        # Get all data
        devices_info = ComprehensiveDataRetriever.get_complete_device_info(db)
        transmission_result = ComprehensiveDataRetriever.get_comprehensive_transmission_data(
            db, start_date, end_date, interval_settings
        )
        
        transmission_data = transmission_result["transmission_data"]
        network_metrics = AdvancedAnalyticsCalculator.calculate_network_performance_metrics(
            transmission_data, len(devices_info), interval_settings
        )
        
        device_failures = AdvancedAnalyticsCalculator.analyze_device_failures(
            devices_info, transmission_data, timeRange
        )
        
        # Calculate executive summary
        latest_metrics = network_metrics[-1] if network_metrics else {}
        total_failures = len([f for f in device_failures if f["failure_metrics"]["failure_rate_percent"] > 25])
        
        executive_summary = {
            "network_status": "healthy" if latest_metrics.get("transmission_rate", 0) > 85 else 
                             "warning" if latest_metrics.get("transmission_rate", 0) > 70 else "critical",
            "total_devices": len(devices_info),
            "active_devices": latest_metrics.get("active_devices", 0),
            "transmission_rate": latest_metrics.get("transmission_rate", 0),
            "data_quality_score": latest_metrics.get("quality_score", 0),
            "devices_needing_attention": total_failures,
            "data_volume_24h": sum(m.get("data_volume", 0) for m in network_metrics[-24:]) if len(network_metrics) >= 24 else 0
        }
        
        response_data = {
            "dashboard_timestamp": datetime.now(KAMPALA_TZ).isoformat(),
            "executive_summary": executive_summary,
            "network_metrics": network_metrics[-48:],  # Last 48 data points
            "top_issues": device_failures[:10],  # Top 10 issues
            "network_breakdown": latest_metrics.get("network_breakdown", {}),
            "category_breakdown": latest_metrics.get("category_breakdown", {})
        }
        
        return create_json_response(response_data)
        
    except Exception as e:
        print(f"Error in network health dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard: {str(e)}")

# Backward compatibility endpoints (simplified versions)
@router.get("/device-transmission")
def get_device_transmission_legacy(
    timeRange: str = Query("7days", description="Time range: 7days, 30days, 90days, or year"),
    db: Session = Depends(get_db)
):
    """Legacy endpoint - use /comprehensive-transmission for full features"""
    try:
        # Redirect to comprehensive endpoint with simplified response
        start_date, end_date = DateRangeCalculator.calculate_range(timeRange)
        interval_settings = DateRangeCalculator.get_interval_settings(timeRange)
        
        transmission_result = ComprehensiveDataRetriever.get_comprehensive_transmission_data(
            db, start_date, end_date, interval_settings
        )
        
        # Simplify response for backward compatibility
        legacy_data = []
        for time_point in transmission_result["transmission_data"]:
            device_data = time_point.get("device_data", {})
            row_data = {"hour": time_point["timestamp"]}
            
            for device_id, device_info in device_data.items():
                reading_count = device_info.get("reading_count", 0)
                row_data[device_id] = 100 if reading_count > 0 else 0
            
            legacy_data.append(row_data)
        
        return create_json_response(legacy_data)
        
    except Exception as e:
        print(f"Error in legacy device transmission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch transmission data: {str(e)}")

# Register the router function
def register_with_app(app):
    """Register the enhanced data analytics router with the FastAPI application"""
    app.include_router(router)