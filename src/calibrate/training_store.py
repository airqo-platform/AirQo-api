"""Shared, durable training queue and temporary GridFS artifacts."""

import io
import os
import uuid
from datetime import datetime, timedelta, timezone

import gridfs
from pymongo import ASCENDING, MongoClient, ReturnDocument

LEASE_SECONDS = 120
MAX_ATTEMPTS = 3


def utcnow():
    return datetime.now(timezone.utc)


class TrainingStore:
    def __init__(self, database=None):
        self.client = None
        if database is None:
            uri = os.getenv("MONGO_URI")
            if not uri:
                raise RuntimeError("MONGO_URI is required for training jobs")
            # Construct after the Gunicorn fork, not at module import time.
            self.client = MongoClient(uri, serverSelectionTimeoutMS=5000, socketTimeoutMS=30000)
            database = self.client[os.getenv("CALIBRATION_JOB_DATABASE", "calibration_jobs")]
        self.db = database
        self.jobs = database["training_jobs"]
        self.files = gridfs.GridFS(database, collection="training_files")
        try:
            self.jobs.create_index([("status", ASCENDING), ("created_at", ASCENDING)])
            self.jobs.create_index("expires_at")  # Cleanup also deletes associated GridFS files.
            self.jobs.create_index([("owner_id", ASCENDING), ("created_at", ASCENDING)])
            self.db.training_files.files.create_index("metadata.job_id")
        except Exception:
            self.close()
            raise

    def close(self):
        if self.client is not None:
            self.client.close()

    def submit(self, owner_id, stream, options):
        job_id = str(uuid.uuid4())
        now = utcnow()
        retention = max(1, int(os.getenv("CALIBRATION_JOB_RETENTION_HOURS", "24")))
        document = {
            "_id": job_id, "owner_id": owner_id, "status": "uploading", "options": options,
            "created_at": now, "expires_at": now + timedelta(hours=retention), "attempts": 0,
        }
        self.jobs.insert_one(document)
        try:
            file_id = self.files.put(stream, filename="input.csv", metadata={"job_id": job_id})
            self.jobs.update_one({"_id": job_id}, {"$set": {"input_id": file_id, "status": "queued"}})
        except Exception:
            self.delete_files(job_id)
            self.jobs.delete_one({"_id": job_id})
            raise
        return document

    def owned_job(self, job_id, owner_id):
        return self.jobs.find_one({"_id": job_id, "owner_id": owner_id, "expires_at": {"$gt": utcnow()}})

    def claim(self):
        now = utcnow()
        return self.jobs.find_one_and_update(
            {"expires_at": {"$gt": now}, "attempts": {"$lt": MAX_ATTEMPTS}, "$or": [
                {"status": "queued"}, {"status": "running", "lease_until": {"$lt": now}},
            ]},
            {"$set": {"status": "running", "lease_token": str(uuid.uuid4()),
                       "lease_until": now + timedelta(seconds=LEASE_SECONDS), "started_at": now},
             "$inc": {"attempts": 1}},
            sort=[("created_at", ASCENDING)], return_document=ReturnDocument.AFTER,
        )

    def lease_filter(self, job):
        now = utcnow()
        return {"_id": job["_id"], "status": "running", "lease_token": job["lease_token"],
                "lease_until": {"$gt": now}, "expires_at": {"$gt": now}}

    def heartbeat(self, job):
        return self.jobs.update_one(self.lease_filter(job), {"$set": {
            "lease_until": utcnow() + timedelta(seconds=LEASE_SECONDS)}}).matched_count == 1

    def complete(self, job, summary, result, artifact):
        ids = []
        try:
            for name, content in (("validation.csv", result), ("model.joblib", artifact)):
                ids.append(self.files.put(io.BytesIO(content), filename=name,
                                          metadata={"job_id": job["_id"]}))
            changed = self.jobs.update_one(self.lease_filter(job), {"$set": {
                "status": "completed", "completed_at": utcnow(), "summary": summary,
                "result_id": ids[0], "model_id": ids[1]}, "$unset": {"input_id": ""}})
            if changed.matched_count != 1:
                raise RuntimeError("Training job lease expired")
        except Exception:
            for file_id in ids:
                self.files.delete(file_id)
            raise
        self.files.delete(job["input_id"])

    def fail(self, job, message):
        changed = self.jobs.update_one(self.lease_filter(job), {"$set": {
            "status": "failed", "message": message, "completed_at": utcnow()},
            "$unset": {"input_id": ""}})
        if changed.matched_count:
            self.files.delete(job["input_id"])

    def delete_files(self, job_id):
        for item in self.db.training_files.files.find({"metadata.job_id": job_id}, {"_id": 1}):
            self.files.delete(item["_id"])

    def cleanup(self):
        now = utcnow()
        # Workers that repeatedly crash cannot keep jobs running forever.
        exhausted = self.jobs.find({"status": "running", "attempts": {"$gte": MAX_ATTEMPTS},
                                    "lease_until": {"$lt": now}})
        for job in exhausted:
            changed = self.jobs.update_one(
                {"_id": job["_id"], "lease_token": job["lease_token"], "lease_until": {"$lt": now}},
                {"$set": {"status": "failed", "message": "Worker retry limit exceeded."},
                 "$unset": {"input_id": ""}})
            if changed.matched_count:
                self.delete_files(job["_id"])
        for job in self.jobs.find({"expires_at": {"$lte": now}}):
            self.delete_files(job["_id"])
            self.jobs.delete_one({"_id": job["_id"]})
