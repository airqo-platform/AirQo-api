const express = require("express");
const router = express.Router();
const uptimeController = require("@controllers/create-uptime");
const { validatePagination, headers } = require("@middleware/common");
const {
  validateTenant,
  validateUptimeQueries,
  validateDeviceBatteryQueries,
} = require("@validators/uptime.validators");

router.use(headers);
router.use(validatePagination);

// Get device status route
router.get(
  "/status",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getDeviceStatus
);

// Get network uptime route
router.get(
  "/network",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getNetworkUptime
);

// Get device uptime route
router.get(
  "/device",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getDeviceUptime
);

// Get device battery route
router.get(
  "/battery",
  validateTenant,
  validateDeviceBatteryQueries,
  uptimeController.getDeviceBattery
);

// Get device uptime leaderboard route
router.get(
  "/leaderboard",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getDeviceUptimeLeaderboard
);

module.exports = router;
