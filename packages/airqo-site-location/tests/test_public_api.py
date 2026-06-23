from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "airqolocate"))

import airqolocate


class PublicApiTests(unittest.TestCase):
    def test_version(self):
        self.assertEqual(airqolocate.__version__, "0.1.1")

    @patch("airqolocate.LocateClient.locate")
    def test_locate_sites_delegates_to_client(self, mock_locate):
        mock_locate.return_value = {"site_location": []}
        polygon = {
            "coordinates": [
                [[32.0, 0.0], [32.1, 0.0], [32.0, 0.1], [32.0, 0.0]]
            ]
        }
        result = airqolocate.locate_sites(
            polygon,
            num_sensors=2,
            token="token",
        )
        self.assertEqual(result, {"site_location": []})
        self.assertEqual(mock_locate.call_args.kwargs["num_sensors"], 2)


if __name__ == "__main__":
    unittest.main()
