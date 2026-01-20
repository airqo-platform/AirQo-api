import requests
import sys

def verify_pagination():
    url = "http://localhost:8000/airqlouds"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        print(f"Response keys: {data.keys()}")
        
        if "meta" not in data:
            print("FAILED: 'meta' key not found in response")
            sys.exit(1)
        
        if "airqlouds" not in data:
            print("FAILED: 'airqlouds' key not found in response")
            sys.exit(1)
            
        meta = data["meta"]
        print(f"Meta: {meta}")
        
        expected_meta_keys = ["total", "page", "pages", "limit", "skip"]
        for key in expected_meta_keys:
            if key not in meta:
                print(f"FAILED: '{key}' not found in meta")
                sys.exit(1)
        
        if meta["limit"] != 10:
            print(f"FAILED: Expected default limit 10, got {meta['limit']}")
            sys.exit(1)
            
        print("SUCCESS: Pagination structure verification passed")

        # Test is_active=true
        print("Testing is_active=true filter...")
        url_active = f"{url}?is_active=true"
        response = requests.get(url_active)
        response.raise_for_status()
        data = response.json()
        if data["airqlouds"]:
            for aq in data["airqlouds"]:
                if aq.get("is_active") is False:
                    print("FAILED: Found inactive airqloud when filtering by is_active=true")
                    sys.exit(1)
        print("SUCCESS: is_active=true filter passed")

        # Test is_active=false
        print("Testing is_active=false filter...")
        url_inactive = f"{url}?is_active=false"
        response = requests.get(url_inactive)
        response.raise_for_status()
        data = response.json()
        if data["airqlouds"]:
            for aq in data["airqlouds"]:
                if aq.get("is_active") is True:
                    print("FAILED: Found active airqloud when filtering by is_active=false")
                    sys.exit(1)
        print("SUCCESS: is_active=false filter passed")

        
    except Exception as e:
        print(f"FAILED: Exception occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    verify_pagination()
