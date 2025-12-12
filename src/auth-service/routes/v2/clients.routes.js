// clients.routes.js
const express = require("express");
const router = express.Router();
const createClientController = require("@controllers/client.controller");
const clientValidations = require("@validators/clients.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

router.get(
  "/",
  clientValidations.list,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createClientController.list
);

router.post(
  "/",
  clientValidations.create,
  enhancedJWTAuth,
  createClientController.create
);

router.patch(
  "/:client_id/secret",
  clientValidations.updateClientSecret,
  enhancedJWTAuth,
  createClientController.updateClientSecret
);

router.put(
  "/:client_id",
  clientValidations.update,
  enhancedJWTAuth,
  createClientController.update
);

router.post(
  "/activate/:client_id",
  clientValidations.activateClient,
  enhancedJWTAuth,
  createClientController.activateClient
);

router.get(
  "/activate-request/:client_id",
  clientValidations.activateClientRequest,
  enhancedJWTAuth,
  createClientController.activateClientRequest
);

router.delete(
  "/:client_id",
  clientValidations.deleteClient,
  enhancedJWTAuth,
  createClientController.delete
);

router.get(
  "/:client_id",
  clientValidations.getClientById,
  enhancedJWTAuth,
  createClientController.getById
);

module.exports = router;
