// routes/organization-requests.routes.js
const express = require("express");
const router = express.Router();
const createOrganizationRequestController = require("@controllers/organization-request.controller");
const organizationRequestValidations = require("@validators/organization-requests.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
router.use(organizationRequestValidations.pagination);

// Create new organization request
router.post(
  "/",
  organizationRequestValidations.create,
  createOrganizationRequestController.create
);

// Get all organization requests (AirQo Admin only)
router.get(
  "/",
  setJWTAuth,
  authJWT,
  organizationRequestValidations.list,
  createOrganizationRequestController.list
);

// Approve organization request (AirQo Admin only)
router.patch(
  "/:request_id/approve",
  setJWTAuth,
  authJWT,
  organizationRequestValidations.approve,
  createOrganizationRequestController.approve
);

// Reject organization request (AirQo Admin only)
router.patch(
  "/:request_id/reject",
  setJWTAuth,
  authJWT,
  organizationRequestValidations.reject,
  createOrganizationRequestController.reject
);

// Get organization request by ID
router.get(
  "/:request_id",
  setJWTAuth,
  authJWT,
  organizationRequestValidations.getById,
  createOrganizationRequestController.getById
);

module.exports = router;
