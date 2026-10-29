import unittest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.services.thingspeak_sync_service import fetch_thingspeak_data_bulk


class TestThingSpeakSyncService(unittest.IsolatedAsyncioTestCase):
    @patch("app.services.thingspeak_sync_service.logger")
    async def test_fetch_thingspeak_404_logs_info(self, mock_logger):
        device = {"channel_id": 643676, "api_key": "dummy_key"}
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 404

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                "Not Found", request=MagicMock(), response=mock_response
            )

            results = await fetch_thingspeak_data_bulk(
                [device],
                start_date="2026-09-01",
                end_date="2026-09-02",
            )

            mock_logger.info.assert_any_call(
                "[ThingSpeak] Failed to fetch channel %s: HTTP 404",
                "643676",
            )
            mock_logger.error.assert_not_called()
            self.assertEqual(results, [{"channel_id": "643676", "feeds": []}])

    @patch("app.services.thingspeak_sync_service.logger")
    async def test_fetch_thingspeak_500_logs_error(self, mock_logger):
        device = {"channel_id": 643676, "api_key": "dummy_key"}
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 500

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                "Internal Server Error", request=MagicMock(), response=mock_response
            )

            results = await fetch_thingspeak_data_bulk(
                [device],
                start_date="2026-09-01",
                end_date="2026-09-02",
            )

            mock_logger.error.assert_called_with(
                "[ThingSpeak] Failed to fetch channel %s: HTTP %s",
                "643676",
                500,
            )
            self.assertEqual(results, [{"channel_id": "643676", "feeds": []}])


if __name__ == "__main__":
    unittest.main()
