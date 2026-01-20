import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session
from app.configs.database import engine
from app.crud.maintenance import get_map_view_data

def verify_map_view_sites():
    with Session(engine) as db:
        print("--- Verifying Map View Data with Sites ---")
        
        results = get_map_view_data(db, days=14)
        
        print(f"Total Devices Returned: {len(results)}")
        
        null_loc = [d for d in results if d["latitude"] is None]
        print(f"Devices Still with NULL Location: {len(null_loc)}")
        
        site_count = len([d for d in results if d.get("site") is not None])
        print(f"Devices with Site Details: {site_count}")
        
        if len(null_loc) == 0 and len(results) == 35:
             print("SUCCESS: All devices now have locations (via Site fallback).")
        elif len(null_loc) < 18:
             print(f"PROGRESS: Null locations reduced from 18 to {len(null_loc)}.")
        else:
             print("WARNING: Site fallback did not reduce null locations. Site data might be missing too.")
             
        # Print a sample
        if results:
            sample = results[0]
            print("\nSample Device Data:")
            print(f"Name: {sample['device_name']}")
            print(f"Coordinates: {sample.get('latitude')}, {sample.get('longitude')}")
            print(f"Site: {sample.get('site')}")
        
        print("-------------------------------------------")

if __name__ == "__main__":
    verify_map_view_sites()
