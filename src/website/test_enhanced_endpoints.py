#!/usr/bin/env python3
"""
Test script to verify our enhanced API endpoints are working correctly
"""
import requests
import json
import sys


def test_endpoint(url, name):
    """Test a single endpoint"""
    print(f"\n🔍 Testing {name}...")
    print(f"URL: {url}")

    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {response.status_code}")

            # Print key information
            if isinstance(data, dict):
                if 'results' in data:
                    # Paginated response
                    print(f"📊 Count: {data.get('count', 'unknown')} total")
                    print(
                        f"📊 Results: {len(data['results'])} items on this page")
                    if data['results']:
                        first_item = data['results'][0]
                        print(
                            f"📊 First item keys: {list(first_item.keys())[:10]}")
                elif 'title' in data:
                    # Event detail
                    print(f"📊 Title: {data.get('title', 'N/A')}")
                    print(f"📊 Event Status: {data.get('event_status', 'N/A')}")
                    print(f"📊 Is Virtual: {data.get('is_virtual', 'N/A')}")
                    print(
                        f"📊 Duration Days: {data.get('duration_days', 'N/A')}")
                    print(
                        f"📊 Public ID: {data.get('public_identifier', 'N/A')}")
                    print(f"📊 Has ID: {'id' in data}")

                    # Check nested data
                    nested_fields = ['inquiries', 'programs',
                                     'resources', 'partner_logos']
                    for field in nested_fields:
                        if field in data:
                            print(
                                f"📊 {field.title()}: {len(data[field])} items")

                elif 'country_name' in data:
                    # African country detail
                    print(f"📊 Country: {data.get('country_name', 'N/A')}")
                    print(f"📊 Cities: {len(data.get('city', []))} items")

                    # Check nested structure
                    cities = data.get('city', [])
                    if cities:
                        first_city = cities[0]
                        print(
                            f"📊 First city: {first_city.get('city_name', 'N/A')}")
                        content = first_city.get('content', [])
                        if content:
                            first_content = content[0]
                            print(
                                f"📊 First content title: {first_content.get('title', 'N/A')}")
                            descriptions = first_content.get('description', [])
                            images = first_content.get('image', [])
                            print(f"📊 Descriptions: {len(descriptions)} items")
                            print(f"📊 Images: {len(images)} items")

                else:
                    print(f"📊 Response keys: {list(data.keys())[:10]}")
            else:
                print(f"📊 Response type: {type(data)}")

        else:
            print(f"❌ Status: {response.status_code}")
            print(f"Response: {response.text[:200]}...")

    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    """Main test function"""
    base_url = "http://127.0.0.1:8000"

    # Test the API endpoints
    endpoints = [
        (f"{base_url}/website/api/v2/events/", "Events List"),
        (f"{base_url}/website/api/v2/events/the-hall-of-fame-2025-dubai/",
         "Event Detail (Slug)"),
        (f"{base_url}/website/api/v2/events/39/", "Event Detail (ID)"),
        (f"{base_url}/website/api/v2/events/upcoming/", "Upcoming Events"),
        (f"{base_url}/website/api/v2/events/past/", "Past Events"),
        (f"{base_url}/website/api/v2/african-countries/", "African Countries List"),
        (f"{base_url}/website/api/v2/african-countries/8/", "African Country Detail"),
        (f"{base_url}/website/api/v2/clean-air-resources/", "Clean Air Resources"),
    ]

    print("🚀 Testing Enhanced API Endpoints")
    print("=" * 50)

    for url, name in endpoints:
        test_endpoint(url, name)

    print("\n" + "=" * 50)
    print("✨ Testing Complete!")


if __name__ == "__main__":
    main()
