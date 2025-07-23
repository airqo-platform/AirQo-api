from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, Extra

from datetime import datetime, timedelta, timezone, date
from dateutil import tz
from decimal import Decimal
import json
import math
import os
import sys

from app.device_performance_endpoint import router as performance_router, register_with_app
from app.site_performance_endpoint import router as site_router, register_with_app as register_site_endpoints
from app.data_transmission_endpoint import router as data_transmission_router, register_with_app as register_data_analytics

from . import database
from . import models, schemas

app = FastAPI(
    title="AirQo Device Monitoring API",
    description="API for comprehensive AirQo device performance and data monitoring",
    version="2.0.0"
)

# Register endpoint routers
register_with_app(app)
register_site_endpoints(app)
register_data_analytics(app)

# Custom JSON encoder to handle special values
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

# CORS configuration
raw_origins = os.getenv("CORS_ORIGINS", "")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://airflow:airflow@postgres:5432/airflow")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper function to convert values to JSON-serializable format
def convert_to_json_serializable(item):
    if isinstance(item, dict):
        return {k: convert_to_json_serializable(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [convert_to_json_serializable(i) for i in item]
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
        if item.lower() in ['nan', 'null', 'none']:
            return None
        return item
    return item

# Timezone helper
def convert_to_eat(timestamp):
    """Convert timestamp to East Africa Time"""
    if timestamp is None:
        return None
    eat_timezone = tz.gettz('Africa/Kampala')
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    eat_time = timestamp.astimezone(eat_timezone)
    return eat_time.isoformat()

# Custom response to handle JSON encoding
def create_json_response(content):
    """Create a Response with properly encoded JSON content"""
    json_content = json.dumps(content, cls=CustomJSONEncoder)
    return Response(content=json_content, media_type="application/json")

# ==========================================
# API ENDPOINTS - CORRECT ORDER IS CRITICAL
# ==========================================

@app.get("/")
def read_root():
    return {"message": "AirQo Device Health Monitoring API v2.0 is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "2.0.0"}

# ====================================
# SPECIFIC ROUTES FIRST (MOST IMPORTANT)
# ====================================

@app.get("/devices/comprehensive")
def get_all_devices_comprehensive(
    include_readings: bool = Query(True, description="Include latest sensor readings"),
    include_health_tips: bool = Query(False, description="Include health tips"),
    active_only: bool = Query(False, description="Return only active devices"),
    deployed_only: bool = Query(False, description="Return only deployed devices"),
    db: Session = Depends(get_db)
):
    """Get comprehensive device data in a single API call"""
    try:
        # Build dynamic query based on parameters
        where_conditions = []
        if active_only:
            where_conditions.append("d.is_active = true")
        if deployed_only:
            where_conditions.append("d.status = 'deployed'")
        
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        query = text(f"""
            WITH latest_readings AS (
                SELECT DISTINCT ON (device_key) 
                    device_key,
                    site_key,
                    timestamp,
                    s1_pm2_5,
                    s1_pm10,
                    s2_pm2_5,
                    s2_pm10,
                    temperature,
                    humidity,
                    wind_speed,
                    device_temperature,
                    device_humidity,
                    battery,
                    altitude,
                    frequency
                FROM fact_device_readings
                ORDER BY device_key, timestamp DESC
            ),
            latest_health_tips AS (
                SELECT DISTINCT ON (r.device_key)
                    r.device_key,
                    h.tip_id,
                    h.title,
                    h.description,
                    h.image_url,
                    h.aqi_category
                FROM fact_device_readings r
                JOIN fact_health_tips h ON r.reading_key = h.reading_key
                ORDER BY r.device_key, r.timestamp DESC
            )
            SELECT 
                -- Device core data
                d.device_key,
                d.device_id,
                d.device_name,
                d.network,
                d.category,
                d.status,
                d.is_active,
                d.is_online,
                d.mount_type,
                d.power_type,
                d.height,
                d.next_maintenance,
                d.first_seen,
                d.last_updated,
                
                -- Location data
                l.latitude,
                l.longitude,
                l.location_name,
                l.search_name,
                l.village,
                l.admin_level_country,
                l.admin_level_city,
                l.admin_level_division,
                l.site_category as location_site_category,
                l.deployment_date,
                l.site_id,
                l.site_name,
                
                -- Site data
                s.site_name as full_site_name,
                s.site_category as full_site_category,
                s.data_provider,
                s.town,
                s.city,
                s.district,
                s.country,
                
                -- Latest readings
                r.timestamp as reading_timestamp,
                r.s1_pm2_5,
                r.s1_pm10,
                r.s2_pm2_5,
                r.s2_pm10,
                r.temperature,
                r.humidity,
                r.wind_speed,
                r.device_temperature,
                r.device_humidity,
                r.battery,
                r.altitude,
                r.frequency,
                
                -- Health tips
                h.tip_id,
                h.title as tip_title,
                h.description as tip_description,
                h.image_url as tip_image_url,
                h.aqi_category
                
            FROM dim_device d
            LEFT JOIN dim_location l ON d.device_key = l.device_key AND l.is_active = true
            LEFT JOIN latest_readings r ON d.device_key = r.device_key
            LEFT JOIN dim_site s ON r.site_key = s.site_key
            LEFT JOIN latest_health_tips h ON d.device_key = h.device_key
            {where_clause}
            ORDER BY d.device_name
        """)
        
        result = db.execute(query)
        devices = []
        
        for row in result:
            try:
                row_dict = dict(row._mapping)
                
                # Process device core data
                device_data = {
                    "device_key": row_dict.get("device_key"),
                    "device_id": row_dict.get("device_id"),
                    "device_name": row_dict.get("device_name"),
                    "network": row_dict.get("network"),
                    "category": row_dict.get("category"),
                    "status": row_dict.get("status"),
                    "is_active": row_dict.get("is_active"),
                    "is_online": row_dict.get("is_online"),
                    "mount_type": row_dict.get("mount_type"),
                    "power_type": row_dict.get("power_type"),
                    "height": row_dict.get("height"),
                    "next_maintenance": convert_to_eat(row_dict.get("next_maintenance")),
                    "first_seen": convert_to_eat(row_dict.get("first_seen")),
                    "last_updated": convert_to_eat(row_dict.get("last_updated"))
                }
                
                # Process location data
                device_data["location"] = {
                    "latitude": row_dict.get("latitude"),
                    "longitude": row_dict.get("longitude"),
                    "location_name": row_dict.get("location_name"),
                    "search_name": row_dict.get("search_name"),
                    "village": row_dict.get("village"),
                    "admin_level_country": row_dict.get("admin_level_country"),
                    "admin_level_city": row_dict.get("admin_level_city"),
                    "admin_level_division": row_dict.get("admin_level_division"),
                    "site_category": row_dict.get("location_site_category"),
                    "deployment_date": convert_to_eat(row_dict.get("deployment_date"))
                }
                
                # Process site data
                device_data["site"] = {
                    "site_id": row_dict.get("site_id"),
                    "site_name": row_dict.get("site_name") or row_dict.get("full_site_name"),
                    "site_category": row_dict.get("location_site_category") or row_dict.get("full_site_category"),
                    "data_provider": row_dict.get("data_provider"),
                    "town": row_dict.get("town"),
                    "city": row_dict.get("city"),
                    "district": row_dict.get("district"),
                    "country": row_dict.get("country")
                }
                
                # Process latest readings if requested
                if include_readings:
                    device_data["latest_reading"] = {
                        "timestamp": convert_to_eat(row_dict.get("reading_timestamp")),
                        "s1_pm2_5": row_dict.get("s1_pm2_5"),
                        "s1_pm10": row_dict.get("s1_pm10"),
                        "s2_pm2_5": row_dict.get("s2_pm2_5"),
                        "s2_pm10": row_dict.get("s2_pm10"),
                        "temperature": row_dict.get("temperature"),
                        "humidity": row_dict.get("humidity"),
                        "wind_speed": row_dict.get("wind_speed"),
                        "device_temperature": row_dict.get("device_temperature"),
                        "device_humidity": row_dict.get("device_humidity"),
                        "battery": row_dict.get("battery"),
                        "altitude": row_dict.get("altitude"),
                        "frequency": row_dict.get("frequency")
                    }
                
                # Process health tips if requested
                if include_health_tips and row_dict.get("tip_id"):
                    device_data["health_tips"] = [{
                        "tip_id": row_dict.get("tip_id"),
                        "title": row_dict.get("tip_title"),
                        "description": row_dict.get("tip_description"),
                        "image_url": row_dict.get("tip_image_url")
                    }]
                
                # Clean and convert data
                device_data = convert_to_json_serializable(device_data)
                devices.append(device_data)
                
            except Exception as row_error:
                print(f"Error processing device row: {str(row_error)}")
                continue
        
        return create_json_response({
            "devices": devices,
            "total_count": len(devices),
            "filters_applied": {
                "active_only": active_only,
                "deployed_only": deployed_only,
                "include_readings": include_readings,
                "include_health_tips": include_health_tips
            }
        })
        
    except Exception as e:
        print(f"Error in comprehensive devices endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch comprehensive device data: {str(e)}")

@app.get("/devices/map-data")
def get_devices_map_data(
    active_only: bool = Query(True, description="Return only active devices"),
    deployed_only: bool = Query(True, description="Return only deployed devices"),
    include_readings: bool = Query(True, description="Include latest readings"),
    db: Session = Depends(get_db)
):
    """Optimized endpoint for map visualization"""
    try:
        where_conditions = ["l.latitude IS NOT NULL", "l.longitude IS NOT NULL", "l.is_active = true"]
        
        if active_only:
            where_conditions.append("d.is_active = true")
        if deployed_only:
            where_conditions.append("d.status = 'deployed'")
        
        where_clause = "WHERE " + " AND ".join(where_conditions)
        
        query = text(f"""
            WITH latest_readings AS (
                SELECT DISTINCT ON (device_key) 
                    device_key,
                    timestamp,
                    s1_pm2_5,
                    s1_pm10,
                    s2_pm2_5,
                    s2_pm10
                FROM fact_device_readings
                ORDER BY device_key, timestamp DESC
            )
            SELECT 
                d.device_id,
                d.device_name,
                d.status,
                d.is_online,
                l.latitude,
                l.longitude,
                l.location_name,
                l.admin_level_country,
                l.admin_level_city,
                l.site_name,
                r.timestamp as reading_timestamp,
                r.s1_pm2_5,
                r.s1_pm10,
                r.s2_pm2_5,
                r.s2_pm10
            FROM dim_device d
            INNER JOIN dim_location l ON d.device_key = l.device_key
            LEFT JOIN latest_readings r ON d.device_key = r.device_key
            {where_clause}
            ORDER BY d.device_name
        """)
        
        result = db.execute(query)
        map_devices = []
        
        for row in result:
            row_dict = dict(row._mapping)
            
            device_data = {
                "id": row_dict.get("device_id"),
                "name": row_dict.get("device_name"),
                "status": "ONLINE" if row_dict.get("is_online") else "OFFLINE",
                "latitude": row_dict.get("latitude"),
                "longitude": row_dict.get("longitude"),
                "location": {
                    "name": row_dict.get("location_name"),
                    "country": row_dict.get("admin_level_country"),
                    "city": row_dict.get("admin_level_city"),
                    "site_name": row_dict.get("site_name")
                }
            }
            
            if include_readings and row_dict.get("reading_timestamp"):
                device_data["latest_reading"] = {
                    "timestamp": convert_to_eat(row_dict.get("reading_timestamp")),
                    "s1_pm2_5": row_dict.get("s1_pm2_5"),
                    "s1_pm10": row_dict.get("s1_pm10"),
                    "s2_pm2_5": row_dict.get("s2_pm2_5"),
                    "s2_pm10": row_dict.get("s2_pm10"),
                    "avg_pm2_5": (row_dict.get("s1_pm2_5", 0) + row_dict.get("s2_pm2_5", 0)) / 2 
                                if row_dict.get("s1_pm2_5") and row_dict.get("s2_pm2_5") else None
                }
            
            device_data = convert_to_json_serializable(device_data)
            map_devices.append(device_data)
        
        return create_json_response({
            "devices": map_devices,
            "total_count": len(map_devices),
            "filters": {
                "active_only": active_only,
                "deployed_only": deployed_only,
                "include_readings": include_readings
            }
        })
        
    except Exception as e:
        print(f"Error in map data endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch map data: {str(e)}")

# ====================================
# INDIVIDUAL DEVICE ROUTES
# ====================================

@app.get("/devices/{device_id}/complete")
def get_single_device_complete(device_id: str, db: Session = Depends(get_db)):
    """Get ALL data for a single device in one API call"""
    try:
        query = text("""
            WITH latest_readings AS (
                SELECT DISTINCT ON (device_key) 
                    device_key,
                    reading_key,
                    site_key,
                    timestamp,
                    s1_pm2_5,
                    s1_pm10,
                    s2_pm2_5,
                    s2_pm10,
                    temperature,
                    humidity,
                    wind_speed,
                    device_temperature,
                    device_humidity,
                    battery,
                    altitude,
                    latitude as reading_latitude,
                    longitude as reading_longitude,
                    frequency
                FROM fact_device_readings
                ORDER BY device_key, timestamp DESC
            ),
            all_health_tips AS (
                SELECT 
                    h.reading_key,
                    h.tip_id,
                    h.title,
                    h.description,
                    h.image_url,
                    h.aqi_category
                FROM fact_health_tips h
            )
            SELECT 
                -- Device core data
                d.device_key,
                d.device_id,
                d.device_name,
                d.network,
                d.category,
                d.status,
                d.is_active,
                d.is_online,
                d.mount_type,
                d.power_type,
                d.height,
                d.next_maintenance,
                d.first_seen,
                d.last_updated,
                
                -- Location data
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
                
                -- Site data
                s.site_name as full_site_name,
                s.location_name as full_location_name,
                s.search_name as full_search_name,
                s.village as full_village,
                s.town,
                s.city,
                s.district,
                s.country,
                s.data_provider,
                s.site_category as full_site_category,
                
                -- Latest reading
                r.timestamp as reading_timestamp,
                r.s1_pm2_5,
                r.s1_pm10,
                r.s2_pm2_5,
                r.s2_pm10,
                r.temperature,
                r.humidity,
                r.wind_speed,
                r.device_temperature,
                r.device_humidity,
                r.battery,
                r.altitude,
                r.reading_latitude,
                r.reading_longitude,
                r.frequency,
                
                -- Health tips
                h.tip_id,
                h.title as tip_title,
                h.description as tip_description,
                h.image_url as tip_image_url,
                h.aqi_category
                
            FROM dim_device d
            LEFT JOIN dim_location l ON d.device_key = l.device_key AND l.is_active = true
            LEFT JOIN latest_readings r ON d.device_key = r.device_key
            LEFT JOIN dim_site s ON r.site_key = s.site_key
            LEFT JOIN all_health_tips h ON r.reading_key = h.reading_key
            WHERE d.device_id = :device_id
        """)
        
        result = db.execute(query, {"device_id": device_id})
        rows = result.fetchall()
        
        if not rows:
            raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
        
        # Process the first row for device data
        first_row = dict(rows[0]._mapping)
        
        # Build comprehensive device response
        device_data = {
            "device": {
                "device_key": first_row.get("device_key"),
                "device_id": first_row.get("device_id"),
                "device_name": first_row.get("device_name"),
                "network": first_row.get("network"),
                "category": first_row.get("category"),
                "status": first_row.get("status"),
                "is_active": first_row.get("is_active"),
                "is_online": first_row.get("is_online"),
                "mount_type": first_row.get("mount_type"),
                "power_type": first_row.get("power_type"),
                "height": first_row.get("height"),
                "next_maintenance": convert_to_eat(first_row.get("next_maintenance")),
                "first_seen": convert_to_eat(first_row.get("first_seen")),
                "last_updated": convert_to_eat(first_row.get("last_updated"))
            },
            "location": {
                "latitude": first_row.get("latitude"),
                "longitude": first_row.get("longitude"),
                "location_name": first_row.get("location_name"),
                "search_name": first_row.get("search_name"),
                "village": first_row.get("village"),
                "admin_level_country": first_row.get("admin_level_country"),
                "admin_level_city": first_row.get("admin_level_city"),
                "admin_level_division": first_row.get("admin_level_division"),
                "site_category": first_row.get("site_category"),
                "deployment_date": convert_to_eat(first_row.get("deployment_date"))
            },
            "site": {
                "site_id": first_row.get("site_id"),
                "site_name": first_row.get("site_name") or first_row.get("full_site_name"),
                "location_name": first_row.get("location_name") or first_row.get("full_location_name"),
                "search_name": first_row.get("search_name") or first_row.get("full_search_name"),
                "village": first_row.get("village") or first_row.get("full_village"),
                "town": first_row.get("town"),
                "city": first_row.get("city"),
                "district": first_row.get("district"),
                "country": first_row.get("country"),
                "data_provider": first_row.get("data_provider"),
                "site_category": first_row.get("site_category") or first_row.get("full_site_category")
            },
            "latest_reading": {
                "timestamp": convert_to_eat(first_row.get("reading_timestamp")),
                "s1_pm2_5": first_row.get("s1_pm2_5"),
                "s1_pm10": first_row.get("s1_pm10"),
                "s2_pm2_5": first_row.get("s2_pm2_5"),
                "s2_pm10": first_row.get("s2_pm10"),
                "temperature": first_row.get("temperature"),
                "humidity": first_row.get("humidity"),
                "wind_speed": first_row.get("wind_speed"),
                "device_temperature": first_row.get("device_temperature"),
                "device_humidity": first_row.get("device_humidity"),
                "battery": first_row.get("battery"),
                "altitude": first_row.get("altitude"),
                "reading_latitude": first_row.get("reading_latitude"),
                "reading_longitude": first_row.get("reading_longitude"),
                "frequency": first_row.get("frequency")
            }
        }
        
        # Collect all health tips
        health_tips = []
        for row in rows:
            row_dict = dict(row._mapping)
            if row_dict.get("tip_id"):
                tip = {
                    "tip_id": row_dict.get("tip_id"),
                    "title": row_dict.get("tip_title"),
                    "description": row_dict.get("tip_description"),
                    "image_url": row_dict.get("tip_image_url"),
                    "aqi_category": row_dict.get("aqi_category")
                }
                if tip not in health_tips:
                    health_tips.append(tip)
        
        device_data["health_tips"] = health_tips
        
        # Get maintenance history
        maintenance_query = text("""
            SELECT 
                timestamp,
                is_online,
                device_status,
                LAG(is_online) OVER (ORDER BY timestamp) as prev_online,
                LAG(device_status) OVER (ORDER BY timestamp) as prev_status
            FROM fact_device_status
            WHERE device_key = :device_key
            ORDER BY timestamp DESC
            LIMIT 20
        """)
        
        maintenance_result = db.execute(maintenance_query, {"device_key": first_row.get("device_key")})
        maintenance_history = []
        
        for row in maintenance_result:
            row_dict = dict(row._mapping)
            maintenance_history.append({
                "timestamp": convert_to_eat(row_dict.get("timestamp")),
                "is_online": row_dict.get("is_online"),
                "device_status": row_dict.get("device_status"),
                "change_type": "status_change" if row_dict.get("prev_status") != row_dict.get("device_status") else
                             "came_online" if not row_dict.get("prev_online") and row_dict.get("is_online") else
                             "went_offline" if row_dict.get("prev_online") and not row_dict.get("is_online") else
                             "no_change"
            })
        
        device_data["maintenance_history"] = maintenance_history
        
        # Get recent readings
        readings_query = text("""
            SELECT 
                timestamp,
                s1_pm2_5,
                s1_pm10,
                s2_pm2_5,
                s2_pm10,
                temperature,
                humidity,
                battery
            FROM fact_device_readings
            WHERE device_key = :device_key
            ORDER BY timestamp DESC
            LIMIT 50
        """)
        
        readings_result = db.execute(readings_query, {"device_key": first_row.get("device_key")})
        recent_readings = []
        
        for row in readings_result:
            row_dict = dict(row._mapping)
            recent_readings.append({
                "timestamp": convert_to_eat(row_dict.get("timestamp")),
                "s1_pm2_5": row_dict.get("s1_pm2_5"),
                "s1_pm10": row_dict.get("s1_pm10"),
                "s2_pm2_5": row_dict.get("s2_pm2_5"),
                "s2_pm10": row_dict.get("s2_pm10"),
                "temperature": row_dict.get("temperature"),
                "humidity": row_dict.get("humidity"),
                "battery": row_dict.get("battery")
            })
        
        device_data["recent_readings"] = recent_readings
        device_data["timezone"] = "Africa/Kampala (EAT)"
        
        # Clean and convert data
        device_data = convert_to_json_serializable(device_data)
        
        return create_json_response(device_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in complete device endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch complete device data: {str(e)}")

# ====================================
# OTHER ENDPOINTS
# ====================================

@app.get("/device-counts")
def get_device_counts(db: Session = Depends(get_db)):
    """Get device counts - optimized single query"""
    try:
        result = db.execute(text("""
            SELECT 
                COUNT(*) as total_devices,
                COUNT(CASE WHEN is_online = true THEN 1 END) as active_devices,
                COUNT(CASE WHEN is_online = false THEN 1 END) as offline_devices,
                COUNT(CASE WHEN status = 'deployed' THEN 1 END) as deployed_devices,
                COUNT(CASE WHEN status = 'not deployed' THEN 1 END) as not_deployed,
                COUNT(CASE WHEN status = 'recalled' THEN 1 END) as recalled_devices
            FROM dim_device
        """))
        
        row = result.fetchone()
        
        return {
            "total_devices": row.total_devices,
            "active_devices": row.active_devices,
            "offline_devices": row.offline_devices,
            "deployed_devices": row.deployed_devices,
            "not_deployed": row.not_deployed,
            "recalled_devices": row.recalled_devices
        }
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in device counts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device counts: {str(e)}")

# ====================================
# LEGACY ENDPOINTS (DEPRECATED)
# ====================================

@app.get("/devices", deprecated=True)
def get_all_devices_legacy(db: Session = Depends(get_db)):
    """Legacy endpoint - use /devices/comprehensive instead"""
    return get_all_devices_comprehensive(
        include_readings=False, 
        include_health_tips=False, 
        active_only=False, 
        deployed_only=False, 
        db=db
    )

# ====================================
# PARAMETERIZED ROUTE - MUST BE LAST
# ====================================

@app.get("/devices/{device_id}")
def get_device_legacy(device_id: str, db: Session = Depends(get_db)):
    """Legacy endpoint - use /devices/{device_id}/complete instead"""
    # Prevent infinite recursion by checking for specific route names
    if device_id in ["comprehensive", "map-data", "complete"]:
        raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
    
    # Simple device lookup for legacy compatibility
    try:
        query = text("""
            SELECT 
                d.device_id,
                d.device_name,
                d.status,
                d.is_online,
                l.latitude,
                l.longitude,
                l.location_name
            FROM dim_device d
            LEFT JOIN dim_location l ON d.device_key = l.device_key AND l.is_active = true
            WHERE d.device_id = :device_id
        """)
        
        result = db.execute(query, {"device_id": device_id})
        device_row = result.first()
        
        if not device_row:
            raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
        
        device_dict = dict(device_row._mapping)
        device_dict = convert_to_json_serializable(device_dict)
        
        return create_json_response(device_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in legacy device endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device: {str(e)}")