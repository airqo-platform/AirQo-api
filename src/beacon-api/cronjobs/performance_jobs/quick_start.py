#!/usr/bin/env python
"""
Quick Start Script for ThingSpeak Data Fetcher
Run this to get started quickly
"""
import subprocess
import sys

def print_header(text):
    print("\n" + "=" * 80)
    print(text)
    print("=" * 80 + "\n")

def main():
    print_header("ThingSpeak Performance Data Fetcher - Quick Start")
    
    print("This job fetches data from ThingSpeak and updates performance tables.")
    print("\n📋 Available Options:\n")
    
    print("1. Test the setup (recommended first step)")
    print("   → python cronjobs/performance_jobs/test_fetcher.py\n")
    
    print("2. Fetch last 24 hours (default)")
    print("   → python cronjobs/performance_jobs/fetch_thingspeak_data.py\n")
    
    print("3. Fetch last 7 days")
    print("   → python cronjobs/performance_jobs/fetch_thingspeak_data.py --days 7\n")
    
    print("4. Fetch specific date range")
    print("   → python cronjobs/performance_jobs/fetch_thingspeak_data.py --start-date 2024-01-01 --end-date 2024-01-31\n")
    
    print("5. Process specific devices")
    print("   → python cronjobs/performance_jobs/fetch_thingspeak_data.py --device-ids device1 device2\n")
    
    print("\n📖 For more information:")
    print("   → See README.md in cronjobs/performance_jobs/")
    print("   → See IMPLEMENTATION_SUMMARY.md for complete details\n")
    
    print("Would you like to:")
    print("  [1] Run the test script")
    print("  [2] Fetch last 24 hours")
    print("  [3] Exit")
    
    try:
        choice = input("\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            print_header("Running Test Script")
            subprocess.run([sys.executable, "cronjobs/performance_jobs/test_fetcher.py"])
        elif choice == "2":
            print_header("Fetching Last 24 Hours")
            subprocess.run([sys.executable, "cronjobs/performance_jobs/fetch_thingspeak_data.py"])
        else:
            print("\nExiting. Run this script again when ready!")
    except KeyboardInterrupt:
        print("\n\nExiting...")
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    main()
