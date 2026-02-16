import sys
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from collections import defaultdict
import statistics

# Add parent directory to path to allow imports from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select, and_
from app.configs.database import SessionLocal
from app.models.device import Device
from app.models.airqloud import AirQloud, AirQloudDevice
from app.models.performance import DevicePerformance

# Configuration
DAYS_TO_ANALYZE = 14
BATTERY_LOW_THRESHOLD = 3.5    # Volts
BATTERY_HEALTHY_THRESHOLD = 3.7 # Volts
HIGH_ERROR_MARGIN_THRESHOLD = 20.0 # Standard deviation mismatch or similar
EXPECTED_FREQ_PER_HOUR = 30    # Approx reports per hour (depends on config, assuming 2-min interval)
MIN_UPTIME_PCT = 0.5           # If < 50% uptime, considered having "Connectivity Issues" if battery is good

def get_performance_data(session: Session, start_date: datetime):
    """Fetch all performance records since start_date"""
    print(f"Fetching performance data since {start_date.isoformat()}...")
    statement = select(DevicePerformance).where(DevicePerformance.timestamp >= start_date)
    results = session.exec(statement).all()
    print(f"Loaded {len(results)} performance records.")
    return results

def analyze_device_failures():
    session = SessionLocal()
    try:
        # 1. Setup Time Window
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=DAYS_TO_ANALYZE)
        
        # 2. Get Devices from Active AirQlouds
        print("Fetching active AirQlouds...")
        # Get active AirQloud IDs
        active_airqlouds = session.exec(select(AirQloud.id).where(AirQloud.is_active == True)).all()
        print(f"Found {len(active_airqlouds)} active AirQlouds.")

        # Get device IDs belonging to these airqlouds
        # Note: AirQloudDevice.id IS the device_id (junction table uses id as device_id)
        if not active_airqlouds:
            print("No active AirQlouds found. Exiting.")
            return

        active_cohort_devices = session.exec(
            select(AirQloudDevice.id).where(AirQloudDevice.cohort_id.in_(active_airqlouds))
        ).all()
        target_device_ids = set(active_cohort_devices)
        print(f"Found {len(target_device_ids)} unique devices in active AirQlouds.")

        # Get Device objects for these IDs, ensuring the devices themselves are also marked active if needed
        # (User asked for "devices under airqlouds which are active only", implying airqloud.is_active=True)
        # We also keep the check for Device.is_active=True to be safe? 
        # "devices under airqlouds which are active only" -> devices in active clouds. 
        # Usually we also want the device itself to be active. Let's keep both filters.
        
        devices = session.exec(
            select(Device).where(
                and_(
                    Device.is_active == True,
                    Device.device_id.in_(target_device_ids)
                )
            )
        ).all()
        
        active_device_ids = {d.device_id: d for d in devices}
        print(f"Analyzing {len(active_device_ids)} active devices (within active AirQlouds) over last {DAYS_TO_ANALYZE} days.")

        # 3. Get Performance Data
        perf_records = get_performance_data(session, start_date)
        
        # 4. Group by Device
        device_stats = defaultdict(list)
        for record in perf_records:
            if record.device_id in active_device_ids:
                device_stats[record.device_id].append(record)
        
        # 5. Compute Metrics & Classify
        classification = {
            "Power Failure": [],
            "Transmission Issue": [],
            "Component Failure": [],
            "Healthy": [],
            "Dead": [] # No data at all in window
        }
        
        report_lines = []
        report_lines.append(f"# Device Failure Analysis Report")
        report_lines.append(f"**Date Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"**Period:** {start_date.date()} to {end_date.date()}")
        report_lines.append(f"**Total Active Devices:** {len(active_device_ids)}")
        report_lines.append("")

        for device_id, device in active_device_ids.items():
            records = device_stats.get(device_id, [])
            
            if not records:
                classification["Dead"].append({
                    "id": device_id,
                    "name": device.device_name,
                    "reason": "No data in period"
                })
                continue

            # Calculate Stats
            battery_values = [r.avg_battery for r in records if r.avg_battery is not None]
            error_margins = [r.error_margin for r in records if r.error_margin is not None]
            timestamps = sorted([r.timestamp for r in records])
            
            hours_with_data = len(set(r.timestamp.replace(minute=0, second=0, microsecond=0) for r in records))
            total_hours = (end_date - start_date).total_seconds() / 3600
            uptime_pct = hours_with_data / total_hours
            
            avg_battery = statistics.mean(battery_values) if battery_values else 0
            avg_error = statistics.mean(error_margins) if error_margins else 0
            
            last_record = sorted(records, key=lambda x: x.timestamp)[-1]
            last_battery = last_record.avg_battery if last_record.avg_battery is not None else 0
            days_since_last_seen = (end_date - last_record.timestamp).days

            # Logic
            details = {
                "id": device_id,
                "name": device.device_name,
                "avg_batt": round(avg_battery, 2),
                "last_batt": round(last_battery, 2),
                "uptime": round(uptime_pct * 100, 1),
                "avg_error": round(avg_error, 2),
                "last_seen": last_record.timestamp.strftime('%Y-%m-%d')
            }

            # Classification Logic
            if days_since_last_seen > 7:
                 classification["Dead"].append({**details, "reason": f"Last seen {days_since_last_seen} days ago"})
            
            elif last_battery < BATTERY_LOW_THRESHOLD or avg_battery < 3.6:
                classification["Power Failure"].append({**details, "reason": "Low Battery"})
            
            elif uptime_pct < MIN_UPTIME_PCT: # Poor reporting but good battery
                 if avg_battery > BATTERY_HEALTHY_THRESHOLD:
                    classification["Transmission Issue"].append({**details, "reason": "Low Uptime with Good Battery"})
                 else:
                    # Edge case: Low uptime and mediocre battery -> could be either, assume Power if unsure or split?
                    # Let's put in Power if < 3.7, else Transmission
                    classification["Power Failure"].append({**details, "reason": "Low Uptime & Mediocre Battery"})
            
            elif avg_error > HIGH_ERROR_MARGIN_THRESHOLD:
                classification["Component Failure"].append({**details, "reason": "High Error Margin"})
            
            else:
                classification["Healthy"].append(details)

        # 6. Generate Report Content
        categories = ["Power Failure", "Transmission Issue", "Component Failure", "Dead", "Healthy"]
        
        summary_table = "| Category | Count | Description |\n|---|---|---|\n"
        for cat in categories:
            count = len(classification[cat])
            desc = ""
            if cat == "Power Failure": desc = "Battery < 3.5V or persistent low voltage"
            elif cat == "Transmission Issue": desc = "Good Battery (>3.7V) but Low Uptime (<50%)"
            elif cat == "Component Failure": desc = f"Avg Error Margin > {HIGH_ERROR_MARGIN_THRESHOLD}"
            elif cat == "Dead": desc = "No data > 7 days"
            
            summary_table += f"| {cat} | {count} | {desc} |\n"
        
        report_lines.append("## Summary Statistics")
        report_lines.append(summary_table)
        report_lines.append("")

        # Detailed Lists
        for cat in ["Power Failure", "Transmission Issue", "Component Failure", "Dead"]:
            items = classification[cat]
            if not items:
                continue
                
            report_lines.append(f"## {cat} ({len(items)} Devices)")
            report_lines.append("| Device Name | ID | Avg Batt (V) | Last Batt (V) | Uptime (%) | Avg Error | Last Seen | Reason |")
            report_lines.append("|---|---|---|---|---|---|---|---|")
            
            # Sort by "severity" (approx)
            # Power: lower batt is worse. Trans: lower uptime is worse.
            items_sorted = items
            if cat == "Power Failure":
                items_sorted = sorted(items, key=lambda x: x.get('last_batt', 10))
            elif cat == "Transmission Issue":
                items_sorted = sorted(items, key=lambda x: x.get('uptime', 100))
            
            for item in items_sorted:
                report_lines.append(
                    f"| {item['name']} | `{item['id']}` | {item.get('avg_batt', '-')} | "
                    f"**{item.get('last_batt', '-')}** | {item.get('uptime', '-')} | "
                    f"{item.get('avg_error', '-')} | {item.get('last_seen', '-')} | {item.get('reason', '')} |"
                )
            report_lines.append("")

        # Write to file
        output_file = Path("analysis/failure_report.md")
        with open(output_file, "w") as f:
            f.write("\n".join(report_lines))
        
        print(f"Report generated at: {output_file.absolute()}")

    finally:
        session.close()

if __name__ == "__main__":
    analyze_device_failures()
