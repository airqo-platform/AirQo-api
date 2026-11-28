import io
import os
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from urllib.error import HTTPError, URLError
from unittest.mock import patch

import joblib
import jwt
import mongomock
import mongomock.gridfs
import numpy as np
import pandas as pd
import sklearn

from app import app
from upload_limits import MAX_CSV_BYTES
from training_core import prepare_training, train_reference_models, build_features
from training_store import TrainingStore, utcnow, MAX_ATTEMPTS
from training_worker import process_one

mongomock.gridfs.enable_gridfs_integration()
SECRET = "calibration-unit-test-secret-32-characters"
USER_A = "000000000000000000000001"
USER_B = "000000000000000000000002"


def token(user=USER_A, **claims):
    payload = {"_id": user, "exp": utcnow() + timedelta(hours=1)}
    payload.update(claims)
    return jwt.encode(payload, SECRET, algorithm="HS256")


def sample_csv(count=40):
    index = np.arange(count)
    return pd.DataFrame({
        "datetime": pd.date_range("2026-10-01", periods=count, freq="h", tz="UTC"),
        "pm2_5": 10 + index % 11, "pm10": 30 + index % 13,
        "humidity": 60 + index % 5, "temperature": 22 + index % 4,
        "reference_pm2_5": 8 + index % 11, "reference_pm10": 27 + index % 13,
        "unused": np.nan,
    }).to_csv(index=False).encode()


class TrainingJobTests(unittest.TestCase):
    def test_store_client_uses_utc_aware_datetimes(self):
        with patch.dict(os.environ, {"MONGO_URI": "mongodb://localhost:27017"}), \
                patch("training_store.MongoClient", return_value=mongomock.MongoClient(tz_aware=True)) as client:
            store = TrainingStore()
            store.close()
        client.assert_called_once_with("mongodb://localhost:27017",
                                       serverSelectionTimeoutMS=5000, socketTimeoutMS=30000,
                                       tz_aware=True)

    def setUp(self):
        self.environment = patch.dict(os.environ, {"AUTH_SERVICE_URL": "http://auth-service.test"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        def fake_verify(req, timeout):
            self.assertEqual(req.full_url, "http://auth-service.test/api/v2/users/verify")
            self.assertEqual(timeout, 5)
            self.assertTrue(req.get_header("Authorization").startswith("JWT "))
            encoded = req.get_header("Authorization")[4:]
            try:
                claims = jwt.decode(encoded, SECRET, algorithms=["HS256"], options={"require": ["exp"]})
                owner = claims.get("userId") or claims.get("id") or claims.get("_id")
                if not isinstance(owner, str) or len(owner) != 24:
                    raise jwt.InvalidTokenError()
            except jwt.InvalidTokenError:
                raise HTTPError(req.full_url, 401, "invalid token", {}, None)
            class Response:
                headers = {"X-Auth-User-Id": owner}
                def __enter__(self): return self
                def __exit__(self, *_): return None
            return Response()
        verifier_patch = patch("training_auth.urlopen", side_effect=fake_verify)
        self.verifier = verifier_patch.start()
        self.addCleanup(verifier_patch.stop)
        self.store = TrainingStore(mongomock.MongoClient(tz_aware=True).jobs)
        factory_patch = patch("training_api.TrainingStore", return_value=self.store)
        self.factory = factory_patch.start()
        self.addCleanup(factory_patch.stop)
        self.client = app.test_client()

    def auth(self, user=USER_A):
        return {"Authorization": "Bearer " + token(user)}

    def submit(self, content=None, user=USER_A, **options):
        options["file"] = (io.BytesIO(content if content is not None else sample_csv()), "paired.csv")
        return self.client.post("/api/v2/calibrate/tool/train", data=options, headers=self.auth(user))

    def test_complete_lifecycle_and_private_downloads(self):
        response = self.submit()
        self.assertEqual(response.status_code, 202, response.json)
        job_id = response.json["job_id"]
        uuid.UUID(job_id)
        url = response.json["status_url"]
        self.assertEqual(response.headers["Location"], url)
        self.assertEqual(self.client.get(url, headers=self.auth()).json["status"], "queued")
        self.assertEqual(self.client.get(url + "/model", headers=self.auth()).status_code, 409)
        self.assertTrue(process_one(self.store))
        status = self.client.get(url, headers=self.auth())
        self.assertEqual(status.json["status"], "completed", status.json)
        self.assertEqual(status.json["training_rows"], 32)
        self.assertEqual(status.json["validation_rows"], 8)
        self.assertLess(status.json["training_end"], status.json["validation_start"])
        result = self.client.get(status.json["result_url"], headers=self.auth())
        frame = pd.read_csv(io.BytesIO(result.data))
        self.assertEqual(len(frame), 8)
        self.assertIn("calibrated_pm10", frame)
        artifact = self.client.get(status.json["model_url"], headers=self.auth())
        model = joblib.load(io.BytesIO(artifact.data))
        self.assertEqual(set(model["models"]), {"pm2_5", "pm10"})
        self.assertEqual(model["versions"]["sklearn"], sklearn.__version__)
        self.assertIn("no-store", artifact.headers["Cache-Control"])
        lcs = pd.read_csv(io.BytesIO(sample_csv())).drop(columns=["reference_pm2_5", "reference_pm10"])
        calibration_url = status.json["calibrate_url"]
        oversized = self.client.post(calibration_url, headers=self.auth(), data={
            "file": (io.BytesIO(b"x" * (MAX_CSV_BYTES + 1)), "large.csv")})
        self.assertEqual(oversized.status_code, 413)
        self.assertIn("bigger than the 20 MB limit", oversized.json["message"])
        calibrated = self.client.post(calibration_url, headers=self.auth(), data={
            "file": (io.BytesIO(lcs.to_csv(index=False).encode()), "sensor.csv")})
        self.assertEqual(calibrated.status_code, 200, calibrated.get_data(as_text=True))
        predictions = pd.read_csv(io.BytesIO(calibrated.data))
        self.assertEqual(len(predictions), len(lcs))
        self.assertIn("calibrated_pm2_5", predictions)
        self.assertIn("calibrated_pm10", predictions)
        self.assertEqual(self.client.post(calibration_url, headers=self.auth(USER_B), data={
            "file": (io.BytesIO(lcs.to_csv(index=False).encode()), "sensor.csv")}).status_code, 404)
        invalid = lcs.copy()
        invalid.loc[0, "humidity"] = 101
        rejected = self.client.post(calibration_url, headers=self.auth(), data={
            "file": (io.BytesIO(invalid.to_csv(index=False).encode()), "sensor.csv")})
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(self.store.db.training_files.files.count_documents({"filename": "input.csv"}), 0)
        for suffix in ("", "/result", "/model"):
            self.assertEqual(self.client.get(url + suffix, headers=self.auth(USER_B)).status_code, 404)

    def test_unique_jobs_and_owner_comes_from_login(self):
        first = self.submit(owner_id=USER_B)
        second = self.submit(user=USER_B)
        self.assertNotEqual(first.json["job_id"], second.json["job_id"])
        self.assertIsNotNone(self.store.owned_job(first.json["job_id"], USER_A))
        self.assertIsNone(self.store.owned_job(first.json["job_id"], USER_B))

    def test_visibility_is_owner_controlled_and_model_download_stays_private(self):
        url = self.submit().json["status_url"]
        self.assertTrue(process_one(self.store))
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.get(url + "/result").status_code, 404)
        self.assertEqual(self.client.patch(url + "/visibility", json={"model_public": True}).status_code, 401)
        self.assertEqual(self.client.patch(url + "/visibility", headers=self.auth(USER_B),
                                           json={"model_public": True}).status_code, 404)
        self.assertEqual(self.client.patch(url + "/visibility", headers=self.auth(),
                                           json={"model_public": "true"}).status_code, 400)
        response = self.client.patch(url + "/visibility", headers=self.auth(),
                                     json={"model_public": True})
        self.assertEqual(response.status_code, 200)
        public_status = self.client.get(url).json
        self.assertIn("calibrate_url", public_status)
        self.assertNotIn("metrics", public_status)
        self.assertNotIn("model_url", public_status)
        self.assertNotIn("result_url", public_status)
        self.assertEqual(self.client.get(url + "/model").status_code, 401)
        self.assertEqual(self.client.get(url + "/model", headers=self.auth(USER_B)).status_code, 404)
        lcs = pd.read_csv(io.BytesIO(sample_csv())).drop(columns=["reference_pm2_5", "reference_pm10"])
        calibrated = self.client.post(public_status["calibrate_url"], data={
            "file": (io.BytesIO(lcs.to_csv(index=False).encode()), "sensor.csv")})
        self.assertEqual(calibrated.status_code, 200)
        self.assertIn("calibrated_pm2_5", pd.read_csv(io.BytesIO(calibrated.data)))
        self.client.patch(url + "/visibility", headers=self.auth(), json={"validations_public": True})
        public_status = self.client.get(url).json
        self.assertIn("r2", public_status["metrics"]["pm2_5"])
        self.assertEqual(self.client.get(public_status["result_url"]).status_code, 200)
        self.client.patch(url + "/visibility", headers=self.auth(),
                          json={"model_public": False, "validations_public": False})
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.get(url + "/result").status_code, 404)
        self.assertEqual(self.client.post(url + "/calibrate", data={
            "file": (io.BytesIO(lcs.to_csv(index=False).encode()), "sensor.csv")}).status_code, 404)

    def test_owner_can_delete_finished_results_and_model(self):
        url = self.submit().json["status_url"]
        self.assertEqual(self.client.delete(url, headers=self.auth()).status_code, 409)
        self.assertTrue(process_one(self.store))
        self.assertEqual(self.client.delete(url, headers=self.auth(USER_B)).status_code, 404)
        self.assertGreater(self.store.db.training_files.files.count_documents({}), 0)
        self.assertEqual(self.client.delete(url, headers=self.auth()).status_code, 204)
        self.assertEqual(self.store.db.training_files.files.count_documents({}), 0)
        self.assertEqual(self.client.get(url, headers=self.auth()).status_code, 404)
        self.assertEqual(self.client.get(url + "/model", headers=self.auth()).status_code, 404)
        self.assertEqual(self.client.get(url + "/result", headers=self.auth()).status_code, 404)
        self.assertEqual(self.client.delete(url, headers=self.auth()).status_code, 404)

    def test_owner_can_delete_failed_result(self):
        url = self.submit(sample_csv(5)).json["status_url"]
        self.assertTrue(process_one(self.store))
        self.assertEqual(self.client.delete(url, headers=self.auth()).status_code, 204)
        self.assertEqual(self.client.get(url, headers=self.auth()).status_code, 404)

    def test_authentication_required_for_all_routes(self):
        url = "/api/v2/calibrate/tool/train"
        for path, method in ((url, "post"), (url + "/" + str(uuid.uuid4()), "delete"),
                             (url + "/" + str(uuid.uuid4()) + "/model", "get"),
                             (url + "/" + str(uuid.uuid4()) + "/visibility", "patch")):
            self.assertEqual(getattr(self.client, method)(path).status_code, 401)
        self.factory.assert_not_called()
        for path in (url + "/" + str(uuid.uuid4()),
                     url + "/" + str(uuid.uuid4()) + "/result",
                     url + "/" + str(uuid.uuid4()) + "/calibrate"):
            method = "post" if path.endswith("/calibrate") else "get"
            self.assertEqual(getattr(self.client, method)(path).status_code, 404 if method == "get" else 400)
        expired = token(exp=utcnow() - timedelta(seconds=1))
        invalid = jwt.encode({"_id": USER_A, "exp": utcnow() + timedelta(hours=1)}, "wrong-key", algorithm="HS256")
        no_expiry = jwt.encode({"_id": USER_A}, SECRET, algorithm="HS256")
        for encoded in (expired, invalid, no_expiry):
            self.assertEqual(self.client.post(url, headers={"Authorization": "Bearer " + encoded}).status_code, 401)

    def test_auth_configuration_fails_closed(self):
        with patch.dict(os.environ, {"AUTH_SERVICE_URL": ""}):
            response = self.client.post("/api/v2/calibrate/tool/train", headers=self.auth())
        self.assertEqual(response.status_code, 503)

    def test_auth_service_unavailable_fails_closed(self):
        self.verifier.side_effect = URLError("auth service unavailable")
        response = self.client.post("/api/v2/calibrate/tool/train", headers=self.auth())
        self.assertEqual(response.status_code, 503)

    def test_client_identity_header_cannot_replace_valid_jwt(self):
        response = self.client.post("/api/v2/calibrate/tool/train", headers={
            "X-Auth-User-Id": USER_A, "Authorization": "JWT invalid"})
        self.assertEqual(response.status_code, 401)
        self.factory.assert_not_called()

    def test_signed_id_claim_is_accepted(self):
        encoded = jwt.encode({"id": USER_A, "exp": utcnow() + timedelta(hours=1)}, SECRET, algorithm="HS256")
        response = self.client.post("/api/v2/calibrate/tool/train", headers={"Authorization": "JWT " + encoded},
                                    data={"file": (io.BytesIO(sample_csv()), "paired.csv")})
        self.assertEqual(response.status_code, 202, response.json)

    def test_invalid_submission_headers_and_size(self):
        self.assertEqual(self.submit(b"datetime,pm2_5\n").status_code, 400)
        self.assertEqual(self.submit(pollutant="ozone").status_code, 400)
        self.assertEqual(self.submit(averaging_interval="year").status_code, 400)
        self.assertEqual(self.submit(pm2_5="pm10").status_code, 400)
        oversized = self.submit(b"x" * (MAX_CSV_BYTES + 1))
        self.assertEqual(oversized.status_code, 413)
        self.factory.assert_not_called()

    def test_single_pollutant_and_custom_mapping(self):
        frame = pd.read_csv(io.BytesIO(sample_csv())).drop(columns="reference_pm10")
        frame = frame.rename(columns={"reference_pm2_5": "reference_bam"})
        submitted = self.submit(frame.to_csv(index=False).encode(), reference_pm2_5="reference_bam")
        self.assertEqual(submitted.status_code, 202)
        self.assertTrue(process_one(self.store))
        status = self.client.get(submitted.json["status_url"], headers=self.auth()).json
        self.assertEqual(set(status["metrics"]), {"pm2_5"})
        lcs = frame.drop(columns=["reference_bam"])
        response = self.client.post(status["calibrate_url"], headers=self.auth(), data={
            "file": (io.BytesIO(lcs.to_csv(index=False).encode()), "sensor.csv")})
        self.assertEqual(response.status_code, 200)
        calibrated = pd.read_csv(io.BytesIO(response.data))
        self.assertIn("calibrated_pm2_5", calibrated)
        self.assertNotIn("calibrated_pm10", calibrated)

    def test_invalid_rows_fail_job_and_remove_upload(self):
        submitted = self.submit(sample_csv(5))
        self.assertEqual(submitted.status_code, 202)
        process_one(self.store)
        status = self.client.get(submitted.json["status_url"], headers=self.auth()).json
        self.assertEqual(status["status"], "failed")
        self.assertIn("30", status["message"])
        self.assertEqual(self.store.db.training_files.files.count_documents({}), 0)

    def test_atomic_worker_claims(self):
        self.submit()
        with ThreadPoolExecutor(max_workers=5) as pool:
            claimed = list(pool.map(lambda _: self.store.claim(), range(5)))
        self.assertEqual(sum(job is not None for job in claimed), 1)

    def test_expired_lease_reclaimed_and_old_worker_cannot_complete(self):
        self.submit()
        old = self.store.claim()
        self.store.jobs.update_one({"_id": old["_id"]}, {"$set": {"lease_until": utcnow() - timedelta(seconds=1)}})
        new = self.store.claim()
        self.assertEqual(old["_id"], new["_id"])
        self.assertNotEqual(old["lease_token"], new["lease_token"])
        with self.assertRaises(RuntimeError):
            self.store.complete(old, {}, b"stale", b"stale")
        self.assertFalse(self.store.heartbeat(old))
        self.assertTrue(self.store.heartbeat(new))
        self.assertEqual(self.store.db.training_files.files.count_documents({}), 1)

    def test_retention_cleanup_and_retry_exhaustion(self):
        expired = self.submit().json["job_id"]
        self.store.jobs.update_one({"_id": expired}, {"$set": {"expires_at": utcnow() - timedelta(seconds=1)}})
        self.assertIsNone(self.store.owned_job(expired, USER_A))
        self.store.cleanup()
        self.assertEqual(self.store.db.training_files.files.count_documents({}), 0)
        active = self.submit().json["job_id"]
        self.store.claim()
        self.store.jobs.update_one({"_id": active}, {"$set": {
            "attempts": MAX_ATTEMPTS, "lease_until": utcnow() - timedelta(seconds=1)}})
        self.store.cleanup()
        self.assertEqual(self.store.jobs.find_one({"_id": active})["status"], "failed")
        self.assertEqual(self.store.db.training_files.files.count_documents({}), 0)

    def test_queue_unavailable_returns_json(self):
        with patch("training_api.TrainingStore", side_effect=RuntimeError("unavailable")):
            with self.assertLogs(app.logger, level="ERROR"):
                response = self.submit()
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json["success"])


class TrainingDataTests(unittest.TestCase):
    def test_aggregation_duplicate_times_and_holdout(self):
        frame = pd.read_csv(io.BytesIO(sample_csv()))
        doubled = pd.concat([frame, frame]).sample(frac=1, random_state=42)
        data, pollutants, interval = prepare_training(doubled, {"pollutant": "both"})
        self.assertEqual(len(data), 40)
        self.assertTrue(data.datetime.is_monotonic_increasing)
        self.assertEqual(data.s2_pm10.tolist(), data.pm10.tolist())
        summary, result, artifact = train_reference_models(data, pollutants, interval)
        self.assertEqual(summary["validation_rows"], 8)
        loaded = joblib.load(io.BytesIO(artifact))
        expected = loaded["models"]["pm2_5"].predict(build_features(data).iloc[32:]).round(2)
        np.testing.assert_array_equal(pd.read_csv(io.BytesIO(result)).calibrated_pm2_5, expected)

    def test_invalid_measurements_and_sites(self):
        original = pd.read_csv(io.BytesIO(sample_csv()))
        for field, value in (("datetime", "invalid"), ("pm2_5", -1),
                             ("reference_pm10", np.nan), ("humidity", 101)):
            frame = original.copy()
            frame.loc[0, field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                prepare_training(frame, {})
        frame = original.assign(site_id=["site-a", "site-b"] * 20)
        with self.assertRaisesRegex(ValueError, "one collocated site"):
            prepare_training(frame, {})


if __name__ == "__main__":
    unittest.main()
