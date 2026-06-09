// clients.routes.js
const express = require("express");
const router = express.Router();
const createClientController = require("@controllers/client.controller");
const clientValidations = require("@validators/clients.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");
const { requireSystemAdmin } = require("@middleware/adminAccess");

router.use(headers); // Keep headers global

const requireAirQoSuperAdmin = requireSystemAdmin();

router.get(
  "/",
  clientValidations.list,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  pagination(),
  createClientController.list
);

router.post(
  "/",
  clientValidations.create,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  createClientController.create
);

router.patch(
  "/:client_id/secret",
  clientValidations.updateClientSecret,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  createClientController.updateClientSecret
);

router.put(
  "/:client_id",
  clientValidations.update,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  createClientController.update
);

router.post(
  "/activate/:client_id",
  clientValidations.activateClient,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  createClientController.activateClient
);

router.get(
  "/activate-request/:client_id",
  clientValidations.activateClientRequest,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  createClientController.activateClientRequest
);

router.delete(
  "/:client_id",
  clientValidations.deleteClient,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  createClientController.delete
);

router.get(
  "/:client_id",
  clientValidations.getClientById,
  enhancedJWTAuth,
  requireAirQoSuperAdmin,
  createClientController.getById
);

module.exports = router;
