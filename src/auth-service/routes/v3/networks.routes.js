// networks.routes.js
const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/network.controller");
const constants = require("@config/constants");
const networkValidations = require("@validators/networks.validators");
const { requirePermissions } = require("@middleware/permissionAuth");
const { enhancedJWTAuth } = require("@middleware/passport");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(networkValidations.pagination);

router.get(
  "/",
  networkValidations.list,
  enhancedJWTAuth,
  requirePermissions([constants.NETWORK_VIEW]),
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
