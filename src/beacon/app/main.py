from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from typing import List, Optional, Dict, Any
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
    description="API for monitoring AirQo device performance and data",
    version="1.0.0"
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
                return str(float_val)
            return float_val
        except (ValueError, OverflowError, TypeError):
            return str(item)
    elif isinstance(item, float):
        if math.isnan(item) or math.isinf(item):
            return str(item)
        return item
    elif isinstance(item, str):
        if item.lower() == 'nan':
            return None
        return item
    return item

# Pydantic models
class Device(BaseModel):
    device_key: Optional[int] = None
    device_id: str
    device_name: Optional[str] = None
    long_name: Optional[str] = None
    alias: Optional[str] = None
    network: Optional[str] = None
    category: Optional[str] = None
    serial_number: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    is_online: Optional[bool] = None
    is_primary_in_location: Optional[bool] = None
    mobility: Optional[bool] = None
    visibility: Optional[bool] = None
    height: Optional[float] = None
    mount_type: Optional[str] = None
    power_type: Optional[str] = None
    next_maintenance: Optional[str] = None
    deployment_date: Optional[str] = None
    description: Optional[str] = None
    device_number: Optional[int] = None
    auth_required: Optional[bool] = None
    created_at: Optional[str] = None
    groups: Optional[List[str]] = None
    device_codes: Optional[List[str]] = None
    first_seen: Optional[str] = None
    last_updated: Optional[str] = None
    approximate_distance_in_km: Optional[float] = None
    bearing_in_radians: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    site: Optional[Dict[str, Any]] = None
    grids: Optional[List[Dict[str, Any]]] = None
    previous_sites: Optional[List[Any]] = None
    cohorts: Optional[List[Any]] = None
    
    class Config:
        from_attributes = True
        extra = Extra.ignore
        arbitrary_types_allowed = True

class DeviceCount(BaseModel):
    total_devices: int
    active_devices: int
    offline_devices: int
    deployed_devices: int 
    not_deployed: int
    recalled_devices: int

# Custom response to handle JSON encoding
def create_json_response(content):
    """Create a Response with properly encoded JSON content"""
    json_content = json.dumps(content, cls=CustomJSONEncoder)
    return Response(content=json_content, media_type="application/json")

# API Endpoints
@app.get("/")
def read_root():
    return {"message": "AirQo Device Health Monitoring API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/devices")
def get_all_devices(db=Depends(get_db)):
    try:
        result = db.execute(text("SELECT * FROM dim_device"))
        devices = []
        
        column_names = result.keys()
        print(f"Database columns: {column_names}")
        
        for idx, row in enumerate(result):
            try:
                device_dict = dict(row._mapping)
                
                if idx == 0:
                    print(f"Raw first row data: {device_dict}")
                
                for key, value in device_dict.items():
                    if isinstance(value, str) and value.lower() == 'nan':
                        device_dict[key] = None
                
                device_dict = convert_to_json_serializable(device_dict)
                
                device_model_fields = Device.__annotations__.keys()
                filtered_dict = {k: v for k, v in device_dict.items() if k in device_model_fields}
                
                if 'device_id' not in filtered_dict:
                    if 'device_key' in filtered_dict:
                        filtered_dict['device_id'] = f"device_{filtered_dict['device_key']}"
                    else:
                        filtered_dict['device_id'] = f"unknown_device_{idx}"
                
                devices.append(filtered_dict)
                
            except Exception as row_error:
                print(f"Error processing row {idx}: {str(row_error)}")
                continue
            
        print(f"Successfully processed {len(devices)} devices")
        return create_json_response(devices)
    except Exception as e:
        print(f"Critical error in get_all_devices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch devices: {str(e)}")

@app.get("/devices/{device_id}")
def get_device(device_id: str, db=Depends(get_db)):
    try:
        result = db.execute(
            text("SELECT * FROM dim_device WHERE device_id = :device_id"), 
            {"device_id": device_id}
        )
        device = result.first()
        
        if not device:
            raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
        
        device_dict = dict(device._mapping)
        
        for key, value in device_dict.items():
            if isinstance(value, str) and value.lower() == 'nan':
                device_dict[key] = None
        
        device_dict = convert_to_json_serializable(device_dict)
        
        location_result = db.execute(
            text("SELECT * FROM dim_location WHERE device_key = :device_key"),
            {"device_key": device_dict['device_key']}
        )
        location = location_result.first()
        
        if location:
            location_dict = dict(location._mapping)
            for key, value in location_dict.items():
                if isinstance(value, str) and value.lower() == 'nan':
                    location_dict[key] = None
                    
            location_dict = convert_to_json_serializable(location_dict)
            
            device_dict['latitude'] = location_dict.get('latitude')
            device_dict['longitude'] = location_dict.get('longitude')
            
            site = {
                "_id": location_dict.get('site_id'),
                "name": location_dict.get('site_name'),
                "location_name": location_dict.get('location_name'),
                "search_name": location_dict.get('search_name'),
                "data_provider": location_dict.get('data_provider')
            }
            device_dict['site'] = site
        
        return create_json_response(device_dict)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_device: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device: {str(e)}")

@app.get("/device-counts")
def get_device_counts(db=Depends(get_db)):
    try:
        total_result = db.execute(text("SELECT COUNT(*) FROM dim_device"))
        total_devices = total_result.scalar()
        
        active_result = db.execute(text("SELECT COUNT(*) FROM dim_device WHERE is_online = true"))
        active_devices = active_result.scalar()
        
        offline_result = db.execute(text("SELECT COUNT(*) FROM dim_device WHERE is_online = false"))
        offline_devices = offline_result.scalar()
        
        deployed_result = db.execute(text("""
            SELECT COUNT(*) FROM dim_device 
            WHERE status = 'deployed'
        """))
        deployed_devices = deployed_result.scalar()
        
        not_deployed_result = db.execute(text("""
            SELECT COUNT(*) FROM dim_device 
            WHERE status = 'not deployed'
        """))
        not_deployed = not_deployed_result.scalar()
        
        recalled_result = db.execute(text("""
            SELECT COUNT(*) FROM dim_device 
            WHERE status = 'recalled'
        """))
        recalled_devices = recalled_result.scalar()
        
        return {
            "total_devices": total_devices,
            "active_devices": active_devices,
            "offline_devices": offline_devices,
            "deployed_devices": deployed_devices,
            "not_deployed": not_deployed,
            "recalled_devices": recalled_devices
        }
    except Exception as e:
        print(f"Error in device counts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device counts: {str(e)}")

@app.get("/device-status")
def get_device_status(db=Depends(get_db)):
    try:
        result = db.execute(text("""
            SELECT 
                status,
                COUNT(*) as count
            FROM dim_device
            GROUP BY status
        """))
        
        status_counts = []
        for row in result:
            try:
                status_dict = dict(row._mapping)
                
                for key, value in status_dict.items():
                    if isinstance(value, str) and value.lower() == 'nan':
                        status_dict[key] = None
                
                for key, value in status_dict.items():
                    if isinstance(value, Decimal):
                        try:
                            status_dict[key] = float(value)
                        except:
                            status_dict[key] = str(value)
                    elif isinstance(value, datetime):
                        status_dict[key] = value.isoformat()
                
                status_counts.append(status_dict)
                
            except Exception as row_error:
                print(f"Error processing status row: {str(row_error)}")
                continue
            
        return create_json_response(status_counts)
    except Exception as e:
        print(f"Error in device status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device status: {str(e)}")

@app.get("/device-locations")
def get_device_locations(db=Depends(get_db)):
    try:
        result = db.execute(text("""
            SELECT 
                d.device_id,
                d.device_name,
                d.status,
                d.is_online,
                l.latitude,
                l.longitude,
                l.site_name
            FROM dim_device d
            LEFT JOIN dim_location l ON d.device_key = l.device_key
        """))
        
        all_devices = []
        devices_with_location = []
        missing_location = []
        
        for row in result:
            try:
                location_dict = dict(row._mapping)
                
                for key, value in location_dict.items():
                    if isinstance(value, str) and value.lower() == 'nan':
                        location_dict[key] = None
                
                location_dict = convert_to_json_serializable(location_dict)
                all_devices.append(location_dict)
                
                if location_dict.get('latitude') is not None and location_dict.get('longitude') is not None:
                    devices_with_location.append(location_dict)
                else:
                    missing_location.append(location_dict.get('device_id'))
            except Exception as row_error:
                print(f"Error processing location row: {str(row_error)}")
                continue
        
        print(f"Total devices: {len(all_devices)}")
        print(f"Devices with location: {len(devices_with_location)}")
        print(f"Devices missing location: {len(missing_location)}")
        if missing_location:
            print(f"First few devices missing location: {missing_location[:5]}")
            
        return create_json_response(devices_with_location)
    except Exception as e:
        print(f"Error in device-locations endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device locations: {str(e)}")

@app.get("/deployment-history")
def get_deployment_history(days: int = 30, db=Depends(get_db)):
    try:
        result = db.execute(text("""
            WITH daily_counts AS (
                SELECT 
                    date_trunc('day', timestamp) as day,
                    COUNT(DISTINCT device_key) FILTER (WHERE device_status = 'deployed') as deployed,
                    COUNT(DISTINCT device_key) FILTER (WHERE device_status = 'not deployed') as not_deployed,
                    COUNT(DISTINCT device_key) FILTER (WHERE device_status = 'recalled') as recalled
                FROM fact_device_status
                WHERE timestamp > current_date - interval ':days days'
                GROUP BY date_trunc('day', timestamp)
                ORDER BY date_trunc('day', timestamp)
            )
            SELECT 
                day,
                deployed,
                not_deployed,
                recalled
            FROM daily_counts
        """), {"days": days})
        
        history = []
        for row in result:
            history_dict = dict(row._mapping)
            history_dict = convert_to_json_serializable(history_dict)
            history.append(history_dict)
            
        return create_json_response(history)
    except Exception as e:
        print(f"Error in deployment history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch deployment history: {str(e)}")

@app.get("/maintenance-metrics")
def get_maintenance_metrics(db=Depends(get_db)):
    try:
        upcoming_result = db.execute(text("""
            SELECT COUNT(*) 
            FROM dim_device 
            WHERE next_maintenance BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        """))
        upcoming_maintenance = upcoming_result.scalar() or 0
        
        overdue_result = db.execute(text("""
            SELECT COUNT(*) 
            FROM dim_device 
            WHERE next_maintenance < CURRENT_DATE
        """))
        overdue_maintenance = overdue_result.scalar() or 0
        
        avg_cycle_result = db.execute(text("""
            SELECT AVG(EXTRACT(EPOCH FROM (next_maintenance - last_updated)) / 86400)
            FROM dim_device
            WHERE next_maintenance IS NOT NULL AND last_updated IS NOT NULL
        """))
        avg_cycle = avg_cycle_result.scalar()
        
        avg_maintenance_cycle = float(avg_cycle) if avg_cycle is not None else 0
        
        return {
            "upcoming_maintenance": upcoming_maintenance,
            "overdue_maintenance": overdue_maintenance,
            "avg_maintenance_cycle_days": round(avg_maintenance_cycle, 1)
        }
    except Exception as e:
        print(f"Error in maintenance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch maintenance metrics: {str(e)}")

@app.get("/devices-simple")
def get_devices_simple(db=Depends(get_db)):
    try:
        result = db.execute(text("""
            SELECT 
                device_key, 
                device_id, 
                device_name, 
                status, 
                is_online,
                is_active 
            FROM dim_device
        """))
        
        devices = []
        for row in result:
            device_dict = dict(row._mapping)
            devices.append(device_dict)
            
        return devices
    except Exception as e:
        print(f"Error in simple devices endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch simple devices: {str(e)}")

@app.get("/valid-device-locations")
def get_valid_device_locations(db=Depends(get_db)):
    try:
        result = db.execute(text("""
            WITH latest_readings AS (
                SELECT DISTINCT ON (device_key) 
                    device_key,
                    site_key,
                    timestamp,
                    pm2_5,
                    pm10
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
                l.admin_level_country,
                l.admin_level_city,
                l.admin_level_division,
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
                r.pm2_5,
                r.pm10,
                r.timestamp as reading_timestamp
            FROM dim_device d
            INNER JOIN dim_location l ON d.device_key = l.device_key
            LEFT JOIN latest_readings r ON d.device_key = r.device_key
            LEFT JOIN dim_site s ON r.site_key = s.site_key
            WHERE 
                l.latitude IS NOT NULL 
                AND l.longitude IS NOT NULL
                AND l.is_active = true
                AND d.is_active = true
                AND d.status = 'deployed'
        """))
        
        device_locations = []
        for row in result:
            try:
                row_dict = {}
                for column, value in row._mapping.items():
                    row_dict[column] = value
                
                device_id = str(row_dict.get("device_id", "")) if row_dict.get("device_id") is not None else ""
                device_name = str(row_dict.get("device_name", "")) if row_dict.get("device_name") is not None else ""
                status = row_dict.get("status")
                is_online = row_dict.get("is_online")
                
                try:
                    latitude = float(row_dict.get("latitude"))
                    if math.isnan(latitude):
                        latitude = None
                except (TypeError, ValueError):
                    latitude = None
                    
                try:
                    longitude = float(row_dict.get("longitude"))
                    if math.isnan(longitude):
                        longitude = None
                except (TypeError, ValueError):
                    longitude = None
                
                if latitude is None or longitude is None:
                    continue
                
                try:
                    pm2_5 = float(row_dict.get("pm2_5"))
                    if math.isnan(pm2_5):
                        pm2_5 = None
                except (TypeError, ValueError):
                    pm2_5 = None
                    
                try:
                    pm10 = float(row_dict.get("pm10"))
                    if math.isnan(pm10):
                        pm10 = None
                except (TypeError, ValueError):
                    pm10 = None
                
                reading_timestamp = None
                if row_dict.get("reading_timestamp") is not None:
                    if hasattr(row_dict["reading_timestamp"], "isoformat"):
                        reading_timestamp = row_dict["reading_timestamp"].isoformat()
                    else:
                        reading_timestamp = str(row_dict["reading_timestamp"])
                
                location_name = row_dict.get("location_name")
                if location_name is not None and isinstance(location_name, str) and location_name.lower() == 'nan':
                    location_name = None
                
                admin_level_division = row_dict.get("admin_level_division")
                if admin_level_division is not None and isinstance(admin_level_division, str) and admin_level_division.lower() == 'nan':
                    admin_level_division = None
                    
                city = row_dict.get("city")
                if city is not None and isinstance(city, str) and city.lower() == 'nan':
                    city = None
                
                display_name = location_name
                if display_name is None:
                    display_name = admin_level_division
                if display_name is None:
                    display_name = city
                if display_name is None:
                    display_name = "Unknown Location"
                
                admin_country = row_dict.get("admin_level_country")
                if admin_country is not None and isinstance(admin_country, str) and admin_country.lower() == 'nan':
                    admin_country = None
                    
                country = row_dict.get("country")
                if country is not None and isinstance(country, str) and country.lower() == 'nan':
                    country = None
                
                display_country = admin_country if admin_country is not None else country
                
                admin_city = row_dict.get("admin_level_city")
                if admin_city is not None and isinstance(admin_city, str) and admin_city.lower() == 'nan':
                    admin_city = None
                
                display_city = admin_city if admin_city is not None else city
                
                formatted_location = {
                    "id": device_id,
                    "name": device_name,
                    "status": "ACTIVE" if status == "deployed" and is_online else "INACTIVE",
                    "latitude": latitude,
                    "longitude": longitude,
                    "pm2_5": pm2_5,
                    "pm10": pm10,
                    "reading_timestamp": reading_timestamp,
                    "location": {
                        "name": display_name,
                        "admin_level_country": display_country,
                        "admin_level_city": display_city,
                        "admin_level_division": admin_level_division,
                        "village": row_dict.get("village"),
                        "site_name": row_dict.get("site_name"),
                        "site_category": row_dict.get("site_category"),
                        "site_id": row_dict.get("site_id"),
                        "data_provider": row_dict.get("data_provider")
                    }
                }
                
                for key, value in formatted_location["location"].items():
                    if isinstance(value, float) and math.isnan(value):
                        formatted_location["location"][key] = None
                    elif isinstance(value, str) and value.lower() == 'nan':
                        formatted_location["location"][key] = None
                
                device_locations.append(formatted_location)
                
            except Exception as row_error:
                print(f"Error processing location row: {str(row_error)}")
                continue
        
        print(f"Retrieved {len(device_locations)} active and deployed device locations with valid coordinates")
            
        def json_encoder(obj):
            if isinstance(obj, (datetime, date)):
                return obj.isoformat()
            elif isinstance(obj, Decimal):
                return float(obj)
            elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
                return None
            return str(obj)
        
        json_content = json.dumps(device_locations, default=json_encoder)
        return Response(content=json_content, media_type="application/json")
    
    except Exception as e:
        print(f"Error in valid-device-locations endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch valid device locations: {str(e)}")

@app.get("/device-detail/{device_id}")
def get_device_detail(device_id: str, db=Depends(get_db)):
    try:
        query = text("""
            WITH latest_readings AS (
                SELECT DISTINCT ON (device_key) 
                    device_key,
                    site_key,
                    timestamp,
                    pm2_5,
                    pm10,
                    no2,
                    aqi_category,
                    aqi_color,
                    aqi_color_name
                FROM fact_device_readings
                ORDER BY device_key, timestamp DESC
            ),
            latest_status AS (
                SELECT DISTINCT ON (device_key)
                    device_key,
                    timestamp,
                    is_online,
                    device_status
                FROM fact_device_status
                ORDER BY device_key, timestamp DESC
            )
            SELECT 
                d.device_key,
                d.device_id,
                d.device_name,
                d.network,
                d.category,
                d.is_active,
                d.status,
                d.mount_type,
                d.power_type,
                d.height,
                d.next_maintenance,
                d.first_seen,
                d.last_updated,
                
                l.location_key,
                l.latitude,
                l.longitude,
                l.location_name,
                l.search_name,
                l.village,
                l.admin_level_country,
                l.admin_level_city,
                l.admin_level_division,
                l.site_category,
                l.site_id,
                l.site_name,
                l.deployment_date,
                
                r.pm2_5,
                r.pm10,
                r.no2,
                r.timestamp as reading_timestamp,
                r.aqi_category,
                r.aqi_color,
                r.aqi_color_name,
                
                st.is_online as current_is_online,
                st.device_status as current_device_status,
                st.timestamp as status_timestamp,
                
                s.site_name as full_site_name,
                s.location_name as full_location_name,
                s.search_name as full_search_name,
                s.village as full_village,
                s.town,
                s.city,
                s.district,
                s.country,
                s.data_provider,
                s.site_category as full_site_category
                
            FROM dim_device d
            LEFT JOIN dim_location l ON d.device_key = l.device_key AND l.is_active = true
            LEFT JOIN latest_readings r ON d.device_key = r.device_key
            LEFT JOIN latest_status st ON d.device_key = st.device_key
            LEFT JOIN dim_site s ON r.site_key = s.site_key
            WHERE d.device_id = :device_id
        """)
        
        result = db.execute(query, {"device_id": device_id})
        device_row = result.first()
        
        if not device_row:
            raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
        
        eat_timezone = tz.gettz('Africa/Kampala')
        
        def convert_to_eat(timestamp):
            if timestamp is None:
                return None
                
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
                
            eat_time = timestamp.astimezone(eat_timezone)
            return eat_time.isoformat()
        
        raw_device_dict = {}
        for column, value in device_row._mapping.items():
            raw_device_dict[column] = value
            
        device_dict = {}
        for key, value in raw_device_dict.items():
            if value is None:
                device_dict[key] = None
                continue
                
            try:
                float_val = float(value)
                if float_val != float_val:
                    device_dict[key] = None
                else:
                    device_dict[key] = float_val
            except (TypeError, ValueError):
                try:
                    if hasattr(value, 'isoformat'):
                        device_dict[key] = convert_to_eat(value)
                    else:
                        device_dict[key] = str(value)
                except:
                    device_dict[key] = str(value)
        
        maintenance_history_query = text("""
            WITH maintenance_entries AS (
                SELECT 
                    timestamp,
                    CASE 
                        WHEN LAG(is_online) OVER (ORDER BY timestamp) = false AND is_online = true THEN 'Restored'
                        WHEN LAG(is_online) OVER (ORDER BY timestamp) = true AND is_online = false THEN 'Offline'
                        WHEN LAG(device_status) OVER (ORDER BY timestamp) != device_status THEN 'Status Change'
                        ELSE null
                    END as maintenance_type,
                    CASE 
                        WHEN LAG(is_online) OVER (ORDER BY timestamp) = false AND is_online = true THEN 'Device came back online'
                        WHEN LAG(is_online) OVER (ORDER BY timestamp) = true AND is_online = false THEN 'Device went offline'
                        WHEN LAG(device_status) OVER (ORDER BY timestamp) != device_status THEN 'Status changed to ' || device_status
                        ELSE null
                    END as description
                FROM fact_device_status
                WHERE device_key = :device_key
                ORDER BY timestamp DESC
            )
            SELECT 
                timestamp,
                maintenance_type,
                description
            FROM maintenance_entries
            WHERE maintenance_type IS NOT NULL
            LIMIT 10
        """)
        
        history_result = db.execute(maintenance_history_query, {"device_key": raw_device_dict.get('device_key')})
        maintenance_history = []
        
        for row in history_result:
            raw_history_dict = {}
            for column, value in row._mapping.items():
                raw_history_dict[column] = value
                
            history_dict = {}
            for key, value in raw_history_dict.items():
                if value is None:
                    history_dict[key] = None
                    continue
                    
                try:
                    float_val = float(value)
                    if float_val != float_val:
                        history_dict[key] = None
                    else:
                        history_dict[key] = float_val
                except (TypeError, ValueError):
                    try:
                        if hasattr(value, 'isoformat'):
                            history_dict[key] = convert_to_eat(value)
                        else:
                            history_dict[key] = str(value)
                    except:
                        history_dict[key] = str(value)
                        
            maintenance_history.append(history_dict)
        
        readings_history_query = text("""
            SELECT 
                timestamp,
                pm2_5,
                pm10,
                no2,
                aqi_category
            FROM fact_device_readings
            WHERE device_key = :device_key
            ORDER BY timestamp DESC
        """)
        
        readings_result = db.execute(readings_history_query, {"device_key": raw_device_dict.get('device_key')})
        readings_history = []
        
        for row in readings_result:
            raw_reading_dict = {}
            for column, value in row._mapping.items():
                raw_reading_dict[column] = value
                
            reading_dict = {}
            for key, value in raw_reading_dict.items():
                if value is None:
                    reading_dict[key] = None
                    continue
                    
                try:
                    float_val = float(value)
                    if float_val != float_val:
                        reading_dict[key] = None
                    else:
                        reading_dict[key] = float_val
                except (TypeError, ValueError):
                    try:
                        if hasattr(value, 'isoformat'):
                            reading_dict[key] = convert_to_eat(value)
                        else:
                            reading_dict[key] = str(value)
                    except:
                        reading_dict[key] = str(value)
                        
            readings_history.append(reading_dict)
        
        response = {
            "device": {
                "id": str(device_dict.get("device_id", "")) if device_dict.get("device_id") is not None else None,
                "name": str(device_dict.get("device_name", "")) if device_dict.get("device_name") is not None else None,
                "status": str(device_dict.get("status", "")) if device_dict.get("status") is not None else None,
                "is_online": device_dict.get("current_is_online"),
                "network": str(device_dict.get("network", "")) if device_dict.get("network") is not None else None,
                "category": str(device_dict.get("category", "")) if device_dict.get("category") is not None else None,
                "is_active": device_dict.get("is_active"),
                "mount_type": str(device_dict.get("mount_type", "")) if device_dict.get("mount_type") is not None else None,
                "power_type": str(device_dict.get("power_type", "")) if device_dict.get("power_type") is not None else None,
                "height": device_dict.get("height"),
                "next_maintenance": device_dict.get("next_maintenance"),
                "first_seen": device_dict.get("first_seen"),
                "last_updated": device_dict.get("last_updated")
            },
            "location": {
                "latitude": device_dict.get("latitude"),
                "longitude": device_dict.get("longitude"),
                "name": str(device_dict.get("location_name", "")) if device_dict.get("location_name") is not None else 
                        (str(device_dict.get("full_location_name", "")) if device_dict.get("full_location_name") is not None else None),
                "country": str(device_dict.get("admin_level_country", "")) if device_dict.get("admin_level_country") is not None else 
                           (str(device_dict.get("country", "")) if device_dict.get("country") is not None else None),
                "city": str(device_dict.get("admin_level_city", "")) if device_dict.get("admin_level_city") is not None else 
                        (str(device_dict.get("city", "")) if device_dict.get("city") is not None else None),
                "division": str(device_dict.get("admin_level_division", "")) if device_dict.get("admin_level_division") is not None else None,
                "village": str(device_dict.get("village", "")) if device_dict.get("village") is not None else 
                           (str(device_dict.get("full_village", "")) if device_dict.get("full_village") is not None else None),
                "deployment_date": device_dict.get("deployment_date")
            },
            "site": {
                "id": str(device_dict.get("site_id", "")) if device_dict.get("site_id") is not None else None,
                "name": str(device_dict.get("site_name", "")) if device_dict.get("site_name") is not None else 
                        (str(device_dict.get("full_site_name", "")) if device_dict.get("full_site_name") is not None else None),
                "category": str(device_dict.get("site_category", "")) if device_dict.get("site_category") is not None else 
                            (str(device_dict.get("full_site_category", "")) if device_dict.get("full_site_category") is not None else None),
                "data_provider": str(device_dict.get("data_provider", "")) if device_dict.get("data_provider") is not None else None
            },
            "latest_reading": {
                "timestamp": device_dict.get("reading_timestamp"),
                "pm2_5": device_dict.get("pm2_5"),
                "pm10": device_dict.get("pm10"),
                "no2": device_dict.get("no2"),
                "aqi_category": str(device_dict.get("aqi_category", "")) if device_dict.get("aqi_category") is not None else None,
                "aqi_color": str(device_dict.get("aqi_color", "")) if device_dict.get("aqi_color") is not None else None
            },
            "maintenance_history": maintenance_history,
            "readings_history": readings_history,
            "timezone": "Africa/Kampala (EAT)"
        }
        
        def safe_json_encoder(obj):
            try:
                json.dumps(obj)
                return obj
            except:
                try:
                    if hasattr(obj, 'isoformat'):
                        return convert_to_eat(obj)
                    return str(obj)
                except:
                    return None
        
        json_str = json.dumps(response, default=safe_json_encoder)
        safe_response = json.loads(json_str)
        
        return safe_response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_device_detail: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch device details: {str(e)}")

@app.get("/health-tips/device/{device_id}")
def get_health_tips_by_device(device_id: str, db=Depends(get_db)):
    try:
        device_query = text("""
            SELECT device_key FROM dim_device 
            WHERE device_id = :device_id
        """)
        
        device_result = db.execute(device_query, {"device_id": device_id})
        device_row = device_result.first()
        
        if not device_row:
            raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
        
        device_key = device_row[0]
        
        reading_query = text("""
            SELECT reading_key, aqi_category
            FROM fact_device_readings
            WHERE device_key = :device_key
            ORDER BY timestamp DESC
            LIMIT 1
        """)
        
        reading_result = db.execute(reading_query, {"device_key": device_key})
        reading_row = reading_result.first()
        
        if not reading_row:
            return {"tips": [], "message": "No readings found for this device"}
        
        reading_key = reading_row[0]
        aqi_category = reading_row[1]
        
        tips_query = text("""
            SELECT 
                tip_key,
                tip_id,
                title,
                description,
                image_url
            FROM fact_health_tips
            WHERE reading_key = :reading_key
        """)
        
        tips_result = db.execute(tips_query, {"reading_key": reading_key})
        tips = []
        
        for row in tips_result:
            raw_tip_dict = {}
            for column, value in row._mapping.items():
                raw_tip_dict[column] = value
            
            tip_dict = {}
            for key, value in raw_tip_dict.items():
                if value is None:
                    tip_dict[key] = None
                    continue
                
                try:
                    float_val = float(value)
                    if float_val != float_val:
                        tip_dict[key] = None
                    else:
                        tip_dict[key] = float_val
                except (TypeError, ValueError):
                    try:
                        if hasattr(value, 'isoformat'):
                            tip_dict[key] = value.isoformat()
                        else:
                            tip_dict[key] = str(value)
                    except:
                        tip_dict[key] = str(value)
            
            tips.append(tip_dict)
        
        if not tips:
            default_tips = get_default_health_tips(aqi_category)
            return {"tips": default_tips, "aqi_category": aqi_category}
        
        return {"tips": tips, "aqi_category": aqi_category}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching health tips by device: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch health tips: {str(e)}")

def get_default_health_tips(aqi_category):
    """Provide default health tips based on AQI category"""
    if not aqi_category or aqi_category == "Unknown":
        return [
            {
                "tip_id": "default-1",
                "title": "Air Quality Information",
                "description": "Stay informed about local air quality conditions through the AirQo app or website."
            }
        ]
    
    if aqi_category == "Good":
        return [
            {
                "tip_id": "good-1",
                "title": "Enjoy Outdoor Activities",
                "description": "Air quality is good! This is a great time for outdoor activities."
            },
            {
                "tip_id": "good-2",
                "title": "Open Windows",
                "description": "Take advantage of the clean air by opening windows to ventilate your home."
            }
        ]
    
    if aqi_category == "Moderate":
        return [
            {
                "tip_id": "moderate-1",
                "title": "Sensitive Groups Should Take Precautions",
                "description": "If you have respiratory issues, consider reducing prolonged outdoor exertion."
            },
            {
                "tip_id": "moderate-2",
                "title": "Stay Hydrated",
                "description": "Drink plenty of water to help your body process pollutants more effectively."
            }
        ]
    
    return [
        {
            "tip_id": "unhealthy-1",
            "title": "Limit Outdoor Activities",
            "description": "Reduce time spent outdoors, especially near high-traffic areas."
        },
        {
            "tip_id": "unhealthy-2",
            "title": "Use Air Purifiers",
            "description": "If available, use air purifiers indoors to improve indoor air quality."
        },
        {
            "tip_id": "unhealthy-3",
            "title": "Wear a Mask",
            "description": "Consider wearing an N95 mask when outdoors if air quality is poor."
        }
    ]