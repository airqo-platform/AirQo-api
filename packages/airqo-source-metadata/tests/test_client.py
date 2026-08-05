import json
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "airqosm"))

from airqo_source_metadata.client import (
    SourceMetadataClient,
    SourceMetadataClientError,
    normalize_platform_response,
)


class NormalizeResponseTests(unittest.TestCase):
    def test_unwraps_singleton_list_response(self):
        payload = [{"message": "Operation successful", "data": {"primary_source": {}}}]
        self.assertEqual(normalize_platform_response(payload), payload[0])

    def test_rejects_non_object_data(self):
        with self.assertRaisesRegex(ValueError, "'data' must be a JSON object"):
            normalize_platform_response({"data": []})


class SourceMetadataClientTests(unittest.TestCase):
    @patch("airqo_source_metadata.client.urlopen")
    def test_fetch_builds_current_coordinate_request(self, mock_urlopen):
        response = MagicMock()
        response.read.return_value = json.dumps(
            [{"message": "Operation successful", "data": {"candidate_sources": []}}]
        ).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = response

        result = SourceMetadataClient(
            base_url="https://platform.airqo.net/", token="test-token"
        ).fetch(
            latitude=0.230918,
            longitude=32.614595,
            include_satellite=True,
        )

        request = mock_urlopen.call_args.args[0]
        parsed = urlparse(request.full_url)
        query = parse_qs(parsed.query)
        self.assertEqual(parsed.path, "/api/v2/spatial/source_metadata")
        self.assertEqual(query["include_satellite"], ["true"])
        self.assertEqual(query["token"], ["test-token"])
        self.assertEqual(result["data"]["candidate_sources"], [])

    def test_rejects_non_finite_coordinates(self):
        client = SourceMetadataClient(token="test-token")
        with self.assertRaisesRegex(ValueError, "finite"):
            client.fetch(latitude=float("nan"), longitude=32.6)

    def test_extra_params_cannot_override_core_fields(self):
        client = SourceMetadataClient(token="test-token")
        with self.assertRaisesRegex(ValueError, "reserved parameters"):
            client.fetch(
                latitude=0.2,
                longitude=32.6,
                extra_params={"latitude": 1.0},
            )

    @patch("airqo_source_metadata.client.urlopen")
    def test_malformed_platform_shape_raises_client_error(self, mock_urlopen):
        response = MagicMock()
        response.read.return_value = b'[{"data": []}]'
        mock_urlopen.return_value.__enter__.return_value = response

        with self.assertRaises(SourceMetadataClientError):
            SourceMetadataClient(token="test-token").fetch(
                latitude=0.2, longitude=32.6
            )


if __name__ == "__main__":
    unittest.main()
