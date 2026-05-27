// networks.routes.js
const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/network.controller");
const networkValidations = require("@validators/networks.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { headers, pagination } = require("@validators/common");
const { requirePermissions } = require("@middleware/permissionAuth");
const constants = require("@config/constants");

router.use(headers);

router.get(
  "/",
  networkValidations.list,
  pagination(),
  createNetworkController.list
);

router.post(
  "/",
  networkValidations.create,
  enhancedJWTAuth,
  requirePermissions([constants.NETWORK_CREATE, constants.SYSTEM_ADMIN]),
  createNetworkController.create
);

module.exports = router;
