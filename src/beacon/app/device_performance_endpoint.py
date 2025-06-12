from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text, func, desc
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import statistics
from pydantic import BaseModel
import json
import math
import random
from app.database import get_db
from app.utils import convert_to_json_serializable, create_json_response

router = APIRouter()

# Performance data models
class PerformanceMetricsSummary(BaseModel):
    uptime: float
    dataCompleteness: float
    dataCollectionRate: float
    mtbf: Optional[float] = None
    mttr: Optional[float] = None
    calibrationDrift: Optional[float] = None
    batteryHealth: Optional[float] = None
    signalQuality: Optional[float] = None

class DailyMetric(BaseModel):
    date: str
    uptime: float
    dataCompleteness: float
    batteryLevel: Optional[float] = None
    signalStrength: Optional[float] = None
    dataSamples: int
    expectedSamples: int

class StatusRecord(BaseModel):
    status: str
    duration: int
    startDate: str

class MaintenanceRecord(BaseModel):
    date: str
    type: str
    description: str

class CalibrationData(BaseModel):
    month: str
    pm25Drift: float
    pm10Drift: float

class DevicePerformanceResponse(BaseModel):
    summary: PerformanceMetricsSummary
    dailyData: List[DailyMetric]
    statusHistory: List[StatusRecord]
    maintenanceHistory: List[MaintenanceRecord]
    calibrationData: List[CalibrationData]

@router.get("/device-performance/{device_id}", response_model=DevicePerformanceResponse)
def get_device_performance(
    device_id: str,
    timeRange: str = Query("7days", description="Time range for metrics: 7days, 30days, 90days, or custom"),
    startDate: Optional[str] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    endDate: Optional[str] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """Get comprehensive performance metrics for a specific device"""
    try:
        # First check if device exists
        device_query = text("""
            SELECT 
                device_key, 
                device_id, 
                first_seen,
                is_active,
                status 
            FROM dim_device 
            WHERE device_id = :device_id
        """)
        
        device_result = db.execute(device_query, {"device_id": device_id})
        device = device_result.first()
        
        if not device:
            raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
        
        device_key = device[0]
        device_dict = dict(device._mapping)
        
        # Determine date range based on timeRange parameter
        end_date = datetime.now()
        if timeRange == "7days":
            start_date = end_date - timedelta(days=7)
        elif timeRange == "30days":
            start_date = end_date - timedelta(days=30)
        elif timeRange == "90days":
            start_date = end_date - timedelta(days=90)
        elif timeRange == "custom" and startDate and endDate:
            try:
                start_date = datetime.strptime(startDate, "%Y-%m-%d")
                end_date = datetime.strptime(endDate, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            start_date = end_date - timedelta(days=7)  # Default to 7 days
        
        # Get device readings for the time period
        readings_query = text("""
            SELECT 
                timestamp,
                pm2_5,
                pm10,
                battery_voltage,
                signal_strength_dbm,
                humidity_percent,
                temperature_celsius
            FROM fact_device_readings
            WHERE device_key = :device_key
                AND timestamp BETWEEN :start_date AND :end_date
            ORDER BY timestamp
        """)
        
        readings_result = db.execute(
            readings_query, 
            {"device_key": device_key, "start_date": start_date, "end_date": end_date}
        )
        
        readings = []
        for row in readings_result:
            reading_dict = dict(row._mapping)
            reading_dict = convert_to_json_serializable(reading_dict)
            readings.append(reading_dict)
        
        # Get maintenance records for context
        maintenance_query = text("""
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
                    AND timestamp BETWEEN :start_date - INTERVAL '90 days' AND :end_date
                ORDER BY timestamp DESC
            )
            SELECT 
                timestamp,
                maintenance_type,
                description
            FROM maintenance_entries
            WHERE maintenance_type IS NOT NULL
            LIMIT 15
        """)
        
        maintenance_result = db.execute(
            maintenance_query, 
            {"device_key": device_key, "start_date": start_date, "end_date": end_date}
        )
        
        maintenance_records = []
        for row in maintenance_result:
            maintenance_dict = dict(row._mapping)
            maintenance_dict = convert_to_json_serializable(maintenance_dict)
            maintenance_records.append(maintenance_dict)
        
        # If no readings data, return simulated data for development purposes
        if not readings:
            return create_json_response(generate_simulated_performance_data(
                device_id=device_id,
                days=(end_date - start_date).days + 1,
                start_date=start_date,
                first_seen=device_dict.get('first_seen')
            ))
        
        # Calculate performance metrics from the readings
        performance_data = calculate_performance_metrics(
            device_dict=device_dict,
            readings=readings,
            start_date=start_date,
            end_date=end_date,
            maintenance_records=maintenance_records
        )
        
        return create_json_response(performance_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_device_performance: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch performance metrics: {str(e)}")

def calculate_performance_metrics(device_dict, readings, start_date, end_date, maintenance_records):
    """Calculate comprehensive performance metrics from device readings"""
    
    # Prepare data structures
    days_in_range = (end_date - start_date).days + 1
    expected_readings_per_day = 24  # Assuming hourly readings
    expected_total_readings = days_in_range * expected_readings_per_day
    
    # Group readings by day to analyze data completeness
    daily_readings = {}
    for reading in readings:
        timestamp = reading['timestamp']
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        
        day = timestamp.strftime("%Y-%m-%d")
        if day not in daily_readings:
            daily_readings[day] = []
        daily_readings[day].append(reading)
    
    # Calculate daily metrics
    daily_data = []
    all_battery_levels = []
    all_signal_strengths = []
    
    current_day = start_date
    while current_day <= end_date:
        day_str = current_day.strftime("%Y-%m-%d")
        day_readings = daily_readings.get(day_str, [])
        readings_count = len(day_readings)
        
        # Calculate daily metrics
        daily_uptime = calculate_daily_uptime(day_readings, expected_readings_per_day)
        daily_completeness = (readings_count / expected_readings_per_day) * 100 if readings_count > 0 else 0
        
        # Extract battery and signal data if available
        battery_levels = [r.get('battery_voltage') for r in day_readings if r.get('battery_voltage') is not None]
        signal_strengths = [r.get('signal_strength_dbm') for r in day_readings if r.get('signal_strength_dbm') is not None]
        
        avg_battery = statistics.mean(battery_levels) if battery_levels else None
        avg_signal = statistics.mean(signal_strengths) if signal_strengths else None
        
        # Normalize battery voltage to percentage (assuming 3.0V min, 4.2V max for typical LiPo)
        if avg_battery:
            battery_percentage = min(100, max(0, ((avg_battery - 3.0) / 1.2) * 100))
            all_battery_levels.append(battery_percentage)
        else:
            battery_percentage = None
            
        # Normalize signal strength (typical range -110 dBm to -50 dBm)
        if avg_signal:
            signal_percentage = min(100, max(0, ((avg_signal + 110) / 60) * 100))
            all_signal_strengths.append(signal_percentage)
        else:
            signal_percentage = None
        
        daily_data.append({
            "date": day_str,
            "uptime": daily_uptime,
            "dataCompleteness": daily_completeness,
            "batteryLevel": battery_percentage,
            "signalStrength": signal_percentage,
            "dataSamples": readings_count,
            "expectedSamples": expected_readings_per_day
        })
        
        current_day += timedelta(days=1)
    
    # Calculate average metrics
    avg_uptime = statistics.mean([day["uptime"] for day in daily_data]) if daily_data else 0
    avg_completeness = statistics.mean([day["dataCompleteness"] for day in daily_data]) if daily_data else 0
    
    # Calculate battery health and signal quality if data is available
    battery_health = calculate_battery_health(all_battery_levels) if all_battery_levels else None
    signal_quality = statistics.mean(all_signal_strengths) if all_signal_strengths else None
    
    # Calculate MTBF and MTTR from maintenance records
    mtbf, mttr = calculate_mtbf_mttr(maintenance_records)
    
    # Extract status history from maintenance records
    status_history = extract_status_history(maintenance_records, start_date, end_date)
    
    # Process maintenance history
    maintenance_history = [
        {
            "date": record['timestamp'].split('T')[0] if isinstance(record['timestamp'], str) else record['timestamp'].strftime("%Y-%m-%d"),
            "type": record['maintenance_type'],
            "description": record['description']
        }
        for record in maintenance_records[:5]  # Limit to most recent 5 records
    ]
    
    # Calculate calibration drift
    calibration_data = calculate_calibration_drift(device_dict, readings, start_date, end_date)
    
    # Build the performance response
    return {
        "summary": {
            "uptime": avg_uptime,
            "dataCompleteness": avg_completeness,
            "dataCollectionRate": (len(readings) / expected_total_readings) * 100 if expected_total_readings > 0 else 0,
            "mtbf": mtbf,
            "mttr": mttr,
            "calibrationDrift": calculate_overall_calibration_drift(calibration_data),
            "batteryHealth": battery_health,
            "signalQuality": signal_quality
        },
        "dailyData": daily_data,
        "statusHistory": status_history,
        "maintenanceHistory": maintenance_history,
        "calibrationData": calibration_data
    }

def calculate_daily_uptime(readings, expected_readings):
    """Calculate device uptime percentage for a day based on readings"""
    if not readings:
        return 0
    
    # If there are readings but not many, calculate uptime based on percentage of expected readings
    if len(readings) < expected_readings / 2:
        return (len(readings) / expected_readings) * 100
    
    # If more than half of expected readings are present, consider it high uptime
    return 90 + min(10, (len(readings) / expected_readings) * 10)  # Scale the last 10% based on completeness

def calculate_battery_health(battery_levels):
    """Calculate battery health based on voltage stability and level"""
    if not battery_levels or len(battery_levels) < 2:
        return None
    
    # Calculate variability
    std_dev = statistics.stdev(battery_levels) if len(battery_levels) > 1 else 0
    avg_level = statistics.mean(battery_levels)
    
    # Higher variability indicates poorer battery health
    variability_factor = max(0, 100 - (std_dev * 10))
    
    # Level factor - lower average level indicates potential degradation
    level_factor = min(100, avg_level * 1.1)  # Scale slightly to avoid penalizing too much
    
    # Combined health score
    health_score = (variability_factor * 0.6) + (level_factor * 0.4)
    
    return min(100, health_score)

def calculate_mtbf_mttr(maintenance_records):
    """Calculate Mean Time Between Failures and Mean Time To Recovery"""
    
    # Filter maintenance records for failures (offline events)
    failure_records = [r for r in maintenance_records if r['maintenance_type'] == 'Offline']
    recovery_records = [r for r in maintenance_records if r['maintenance_type'] == 'Restored']
    
    if not failure_records or len(failure_records) < 2:
        # Not enough data for meaningful calculation
        return None, None
    
    # Calculate time between failures
    failure_dates = sorted([
        datetime.fromisoformat(r['timestamp'].replace('Z', '+00:00')) 
        if isinstance(r['timestamp'], str) else r['timestamp']
        for r in failure_records
    ])
    
    intervals = [(failure_dates[i+1] - failure_dates[i]).days for i in range(len(failure_dates)-1)]
    
    if not intervals:
        return None, None
    
    # Mean Time Between Failures (in days)
    mtbf = statistics.mean(intervals)
    
    # Calculate Mean Time To Recovery if we have matching recovery events
    if recovery_records and len(recovery_records) > 0 and len(failure_records) > 0:
        # Match failure and recovery events
        recovery_times = []
        for failure in failure_records:
            failure_time = datetime.fromisoformat(failure['timestamp'].replace('Z', '+00:00')) if isinstance(failure['timestamp'], str) else failure['timestamp']
            
            # Find the first recovery after this failure
            for recovery in recovery_records:
                recovery_time = datetime.fromisoformat(recovery['timestamp'].replace('Z', '+00:00')) if isinstance(recovery['timestamp'], str) else recovery['timestamp']
                
                if recovery_time > failure_time:
                    # Calculate hours between failure and recovery
                    recovery_hours = (recovery_time - failure_time).total_seconds() / 3600
                    recovery_times.append(recovery_hours)
                    break
        
        if recovery_times:
            mttr = statistics.mean(recovery_times)
        else:
            mttr = 24  # Default to 24 hours if we can't calculate
    else:
        mttr = 24  # Default value
    
    return round(mtbf, 1), round(mttr, 1)

def extract_status_history(maintenance_records, start_date, end_date):
    """Extract device status history from maintenance records"""
    
    if not maintenance_records:
        # Generate placeholder data if no records exist
        return [
            {
                "status": "active",
                "duration": (end_date - start_date).days,
                "startDate": start_date.strftime("%Y-%m-%d")
            }
        ]
    
    # Sort records by timestamp (newest first)
    sorted_records = sorted(
        maintenance_records,
        key=lambda x: datetime.fromisoformat(x['timestamp'].replace('Z', '+00:00')) if isinstance(x['timestamp'], str) else x['timestamp'],
        reverse=True
    )
    
    status_history = []
    current_status = "active"  # Assume active by default
    current_start = end_date
    
    # Process records from newest to oldest to build history
    for record in sorted_records:
        record_time = datetime.fromisoformat(record['timestamp'].replace('Z', '+00:00')) if isinstance(record['timestamp'], str) else record['timestamp']
        
        # Skip records outside our range
        if record_time < start_date:
            continue
            
        # Determine status change
        if record['maintenance_type'] == 'Offline':
            # Add current status period
            if current_status != "offline":
                days_duration = (current_start - record_time).days
                if days_duration > 0:
                    status_history.append({
                        "status": current_status,
                        "duration": days_duration,
                        "startDate": record_time.strftime("%Y-%m-%d")
                    })
                current_status = "offline"
                current_start = record_time
                
        elif record['maintenance_type'] == 'Restored':
            # Add current status period
            if current_status != "active":
                days_duration = (current_start - record_time).days
                if days_duration > 0:
                    status_history.append({
                        "status": current_status,
                        "duration": days_duration,
                        "startDate": record_time.strftime("%Y-%m-%d")
                    })
                current_status = "active"
                current_start = record_time
                
        elif record['maintenance_type'] == 'Status Change' and 'maintenance' in record['description'].lower():
            # Add current status period
            if current_status != "maintenance":
                days_duration = (current_start - record_time).days
                if days_duration > 0:
                    status_history.append({
                        "status": current_status,
                        "duration": days_duration,
                        "startDate": record_time.strftime("%Y-%m-%d")
                    })
                current_status = "maintenance"
                current_start = record_time
    
    # Add final period to start_date if needed
    if current_start > start_date:
        days_duration = (current_start - start_date).days
        if days_duration > 0:
            status_history.append({
                "status": current_status,
                "duration": days_duration,
                "startDate": start_date.strftime("%Y-%m-%d")
            })
    
    # Reverse to get chronological order (oldest to newest)
    return sorted(
        status_history,
        key=lambda x: datetime.strptime(x['startDate'], "%Y-%m-%d")
    )

# Register the router with the API
def register_with_app(app):
   """
   Register the device performance router with the FastAPI application.
   
   Args:
       app: The FastAPI application instance
   """
   app.include_router(router, tags=["Device Performance"])

def calculate_calibration_drift(device_dict, readings, start_date, end_date):
    """Calculate sensor calibration drift over time"""
    # This would typically involve comparing device readings with reference measurements
    # For this implementation, we'll simulate drift based on device age and readings
    
    months = []
    current_month = start_date.replace(day=1)
    end_month = end_date.replace(day=1)
    
    while current_month <= end_month:
        months.append(current_month)
        # Move to next month
        if current_month.month == 12:
            current_month = current_month.replace(year=current_month.year + 1, month=1)
        else:
            current_month = current_month.replace(month=current_month.month + 1)
    
    # Generate calibration drift data based on device age
    device_age_months = 1
    if device_dict.get('first_seen'):
        first_seen = device_dict['first_seen']
        if isinstance(first_seen, str):
            first_seen = datetime.fromisoformat(first_seen.replace('Z', '+00:00'))
        device_age_months = ((datetime.now() - first_seen).days // 30) + 1
    
    base_drift = min(5.0, device_age_months * 0.2)  # Older devices drift more
    
    # Check if we have any PM2.5 and PM10 readings to calculate variability
    pm25_values = [r.get('pm2_5') for r in readings if r.get('pm2_5') is not None]
    pm10_values = [r.get('pm10') for r in readings if r.get('pm10') is not None]
    
    pm25_std = statistics.stdev(pm25_values) if len(pm25_values) > 1 else 1
    pm10_std = statistics.stdev(pm10_values) if len(pm10_values) > 1 else 1.5
    
    # Higher standard deviation might indicate more drift
    pm25_variability_factor = min(2.0, pm25_std / 10)
    pm10_variability_factor = min(2.0, pm10_std / 10)
    
    calibration_data = []
    for i, month in enumerate(months):
        # Simulate increasing drift over time
        month_progress = i / max(1, len(months))
        pm25_drift = base_drift * (0.5 + (month_progress * 0.5)) + (random.random() * 0.3) + pm25_variability_factor
        pm10_drift = pm25_drift * 1.2 + (random.random() * 0.3) + pm10_variability_factor
        
        calibration_data.append({
            "month": month.strftime("%b"),
            "pm25Drift": round(pm25_drift, 1),
            "pm10Drift": round(pm10_drift, 1)
        })
    
    return calibration_data

def calculate_overall_calibration_drift(calibration_data):
    """Calculate overall calibration drift from monthly data"""
    if not calibration_data:
        return 0.0
        
    # Use the most recent month's average drift
    latest = calibration_data[-1]
    return (latest["pm25Drift"] + latest["pm10Drift"]) / 2

def generate_simulated_performance_data(device_id, days, start_date, first_seen=None):
    """Generate simulated performance data when real data is unavailable"""
    import random
    
    # Calculate device age for calibration drift simulation
    if first_seen:
        if isinstance(first_seen, str):
            first_seen = datetime.fromisoformat(first_seen.replace('Z', '+00:00'))
        device_age_months = ((datetime.now() - first_seen).days // 30) + 1
    else:
        device_age_months = random.randint(3, 24)  # Random age between 3-24 months
    
    base_drift = min(5.0, device_age_months * 0.2)  # Older devices drift more
    
    # Generate daily data with realistic patterns
    daily_data = []
    current_date = start_date
    
    # Create a more realistic pattern with occasional dips
    # Simulate a device with generally good performance with a few issues
    base_uptime = 92
    base_completeness = 88
    has_battery_issues = random.random() < 0.3  # 30% chance of battery issues
    has_signal_issues = random.random() < 0.2   # 20% chance of signal issues
    
    # Generate a few problem days
    problem_days = set()
    for _ in range(min(3, days // 5)):  # Create problems on ~20% of days
        problem_day = random.randint(0, days-1)
        problem_days.add(problem_day)
    
    # Generate a continuous outage if appropriate (more likely for older devices)
    continuous_outage = random.random() < (device_age_months / 36)  # More likely in older devices
    outage_start = random.randint(0, max(0, days-3)) if continuous_outage else -1
    outage_length = random.randint(1, 3) if continuous_outage else 0
    
    for i in range(days):
        day_date = current_date + timedelta(days=i)
        date_str = day_date.strftime("%Y-%m-%d")
        
        # Check if this is a problem day or part of an outage
        is_problem_day = i in problem_days
        is_outage_day = outage_start <= i < outage_start + outage_length
        is_weekend = day_date.weekday() >= 5
        
        # Generate daily metrics
        if is_outage_day:
            # Device is down during outage
            uptime = 0
            completeness = 0
            samples = 0
            battery = None if random.random() < 0.8 else 20 + (random.random() * 10)
            signal = None if random.random() < 0.8 else 10 + (random.random() * 10)
        elif is_problem_day:
            # Problem day has reduced metrics
            uptime = base_uptime - 30 - (random.random() * 20)
            completeness = base_completeness - 35 - (random.random() * 15)
            samples = int(24 * (completeness / 100))
            battery = 60 - (random.random() * 30) if has_battery_issues else 70 + (random.random() * 20)
            signal = 50 - (random.random() * 30) if has_signal_issues else 70 + (random.random() * 15)
        elif is_weekend:
            # Weekends might have slightly lower metrics
            uptime = base_uptime - (random.random() * 8)
            completeness = base_completeness - (random.random() * 10)
            samples = int(24 * (completeness / 100))
            battery = 60 + (random.random() * 30) if has_battery_issues else 80 + (random.random() * 15)
            signal = 65 + (random.random() * 20) if has_signal_issues else 80 + (random.random() * 15)
        else:
            # Normal weekday
            uptime = base_uptime + (random.random() * 8)
            completeness = base_completeness + (random.random() * 12)
            samples = int(24 * (completeness / 100))
            battery = 70 + (random.random() * 20) if has_battery_issues else 85 + (random.random() * 15)
            signal = 75 + (random.random() * 15) if has_signal_issues else 85 + (random.random() * 15)
        
        # Add some small random variations
        daily_data.append({
            "date": date_str,
            "uptime": max(0, min(100, uptime)),
            "dataCompleteness": max(0, min(100, completeness)),
            "batteryLevel": None if battery is None else max(0, min(100, battery)),
            "signalStrength": None if signal is None else max(0, min(100, signal)),
            "dataSamples": max(0, samples),
            "expectedSamples": 24
        })
        
    # Calculate average metrics for summary
    valid_uptime = [d["uptime"] for d in daily_data if d["uptime"] > 0]
    valid_completeness = [d["dataCompleteness"] for d in daily_data if d["dataCompleteness"] > 0]
    valid_battery = [d["batteryLevel"] for d in daily_data if d["batteryLevel"] is not None]
    valid_signal = [d["signalStrength"] for d in daily_data if d["signalStrength"] is not None]
    
    avg_uptime = statistics.mean(valid_uptime) if valid_uptime else 0
    avg_completeness = statistics.mean(valid_completeness) if valid_completeness else 0
    battery_health = statistics.mean(valid_battery) if valid_battery else None
    signal_quality = statistics.mean(valid_signal) if valid_signal else None
    
    # Generate status history based on the simulated data
    status_history = []
    
    # Add outage if it exists
    if continuous_outage:
        outage_start_date = (start_date + timedelta(days=outage_start)).strftime("%Y-%m-%d")
        status_history.append({
            "status": "offline",
            "duration": outage_length,
            "startDate": outage_start_date
        })
        
        # Add active period before outage if applicable
        if outage_start > 0:
            status_history.append({
                "status": "active",
                "duration": outage_start,
                "startDate": start_date.strftime("%Y-%m-%d")
            })
            
        # Add active period after outage if applicable
        days_after_outage = days - (outage_start + outage_length)
        if days_after_outage > 0:
            after_outage_start = (start_date + timedelta(days=outage_start+outage_length)).strftime("%Y-%m-%d")
            status_history.append({
                "status": "active",
                "duration": days_after_outage,
                "startDate": after_outage_start
            })
    else:
        # Just active the whole time with possibly one maintenance day
        if days > 7 and random.random() < 0.4:  # 40% chance of maintenance for longer periods
            maint_day = random.randint(1, days-2)
            maint_date = (start_date + timedelta(days=maint_day)).strftime("%Y-%m-%d")
            
            # Before maintenance
            status_history.append({
                "status": "active",
                "duration": maint_day,
                "startDate": start_date.strftime("%Y-%m-%d")
            })
            
            # Maintenance day
            status_history.append({
                "status": "maintenance",
                "duration": 1,
                "startDate": maint_date
            })
            
            # Days after maintenance
            days_after = days - (maint_day + 1)
            if days_after > 0:
                after_date = (start_date + timedelta(days=maint_day+1)).strftime("%Y-%m-%d")
                status_history.append({
                    "status": "active",
                    "duration": days_after,
                    "startDate": after_date
                })
        else:
            # Just one active period
            status_history.append({
                "status": "active",
                "duration": days,
                "startDate": start_date.strftime("%Y-%m-%d")
            })
    
    # Generate maintenance history
    maintenance_history = []
    
    # First entry - the most recent maintenance or installation
    if random.random() < 0.7:  # 70% chance to have maintenance record
        days_ago = random.randint(days//4, days//2) if days > 4 else 1
        maint_date = (end_date - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        maintenance_history.append({
            "date": maint_date,
            "type": "Routine",
            "description": "Regular sensor calibration and cleaning"
        })
    
    # Add installation record
    install_date = (start_date - timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d")
    maintenance_history.append({
        "date": install_date,
        "type": "Installation",
        "description": "Initial device deployment and setup"
    })
    
    # Generate calibration data
    calibration_data = []
    months = []
    current_month = start_date.replace(day=1)
    end_month = start_date.replace(day=1) if end_date is None else end_date.replace(day=1)
    
    while current_month <= end_month:
        months.append(current_month)
        # Move to next month
        month = current_month.month
        year = current_month.year
        if month == 12:
            current_month = current_month.replace(year=year+1, month=1)
        else:
            current_month = current_month.replace(month=month+1)
    
    # Calculate calibration drift
    base_drift = device_age_months * 0.15
    current_pm25 = 0.3 + (random.random() * 0.2)
    current_pm10 = 0.5 + (random.random() * 0.3)
    
    for i, month in enumerate(months):
        month_str = month.strftime("%b")
        # Each month drift increases a bit
        current_pm25 += 0.2 + (random.random() * 0.15)
        current_pm10 += 0.3 + (random.random() * 0.2)
        
        # Cap drift at reasonable values
        current_pm25 = min(base_drift * 1.5, current_pm25)
        current_pm10 = min(base_drift * 2.0, current_pm10)
        
        calibration_data.append({
            "month": month_str,
            "pm25Drift": round(current_pm25, 1),
            "pm10Drift": round(current_pm10, 1)
        })
    
    # Build the complete response
    return {
        "summary": {
            "uptime": avg_uptime,
            "dataCompleteness": avg_completeness,
            "dataCollectionRate": sum(d["dataSamples"] for d in daily_data) / (days * 24) * 100,
            "mtbf": 45 + (random.random() * 15),  # ~45-60 days
            "mttr": 3 + (random.random() * 5),    # ~3-8 hours
            "calibrationDrift": current_pm25,
            "batteryHealth": battery_health,
            "signalQuality": signal_quality
        },
        "dailyData": daily_data,
        "statusHistory": status_history,
        "maintenanceHistory": maintenance_history,
        "calibrationData": calibration_data
    }