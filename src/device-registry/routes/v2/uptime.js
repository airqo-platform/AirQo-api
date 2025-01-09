const express = require("express");
const router = express.Router();
const uptimeController = require("@controllers/create-uptime");
const { validatePagination, headers } = require("@middleware/common");
const {
  validateTenant,
  validateUptimeQueries,
  validateDeviceBatteryQueries,
} = require("@validators/uptime.validators");

// Apply common middleware
router.use(headers);
router.use(validatePagination);

// Base routes with consistent naming and validation
router.get(
  "/status",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getDeviceStatus
);

// router.post(
//   "/status",
//   validateTenant,
//   validateUptimeBody,
//   uptimeController.createDeviceStatus
// );

router.get(
  "/network",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getNetworkUptime
);

router.get(
  "/device",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getDeviceUptime
);

router.get(
  "/battery",
  validateTenant,
  validateDeviceBatteryQueries,
  uptimeController.getDeviceBattery
);

router.get(
  "/leaderboard",
  validateTenant,
  validateUptimeQueries,
  uptimeController.getDeviceUptimeLeaderboard
);

// Health check endpoint (matching Python implementation)
router.get("/health", (req, res) => {
  console.info("health status OK");
  return res.status(200).json({
    message: "App status - OK.",
    success: true,
  });
});

module.exports = router;
