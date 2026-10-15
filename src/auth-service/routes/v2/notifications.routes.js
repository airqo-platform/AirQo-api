const express = require("express");
const router = express.Router();
const notificationController = require("@controllers/notification.controller");
const notificationValidations = require("@validators/notification.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { requirePermissions } = require("@middleware/permissionAuth");
const { requireGroupManagerAccess } = require("@middleware/groupNetworkAuth");
const constants = require("@config/constants");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);

// ---- Current user's own notifications ----

router.get(
  "/",
  notificationValidations.list,
  enhancedJWTAuth,
  pagination(20, 100),
  validate,
  notificationController.list,
);

router.get(
  "/unread-count",
  notificationValidations.unreadCount,
  enhancedJWTAuth,
  validate,
  notificationController.getUnreadCount,
);

router.patch(
  "/read-all",
  notificationValidations.markAllRead,
  enhancedJWTAuth,
  validate,
  notificationController.markAllRead,
);

// ---- Sending (admin) ----

router.post(
  "/groups/:grp_id",
  notificationValidations.sendToGroup,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  validate,
  notificationController.sendToGroup,
);

router.post(
  "/broadcast",
  notificationValidations.broadcast,
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  validate,
  notificationController.broadcast,
);

// ---- Single notification (keep after the static paths above) ----

router.patch(
  "/:notification_id/read",
  notificationValidations.markRead,
  enhancedJWTAuth,
  validate,
  notificationController.markRead,
);

router.delete(
  "/:notification_id",
  notificationValidations.delete,
  enhancedJWTAuth,
  validate,
  notificationController.delete,
);

module.exports = router;
