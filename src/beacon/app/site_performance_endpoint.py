from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
from datetime import datetime, timedelta
from decimal import Decimal
import math
import pandas as pd

# Import your database connection
from app.database import get_db

# Create router
router = APIRouter(prefix="/site-analytics", tags=["site-analytics"])

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

# Helper function for JSON serialization
def convert_to_json_serializable(item):
    # Handle dictionary case
    if isinstance(item, dict):
        return {k: convert_to_json_serializable(v) for k, v in item.items()}
    # Handle list case
    elif isinstance(item, list):
        return [convert_to_json_serializable(i) for i in item]
    # Handle datetime
    elif isinstance(item, datetime):
        return item.isoformat()
    # Handle Decimal
    elif isinstance(item, Decimal):
        try:
            float_val = float(item)
            if math.isnan(float_val) or math.isinf(float_val):
                return str(float_val)
            return float_val
        except (ValueError, OverflowError, TypeError):
            return str(item)
    # Handle float
    elif isinstance(item, float):
        if math.isnan(item) or math.isinf(item):
            return str(item)
        return item
    # Handle string 'NaN' values
    elif isinstance(item, str):
        if item.lower() == 'nan':
            return None
        return item
    # Return any other type as is
    return item

# Custom response to handle JSON encoding
def create_json_response(content):
    """Create a Response with properly encoded JSON content"""
    json_content = json.dumps(content, cls=CustomJSONEncoder)
    return Response(content=json_content, media_type="application/json")

# Get list of all locations/regions
@router.get("/locations")
def get_locations(db: Session = Depends(get_db)):
    try:
        # Query unique locations from the database
        query = text("""
            WITH location_data AS (
                SELECT DISTINCT
                    country,
                    city,
                    district,
                    town,
                    COUNT(DISTINCT site_key) as site_count
                FROM dim_site
                GROUP BY 
                    country,
                    city,
                    district,
                    town
                HAVING 
                    country IS NOT NULL
            )
            SELECT 
                country,
                city,
                district,
                town,
                site_count,
                CASE 
                    WHEN city IS NOT NULL THEN city
                    WHEN district IS NOT NULL THEN district
                    WHEN town IS NOT NULL THEN town
                    ELSE country
                END as display_name,
                CASE 
                    WHEN city IS NOT NULL THEN 'city'
                    WHEN district IS NOT NULL THEN 'district'
                    WHEN town IS NOT NULL THEN 'town'
                    ELSE 'country'
                END as location_type,
                CONCAT(
                    LOWER(REGEXP_REPLACE(
                        CASE 
                            WHEN city IS NOT NULL THEN city
                            WHEN district IS NOT NULL THEN district
                            WHEN town IS NOT NULL THEN town
                            ELSE country
                        END, 
                        '[^a-zA-Z0-9]', '_'
                    )),
                    '_',
                    CASE 
                        WHEN city IS NOT NULL THEN 'city'
                        WHEN district IS NOT NULL THEN 'district'
                        WHEN town IS NOT NULL THEN 'town'
                        ELSE 'country'
                    END
                ) as location_id
            FROM location_data
            ORDER BY country, district, city, town
        """)
        
        result = db.execute(query)
        
        locations = []
        for row in result:
            location_dict = dict(row._mapping)
            location_dict = convert_to_json_serializable(location_dict)
            locations.append(location_dict)
        
        return create_json_response(locations)
    
    except Exception as e:
        print(f"Error in get_locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")
    
# Get site analytics for a specific location
@router.get("/location/{location_id}")
def get_location_analytics(
    location_id: str, 
    time_range: Optional[str] = "week",
    db: Session = Depends(get_db)
):
    try:
        # First, get the location details to determine the type and value
        location_query = text("""
            WITH location_data AS (
                SELECT DISTINCT
                    country,
                    city,
                    district,
                    town,
                    CASE 
                        WHEN city IS NOT NULL THEN 'city'
                        WHEN district IS NOT NULL THEN 'district'
                        WHEN town IS NOT NULL THEN 'town'
                        ELSE 'country'
                    END as location_type,
                    CONCAT(
                        LOWER(REGEXP_REPLACE(
                            CASE 
                                WHEN city IS NOT NULL THEN city
                                WHEN district IS NOT NULL THEN district
                                WHEN town IS NOT NULL THEN town
                                ELSE country
                            END, 
                            '[^a-zA-Z0-9]', '_'
                        )),
                        '_',
                        CASE 
                            WHEN city IS NOT NULL THEN 'city'
                            WHEN district IS NOT NULL THEN 'district'
                            WHEN town IS NOT NULL THEN 'town'
                            ELSE 'country'
                        END
                    ) as location_id
                FROM dim_site
            )
            SELECT *
            FROM location_data
            WHERE location_id = :location_id
            LIMIT 1
        """)
        
        location_result = db.execute(location_query, {"location_id": location_id})
        location_data = location_result.first()
        
        if not location_data:
            raise HTTPException(status_code=404, detail=f"Location with ID {location_id} not found")
            
        location_dict = dict(location_data._mapping)
        location_type = location_dict.get('location_type')
        
        # Determine time range filter
        current_time = datetime.now()
        if time_range == "day":
            start_time = current_time - timedelta(days=1)
        elif time_range == "week":
            start_time = current_time - timedelta(days=7)
        elif time_range == "month":
            start_time = current_time - timedelta(days=30)
        elif time_range == "quarter":
            start_time = current_time - timedelta(days=90)
        elif time_range == "year":
            start_time = current_time - timedelta(days=365)
        else:
            start_time = current_time - timedelta(days=7)  # Default to week
            
        # Build the WHERE clause based on the location type
        location_filter = ""
        params = {"start_time": start_time, "location_id": location_id}
        
        if location_type == 'city':
            location_filter = "s.city = :location_value"
            params["location_value"] = location_dict.get('city')
        elif location_type == 'district':
            location_filter = "s.district = :location_value"
            params["location_value"] = location_dict.get('district')
        elif location_type == 'town':
            location_filter = "s.town = :location_value"
            params["location_value"] = location_dict.get('town')
        elif location_type == 'country':
            location_filter = "s.country = :location_value"
            params["location_value"] = location_dict.get('country')
            
        # Get sites in this location with their latest PM2.5 and PM10 values
        sites_query = text(f"""
            WITH latest_readings AS (
                SELECT DISTINCT ON (site_key) 
                    site_key,
                    timestamp,
                    pm2_5,
                    pm10,
                    aqi_category,
                    aqi_color
                FROM fact_site_readings
                ORDER BY site_key, timestamp DESC
            )
            SELECT 
                s.site_key,
                s.site_id,
                s.site_name,
                s.location_name,
                s.town,
                s.city,
                s.district,
                s.country,
                s.data_provider,
                s.site_category,
                s.city as city_name,
                s.district as division_name,
                s.country as country_name,
                lr.pm2_5 as latest_pm2_5,
                lr.pm10 as latest_pm10,
                lr.timestamp as last_reading_time,
                lr.aqi_category,
                lr.aqi_color
            FROM dim_site s
            LEFT JOIN latest_readings lr ON s.site_key = lr.site_key
            WHERE {location_filter}
        """)
        
        sites_result = db.execute(sites_query, params)
        
        sites = []
        site_keys = []
        for row in sites_result:
            site_dict = dict(row._mapping)
            site_dict = convert_to_json_serializable(site_dict)
            sites.append(site_dict)
            site_keys.append(site_dict.get('site_key'))
            
        if not sites:
            return {
                "location": location_dict,
                "sites": [],
                "metrics": {},
                "aqi_distribution": {},
                "time_series": []
            }
            
        # Get site metrics like uptime, data completeness
        site_keys_str = ','.join([str(key) for key in site_keys])
        
        metrics_query = text(f"""
            WITH site_metrics AS (
                SELECT 
                    site_key,
                    COUNT(*) as total_readings,
                    COUNT(*) * 100.0 / (EXTRACT(EPOCH FROM (NOW() - :start_time)) / 3600) as data_completeness,
                    AVG(CASE WHEN pm2_5 IS NOT NULL THEN pm2_5 ELSE NULL END) as avg_pm25,
                    AVG(CASE WHEN pm10 IS NOT NULL THEN pm10 ELSE NULL END) as avg_pm10,
                    MAX(timestamp) as last_reading
                FROM fact_site_readings
                WHERE site_key IN ({site_keys_str})
                AND timestamp >= :start_time
                GROUP BY site_key
            )
            SELECT 
                COUNT(DISTINCT site_key) as total_sites,
                AVG(data_completeness) as avg_data_completeness,
                AVG(avg_pm25) as avg_pm25,
                AVG(avg_pm10) as avg_pm10,
                SUM(total_readings) as total_readings
            FROM site_metrics
        """)
        
        metrics_result = db.execute(metrics_query, params)
        metrics_row = metrics_result.first()
        metrics = convert_to_json_serializable(dict(metrics_row._mapping)) if metrics_row else {}
        
        # Get AQI distribution for this location
        aqi_query = text(f"""
            WITH latest_readings AS (
                SELECT DISTINCT ON (site_key) 
                    site_key,
                    timestamp,
                    aqi_category
                FROM fact_site_readings
                WHERE site_key IN ({site_keys_str})
                ORDER BY site_key, timestamp DESC
            )
            SELECT 
                aqi_category,
                COUNT(*) as site_count
            FROM latest_readings
            GROUP BY aqi_category
        """)
        
        aqi_result = db.execute(aqi_query)
        
        aqi_distribution = {
            "good": 0,
            "moderate": 0,
            "unhealthy_sensitive": 0,
            "unhealthy": 0,
            "very_unhealthy": 0,
            "hazardous": 0
        }
        
        for row in aqi_result:
            aqi_dict = dict(row._mapping)
            aqi_category = aqi_dict.get('aqi_category', '').lower()
            site_count = aqi_dict.get('site_count', 0)
            
            if aqi_category == 'good':
                aqi_distribution['good'] = site_count
            elif aqi_category == 'moderate':
                aqi_distribution['moderate'] = site_count
            elif aqi_category == 'unhealthy for sensitive groups':
                aqi_distribution['unhealthy_sensitive'] = site_count
            elif aqi_category == 'unhealthy':
                aqi_distribution['unhealthy'] = site_count
            elif aqi_category == 'very unhealthy':
                aqi_distribution['very_unhealthy'] = site_count
            elif aqi_category == 'hazardous':
                aqi_distribution['hazardous'] = site_count
                
        # Get time series data for PM2.5 and PM10
        time_series_query = text(f"""
            WITH daily_readings AS (
                SELECT 
                    DATE_TRUNC('day', timestamp) as reading_date,
                    AVG(CASE WHEN pm2_5 IS NOT NULL THEN pm2_5 ELSE NULL END) as avg_pm25,
                    AVG(CASE WHEN pm10 IS NOT NULL THEN pm10 ELSE NULL END) as avg_pm10,
                    COUNT(DISTINCT site_key) as active_sites,
                    100.0 * COUNT(*) / (COUNT(DISTINCT site_key) * 24) as uptime
                FROM fact_site_readings
                WHERE site_key IN ({site_keys_str})
                AND timestamp >= :start_time
                GROUP BY DATE_TRUNC('day', timestamp)
                ORDER BY DATE_TRUNC('day', timestamp)
            )
            SELECT 
                reading_date,
                avg_pm25,
                avg_pm10,
                active_sites,
                uptime
            FROM daily_readings
        """)
        
        time_series_result = db.execute(time_series_query, params)
        
        time_series = []
        for row in time_series_result:
            ts_dict = dict(row._mapping)
            ts_dict = convert_to_json_serializable(ts_dict)
            time_series.append(ts_dict)
            
        # Return the complete response
        response = {
            "location": convert_to_json_serializable(location_dict),
            "sites": sites,
            "metrics": metrics,
            "aqi_distribution": aqi_distribution,
            "time_series": time_series
        }
        
        return create_json_response(response)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_location_analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch location analytics: {str(e)}")
def register_with_app(app):
    app.include_router(router)