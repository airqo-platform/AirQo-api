// requests.routes.js
const express = require("express");
const router = express.Router();
const createRequestController = require("@controllers/request.controller");
const requestValidations = require("@validators/requests.validators");
const { enhancedJWTAuth, optionalJWTAuth } = require("@middleware/passport");
const { requirePermissions } = require("@middleware/permissionAuth");
const constants = require("@config/constants");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);

router.post(
  "/groups/:grp_id",
  requestValidations.requestAccessToGroup,
  enhancedJWTAuth,
  createRequestController.requestAccessToGroup,
);

router.post(
  "/emails/groups/:grp_id",
  requestValidations.requestAccessToGroupByEmail,
  enhancedJWTAuth,
  createRequestController.requestAccessToGroupByEmail,
);

router.post(
  "/emails/accept",
  requestValidations.acceptInvitation,
  optionalJWTAuth,
  createRequestController.acceptInvitation,
);

router.post(
  "/networks/:net_id",
  requestValidations.requestAccessToNetwork,
  enhancedJWTAuth,
  createRequestController.requestAccessToNetwork,
);

router.get(
  "/",
  requestValidations.list,
  enhancedJWTAuth,
  pagination(),
  createRequestController.list,
);

router.get(
  "/pending",
  requestValidations.listPending,
  enhancedJWTAuth,
  pagination(),
  createRequestController.listPendingAccessRequests,
);

router.post(
  "/:request_id/approve",
  requestValidations.approveAccessRequest,
  enhancedJWTAuth,
  createRequestController.approveAccessRequest,
);

router.post(
  "/:request_id/reject",
  requestValidations.rejectAccessRequest,
  enhancedJWTAuth,
  createRequestController.rejectAccessRequest,
);

router.get(
  "/groups",
  requestValidations.listForGroup,
  enhancedJWTAuth,
  pagination(),
  createRequestController.listAccessRequestsForGroup,
);

router.get(
  "/pending/user",
  enhancedJWTAuth,
  createRequestController.listPendingInvitationsForUser,
);

router.post(
  "/pending/:request_id/accept",
  requestValidations.approveAccessRequest,
  enhancedJWTAuth,
  createRequestController.acceptPendingInvitation,
);

router.post(
  "/pending/:request_id/reject",
  requestValidations.rejectAccessRequest,
  enhancedJWTAuth,
  createRequestController.rejectPendingInvitation,
);

router.get(
  "/networks",
  requestValidations.list,
  requestValidations.listForNetwork,
  enhancedJWTAuth,
  pagination(),
  createRequestController.listAccessRequestsForNetwork,
);

router.delete(
  "/expired",
  requestValidations.cleanupExpired,
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  createRequestController.cleanupExpiredRequests,
);

router.delete(
  "/:request_id",
  requestValidations.deleteRequest,
  enhancedJWTAuth,
  createRequestController.delete,
);

router.put(
  "/:request_id",
  requestValidations.updateRequest,
  enhancedJWTAuth,
  createRequestController.update,
);

router.get(
  "/groups/:grp_id",
  requestValidations.listAccessRequestsForGroup,
  enhancedJWTAuth,
  pagination(),
  createRequestController.listAccessRequestsForGroup,
);

router.get(
  "/networks/:net_id",
  requestValidations.listAccessRequestsForNetwork,
  enhancedJWTAuth,
  pagination(),
  createRequestController.listAccessRequestsForNetwork,
);

router.get(
  "/request_id",
  requestValidations.getRequestId,
  enhancedJWTAuth,
  createRequestController.list,
);

module.exports = router;
