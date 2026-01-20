import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from app.configs.database import engine
from app.crud.maintenance import get_map_view_data

def inspect_missing_sites():
    with Session(engine) as db:
        #print("--- Inspecting Devices with Missing Sites ---")
        
        results = get_map_view_data(db, days=14)
        
        missing = [d for d in results if d.get("site") is None]
        
        print(f"Devices without Site: {len(missing)}")
        
        if missing:
             print(f"{'Device Name':<30} | {'Lat/Lon':<20}")
             print("-" * 55)
             for d in missing:
                  name = d.get('device_name', 'N/A')
                  lat = d.get('latitude', 'N/A')
                  lon = d.get('longitude', 'N/A')
                  print(f"{name:<30} | {lat}, {lon}")
                  
        #print("-------------------------------------------")

if __name__ == "__main__":
    inspect_missing_sites()
