const express = require("express");
const NotificationPreferenceController = require("@controllers/notification-preferences.controller");
const notificationPreferenceValidations = require("@validators/notification-preferences.validators");
const { enhancedJWTAuth } = require("@middleware/passport");

const router = express.Router();

// CORS headers middleware
const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);
router.use(notificationPreferenceValidations.pagination(20, 100));

// List Notification Preferences
router.get(
  "/list",
  notificationPreferenceValidations.listValidation, // Changed from list to listValidation
  enhancedJWTAuth,
  NotificationPreferenceController.list
);

// Create Notification Preferences
router.post(
  "/create",
  notificationPreferenceValidations.createValidation, // Changed from create to createValidation
  enhancedJWTAuth,
  NotificationPreferenceController.create
);

// Get Single Notification Preference
router.get(
  "/:preference_id",
  notificationPreferenceValidations.preferenceId, // Changed from idOperation
  enhancedJWTAuth,
  NotificationPreferenceController.getById
);

// Update Notification Preferences
router.patch(
  "/:preference_id",
  notificationPreferenceValidations.updateValidation, // Changed from update to updateValidation
  enhancedJWTAuth,
  NotificationPreferenceController.update
);

// Update Thresholds
router.put(
  "/:preference_id/thresholds",
  notificationPreferenceValidations.updateThresholdsValidation, // Changed
  enhancedJWTAuth,
  NotificationPreferenceController.updateThresholds
);

// Update Quiet Hours
router.put(
  "/:preference_id/quiet-hours",
  notificationPreferenceValidations.updateQuietHoursValidation, // Changed
  enhancedJWTAuth,
  NotificationPreferenceController.updateQuietHours
);

// Toggle Notification Type
router.patch(
  "/:preference_id/toggle-notification",
  notificationPreferenceValidations.toggleNotificationValidation, // Changed
  enhancedJWTAuth,
  NotificationPreferenceController.toggleNotificationType
);

// Delete Notification Preferences
router.delete(
  "/:preference_id",
  notificationPreferenceValidations.preferenceId, // Changed from idOperation
  enhancedJWTAuth,
  NotificationPreferenceController.delete
);

// Get User Notification History
router.get(
  "/:preference_id/history",
  notificationPreferenceValidations.historyValidation, // Changed
  enhancedJWTAuth,
  NotificationPreferenceController.getNotificationHistory
);

// Get Notification Statistics
router.get(
  "/stats",
  notificationPreferenceValidations.statsValidation, // Changed
  enhancedJWTAuth,
  NotificationPreferenceController.getNotificationStats
);

// Generate Notification Report
router.get(
  "/reports/notification-report",
  notificationPreferenceValidations.reportValidation, // Changed
  enhancedJWTAuth,
  NotificationPreferenceController.generateNotificationReport
);

// Bulk Update Notification Settings
router.post(
  "/bulk-update",
  notificationPreferenceValidations.bulkUpdateValidation, // Changed
  enhancedJWTAuth,
  NotificationPreferenceController.bulkUpdate
);

module.exports = router;
