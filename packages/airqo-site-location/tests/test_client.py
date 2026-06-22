import json
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "airqolocate"))

from airqolocate import LocateClient, build_polygon, build_request_payload


POLYGON = {
    "coordinates": [
        [
            [-0.5197049, 5.7005015],
            [-0.5189109, 5.6922597],
            [-0.5150914, 5.6888007],
        ]
    ]
}


class PayloadTests(unittest.TestCase):
    def test_build_polygon_closes_open_ring(self):
        polygon = build_polygon(POLYGON["coordinates"])
        ring = polygon["coordinates"][0]
        self.assertEqual(ring[0], ring[-1])
        self.assertEqual(len(ring), 4)


    @patch("airqolocate.client.polygon_from_place")
    def test_resolves_named_place_to_polygon(self, mock_polygon_from_place):
        mock_polygon_from_place.return_value = POLYGON
        payload = build_request_payload(
            polygon="Kampala, Uganda",
            num_sensors=5,
        )
        mock_polygon_from_place.assert_called_once_with("Kampala, Uganda")
        self.assertEqual(payload["polygon"], POLYGON)
    def test_omits_optional_must_have_locations(self):
        payload = build_request_payload(
            polygon=POLYGON,
            num_sensors=5,
            min_distance_km=2.5,
        )
        self.assertNotIn("must_have_locations", payload)

    def test_preserves_must_have_latitude_longitude_order(self):
        payload = build_request_payload(
            polygon=POLYGON,
            num_sensors=5,
            must_have_locations=[[-1.2790166, 36.816709]],
        )
        self.assertEqual(
            payload["must_have_locations"], [[-1.2790166, 36.816709]]
        )

    def test_rejects_more_required_locations_than_sensors(self):
        with self.assertRaisesRegex(ValueError, "cannot contain more"):
            build_request_payload(
                polygon=POLYGON,
                num_sensors=1,
                must_have_locations=[[0.1, 32.1], [0.2, 32.2]],
            )

    def test_rejects_core_option_override(self):
        with self.assertRaisesRegex(ValueError, "core fields"):
            build_request_payload(
                polygon=POLYGON,
                num_sensors=5,
                options={"num_sensors": 10},
            )


class LocateClientTests(unittest.TestCase):
    @patch("airqolocate.client.urlopen")
    def test_posts_expected_request(self, mock_urlopen):
        response = MagicMock()
        response.read.return_value = json.dumps(
            {"site_location": [], "site_information": {"total_sites": 0}}
        ).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = response

        result = LocateClient(token="test-token").locate(
            polygon=POLYGON,
            num_sensors=5,
            min_distance_km=2.5,
        )

        request = mock_urlopen.call_args.args[0]
        parsed = urlparse(request.full_url)
        body = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.method, "POST")
        self.assertEqual(parsed.path, "/api/v2/spatial/site_location")
        self.assertEqual(parse_qs(parsed.query)["token"], ["test-token"])
        self.assertEqual(body["num_sensors"], 5)
        self.assertNotIn("must_have_locations", body)
        self.assertEqual(result["site_location"], [])

    @patch("airqolocate.client.urlopen")
    def test_unwraps_singleton_response(self, mock_urlopen):
        response = MagicMock()
        response.read.return_value = b'[{"site_location": []}]'
        mock_urlopen.return_value.__enter__.return_value = response

        result = LocateClient(token="test-token").locate(
            polygon=POLYGON,
            num_sensors=3,
        )
        self.assertEqual(result, {"site_location": []})


if __name__ == "__main__":
    unittest.main()
