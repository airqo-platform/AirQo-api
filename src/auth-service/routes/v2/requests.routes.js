// requests.routes.js
const express = require("express");
const router = express.Router();
const createRequestController = require("@controllers/request.controller");
const requestValidations = require("@validators/requests.validators");
const { enhancedJWTAuth } = require("@middleware/passport");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(requestValidations.pagination);

router.post(
  "/groups/:grp_id",
  requestValidations.requestAccessToGroup,
  enhancedJWTAuth,
  createRequestController.requestAccessToGroup
);

router.post(
  "/emails/groups/:grp_id",
  requestValidations.requestAccessToGroupByEmail,
  enhancedJWTAuth,
  createRequestController.requestAccessToGroupByEmail
);

router.post(
  "/emails/accept",
  requestValidations.acceptInvitation,
  enhancedJWTAuth,
  createRequestController.acceptInvitation
);

router.post(
  "/networks/:net_id",
  requestValidations.requestAccessToNetwork,
  enhancedJWTAuth,
  createRequestController.requestAccessToNetwork
);

router.get(
  "/",
  requestValidations.list,
  enhancedJWTAuth,
  createRequestController.list
);

router.get(
  "/pending",
  requestValidations.listPending,
  enhancedJWTAuth,
  createRequestController.listPendingAccessRequests
);

router.post(
  "/:request_id/approve",
  requestValidations.approveAccessRequest,
  enhancedJWTAuth,
  createRequestController.approveAccessRequest
);

router.post(
  "/:request_id/reject",
  requestValidations.rejectAccessRequest,
  enhancedJWTAuth,
  createRequestController.rejectAccessRequest
);

router.get(
  "/groups",
  requestValidations.listForGroup,
  enhancedJWTAuth,
  createRequestController.listAccessRequestsForGroup
);

router.get(
  "/networks",
  requestValidations.listForNetwork,
  enhancedJWTAuth,
  createRequestController.listAccessRequestsForNetwork
);

router.delete(
  "/:request_id",
  requestValidations.deleteRequest,
  enhancedJWTAuth,
  createRequestController.delete
);

router.put(
  "/:request_id",
  requestValidations.updateRequest,
  enhancedJWTAuth,
  createRequestController.update
);

router.get(
  "/groups/:grp_id",
  requestValidations.listAccessRequestsForGroup,
  enhancedJWTAuth,
  createRequestController.listAccessRequestsForGroup
);

router.get(
  "/networks/:net_id",
  requestValidations.listAccessRequestsForNetwork,
  enhancedJWTAuth,
  createRequestController.listAccessRequestsForNetwork
);

router.get(
  "/request_id",
  requestValidations.getRequestId,
  enhancedJWTAuth,
  createRequestController.list
);

module.exports = router;
