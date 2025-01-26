// uptime.routes.js
const express = require("express");
const router = express.Router();
const uptime = require("@controllers/uptime.controller");
const uptimeValidations = require("@validators/uptime.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.get("/status", uptimeValidations.getUptime, uptime.getDeviceStatus);

router.get("/network", uptimeValidations.getUptime, uptime.getNetworkUptime);

router.get("/device", uptimeValidations.getUptime, uptime.getDeviceUptime);

router.get(
  "/battery",
  uptimeValidations.getDeviceBattery,
  uptime.getDeviceBattery
);

router.get(
  "/leaderboard",
  uptimeValidations.getUptime,
  uptime.getDeviceUptimeLeaderboard
);

router.get("/health", (req, res) => {
  console.info("health status OK");
  return res.status(200).json({
    message: "App status - OK.",
    success: true,
  });
});

module.exports = router;
