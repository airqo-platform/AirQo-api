"use strict";
/**
 * Device Bulk Update Jobs API
 *
 * Base path (mounted at): /api/v2/devices/bulk-update-jobs
 *
 * POST   /                  — create a new job (persists to DB, job runner picks it up)
 * GET    /                  — list all jobs with pagination + status filter
 * GET    /:jobId             — get a single job with live progress %
 * PUT    /:jobId             — patch job settings (pause / resume / cancel / batchSize)
 * DELETE /:jobId             — delete a non-running job
 * POST   /:jobId/trigger     — immediately queue a pending/paused job for execution
 *
 * All write operations require token auth (nginx passes them through only with a
 * valid ?token= query param — see k8s/nginx global-config.yaml).
 */
const express = require("express");
const router = express.Router();

const controller = require("@controllers/device-bulk-update-job.controller");
const validators = require("@validators/device-bulk-update-job.validators");

// Collection routes — exact match, evaluated first
router
  .route("/")
  .post(validators.createBulkUpdateJob, controller.createBulkUpdateJob)
  .get(validators.listBulkUpdateJobs, controller.listBulkUpdateJobs);

// Sub-resource action — MUST be before /:jobId so Express does not
// swallow "trigger" as a jobId value on POST requests.
router.post(
  "/:jobId/trigger",
  validators.triggerBulkUpdateJob,
  controller.triggerBulkUpdateJob
);

// Parameterized single-job routes — last, as they match any single segment
router
  .route("/:jobId")
  .get(validators.getBulkUpdateJob, controller.getBulkUpdateJob)
  .put(validators.updateBulkUpdateJob, controller.updateBulkUpdateJob)
  .delete(validators.deleteBulkUpdateJob, controller.deleteBulkUpdateJob);

module.exports = router;
