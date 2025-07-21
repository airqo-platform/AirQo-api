// uptime.routes.js
const express = require("express");
const router = express.Router();
const uptime = require("@controllers/uptime.controller");
const uptimeValidations = require("@validators/uptime.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.get(
  "/status",
  uptimeValidations.getUptime,
  pagination(),
  uptime.getDeviceStatus
);

router.get(
  "/network",
  uptimeValidations.getUptime,
  pagination(),
  uptime.getNetworkUptime
);

router.get(
  "/device",
  uptimeValidations.getUptime,
  pagination(),
  uptime.getDeviceUptime
);

router.get(
  "/battery",
  uptimeValidations.getDeviceBattery,
  pagination(),
  uptime.getDeviceBattery
);

router.get(
  "/leaderboard",
  uptimeValidations.getUptime,
  pagination(),
  uptime.getDeviceUptimeLeaderboard
);

router.get("/health", pagination(), (req, res) => {
  console.info("health status OK");
  return res.status(200).json({
    message: "App status - OK.",
    success: true,
  });
});

module.exports = router;
