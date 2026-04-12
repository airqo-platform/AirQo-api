// network-creation-requests.routes.js
// Mounted at /api/v2/devices/network-creation-requests
//
// Terminology note: internally these are "networks", but in all user-facing
// surfaces (emails, docs, frontend) they are called "sensor manufacturers".
//
// Workflow:
//   POST   /                          — submit a new sensor manufacturer creation request (public)
//   GET    /                          — list all requests (admin only, requires admin_secret in query)
//   GET    /:request_id               — retrieve a single request
//   PUT    /:request_id/approve       — approve the request and create the network (admin only)
//   PUT    /:request_id/deny          — deny the request (admin only)
//   PUT    /:request_id/review        — mark the request as under review (admin only)
const express = require("express");
const router = express.Router();
const networkCreationRequestController = require("@controllers/network-creation-request.controller");
const networkCreationRequestValidators = require("@validators/network-creation-request.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

// Submit a new sensor manufacturer creation request
router.post(
  "/",
  networkCreationRequestValidators.createRequest,
  networkCreationRequestController.createRequest
);

// List all requests (admin)
router.get(
  "/",
  networkCreationRequestValidators.listRequests,
  pagination(),
  networkCreationRequestController.listRequests
);

// Get a single request
router.get(
  "/:request_id",
  networkCreationRequestValidators.getRequest,
  networkCreationRequestController.getRequest
);

// Approve a request (creates the network)
router.put(
  "/:request_id/approve",
  networkCreationRequestValidators.approveRequest,
  networkCreationRequestController.approveRequest
);

// Deny a request
router.put(
  "/:request_id/deny",
  networkCreationRequestValidators.denyRequest,
  networkCreationRequestController.denyRequest
);

// Mark a request as under review
router.put(
  "/:request_id/review",
  networkCreationRequestValidators.reviewRequest,
  networkCreationRequestController.reviewRequest
);

module.exports = router;
