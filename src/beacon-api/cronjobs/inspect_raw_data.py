
import sys
import os
from pathlib import Path
import requests
from sqlmodel import select, Session
from dotenv import load_dotenv

# Add data-layer to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.configs.database import SessionLocal
from app.models.device import Device

load_dotenv()

def inspect_raw_data():
    session = SessionLocal()
    try:
        # Get an active device with credentials
        device = session.exec(
            select(Device)
            .where(Device.is_active == True)
            .where(Device.channel_id != None)
            .where(Device.read_key != None)
            .limit(1)
        ).first()

        if not device:
            print("No active device found with credentials.")
            return

        print(f"Inspecting Device: {device.device_id} (Channel: {device.channel_id})")

        url = f"https://api.thingspeak.com/channels/{device.channel_id}/feeds.json?api_key={device.read_key}&results=1"
        print(f"Fetching: {url}")
        
        resp = requests.get(url)
        data = resp.json()
        
        channel = data.get('channel', {})
        feeds = data.get('feeds', [])

        print("\n--- Channel Metadata ---")
        for k, v in channel.items():
            print(f"{k}: {v}")

        print("\n--- Latest Feed ---")
        if feeds:
            feed = feeds[0]
            for k, v in feed.items():
                print(f"{k}: {v}")
        else:
            print("No feeds found.")

    finally:
        session.close()

if __name__ == "__main__":
    inspect_raw_data()
