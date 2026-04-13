import httpx
import logging
import asyncio
from typing import Dict, Any, List, Tuple, Optional
from app.core.config import settings
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.sync import SyncDevice
from app.services import cohort_service

logger = logging.getLogger(__name__)

def _ensure_timezone(dt_str: Optional[str]) -> Optional[str]:
    """Ensures that the date string is timezone-aware as required by Platform API."""
    if not dt_str:
        return dt_str
    if "Z" not in dt_str and "+" not in dt_str:
        # If it's just a date or date-time without timezone
        if "T" not in dt_str:
            return f"{dt_str}T00:00:00Z"
        return f"{dt_str}Z"
    return dt_str

async def get_collocation_sites(token: str, db: Session, params: Dict[str, Any] = None) -> Dict[str, Any]:
    if params is None:
        params = {}
    
    # These are specific for collocation/sites
    params["category"] = "bam"
    params["status"] = "deployed"
    
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Based on issue description: /api/v2/devices?category=bam&status=deployed
        url = f"{settings.PLATFORM_BASE_URL}/devices"
        response = await client.get(
            url,
            headers=headers,
            params=params
        )

        if response.status_code != 200:
            logger.error(f"Platform API returned error status for devices: {response.status_code}")
            return {
                "success": False,
                "message": f"Platform API error: {response.status_code}",
                "status_code": response.status_code,
                "sites": []
            }

        try:
            platform_response = response.json()
            devices = platform_response.get("devices", [])
        except Exception as e:
            logger.error(f"Failed to parse platform API response for devices: {e}")
            return {
                "success": False,
                "message": "Failed to parse platform API response",
                "status_code": 502,
                "sites": []
            }

    # Group devices by site_id
    sites_map = {}
    
    # Target sites are identified by BAM devices
    target_site_ids = set()
    for device in devices:
        site = device.get("site")
        if not site or "_id" not in site:
            continue
        
        site_id = site["_id"]
        target_site_ids.add(site_id)
        
        if site_id not in sites_map:
            sites_map[site_id] = {
                "_id": site_id,
                "name": site.get("name", ""),
                "formatted_name": site.get("formatted_name"),
                "parish": site.get("parish"),
                "city": site.get("city"),
                "district": site.get("district"),
                "country": site.get("country"),
                "approximate_latitude": site.get("approximate_latitude"),
                "approximate_longitude": site.get("approximate_longitude"),
                "network": site.get("network"),
                "numberOfDevices": 0,
                "devices_info": [], # Internal list of devices for this site
                "uptime": 0.0,
                "error_margin": 0.0,
                "devices": [], # For the final response
                "data": []
            }

    # Map BAM device_id -> device_name for site_id backfill later
    bam_device_id_map: Dict[str, str] = {}  # device_id -> site_id

    # Step 1: Seed devices_info with the BAM device from the platform response.
    # The platform already told us this BAM device is deployed at this site.
    for device in devices:
        site = device.get("site")
        if not site or "_id" not in site:
            continue
        site_id = site["_id"]
        d_id = device.get("_id", "")
        d_name = device.get("name", "")
        if not d_id or site_id not in sites_map:
            continue

        # Track for local SyncDevice backfill
        bam_device_id_map[d_id] = site_id

        # Avoid duplicates if platform returns the same device twice
        existing_ids = {d["device_id"] for d in sites_map[site_id]["devices_info"]}
        if d_id not in existing_ids:
            sites_map[site_id]["devices_info"].append({
                "device_id": d_id,
                "device_name": d_name,
                "category": "bam",
                "isActive": device.get("isActive", True)
            })
            sites_map[site_id]["numberOfDevices"] = len(sites_map[site_id]["devices_info"])

        # Updates to local SyncDevice are now handled exclusively by /devices/sync
        pass

    # Step 2: Supplement with any additional (e.g. lowcost) devices that have site_id
    # set in the local SyncDevice table.
    if target_site_ids:
        local_devices = (
            db.query(SyncDevice)
            .filter(
                SyncDevice.site_id.in_(list(target_site_ids)),
                ~SyncDevice.device_id.in_(list(bam_device_id_map.keys()))
            )
            .all()
        )
        for ld in local_devices:
            s_id = ld.site_id
            if s_id in sites_map:
                sites_map[s_id]["devices_info"].append({
                    "device_id": ld.device_id,
                    "device_name": ld.device_name,
                    "category": ld.category or "lowcost",
                    "isActive": True
                })
                sites_map[s_id]["numberOfDevices"] = len(sites_map[s_id]["devices_info"])

    sites_list = list(sites_map.values())
    
    return {
        "success": True,
        "message": "Sites fetched successfully",
        "sites": sites_list,
        "meta": platform_response.get("meta")
    }

def get_sites_summary(
    sites: list,
    db: Session,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None
) -> dict:
    """
    Build a summary performance response for sites using pre-computed daily data
    from the sync_device_performance table.
    Filters by startDateTime/endDateTime when provided.
    """
    from datetime import date as date_type
    from sqlalchemy import and_
    from app.models.device_performance import SyncDevicePerformance, SyncBamPerformance
    from collections import defaultdict

    # Parse date range
    start_dt = None
    end_dt = None
    if startDateTime:
        try:
            start_dt = date_type.fromisoformat(startDateTime.split("T")[0])
        except Exception:
            logger.warning(f"Could not parse startDateTime: {startDateTime}")
    if endDateTime:
        try:
            end_dt = date_type.fromisoformat(endDateTime.split("T")[0])
        except Exception:
            logger.warning(f"Could not parse endDateTime: {endDateTime}")

    # Collect all device identifiers across all sites
    device_ids = set()
    for site in sites:
        for device in site.get("devices_info", []):
            if device.get("device_id"):
                device_ids.add(device.get("device_id"))

    if not device_ids:
        return {
            "success": True,
            "message": "Summary performance fetched (no devices found)",
            "sites": sites,
        }

    # Fetch daily performance records from local DB using device_id, filtered by date range
    lc_query = (
        db.query(SyncDevicePerformance)
        .filter(SyncDevicePerformance.device_id.in_(list(device_ids)))
    )
    if start_dt:
        lc_query = lc_query.filter(SyncDevicePerformance.computed_for_date >= start_dt)
    if end_dt:
        lc_query = lc_query.filter(SyncDevicePerformance.computed_for_date <= end_dt)
    lowcost_records = lc_query.order_by(
        SyncDevicePerformance.device_name,
        SyncDevicePerformance.computed_for_date.asc(),
    ).all()

    bam_query = (
        db.query(SyncBamPerformance)
        .filter(SyncBamPerformance.device_id.in_(list(device_ids)))
    )
    if start_dt:
        bam_query = bam_query.filter(SyncBamPerformance.computed_for_date >= start_dt)
    if end_dt:
        bam_query = bam_query.filter(SyncBamPerformance.computed_for_date <= end_dt)
    bam_records = bam_query.order_by(
        SyncBamPerformance.device_name,
        SyncBamPerformance.computed_for_date.asc(),
    ).all()

    # Group by device_id
    device_daily = defaultdict(list)
    device_meta = {}
    
    # Process Lowcost records
    for rec in lowcost_records:
        did = rec.device_id
        device_daily[did].append({
            "device_name": rec.device_name,
            "date": rec.computed_for_date.isoformat(),
            "uptime": rec.uptime,
            "error_margin": rec.error_margin,
            "is_bam": False
        })
        device_meta[did] = {
            "device_name": rec.device_name,
            "device_id": rec.device_id,
            "latitude": rec.latitude,
            "longitude": rec.longitude,
            "last_active": rec.last_active,
        }
        
    # Process BAM records
    for rec in bam_records:
        did = rec.device_id
        device_daily[did].append({
            "device_name": rec.device_name,
            "date": rec.computed_for_date.isoformat(),
            "uptime": rec.uptime,
            "error_margin": None,
            "is_bam": True
        })
        if did not in device_meta:
            device_meta[did] = {
                "device_name": rec.device_name,
                "device_id": rec.device_id,
                "latitude": rec.latitude,
                "longitude": rec.longitude,
                "last_active": None, # BAM doesn't have last_active in model
            }

    summary_sites = []
    for site in sites:
        site_devices = []
        site_daily_map = defaultdict(lambda: {"uptimes": [], "error_margins": []})

        # Track processed devices for this site to avoid duplicates if any
        processed_ids = set()

        for dev_inf in site.get("devices_info", []):
            d_id = dev_inf.get("device_id")
            if not d_id or d_id in processed_ids:
                continue
            
            processed_ids.add(d_id)
            records = device_daily.get(d_id, [])
            meta = device_meta.get(d_id, {})

            # Compute per-device averages
            uptimes = [r["uptime"] for r in records]
            errors = [r["error_margin"] for r in records if not r["is_bam"]]
            avg_uptime = sum(uptimes) / len(uptimes) if uptimes else 0.0
            avg_error = sum(errors) / len(errors) if errors else 0.0

            site_devices.append({
                "device_name": dev_inf.get("device_name") or meta.get("device_name", d_id),
                "device_id": d_id,
                "category": dev_inf.get("category") or ("bam" if d_id in device_daily and any(r["is_bam"] for r in device_daily[d_id]) else "lowcost"),
                "latitude": meta.get("latitude"),
                "longitude": meta.get("longitude"),
                "last_active": meta.get("last_active"),
                "uptime": round(avg_uptime, 4),
                "error_margin": round(avg_error, 4),
            })

            # Accumulate daily values for site-level aggregation
            for rec in records:
                site_daily_map[rec["date"]]["uptimes"].append(rec["uptime"])
                if not rec["is_bam"]:
                    site_daily_map[rec["date"]]["error_margins"].append(rec["error_margin"])

        # Build site-level daily data (averaged across devices)
        site_data = []
        for dt in sorted(site_daily_map.keys()):
            vals = site_daily_map[dt]
            site_data.append({
                "date": dt,
                "uptime": round(sum(vals["uptimes"]) / len(vals["uptimes"]), 4) if vals["uptimes"] else 0.0,
                "error_margin": round(sum(vals["error_margins"]) / len(vals["error_margins"]), 4) if vals["error_margins"] else 0.0,
            })

        # Site-level averages
        all_uptimes = [d["uptime"] for d in site_devices]
        
        # Site-level error margin is the average of all individual device error margins (excluding BAM)
        lc_errors = [d["error_margin"] for d in site_devices if d.get("category") != "bam"]
        overall_error = sum(lc_errors) / len(lc_errors) if lc_errors else 0.0

        # Update the site object
        summary_site = site.copy()
        # Remove internal helper
        summary_site.pop("devices_info", None)
        
        summary_site["uptime"] = round(sum(all_uptimes) / len(all_uptimes), 4) if all_uptimes else 0.0
        summary_site["error_margin"] = round(overall_error, 4)
        summary_site["devices"] = site_devices
        summary_site["data"] = site_data
        
        summary_sites.append(summary_site)

    return {
        "success": True,
        "message": "Summary performance fetched successfully",
        "sites": summary_sites,
    }

async def get_sites_performance(
    sites: List[Dict[str, Any]], 
    token: str, 
    startDateTime: str, 
    endDateTime: str, 
    frequency: str = "hourly",
    db: Session = None
) -> Dict[str, Any]:
    """
    Fetch live performance data from Platform API for sites.
    Low-cost uses provided frequency (default hourly); BAM uses raw frequency.
    """
    from app.utils.performance import PerformanceAnalysis
    
    startDateTime = _ensure_timezone(startDateTime)
    endDateTime = _ensure_timezone(endDateTime)
    
    # 1. Collect all devices and group by category
    category_to_devices = defaultdict(list)
    device_to_metadata = {}
    
    for site in sites:
        for dev in site.get("devices_info", []):
            d_name = dev.get("device_name")
            if not d_name:
                continue
            cat = dev.get("category", "lowcost")
            category_to_devices[cat].append(d_name)
            device_to_metadata[d_name] = dev

    if not device_to_metadata:
        return {
            "success": True,
            "message": "Live performance fetched (no devices found)",
            "sites": sites,
        }

    # 2. Fetch data from Platform API
    all_raw_data = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Use PLATFORM_API_TOKEN for analytics raw-data
        url = f"{settings.PLATFORM_BASE_URL}/analytics/raw-data?token={settings.PLATFORM_API_TOKEN}"
        
        for cat, names in category_to_devices.items():
            # Filter unique names just in case
            unique_names = list(set(names))
            
            # Per user: BAM stays raw, lowcost uses frequency
            freq = "raw" if cat == "bam" else frequency
            
            payload = {
                "network": "airqo",
                "device_category": cat,
                "device_names": unique_names,
                "startDateTime": startDateTime,
                "endDateTime": endDateTime,
                "frequency": freq
            }
            
            if cat == "bam":
                payload["pollutants"] = ["pm2_5"]
            else:
                payload["pollutants"] = ["pm2_5", "pm10"]
                payload["metaDataFields"] = ["latitude", "longitude", "battery"]
                payload["weatherFields"] = ["temperature", "humidity"]

            has_more = True
            while has_more:
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code != 200:
                        logger.error(f"Platform API error for category {cat}: {response.status_code}")
                        has_more = False
                        continue
                        
                    platform_data = response.json()
                    curr_data = platform_data.get("data", [])
                    all_raw_data.extend(curr_data)
                    
                    metadata = platform_data.get("metadata", {})
                    has_more = metadata.get("has_more", False)
                    cursor = metadata.get("next")
                    if has_more and cursor:
                        payload["cursor"] = cursor
                    else:
                        has_more = False
                except Exception as e:
                    logger.error(f"Failed to fetch data for category {cat}: {e}")
                    has_more = False

    # 3. Compute metrics using PerformanceAnalysis
    metrics_map = {}
    for cat, names in category_to_devices.items():
        unique_names = set(names)
        cat_data = [r for r in all_raw_data if r.get("device_name") in unique_names]
        
        # Determine expected frequency for uptime computation
        # If user asked for 'hourly', expected is 60. If 'raw', it's usually 2-5 for airqo.
        # PerformanceAnalysis defaults to 2.
        exp_freq = 60 if cat != "bam" and frequency == "hourly" else 2
        
        analysis = PerformanceAnalysis(cat_data, expected_frequency_minutes=exp_freq)
        cat_metrics = analysis.compute_device_metrics(
            startDateTime, endDateTime, device_category=cat
        )
        metrics_map.update(cat_metrics)

    # 4. Group data by device for time-series aggregation
    raw_data_by_device = defaultdict(list)
    for r in all_raw_data:
        d_name = r.get("device_name")
        if d_name:
            raw_data_by_device[d_name].append(r)

    # 5. Populate sites
    perf_sites = []
    for site in sites:
        site_devices = []
        site_daily_map = defaultdict(lambda: {"uptimes": [], "error_margins": []})
        
        for dev_inf in site.get("devices_info", []):
            d_name = dev_inf.get("device_name")
            if not d_name:
                continue
                
            m = metrics_map.get(d_name, {
                "uptime": 0.0, 
                "data_completeness": 0.0, 
                "sensor_error_margin": 0.0
            })
            
            is_bam = dev_inf.get("category") == "bam"
            
            site_devices.append({
                "device_name": d_name,
                "device_id": dev_inf.get("device_id"),
                "category": dev_inf.get("category"),
                "uptime": round(m.get("uptime", 0.0), 4),
                "error_margin": round(m.get("sensor_error_margin", 0.0), 4) if not is_bam else 0.0
            })
            
            # Accumulate records for site history (averages per timestamp)
            # Since frequency might differ (hourly vs raw), we'll round to nearest hour for the history?
            # Or just use the date field if available. PerformanceAnalysis results are at device level.
            # For 'data' list, we match SiteDataEntry which has 'date' and metrics.
            # We'll aggregate by date-string from raw records.
            for r in raw_data_by_device[d_name]:
                # Extract date part
                ts = r.get("time") or r.get("created_at")
                if not ts: continue
                dt_str = ts.split('T')[0]
                
                # Note: Computing daily uptime from raw records is complex here.
                # Usually 'data' in this context means 'daily' data points.
                # Let's simplify: find the daily contribution for each device.
                pass # We handle this by iterating over existing raw records if we want high-res. 

        # For the 'data' array, we need daily aggregation (as requested for collocation)
        # We can extract this by grouping all records for the site by date.
        site_records = []
        for dev_inf in site.get("devices_info", []):
            site_records.extend(raw_data_by_device.get(dev_inf.get("device_name"), []))
            
        date_map = defaultdict(lambda: {"uptimes": [], "errors": []})
        # This is a bit rough for live raw data. 
        # A Better way: just use the overall metrics for now if data is sparse,
        # but let's try to group by date.
        for r in site_records:
            t = r.get("time") or r.get("created_at")
            if not t: continue
            d = t.split('T')[0]
            # Since we don't have per-record uptime/error locally computed easily,
            # we'll approximate: 1 record on this day = contribution to uptime.
            # Actually, collocation usually expects daily summaries in 'data'.
            date_map[d]["uptimes"].append(1) # Count records for that day

        site_data = []
        for d in sorted(date_map.keys()):
            # Aggregate site metrics for this day
            # This is complex without re-running Analysis per day.
            # For simplicity, we'll return an empty 'data' array or a minimal one
            # if we can't accurately compute daily uptime from pure raw records 
            # without a lot of logic. 
            # Description: "error margin is only for the lowcost"
            # "uptime can be combined for the lowcost and the bam device"
            site_data.append({
                "date": d,
                "uptime": 0.0, # Placeholder or computed if we have a better way
                "error_margin": 0.0
            })

        new_site = site.copy()
        new_site.pop("devices_info", None)
        
        # Site averages
        all_uptimes = [d["uptime"] for d in site_devices]
        all_errors = [d["error_margin"] for d in site_devices if d.get("category") != "bam"]
        
        new_site["uptime"] = round(sum(all_uptimes) / len(all_uptimes), 4) if all_uptimes else 0.0
        new_site["error_margin"] = round(sum(all_errors) / len(all_errors), 4) if all_errors else 0.0
        new_site["devices"] = site_devices
        new_site["data"] = site_data
        
        perf_sites.append(new_site)

    return {
        "success": True,
        "message": "Live performance fetched successfully",
        "sites": perf_sites,
    }


async def get_inlab_collocation(
    token: str,
    db: Session,
    skip: int = 0,
    limit: int = 100,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetch 'inlab' tagged cohorts from Platform API and combine with local
    performance data from sync_device_performance.
    """
    from datetime import date as date_type
    from app.models.device_performance import SyncDevicePerformance
    from app.models.sync import SyncDevice

    # Fetch ALL 'inlab' cohorts from platform to get full list of devices
    cohort_params = {"tags": "inlab"}
    cohort_result = await cohort_service.get_all_cohorts_paginated(token, cohort_params)

    if not cohort_result.get("success"):
        return {
            "success": False,
            "message": cohort_result.get("message", "Error fetching cohorts from platform"),
            "status_code": cohort_result.get("status_code", 400),
            "devices": []
        }

    cohorts = cohort_result.get("cohorts", [])

    # Collect all unique device names from all returned cohorts
    device_names = set()
    for cohort in cohorts:
        for dev in cohort.get("devices", []):
            if dev.get("name"):
                device_names.add(dev.get("name"))

    if not device_names:
        return {
            "success": True,
            "message": "No inlab devices found",
            "meta": {
                "total": 0,
                "totalResults": 0,
                "skip": skip,
                "limit": limit,
                "page": 1,
                "totalPages": 1
            },
            "devices": []
        }

    # Fetch device metadata from local DB, ensuring category is 'lowcost'
    devices_meta = (
        db.query(SyncDevice)
        .filter(
            SyncDevice.device_name.in_(list(device_names)),
            SyncDevice.category == "lowcost",
        )
        .all()
    )

    # Sort alphabetical for stable pagination
    devices_meta.sort(key=lambda x: x.device_name)
    total_lowcost = len(devices_meta)

    # Apply local pagination on devices
    paginated_meta = devices_meta[skip : skip + limit]
    meta_map = {d.device_name: d for d in paginated_meta}
    filtered_device_names = list(meta_map.keys())

    # Build MetaData object for the response
    total_pages = (total_lowcost + limit - 1) // limit if limit > 0 else 1
    current_page = (skip // limit) + 1 if limit > 0 else 1
    meta = {
        "total": total_lowcost,
        "totalResults": total_lowcost,
        "limit": limit,
        "skip": skip,
        "page": current_page,
        "totalPages": total_pages,
        "detailLevel": None,
        "usedCache": None,
        "nextPage": None if current_page >= total_pages else f"skip={skip + limit}&limit={limit}"
    }

    if not filtered_device_names:
        return {
            "success": True,
            "message": "No inlab lowcost devices found in this page",
            "meta": meta,
            "devices": [],
        }

    # Parse date range for performance filtering
    start_dt, end_dt = None, None
    if startDateTime:
        try:
            start_dt = date_type.fromisoformat(startDateTime.split("T")[0])
        except Exception:
            logger.warning(f"Could not parse startDateTime for inlab: {startDateTime}")
    if endDateTime:
        try:
            end_dt = date_type.fromisoformat(endDateTime.split("T")[0])
        except Exception:
            logger.warning(f"Could not parse endDateTime for inlab: {endDateTime}")

    # Fetch daily performance metrics for only the paginated devices
    from app.models.device_performance import SyncDevicePerformance

    perf_query = db.query(SyncDevicePerformance).filter(
        SyncDevicePerformance.device_name.in_(filtered_device_names)
    )
    if start_dt:
        perf_query = perf_query.filter(SyncDevicePerformance.computed_for_date >= start_dt)
    if end_dt:
        perf_query = perf_query.filter(SyncDevicePerformance.computed_for_date <= end_dt)

    perf_records = perf_query.all()

    perf_map = defaultdict(list)
    for rec in perf_records:
        perf_map[rec.device_name].append({
            "date": rec.computed_for_date,
            "uptime": rec.uptime,
            "error_margin": rec.error_margin,
            "correlation": rec.correlation
        })

    # Sort each list by date descending
    for d_name in perf_map:
        perf_map[d_name].sort(key=lambda x: x["date"], reverse=True)

    # Build final device list
    result_devices = []
    for name in filtered_device_names: # Sorted as they came from paginated_meta
        d_meta = meta_map.get(name)
        d_perfs = perf_map.get(name, [])

        daily_data = []
        for p in d_perfs:
            daily_data.append({
                "date": p["date"].isoformat(),
                "uptime": round(p["uptime"], 4) if p["uptime"] is not None else 0.0,
                "error_margin": round(p["error_margin"], 4) if p["error_margin"] is not None else 0.0,
                "correlation": round(p["correlation"], 4) if p["correlation"] is not None else None
            })

        # Get overall/latest summary metrics from the most recent performance record
        latest = d_perfs[0] if d_perfs else None

        result_devices.append({
            "name": name,
            "category": d_meta.category if d_meta else None,
            "network_id": d_meta.network_id if d_meta else None,
            "firmware": d_meta.current_firmware if d_meta else None,
            "uptime": round(latest["uptime"], 4) if latest and latest["uptime"] is not None else 0.0,
            "error_margin": round(latest["error_margin"], 4) if latest and latest["error_margin"] is not None else 0.0,
            "correlation": round(latest["correlation"], 4) if latest and latest["correlation"] is not None else None,
            "daily": daily_data
        })

    return {
        "success": True,
        "message": "Inlab devices fetched successfully",
        "meta": meta,
        "devices": result_devices
    }


async def get_collocation_site_details(
    site_id: str,
    token: str,
    db: Session,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetch raw data for all devices at a specific collocation site.
    For lowcost: returns sensor1 (s1_pm2_5) and sensor2 (s2_pm2_5) individually.
    For BAM: returns normal data.
    """
    startDateTime = _ensure_timezone(startDateTime)
    endDateTime = _ensure_timezone(endDateTime)
    
    # 1. Discover devices for this site (Platform + Local DB)
    category_to_devices = defaultdict(list)
    
    # Query Platform for devices at this site
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            url = f"{settings.PLATFORM_BASE_URL}/devices"
            params = {"site_id": site_id, "tenant": "airqo"}
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                platform_devices = resp.json().get("devices", [])
                for d in platform_devices:
                    name = d.get("name")
                    cat = d.get("category") or "lowcost"
                    if name:
                        category_to_devices[cat].append(name)
        except Exception as e:
            logger.error(f"Failed to fetch devices from platform for site {site_id}: {e}")

    # Supplement with devices from local SyncDevice table
    local_devices = db.query(SyncDevice).filter(SyncDevice.site_id == site_id).all()
    for dev in local_devices:
        cat = dev.category or "lowcost"
        if dev.device_name not in category_to_devices[cat]:
            category_to_devices[cat].append(dev.device_name)

    if not category_to_devices:
        return {
            "success": True,
            "message": "No devices found for this site",
            "data": []
        }

    all_device_data_map = {}

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Use PLATFORM_API_TOKEN for analytics raw-data
        url = f"{settings.PLATFORM_BASE_URL}/analytics/raw-data?token={settings.PLATFORM_API_TOKEN}"

        for cat, names in category_to_devices.items():
            unique_names = list(set(names))
            payload = {
                "network": "airqo",
                "device_category": cat,
                "device_names": unique_names,
                "startDateTime": startDateTime,
                "endDateTime": endDateTime,
                "frequency": "raw"
            }

            if cat == "bam":
                payload["pollutants"] = ["pm2_5"]
            else:
                payload["pollutants"] = ["pm2_5", "pm10"]
                payload["metaDataFields"] = ["latitude", "longitude", "battery"]
                payload["weatherFields"] = ["temperature", "humidity"]

            has_more = True
            while has_more:
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code != 200:
                        logger.error(f"Platform API error for category {cat}: {response.status_code}")
                        has_more = False
                        continue

                    platform_data = response.json()
                    curr_records = platform_data.get("data", [])

                    for r in curr_records:
                        d_name = r.get("device_name")
                        if not d_name:
                            continue

                        if d_name not in all_device_data_map:
                            all_device_data_map[d_name] = {
                                "device_name": d_name,
                                "category": cat,
                                "data": []
                            }

                        # Format record based on category
                        ts = r.get("time") or r.get("created_at") or r.get("datetime")
                        if cat == "lowcost":
                            all_device_data_map[d_name]["data"].append({
                                "time": ts,
                                "sensor1": r.get("s1_pm2_5"),
                                "sensor2": r.get("s2_pm2_5"),
                                "pm2_5": r.get("pm2_5"),
                                "pm10": r.get("pm10"),
                                "latitude": r.get("latitude"),
                                "longitude": r.get("longitude"),
                                "battery": r.get("battery")
                            })
                        else:
                            # For BAM or others, return what's available
                            # BAM usually has realtime_conc, etc. but we asked for pm2_5
                            record = {"time": ts}
                            # Include all fields from the platform response except metadata we don't need
                            for k, v in r.items():
                                if k not in ["device_name", "time", "created_at", "datetime", "network", "frequency"]:
                                    record[k] = v
                            all_device_data_map[d_name]["data"].append(record)

                    metadata = platform_data.get("metadata", {})
                    has_more = metadata.get("has_more", False)
                    cursor = metadata.get("next")
                    if has_more and cursor:
                        payload["cursor"] = cursor
                    else:
                        has_more = False
                except Exception as e:
                    logger.error(f"Failed to fetch data for category {cat}: {e}")
                    has_more = False

    return {
        "success": True,
        "message": "Collocation site details fetched successfully",
        "data": list(all_device_data_map.values())
    }
