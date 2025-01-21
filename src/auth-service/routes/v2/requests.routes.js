// requests.routes.js
const express = require("express");
const router = express.Router();
const createRequestController = require("@controllers/request.controller");
const requestValidations = require("@validators/requests.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
  setJWTAuth,
  authJWT,
  createRequestController.requestAccessToGroup
);

router.post(
  "/emails/groups/:grp_id",
  requestValidations.requestAccessToGroupByEmail,
  setJWTAuth,
  authJWT,
  createRequestController.requestAccessToGroupByEmail
);

router.post(
  "/emails/accept",
  requestValidations.acceptInvitation,
  setJWTAuth,
  authJWT,
  createRequestController.acceptInvitation
);

router.post(
  "/networks/:net_id",
  requestValidations.requestAccessToNetwork,
  setJWTAuth,
  authJWT,
  createRequestController.requestAccessToNetwork
);

router.get(
  "/",
  requestValidations.list,
  setJWTAuth,
  authJWT,
  createRequestController.list
);

router.get(
  "/pending",
  requestValidations.listPending,
  setJWTAuth,
  authJWT,
  createRequestController.listPendingAccessRequests
);

router.post(
  "/:request_id/approve",
  requestValidations.approveAccessRequest,
  setJWTAuth,
  authJWT,
  createRequestController.approveAccessRequest
);

router.post(
  "/:request_id/reject",
  requestValidations.rejectAccessRequest,
  setJWTAuth,
  authJWT,
  createRequestController.rejectAccessRequest
);

router.get(
  "/groups",
  requestValidations.listForGroup,
  setJWTAuth,
  authJWT,
  createRequestController.listAccessRequestsForGroup
);

router.get(
  "/networks",
  requestValidations.listForNetwork,
  setJWTAuth,
  authJWT,
  createRequestController.listAccessRequestsForNetwork
);

router.delete(
  "/:request_id",
  requestValidations.deleteRequest,
  setJWTAuth,
  authJWT,
  createRequestController.delete
);

router.put(
  "/:request_id",
  requestValidations.updateRequest,
  setJWTAuth,
  authJWT,
  createRequestController.update
);

router.get(
  "/groups/:grp_id",
  requestValidations.listAccessRequestsForGroup,
  setJWTAuth,
  authJWT,
  createRequestController.listAccessRequestsForGroup
);

router.get(
  "/networks/:net_id",
  requestValidations.listAccessRequestsForNetwork,
  setJWTAuth,
  authJWT,
  createRequestController.listAccessRequestsForNetwork
);

router.get(
  "/request_id",
  requestValidations.getRequestId,
  setJWTAuth,
  authJWT,
  createRequestController.list
);

module.exports = router;
