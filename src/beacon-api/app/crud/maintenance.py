from sqlmodel import Session, select
from typing import List, Any, Dict, Optional
from datetime import datetime, timedelta, timezone
import math

from app.models import (
    Device, 
    AirQloud, 
    AirQloudDevice, 
    Location, 
    DeviceStatus,
    DevicePerformance
)
from app.crud.performance import airqloud_performance
from app.utils.performance_fetcher import ensure_multiple_airqlouds_performance_data

# --- Helper Functions ---

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) in kilometers.
    """
    R = 6371  # Radius of earth in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) * math.sin(d_lat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) * math.sin(d_lon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    d = R * c
    return d

def sanitize_metric(value: Optional[float], ndigits: int = 2) -> float:
    """
    Sanitize float values to ensure they are JSON compliant.
    Converts None, NaN, and Infinity to 0.0.
    """
    if value is None:
        return 0.0
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return round(value, ndigits)

def calculate_uptime_from_logs(status_history: List[Any], start_time: datetime, end_time: datetime) -> float:
    """
    Calculate uptime percentage using in-memory log list which is already filtered by time.
    """
    if not status_history:
        return 0.0
        
    online_time = 0
    offline_time = 0
    last_status = None
    
    # We assume status_history is sorted by timestamp
    
    for status in status_history:
        if last_status is not None:
            diff = (status.timestamp - last_status.timestamp).total_seconds()
            if last_status.is_online:
                online_time += diff
            else:
                offline_time += diff
        last_status = status
    
    # Add time to end_time
    if last_status:
        diff = (end_time - last_status.timestamp).total_seconds()
        if last_status.is_online:
            online_time += diff
        else:
            offline_time += diff
            
    total_time = online_time + offline_time
    if total_time <= 0:
        return 0.0
        
    return (online_time / total_time) * 100.0

def calculate_uptime(db: Session, device_key: int, start_time: datetime, end_time: datetime) -> float:
    """
    Calculate uptime percentage for a device over a period using DeviceStatus logs.
    """
    status_history = db.exec(
        select(DeviceStatus)
        .where(DeviceStatus.device_key == device_key)
        .where(DeviceStatus.timestamp >= start_time)
        .where(DeviceStatus.timestamp <= end_time)
        .order_by(DeviceStatus.timestamp)
    ).all()
    
    return calculate_uptime_from_logs(status_history, start_time, end_time)

# --- CRUD Operations ---

def get_maintenance_overview_data(db: Session, days: int = 14) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get maintenance summary:
    - Average uptime and error margin for each active airqloud for the past N days.
    - Differentiated by country.
    """
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # 1. Get Active AirQlouds
    active_airqlouds = db.exec(
        select(AirQloud).where(AirQloud.is_active == True)
    ).all()
    
    if not active_airqlouds:
        return {}
        
    # 2. Get Performance Data for these AirQlouds
    active_ids = [aq.id for aq in active_airqlouds]
    
    # Ensure data availability
    ensure_multiple_airqlouds_performance_data(db, active_ids, start_date, end_date)
    
    # Fetch performance records
    performance_records = airqloud_performance.get_performance_by_airqlouds(
        db,
        airqloud_ids=active_ids,
        start_date=start_date,
        end_date=end_date
    )
    
    # Group by AirQloud ID
    performance_map = {} # id -> list of records
    for record in performance_records:
        if record.airqloud_id not in performance_map:
            performance_map[record.airqloud_id] = []
        performance_map[record.airqloud_id].append(record)
        
    # Group by Country
    response = {}
    
    for aq in active_airqlouds:
        records = performance_map.get(aq.id, [])
        
        avg_uptime = 0
        avg_error_margin = 0
        
        if records:
            total_freq = sum([r.freq or 0 for r in records])
            total_error = sum([r.error_margin or 0 for r in records if r.error_margin is not None])
            count = len(records)
            
            # Assuming freq is percentage uptime as implied by context, or adjusting if it's count?
            # User said: "instead of a value for each day it returns one specific value"
            # In /airqlouds endpoint: freq is passed as is.
            # Assuming freq is the uptime metric here.
            
            avg_uptime = total_freq / count if count > 0 else 0
            
            # Count for error margin might differ if some are None
            error_count = len([r for r in records if r.error_margin is not None])
            avg_error_margin = total_error / error_count if error_count > 0 else 0
        
        country = aq.country or "Unknown"
        
        if country not in response:
            response[country] = []
            
        response[country].append({
            "airqloud_id": aq.id,
            "airqloud_name": aq.name,
            "country": aq.country,  # Explicitly include country as requested
            "device_count": aq.number_of_devices or 0,
            "average_uptime": sanitize_metric(avg_uptime),
            "average_error_margin": sanitize_metric(avg_error_margin)
        })
        
    return response

def get_map_view_data(db: Session, days: int = 14) -> List[Dict[str, Any]]:
    """
    Get map data for active tracked devices:
    - Device Coordinates
    - Associated AirQlouds
    - Average Uptime & Error Margin
    """
    from app.models.performance import DevicePerformance
    from sqlmodel import func, case, distinct

    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Subquery for aggregated device performance
    # Uptime = (Sum of hours with data / Total Days)
    # Each row in DevicePerformance is an hour. If freq > 0, it has data.
    uptime_expression = (
        func.sum(
            case(
                ((DevicePerformance.freq > 0), 1.0),
                else_=0.0
            )
        ) / float(max(days, 1))
    )

    perf_subquery = (
        select(
            DevicePerformance.device_id,
            uptime_expression.label("avg_uptime"), 
            func.avg(DevicePerformance.error_margin).label("avg_error_margin")
        )
        .where(DevicePerformance.timestamp >= start_date)
        .where(DevicePerformance.timestamp <= end_date)
        .group_by(DevicePerformance.device_id)
        .subquery()
    )

    # 1. Get active tracked devices (in an active airqloud)
    # Join Device, AirQloudDevice, AirQloud
    # OUTER JOIN Location (to include devices without active location)
    # OUTER JOIN Site (to include site info and fallback location)
    # OUTER JOIN Performance (to include devices without data)
    from sqlmodel import and_
    from app.models import Site
    
    query = (
        select(
            Device, 
            Location,
            Site,
            AirQloud.name,
            perf_subquery.c.avg_uptime,
            perf_subquery.c.avg_error_margin
        )
        .join(AirQloudDevice, AirQloudDevice.id == Device.device_id)
        .join(AirQloud, AirQloud.id == AirQloudDevice.cohort_id)
        .outerjoin(Location, and_(Location.device_key == Device.device_key, Location.is_active == True))
        .outerjoin(Site, Site.site_id == Device.site_id)
        .outerjoin(perf_subquery, Device.device_id == perf_subquery.c.device_id)
        .where(
            AirQloud.is_active == True,
            AirQloudDevice.is_active == True
        )
    )
    
    results = db.exec(query).all()
    
    # Process results to group airqlouds per device
    device_map = {}
    
    for device, loc, site, aq_name, avg_uptime, avg_error in results:
        if device.device_id not in device_map:
            # Determine location: Prefer active Location record, fallback to Site location
            latitude = loc.latitude if loc else (site.latitude if site else None)
            longitude = loc.longitude if loc else (site.longitude if site else None)
            
            device_map[device.device_id] = {
                "device_id": device.device_id,
                "device_name": device.device_name,
                "latitude": latitude,
                "longitude": longitude,
                "last_active": loc.recorded_at.isoformat() if loc and loc.recorded_at else None,
                "avg_uptime": sanitize_metric(avg_uptime),
                "avg_error_margin": sanitize_metric(avg_error),
                "airqlouds": set(),
                "site": {
                    "_id": site.site_id,
                    "name": site.site_name,
                    "district": site.district,
                    "country": site.country,
                    "latitude": site.latitude,
                    "longitude": site.longitude
                } if site else None
            }
        device_map[device.device_id]["airqlouds"].add(aq_name)
        
    # Convert sets to lists
    output = []
    for d in device_map.values():
        d["airqlouds"] = list(d["airqlouds"])
        output.append(d)
        
    return output

def calculate_maintenance_routes(
    db: Session, 
    device_ids: List[str], 
    start_lat: float, 
    start_lon: float
) -> Dict[str, Any]:
    """
    Calculate an optimized maintenance route for the selected devices.
    """
    if not device_ids:
        return {"route": [], "total_distance_km": 0}
        
    # 1. Fetch Device Locations & Performance Data
    devices_data = []
    
    for d_id in device_ids:
        device = db.exec(select(Device).where(Device.device_id == d_id)).first()
        if not device:
            continue
            
        # Location
        loc = db.exec(
            select(Location)
            .where(Location.device_key == device.device_key, Location.is_active == True)
        ).first()
        
        if not loc:
            continue
            
        # Performance / Criticality
        # Fetch latest performance record
        perf = db.exec(
            select(DevicePerformance)
            .where(DevicePerformance.device_id == d_id)
            .order_by(DevicePerformance.timestamp.desc())
            .limit(1)
        ).first()
        
        # Calculate scores
        uptime = 100.0 # Default good
        error_margin = 0.0
        
        if perf:
            error_margin = perf.error_margin or 0.0
            
        # Get uptime
        uptime = calculate_uptime(
            db, 
            device.device_key, 
            datetime.now(timezone.utc) - timedelta(days=7), 
            datetime.now(timezone.utc)
        )
        
        # Criticality Score: 
        # High Priority -> > 1
        # Low Uptime (< 80%) -> Increase score
        # High Error (> 20%) -> Increase score
        
        score = 1.0
        if uptime < 80:
            score += (80 - uptime) / 20.0 # e.g. 0 uptime -> +4 points
        if error_margin > 20:
            score += (error_margin - 20) / 20.0
            
        devices_data.append({
            "id": d_id,
            "name": device.device_name,
            "lat": loc.latitude,
            "lon": loc.longitude,
            "criticality": score,
            "uptime": uptime,
            "error_margin": error_margin
        })

    # 2. Route Optimization (Nearest Neighbor weighted by Criticality)
    # Start at depot
    current_pos = {"lat": start_lat, "lon": start_lon}
    unvisited = devices_data.copy()
    route = []
    total_distance = 0.0
    
    while unvisited:
        best_next = None
        best_score = -1 
        
        min_cost = float('inf')
        
        for candidate in unvisited:
            dist = haversine_distance(
                current_pos["lat"], current_pos["lon"],
                candidate["lat"], candidate["lon"]
            )
            
            # Avoid division by zero
            criticality = max(candidate["criticality"], 0.1)
            
            # Cost function:
            effective_cost = dist / (criticality ** 2) 
            
            if effective_cost < min_cost:
                min_cost = effective_cost
                best_next = candidate
                best_dist = dist
                
        if best_next:
            route.append({
                "device_id": best_next["id"],
                "device_name": best_next["name"],
                "latitude": best_next["lat"],
                "longitude": best_next["lon"],
                "distance_from_last_km": round(best_dist, 2),
                "criticality_score": round(best_next["criticality"], 2),
                "uptime": round(best_next["uptime"], 2)
            })
            total_distance += best_dist
            current_pos = {"lat": best_next["lat"], "lon": best_next["lon"]}
            unvisited.remove(best_next)
            
    return {
        "route": route,
        "total_distance_km": round(total_distance, 2)
    }


def get_airqloud_performance_stats(
    db: Session,
    request: Any
) -> List[Dict[str, Any]]:
    """
    Get aggregated performance stats for airqlouds with filtering, sorting, and pagination.
    """
    from app.models.maintenance import MaintenanceStatsRequest
    from app.models.performance import AirQloudPerformance
    from sqlmodel import func, col
    
    req: MaintenanceStatsRequest = request
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=req.period_days)
    
    # Base query: Join AirQloud with aggregated Performance
    # We need a subquery for performance aggregation
    perf_subquery = (
        select(
            AirQloudPerformance.airqloud_id,
            func.avg(AirQloudPerformance.freq).label("avg_uptime"),
            func.avg(AirQloudPerformance.error_margin).label("avg_error_margin")
        )
        .where(AirQloudPerformance.timestamp >= start_date)
        .where(AirQloudPerformance.timestamp <= end_date)
        .group_by(AirQloudPerformance.airqloud_id)
        .subquery()
    )
    
    # Subquery for device count per airqloud
    device_count_subquery = (
        select(
            AirQloudDevice.cohort_id,
            func.count(AirQloudDevice.id).label("device_count")
        )
        .where(AirQloudDevice.is_active == True)
        .group_by(AirQloudDevice.cohort_id)
        .subquery()
    )
    
    query = (
        select(
            AirQloud,
            perf_subquery.c.avg_uptime,
            perf_subquery.c.avg_error_margin,
            device_count_subquery.c.device_count
        )
        .outerjoin(perf_subquery, AirQloud.id == perf_subquery.c.airqloud_id)
        .outerjoin(device_count_subquery, AirQloud.id == device_count_subquery.c.cohort_id)
        .where(AirQloud.is_active == True)
    )
    
    # 1. Apply Filters
    if req.filters:
        # Search
        if req.filters.search:
            pattern = f"%{req.filters.search}%"
            query = query.where(
                (AirQloud.name.ilike(pattern)) | 
                (AirQloud.id.ilike(pattern)) |
                (AirQloud.country.ilike(pattern))
            )
            
        # Country
        if req.filters.country:
            query = query.where(AirQloud.country == req.filters.country)
            
        # Uptime Range
        if req.filters.uptime:
            if req.filters.uptime.min is not None:
                query = query.where(perf_subquery.c.avg_uptime >= req.filters.uptime.min)
            if req.filters.uptime.max is not None:
                query = query.where(perf_subquery.c.avg_uptime <= req.filters.uptime.max)
                
        # Error Margin Range
        if req.filters.error_margin:
            if req.filters.error_margin.min is not None:
                query = query.where(perf_subquery.c.avg_error_margin >= req.filters.error_margin.min)
            if req.filters.error_margin.max is not None:
                query = query.where(perf_subquery.c.avg_error_margin <= req.filters.error_margin.max)

    # 2. Apply Sorting
    if req.sort:
        field = req.sort.field
        order = req.sort.order
        
        sort_col = None
        if field == 'uptime':
            sort_col = perf_subquery.c.avg_uptime
        elif field == 'error_margin':
            sort_col = perf_subquery.c.avg_error_margin
        elif field == 'name':
            sort_col = AirQloud.name
            
        if sort_col is not None:
            if order == 'desc':
                query = query.order_by(sort_col.desc().nulls_last())
            else:
                query = query.order_by(sort_col.asc().nulls_last())
    else:
        # Default sort by name
        query = query.order_by(AirQloud.name)

    # 3. Calculate Total Count (before pagination), using a subquery for safety with grouping/distinct
    count_query = select(func.count()).select_from(query.subquery())
    total = db.exec(count_query).one()

    # 4. Apply Pagination
    offset = (req.page - 1) * req.page_size
    query = query.offset(offset).limit(req.page_size)
    
    results = db.exec(query).all()
    
    items = []
    for row in results:
        aq = row[0]
        avg_uptime = row[1] or 0.0
        avg_error = row[2] or 0.0
        count = row[3] or 0
        
        items.append({
            "id": aq.id,
            "name": aq.name,
            "country": aq.country,
            "device_count": count,
            "avg_uptime": sanitize_metric(avg_uptime),
            "avg_error_margin": sanitize_metric(avg_error)
        })
        
    return {
        "total": total,
        "page": req.page,
        "page_size": req.page_size,
        "items": items
    }


def get_device_performance_stats(
    db: Session,
    request: Any
) -> List[Dict[str, Any]]:
    """
    Get aggregated performance stats for devices with filtering, sorting, and pagination.
    Only includes devices that are part of at least one active AirQloud.
    """
    from app.models.maintenance import MaintenanceStatsRequest
    from app.models.performance import DevicePerformance
    from sqlmodel import func, distinct, case
    
    req: MaintenanceStatsRequest = request
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=req.period_days)
    
    # Subquery for aggregated device performance
    # Uptime = (Sum of hours with data / Total Days)
    # Each row in DevicePerformance is an hour. If freq > 0, it has data.
    uptime_expression = (
        func.sum(
            case(
                ((DevicePerformance.freq > 0), 1.0),
                else_=0.0
            )
        ) / float(max(req.period_days, 1))
    )

    perf_subquery = (
        select(
            DevicePerformance.device_id,
            uptime_expression.label("avg_uptime"), 
            func.avg(DevicePerformance.error_margin).label("avg_error_margin"),
            func.avg(DevicePerformance.avg_battery).label("avg_battery")
        )
        .where(DevicePerformance.timestamp >= start_date)
        .where(DevicePerformance.timestamp <= end_date)
        .group_by(DevicePerformance.device_id)
        .subquery()
    )
    
    # Query: Join Device with Performance and AirQloud info
    # Filter: Must belong to at least one active AirQloud
    query = (
        select(
            Device,
            perf_subquery.c.avg_uptime,
            perf_subquery.c.avg_error_margin,
            perf_subquery.c.avg_battery
        )
        .join(AirQloudDevice, AirQloudDevice.id == Device.device_id)
        .join(AirQloud, AirQloud.id == AirQloudDevice.cohort_id)
        .outerjoin(perf_subquery, Device.device_id == perf_subquery.c.device_id)
        .where(AirQloud.is_active == True)
        .where(AirQloudDevice.is_active == True)
        .distinct() # Ensure unique devices since a device can be in multiple airqlouds
    )
    
    # 1. Apply Filters
    if req.filters:
        # Search
        if req.filters.search:
            pattern = f"%{req.filters.search}%"
            query = query.where(
                (Device.device_name.ilike(pattern)) | 
                (Device.device_id.ilike(pattern))
            )

        # Uptime Range (Explicit uptime filter)
        if req.filters.uptime:
            if req.filters.uptime.min is not None:
                query = query.where(perf_subquery.c.avg_uptime >= req.filters.uptime.min)
            if req.filters.uptime.max is not None:
                query = query.where(perf_subquery.c.avg_uptime <= req.filters.uptime.max)
                
        # Error Margin Range
        if req.filters.error_margin:
            if req.filters.error_margin.min is not None:
                query = query.where(perf_subquery.c.avg_error_margin >= req.filters.error_margin.min)
            if req.filters.error_margin.max is not None:
                query = query.where(perf_subquery.c.avg_error_margin <= req.filters.error_margin.max)

    # 2. Apply Sorting
    if req.sort:
        field = req.sort.field
        order = req.sort.order
        
        sort_col = None
        if field == 'uptime':
            sort_col = perf_subquery.c.avg_uptime
        elif field == 'error_margin':
            sort_col = perf_subquery.c.avg_error_margin
        elif field == 'name':
            sort_col = Device.device_name
            
        if sort_col is not None:
            if order == 'desc':
                query = query.order_by(sort_col.desc().nulls_last())
            else:
                query = query.order_by(sort_col.asc().nulls_last())
    else:
        query = query.order_by(Device.device_name)
        
    # 3. Calculate Total Count (before pagination)
    count_query = select(func.count()).select_from(query.subquery())
    total = db.exec(count_query).one()

    # 4. Apply Pagination
    offset = (req.page - 1) * req.page_size
    query = query.offset(offset).limit(req.page_size)
    
    results = db.exec(query).all()
    
    # 5. Post-process to add AirQloud context
    items = []
    if results:
        device_ids = [row[0].device_id for row in results]
        
        # Fetch map of device_id -> list of airqloud names
        aq_map = {}
        if device_ids:
            aq_rows = db.exec(
                select(AirQloudDevice.id, AirQloud.name)
                .join(AirQloud, AirQloud.id == AirQloudDevice.cohort_id)
                .where(AirQloudDevice.id.in_(device_ids))
                .where(AirQloudDevice.is_active == True)
                .where(AirQloud.is_active == True)
            ).all()
            
            for d_id, aq_name in aq_rows:
                if d_id not in aq_map:
                    aq_map[d_id] = []
                aq_map[d_id].append(aq_name)
                
        for row in results:
            device = row[0]
            avg_uptime = row[1] or 0.0
            avg_error = row[2] or 0.0
            avg_battery = row[3] # Can be None
            
            items.append({
                "device_id": device.device_id,
                "device_name": device.device_name,
                "airqlouds": aq_map.get(device.device_id, []),
                "avg_uptime": sanitize_metric(avg_uptime),
                "avg_error_margin": sanitize_metric(avg_error),
                "avg_battery": sanitize_metric(avg_battery) if avg_battery is not None else None
            })
        
    return {
        "total": total,
        "page": req.page,
        "page_size": req.page_size,
        "items": items
    }


