// routes/organization-requests.routes.js
const express = require("express");
const router = express.Router();
const createOrganizationRequestController = require("@controllers/organization-request.controller");
const organizationRequestValidations = require("@validators/organization-requests.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const { validate } = require("@validators/common");
const { airqoAdminCheck } = require("@middleware/admin-access.middleware");

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

// Create organization request (public endpoint)
router.post(
  "/",
  organizationRequestValidations.create,
  validate,
  createOrganizationRequestController.create
);

// Get all organization requests (AirQo Admin only)
router.get(
  "/",
  setJWTAuth,
  authJWT,
  airqoAdminCheck,
  organizationRequestValidations.list,
  validate,
  createOrganizationRequestController.list
);

// Approve organization request (AirQo Admin only)
router.patch(
  "/:request_id/approve",
  setJWTAuth,
  authJWT,
  airqoAdminCheck,
  organizationRequestValidations.approve,
  validate,
  createOrganizationRequestController.approve
);

router.get(
  "/slug-availability/:slug",
  organizationRequestValidations.checkSlugAvailability,
  validate,
  createOrganizationRequestController.checkSlugAvailability
);

// Reject organization request (AirQo Admin only)
router.patch(
  "/:request_id/reject",
  setJWTAuth,
  authJWT,
  airqoAdminCheck,
  organizationRequestValidations.reject,
  validate,
  createOrganizationRequestController.reject
);

// Get organization request by ID (AirQo Admin only)
router.get(
  "/:request_id",
  setJWTAuth,
  authJWT,
  airqoAdminCheck,
  organizationRequestValidations.getById,
  validate,
  createOrganizationRequestController.getById
);

module.exports = router;
