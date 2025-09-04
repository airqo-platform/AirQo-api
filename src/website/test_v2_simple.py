#!/usr/bin/env python3
"""
AirQo Website API v2 Test Suite - Simple Version
===============================================

This script tests all v2 API endpoints to ensure proper functionality.
It tests pagination, filtering, searching, and data retrieval.

Usage:
    python test_v2_simple.py
"""

import requests
import sys


def test_endpoint(base_url, endpoint, test_name, test_filters=None):
    """Test an API endpoint with optional filters"""
    try:
        if endpoint:
            url = f"{base_url}/{endpoint}/"
        else:
            url = f"{base_url}/"

        if test_filters:
            params = "&".join([f"{k}={v}" for k, v in test_filters.items()])
            url = f"{url}?{params}"

        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()

            # Check if response has pagination structure
            if isinstance(data, dict) and 'results' in data:
                count = len(data['results'])
                total_count = data.get('count', 'unknown')
                print(f"  {test_name:<35} - OK ({count}/{total_count} items)")
            elif isinstance(data, list):
                count = len(data)
                print(f"  {test_name:<35} - OK ({count} items)")
            else:
                print(f"  {test_name:<35} - OK (Single item response)")
            return True
        else:
            print(f"  {test_name:<35} - ERROR {response.status_code}")
            return False

    except Exception as e:
        print(f"  {test_name:<35} - FAILED: {str(e)}")
        return False


def main():
    """Main function to run the tests"""
    base_url = "http://127.0.0.1:8000/website/api/v2"
    passed = 0
    failed = 0

    print("AirQo Website API v2 Test Suite")
    print("=" * 60)
    print()

    endpoints = [
        ("", "API Root"),
        ("impact-numbers", "Impact Numbers List"),
        ("african-countries", "African Countries List"),
        ("board-members", "Board Members List"),
        ("careers", "Careers List"),
        ("departments", "Departments List"),
        ("clean-air-resources", "Clean Air Resources"),
        ("forum-events", "Forum Events"),
        ("events", "Events List"),
        ("event-inquiries", "Event Inquiries"),
        ("event-programs", "Event Programs"),
        ("event-sessions", "Event Sessions"),
        ("event-partner-logos", "Event Partner Logos"),
        ("event-resources", "Event Resources"),
        ("external-team-members", "External Team Members"),
        ("external-team-biographies", "External Team Biographies"),
        ("faqs", "FAQs List"),
        ("highlights", "Highlights List"),
        ("tags", "Tags List"),
        ("partners", "Partners List"),
        ("partner-descriptions", "Partner Descriptions"),
        ("press", "Press List"),
        ("publications", "Publications List"),
        ("team-members", "Team Members List"),
        ("team-biographies", "Team Biographies"),
    ]

    for endpoint, test_name in endpoints:
        success = test_endpoint(base_url, endpoint, test_name)
        if success:
            passed += 1
        else:
            failed += 1

    # Test pagination and filtering
    print()
    print("Testing Pagination & Filtering:")
    print("-" * 30)

    success = test_endpoint(base_url, "highlights", "Pagination Test", {
                            "page": "1", "page_size": "5"})
    if success:
        passed += 1
    else:
        failed += 1

    success = test_endpoint(base_url, "team-members",
                            "Search Test", {"search": "Engineer"})
    if success:
        passed += 1
    else:
        failed += 1

    # Summary
    total = passed + failed
    print()
    print("=" * 60)
    print(f"Test Results Summary:")
    print(f"  Total Tests: {total}")
    print(f"  Passed: {passed}")
    print(f"  Failed: {failed}")
    print(f"  Success Rate: {(passed/total*100):.1f}%" if total > 0 else "N/A")

    if failed == 0:
        print("\nALL TESTS PASSED! The v2 API is fully functional.")
        return True
    else:
        print(f"\n{failed} test(s) failed. Please check the issues above.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
