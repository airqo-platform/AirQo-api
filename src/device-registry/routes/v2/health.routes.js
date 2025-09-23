const express = require("express");
const router = express.Router();
const healthController = require("@controllers/health.controller");
const { check, getJobMetrics } = require("@validators/health.validators");
const { headers } = require("@validators/common");

router.use(headers);

router.get("/", check, healthController.check);

const isDev = process.env.NODE_ENV === "development";
if (isDev) {
  router.get("/debug/jobs", getJobMetrics, healthController.getJobMetrics);
}

module.exports = router;
