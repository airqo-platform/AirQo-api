import os
import json
import urllib.request

def parse_env(file_path):
    env_vars = {}
    if not os.path.exists(file_path):
        return env_vars
    with open(file_path, "r") as f:
        for line in f:
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                env_vars[key] = val
    return env_vars

def test_devices():
    # Parse .env manually
    env_vars = parse_env(".env")
    token = env_vars.get("TOKEN")
    
    if not token:
        print("Error: TOKEN not found in .env")
        return

    # Check if we need to add "JWT " prefix if not present (although it usually is)
    auth_header = token if token.startswith("JWT ") else f"JWT {token}"
    
    print("\n--- Making Request to Beacon API ---")
    print(f"URL: http://localhost:8000/api/v1/devices/?limit=5")
    
    url = "http://localhost:8000/api/v1/devices/?limit=5"
    req = urllib.request.Request(url, headers={"Authorization": auth_header})
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print("\n--- Response Summary ---")
            print(f"Success: {data.get('success', 'N/A')}")
            devices = data.get('devices', [])
            print(f"Number of Devices: {len(devices)}")
            
            if devices:
                print("\n--- Device List (First 5) ---")
                for i, dev in enumerate(devices[:5]):
                    print(f"{i+1}. name: {dev.get('name')}, id: {dev.get('_id')}")
            else:
                print("No devices found in response.")
    except Exception as e:
        print(f"\n[!] Error: {e}")
        if hasattr(e, 'read'):
            print(f"Detailed Server Error: {e.read().decode()}")

if __name__ == "__main__":
    test_devices()
