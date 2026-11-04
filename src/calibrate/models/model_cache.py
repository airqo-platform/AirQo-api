"""One cloud model pair per worker, refreshed by object generation."""

import io
import logging
import math
import threading
import time
from dataclasses import dataclass, replace

import joblib
from google.cloud import storage

logger = logging.getLogger(__name__)
MODEL_FILES = ("default_rf.pkl", "default_lasso.pkl")


@dataclass(frozen=True)
class CacheEntry:
    bucket: str
    generations: tuple
    models: tuple
    checked_at: float


class PredictionModelCache:
    def __init__(self):
        self._entry = None
        self._lock = threading.Lock()

    def get(self, bucket, refresh_seconds):
        if not math.isfinite(refresh_seconds) or refresh_seconds <= 0:
            raise ValueError("MODEL_REFRESH_INTERVAL_SECONDS must be a positive finite number")
        # Serialize cold starts/refreshes so concurrent requests do not load copies.
        with self._lock:
            previous = self._entry if self._entry and self._entry.bucket == bucket else None
            if previous and time.monotonic() - previous.checked_at < refresh_seconds:
                return previous.models
            try:
                generations, models = self._load(bucket, previous)
            except Exception:
                if previous is None:
                    raise
                logger.exception("Model refresh failed for bucket %s; retaining cached models", bucket)
                # Back off until the next interval rather than retrying on every request.
                self._entry = replace(previous, checked_at=time.monotonic())
                return previous.models
            self._entry = CacheEntry(bucket, generations, models, time.monotonic())
            return models

    @staticmethod
    def _load(bucket, previous):
        client = storage.Client()
        try:
            bucket_obj = client.bucket(bucket)
            blobs = [bucket_obj.blob(filename) for filename in MODEL_FILES]
            for blob in blobs:
                blob.reload(timeout=30)
            generations = tuple(int(blob.generation) for blob in blobs)
            models = []
            for index, blob in enumerate(blobs):
                if previous and previous.generations[index] == generations[index]:
                    models.append(previous.models[index])
                    continue
                # Do not deserialize a different generation if an upload races this check.
                content = blob.download_as_bytes(if_generation_match=generations[index], timeout=120)
                model = joblib.load(io.BytesIO(content))
                if not callable(getattr(model, "predict", None)):
                    raise ValueError("Expected a prediction model in " + MODEL_FILES[index])
                models.append(model)
            # Publish only after both models have loaded and passed validation.
            return generations, tuple(models)
        finally:
            client.close()


prediction_model_cache = PredictionModelCache()
