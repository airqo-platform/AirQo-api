"""Locust load test for the legacy spatial site-location endpoint."""

import os
import random

from locust import HttpUser, between, task


BASE_POLYGON = (
    (32.575107, 0.305577),
    (32.575364, 0.319138),
    (32.597337, 0.320340),
    (32.607894, 0.312787),
    (32.608752, 0.297509),
    (32.599225, 0.292102),
    (32.580342, 0.291845),
    (32.574334, 0.296994),
    (32.575107, 0.305577),
)
NUM_SENSORS = max(1, int(os.getenv("LOCUST_SITE_LOCATION_NUM_SENSORS", "3")))
MUST_HAVE_COUNT = 1
MIN_DISTANCE_OPTIONS_KM = (0.5, 1.0, 1.5, 2.0, 2.5)
REQUEST_TIMEOUT_SECONDS = max(
    1.0, float(os.getenv("LOCUST_REQUEST_TIMEOUT_SECONDS", "60"))
)


class SpatialAPIUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def locate_sites(self):
        latitude_offset = random.uniform(-0.5, 0.5)
        longitude_offset = random.uniform(-0.5, 0.5)
        polygon = [
            [longitude + longitude_offset, latitude + latitude_offset]
            for longitude, latitude in BASE_POLYGON
        ]
        must_have_locations = [
            [0.305 + latitude_offset, 32.59 + longitude_offset]
        ]
        payload = {
            "polygon": {"coordinates": [polygon]},
            "must_have_locations": must_have_locations,
            "min_distance_km": random.choice(MIN_DISTANCE_OPTIONS_KM),
            "num_sensors": NUM_SENSORS,
        }

        with self.client.post(
            "/api/v2/spatial/site_location",
            json=payload,
            name="/api/v2/spatial/site_location",
            timeout=REQUEST_TIMEOUT_SECONDS,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(
                    f"HTTP {response.status_code}: {response.text[:200]}"
                )
                return

            try:
                body = response.json()
            except ValueError:
                response.failure("Response was not valid JSON")
                return

            if not isinstance(body, dict):
                response.failure("Response JSON was not an object")
                return

            sites = body.get("site_location")
            if not isinstance(sites, list):
                response.failure("Response did not contain site_location list")
            expected_sites = NUM_SENSORS + MUST_HAVE_COUNT
            if len(sites) != expected_sites:
                response.failure(
                    f"Expected {expected_sites} sites, received {len(sites)}"
                )
