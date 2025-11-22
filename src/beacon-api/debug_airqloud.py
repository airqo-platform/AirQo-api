"""
Debug script to check database content for airqloud performance
"""
import sys
sys.path.append('.')

from sqlmodel import Session, create_engine, select
from app.configs.settings import settings
from app.models.airqloud import AirQloud, AirQloudDevice
from app.models.performance import AirQloudPerformance, DevicePerformance

# Create database engine
engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

def check_airqloud():
    """Check if airqloud exists and what devices it has"""
    with Session(engine) as session:
        # Check airqloud
        airqloud_id = "aq_967u90womy"
        airqloud = session.exec(
            select(AirQloud).where(AirQloud.id == airqloud_id)
        ).first()
        
        if not airqloud:
            print(f"❌ AirQloud '{airqloud_id}' NOT FOUND in database")
            print("\nLet's find what airqlouds exist:")
            all_airqlouds = session.exec(select(AirQloud).limit(10)).all()
            for aq in all_airqlouds:
                print(f"  - {aq.id} ({aq.name})")
            return
        
        print(f"✅ AirQloud found: {airqloud.id} - {airqloud.name}")
        
        # Check devices in this airqloud
        devices = session.exec(
            select(AirQloudDevice).where(AirQloudDevice.cohort_id == airqloud_id)
        ).all()
        
        print(f"\n📱 Devices in airqloud ({len(devices)} total):")
        for device in devices[:10]:  # Show first 10
            print(f"  - {device.id} ({device.name})")
        
        # Check airqloud performance data
        perf_records = session.exec(
            select(AirQloudPerformance).where(
                AirQloudPerformance.airqloud_id == airqloud_id
            ).limit(10)
        ).all()
        
        print(f"\n📊 AirQloud Performance Records ({len(perf_records)} found):")
        for record in perf_records:
            print(f"  - {record.timestamp}: freq={record.freq}, error_margin={record.error_margin}")
        
        if not perf_records:
            print("  ⚠️  No airqloud performance records found!")
        
        # Check device performance data
        if devices:
            device_ids = [d.id for d in devices[:5]]  # Check first 5 devices
            dev_perf_records = session.exec(
                select(DevicePerformance).where(
                    DevicePerformance.device_id.in_(device_ids)
                ).limit(20)
            ).all()
            
            print(f"\n📈 Device Performance Records (sample from {len(device_ids)} devices, {len(dev_perf_records)} found):")
            for record in dev_perf_records[:10]:
                print(f"  - {record.device_id} @ {record.timestamp}: freq={record.freq}, error={record.error_margin}")
            
            if not dev_perf_records:
                print("  ⚠️  No device performance records found!")

if __name__ == "__main__":
    check_airqloud()
