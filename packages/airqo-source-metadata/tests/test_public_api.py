from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "airqosm"))

import airqosm


class PublicHelpersTests(unittest.TestCase):
    @patch("airqo_source_metadata.source_metadata")
    def test_primary_source_extracts_current_response_field(self, mock_source_metadata):
        expected = {"source_type": "traffic", "confidence": 0.3478}
        mock_source_metadata.return_value = {"message": "ok", "data": {"primary_source": expected}}
        self.assertEqual(
            airqosm.primary_source(0.2, 32.6, token="token"),
            expected,
        )

    @patch("airqo_source_metadata.source_metadata")
    def test_candidate_sources_validates_field_type(self, mock_source_metadata):
        mock_source_metadata.return_value = {"message": "ok", "data": {"candidate_sources": {}}}
        with self.assertRaises(airqosm.SourceMetadataClientError):
            airqosm.candidate_sources(0.2, 32.6, token="token")

    @patch("airqo_source_metadata.source_metadata")
    def test_candidate_sources_validates_item_types(self, mock_source_metadata):
        mock_source_metadata.return_value = {
            "message": "ok",
            "data": {"candidate_sources": [{"name": "valid"}, "invalid"]},
        }
        with self.assertRaisesRegex(
            airqosm.SourceMetadataClientError,
            "must contain only objects",
        ):
            airqosm.candidate_sources(0.2, 32.6, token="token")

if __name__ == "__main__":
    unittest.main()
