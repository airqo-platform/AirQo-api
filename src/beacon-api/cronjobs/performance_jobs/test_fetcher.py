"""
Test script for ThingSpeak data fetcher
Run this to verify the cronjob works correctly with your database
"""
import sys
from pathlib import Path

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from datetime import datetime, timedelta, timezone
from app.configs.database import SessionLocal
from cronjobs.performance_jobs.fetch_thingspeak_data import ThingSpeakDataFetcher
from sqlmodel import select
from app.models.device import Device


def test_fetcher():
    """Test the ThingSpeak data fetcher with a small dataset"""
    
    print("=" * 80)
    print("Testing ThingSpeak Data Fetcher")
    print("=" * 80)
    
    with SessionLocal() as session:
        # Check for devices with ThingSpeak credentials
        devices = session.exec(
            select(Device).where(
                Device.channel_id.isnot(None),
                Device.read_key.isnot(None)
            ).limit(5)
        ).all()
        
        if not devices:
            print("\n❌ No devices found with ThingSpeak credentials (channel_id and read_key)")
            print("Please ensure your devices have channel_id and read_key set.")
            return
        
        print(f"\n✓ Found {len(devices)} devices with ThingSpeak credentials")
        for device in devices:
            print(f"  - {device.device_id} (Channel: {device.channel_id})")
        
        # Test with just the first device
        test_device = devices[0]
        print(f"\n📊 Testing with device: {test_device.device_id}")
        
        # Test with last 1 day
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=1)
        
        print(f"📅 Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        
        # Create fetcher
        fetcher = ThingSpeakDataFetcher(session)
        
        # Test single device processing
        print("\n🔄 Processing device...")
        results = fetcher.process_device(test_device, start_date, end_date)
        
        if results:
            print(f"\n✅ SUCCESS! Created {len(results)} hourly performance records:")
            # Show first few records
            for i, result in enumerate(results[:3], 1):
                print(f"\n   Record {i}:")
                print(f"   Device ID: {result.device_id}")
                print(f"   Frequency: {result.freq} data points")
                print(f"   Error Margin: {result.error_margin}")
                print(f"   Timestamp: {result.timestamp}")
            
            if len(results) > 3:
                print(f"\n   ... and {len(results) - 3} more hourly records")
        else:
            print(f"\n⚠️  No performance records created for device {test_device.device_id}")
            print("This might be due to:")
            print("  - No data available in ThingSpeak for the specified period")
            print("  - Invalid API key")
            print("  - Network/API issues")
            print("  - Missing field1 or field3 data")
        
        # Print stats
        print("\n📈 Statistics:")
        print(f"   API Requests: {fetcher.stats['api_requests']}")
        print(f"   Records Fetched: {fetcher.stats['device_records_fetched']}")
        print(f"   Errors: {fetcher.stats['errors']}")
        
        # Rollback to avoid saving test data (remove this if you want to save)
        session.rollback()
        print("\n🔄 Test completed (changes not saved)")
        
        print("\n" + "=" * 80)
        print("To run the full job, use:")
        print("  python cronjobs/performance_jobs/fetch_thingspeak_data.py")
        print("=" * 80)


if __name__ == "__main__":
    test_fetcher()
