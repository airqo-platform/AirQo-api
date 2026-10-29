import io
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

import joblib
import numpy as np

from app import app
from models.model_cache import MODEL_FILES, PredictionModelCache


class PredictionModel:
    def __init__(self, value):
        self.value = value

    def predict(self, frame):
        return np.full(len(frame), self.value, dtype=float)


def serialized(value):
    stream = io.BytesIO()
    joblib.dump(value, stream)
    return stream.getvalue()


class ModelCacheTests(unittest.TestCase):
    def setUp(self):
        self.cache = PredictionModelCache()
        clock_patch = patch("models.model_cache.time.monotonic", return_value=100)
        self.clock = clock_patch.start()
        self.addCleanup(clock_patch.stop)
        storage_patch = patch("models.model_cache.storage.Client")
        self.client_factory = storage_patch.start()
        self.addCleanup(storage_patch.stop)
        self.client = self.client_factory.return_value
        self.blobs = {name: MagicMock() for name in MODEL_FILES}
        self.client.bucket.return_value.blob.side_effect = self.blobs.__getitem__
        for name in MODEL_FILES:
            self.update(name, 1, 12)

    def update(self, name, generation, value):
        blob = self.blobs[name]
        blob.generation = generation
        blob.download_as_bytes.return_value = serialized(PredictionModel(value))

    def test_warm_requests_reuse_models_without_cloud_calls(self):
        first = self.cache.get("configured-bucket", 10)
        second = self.cache.get("configured-bucket", 10)
        self.assertIs(first, second)
        self.client.bucket.assert_called_once_with("configured-bucket")
        for blob in self.blobs.values():
            blob.reload.assert_called_once_with(timeout=30)
            blob.download_as_bytes.assert_called_once_with(if_generation_match=1, timeout=120)
        self.client.close.assert_called_once()

    def test_unchanged_generations_only_refresh_metadata(self):
        original = self.cache.get("bucket", 10)
        self.clock.return_value = 110
        refreshed = self.cache.get("bucket", 10)
        for before, after in zip(original, refreshed):
            self.assertIs(before, after)
        for blob in self.blobs.values():
            self.assertEqual(blob.reload.call_count, 2)
            self.assertEqual(blob.download_as_bytes.call_count, 1)
        self.cache.get("bucket", 10)
        self.assertEqual(self.client_factory.call_count, 2)

    def test_changed_object_reloads_only_changed_model(self):
        original = self.cache.get("bucket", 10)
        self.update(MODEL_FILES[0], 2, 25)
        self.clock.return_value = 110
        refreshed = self.cache.get("bucket", 10)
        self.assertIsNot(refreshed[0], original[0])
        self.assertEqual(refreshed[0].value, 25)
        self.assertIs(refreshed[1], original[1])
        self.blobs[MODEL_FILES[0]].download_as_bytes.assert_called_with(if_generation_match=2, timeout=120)
        self.assertEqual(self.blobs[MODEL_FILES[1]].download_as_bytes.call_count, 1)

    def test_failed_refresh_preserves_pair_and_retries_after_interval(self):
        original = self.cache.get("bucket", 10)
        self.update(MODEL_FILES[0], 2, 25)
        self.update(MODEL_FILES[1], 2, 30)
        self.blobs[MODEL_FILES[1]].download_as_bytes.return_value = serialized({"not": "a model"})
        self.clock.return_value = 110
        with self.assertLogs("models.model_cache", level="ERROR"):
            refreshed = self.cache.get("bucket", 10)
        self.assertIs(refreshed, original)
        calls = self.client_factory.call_count
        self.assertIs(self.cache.get("bucket", 10), original)
        self.assertEqual(self.client_factory.call_count, calls)
        self.update(MODEL_FILES[1], 2, 30)
        self.clock.return_value = 120
        retried = self.cache.get("bucket", 10)
        self.assertEqual([model.value for model in retried], [25, 30])

    def test_metadata_failure_retains_cached_models(self):
        original = self.cache.get("bucket", 10)
        self.clock.return_value = 110
        self.blobs[MODEL_FILES[0]].reload.side_effect = ConnectionError("offline")
        with self.assertLogs("models.model_cache", level="ERROR"):
            self.assertIs(self.cache.get("bucket", 10), original)

    def test_first_load_and_bucket_switch_fail_closed(self):
        self.blobs[MODEL_FILES[0]].reload.side_effect = ConnectionError("offline")
        with self.assertRaises(ConnectionError):
            self.cache.get("bucket-a", 10)
        self.blobs[MODEL_FILES[0]].reload.side_effect = None
        original = self.cache.get("bucket-a", 10)
        self.blobs[MODEL_FILES[0]].reload.side_effect = ConnectionError("offline")
        with self.assertRaises(ConnectionError):
            self.cache.get("bucket-b", 10)
        self.assertIs(self.cache.get("bucket-a", 10), original)

    def test_successful_bucket_switch_does_not_reuse_previous_bucket(self):
        original = self.cache.get("bucket-a", 10)
        changed = self.cache.get("bucket-b", 10)
        self.assertIsNot(original[0], changed[0])
        self.client.bucket.assert_called_with("bucket-b")
        self.assertEqual(self.blobs[MODEL_FILES[0]].download_as_bytes.call_count, 2)

    def test_concurrent_cold_requests_load_once(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.cache.get("bucket", 10), range(20)))
        self.assertTrue(all(result is results[0] for result in results))
        self.client_factory.assert_called_once()

    def test_invalid_refresh_interval(self):
        for seconds in (0, -1, float("nan"), float("inf")):
            with self.subTest(seconds=seconds), self.assertRaises(ValueError):
                self.cache.get("bucket", seconds)
        self.client_factory.assert_not_called()

    def test_endpoint_reuses_models_and_refreshes_predictions(self):
        client = app.test_client()

        def upload():
            data = b"datetime,pm2_5,pm10,humidity,temperature\n2026-10-28T10:00:00Z,25,40,65,24\n"
            return client.post("/api/v2/calibrate/tool", data={"file": (io.BytesIO(data), "input.csv")})

        with patch("models.model_cache.prediction_model_cache", self.cache), patch.dict(
            os.environ, {"FORECAST_MODELS_BUCKET": "endpoint-bucket", "MODEL_REFRESH_INTERVAL_SECONDS": "10"}
        ):
            for _ in range(2):
                response = upload()
                self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
                self.assertIn(",12.0,12.0", response.get_data(as_text=True))
            self.client_factory.assert_called_once()
            self.update(MODEL_FILES[0], 2, 35)
            self.clock.return_value = 110
            response = upload()
            self.assertEqual(response.status_code, 200)
            self.assertIn(",35.0,12.0", response.get_data(as_text=True))
            self.client.bucket.assert_called_with("endpoint-bucket")


if __name__ == "__main__":
    unittest.main()
