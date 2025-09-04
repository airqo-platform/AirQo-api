#!/usr/bin/env python3
"""
AirQo Website API v2 Test Suite
==============================

This script tests all v2 API endpoints to ensure proper functionality.
It tests pagination, filtering, searching, and data retrieval.

Usage:
    python test_v2_api.py
"""

import requests
import json
import sys
from typing import Dict, List, Any, Optional


class APITester:
    def __init__(self, base_url: str = "http://127.0.0.1:8000/website/api/v2"):
        self.base_url = base_url
        self.results = []
        self.passed = 0
        self.failed = 0

    def test_endpoint(self, endpoint: str, test_name: str, test_filters: Optional[Dict[str, str]] = None) -> bool:
        """Test an API endpoint with optional filters"""
        try:
            url = f"{self.base_url}/{endpoint}/"
            if test_filters:
                params = "&".join(
                    [f"{k}={v}" for k, v in test_filters.items()])
                url = f"{url}?{params}"

            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                data = response.json()

                # Check if response has pagination structure
                if isinstance(data, dict) and 'results' in data:
                    count = len(data['results'])
                    total_count = data.get('count', 'unknown')
                    self.log_success(
                        test_name, f"✓ {count}/{total_count} items")
                elif isinstance(data, list):
                    count = len(data)
                    self.log_success(test_name, f"✓ {count} items")
                else:
                    self.log_success(test_name, f"✓ Single item response")
                return True
            else:
                self.log_error(
                    test_name, f"✗ HTTP {response.status_code}: {response.text[:100]}")
                return False

        except Exception as e:
            self.log_error(test_name, f"✗ Exception: {str(e)}")
            return False

    def log_success(self, test_name: str, message: str):
        """Log successful test result"""
        print(f"  {test_name:<35} - {message}")
        self.passed += 1

    def log_error(self, test_name: str, message: str):
        """Log failed test result"""
        print(f"  {test_name:<35} - {message}")
        self.failed += 1

    def run_comprehensive_tests(self):
        """Run comprehensive tests for all endpoints"""
        print("AirQo Website API v2 Test Suite")
        print("=" * 60)
        print()

        # Test API root
        print("🌐 Testing API Root")
        print("-" * 30)
        self.test_endpoint("", "API Root")
        print()

        # Test Impact Numbers
        print("📊 Testing Impact Numbers")
        print("-" * 30)
        self.test_endpoint("impact-numbers", "Impact Numbers List")
        print()

        # Test African Cities
        print("🌍 Testing African Cities")
        print("-" * 30)
        self.test_endpoint("african-countries", "African Countries List")
        print()

        # Test Board Members
        print("👥 Testing Board Members")
        print("-" * 30)
        self.test_endpoint("board-members", "Board Members List")
        print()

        # Test Careers
        print("💼 Testing Careers")
        print("-" * 30)
        self.test_endpoint("careers", "Careers List")
        self.test_endpoint("departments", "Departments List")
        print()

        # Test Clean Air
        print("🌿 Testing Clean Air")
        print("-" * 30)
        self.test_endpoint("clean-air-resources", "Clean Air Resources")
        self.test_endpoint("forum-events", "Forum Events")
        print()

        # Test Events
        print("📅 Testing Events")
        print("-" * 30)
        self.test_endpoint("events", "Events List")
        self.test_endpoint("event-inquiries", "Event Inquiries")
        self.test_endpoint("event-programs", "Event Programs")
        self.test_endpoint("event-sessions", "Event Sessions")
        self.test_endpoint("event-partner-logos", "Event Partner Logos")
        self.test_endpoint("event-resources", "Event Resources")
        print()

        # Test External Teams
        print("🤝 Testing External Teams")
        print("-" * 30)
        self.test_endpoint("external-team-members", "External Team Members")
        self.test_endpoint("external-team-biographies",
                           "External Team Biographies")
        print()

        # Test FAQs
        print("❓ Testing FAQs")
        print("-" * 30)
        self.test_endpoint("faqs", "FAQs List")
        print()

        # Test Highlights
        print("⭐ Testing Highlights")
        print("-" * 30)
        self.test_endpoint("highlights", "Highlights List")
        self.test_endpoint("tags", "Tags List")
        print()

        # Test Partners
        print("🤝 Testing Partners")
        print("-" * 30)
        self.test_endpoint("partners", "Partners List")
        self.test_endpoint("partner-descriptions", "Partner Descriptions")
        print()

        # Test Press
        print("📰 Testing Press")
        print("-" * 30)
        self.test_endpoint("press", "Press List")
        print()

        # Test Publications
        print("📚 Testing Publications")
        print("-" * 30)
        self.test_endpoint("publications", "Publications List")
        print()

        # Test Team
        print("👨‍💻 Testing Team")
        print("-" * 30)
        self.test_endpoint("team-members", "Team Members List")
        self.test_endpoint("team-biographies", "Team Biographies")
        print()

        # Test Pagination (if data exists)
        print("📄 Testing Pagination & Filtering")
        print("-" * 30)
        self.test_endpoint("highlights", "Pagination Test",
                           {"page": "1", "page_size": "5"})
        self.test_endpoint("team-members", "Search Test",
                           {"search": "Engineer"})
        print()

        # Summary
        total = self.passed + self.failed
        print("=" * 60)
        print(f"Test Results Summary:")
        print(f"  Total Tests: {total}")
        print(f"  ✅ Passed: {self.passed}")
        print(f"  ❌ Failed: {self.failed}")
        print(
            f"  Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "N/A")

        if self.failed == 0:
            print("\n🎉 ALL TESTS PASSED! The v2 API is fully functional.")
            return True
        else:
            print(
                f"\n⚠️  {self.failed} test(s) failed. Please check the issues above.")
            return False


def main():
    """Main function to run the tests"""
    tester = APITester()
    success = tester.run_comprehensive_tests()

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
