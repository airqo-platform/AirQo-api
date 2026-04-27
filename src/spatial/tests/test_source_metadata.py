import unittest
from unittest.mock import patch

from flask import Flask

from models.source_metadata_model import SourceMetadataModel, _extract_cams_pollutants
from views.source_metadata_view import SourceMetadataView


SAMPLE_SATELLITE_POLLUTANTS = {
    "NO2": 48.0,
    "SO2": 12.0,
    "CO": 620.0,
    "O3": 112.0,
    "CH4": 1810.0,
    "HCHO": None,
    "AOD": 0.24,
    "Aerosol_Index": 0.65,
    "Dust": 35.0,
}


def create_test_app():
    app = Flask(__name__)
    app.add_url_rule(
        "/api/v2/spatial/source_metadata",
        view_func=SourceMetadataView.get_source_metadata,
        methods=["GET"],
    )
    return app


class SourceMetadataEndpointTest(unittest.TestCase):
    def setUp(self):
        self.app = create_test_app()
        self.client = self.app.test_client()
        self.site_patch = patch("models.source_metadata_model.SiteCategoryModel", None)
        self.satellite_patch = patch(
            "models.source_metadata_model.fetch_satellite_pollutants",
            return_value=SAMPLE_SATELLITE_POLLUTANTS,
        )
        self.site_patch.start()
        self.satellite_patch.start()

    def tearDown(self):
        self.satellite_patch.stop()
        self.site_patch.stop()

    def test_valid_request_without_satellite(self):
        response = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=32.5825"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertFalse(data["satellite_enabled"])
        self.assertIsNone(data["satellite_pollutants_mean"])
        self.assertEqual(data["method"], "rule_based_spatial_inference")
        self.assertGreater(len(data["candidate_sources"]), 0)

    def test_valid_request_with_satellite_true(self):
        response = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=32.5825&satellite=true"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["satellite_enabled"])
        self.assertIsNotNone(data["satellite_pollutants_mean"])
        self.assertEqual(data["satellite_metadata"]["status"], "available")
        self.assertIn("Copernicus Atmosphere Monitoring Service", data["satellite_metadata"]["source"])
        self.assertEqual(
            data["satellite_metadata"]["base_url"],
            "https://atmosphere.copernicus.eu",
        )
        self.assertNotIn("Google Earth Engine", data["satellite_metadata"]["source"])
        self.assertIn("NO2", data["satellite_pollutants_mean"])

    def test_valid_request_with_satellite_false(self):
        response = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=32.5825&satellite=false"
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertFalse(data["satellite_enabled"])
        self.assertIsNone(data["satellite_pollutants_mean"])
        self.assertNotIn("satellite_metadata", data)

    def test_missing_latitude(self):
        response = self.client.get(
            "/api/v2/spatial/source_metadata?longitude=32.5825"
        )

        self.assertEqual(response.status_code, 400)

    def test_invalid_coordinate_range(self):
        response = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=91&longitude=32.5825"
        )

        self.assertEqual(response.status_code, 400)

    def test_non_numeric_longitude(self):
        response = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=abc"
        )

        self.assertEqual(response.status_code, 400)

    def test_invalid_buffer_radius(self):
        response = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=32.5825&buffer_radius_m=0"
        )

        self.assertEqual(response.status_code, 400)

    def test_candidate_source_confidence_scores_sum_to_one(self):
        data = SourceMetadataModel().build_source_metadata(
            latitude=0.3476,
            longitude=32.5825,
            satellite=True,
        )
        total = sum(source["confidence"] for source in data["candidate_sources"])

        self.assertAlmostEqual(total, 1.0, places=4)

    def test_satellite_pollutant_values_only_when_satellite_true(self):
        without_satellite = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=32.5825"
        ).get_json()
        with_satellite = self.client.get(
            "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=32.5825&satellite=true"
        ).get_json()

        self.assertIsNone(without_satellite["satellite_pollutants_mean"])
        self.assertIsNotNone(with_satellite["satellite_pollutants_mean"])

    def test_satellite_unavailable_does_not_fail_request(self):
        with patch(
            "models.source_metadata_model.fetch_satellite_pollutants",
            return_value=None,
        ):
            response = self.client.get(
                "/api/v2/spatial/source_metadata?latitude=0.3476&longitude=32.5825&satellite=true"
            )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["satellite_enabled"])
        self.assertIsNone(data["satellite_pollutants_mean"])
        self.assertEqual(data["satellite_metadata"]["status"], "unavailable")

    def test_cams_payload_is_normalized_to_pollutant_schema(self):
        pollutants = _extract_cams_pollutants(
            {
                "pollutants": {
                    "nitrogen_dioxide": {"mean": 44.5},
                    "sulphur_dioxide": {"mean": 8.0},
                    "carbon_monoxide": {"mean": [500.0, 620.0]},
                    "ozone": {"mean": 101.2},
                    "methane": {"mean": 1815.0},
                    "formaldehyde": {"mean": None},
                    "aerosol_optical_depth_550nm": {"mean": 0.21},
                    "dust_aerosol_optical_depth_550nm": {"mean": 0.32},
                }
            }
        )

        self.assertEqual(pollutants["NO2"], 44.5)
        self.assertEqual(pollutants["CO"], 560.0)
        self.assertEqual(pollutants["CH4"], 1815.0)
        self.assertEqual(pollutants["AOD"], 0.21)
        self.assertEqual(pollutants["Aerosol_Index"], 0.64)


if __name__ == "__main__":
    unittest.main()
