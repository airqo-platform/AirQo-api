// networks.routes.js
const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/network.controller");
const networkValidations = require("@validators/networks.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");
const {
  requirePermissions,
  requireNetworkPermissions,
} = require("@middleware/permissionAuth");
const constants = require("@config/constants");

router.use(headers);

router.put(
  "/:net_id/assign-user/:user_id",
  networkValidations.assignOneUser,
  enhancedJWTAuth,
  requireNetworkPermissions([constants.ORG_USER_ASSIGN], "net_id"),
  createNetworkController.assignOneUser
);

router.get(
  "/",
  networkValidations.list,
  enhancedJWTAuth,
  pagination(),
  // requirePermissions([constants.NETWORK_VIEW]),
  createNetworkController.list
);

router.get(
  "/summary",
  networkValidations.listSummary,
  pagination(),
  createNetworkController.listSummary
);

router.put(
  "/:net_id/set-manager/:user_id",
  networkValidations.setManager,
  enhancedJWTAuth,
  requireNetworkPermissions(
    [constants.NETWORK_MANAGEMENT, constants.USER_MANAGEMENT],
    "net_id"
  ),
  createNetworkController.setManager
);

router.get(
  "/:net_id/assigned-users",
  networkValidations.listAssignedUsers,
  enhancedJWTAuth,
  pagination(),
  requireNetworkPermissions([constants.MEMBER_VIEW], "net_id"),
  createNetworkController.listAssignedUsers
);

router.get(
  "/:net_id/available-users",
  networkValidations.listAvailableUsers,
  enhancedJWTAuth,
  pagination(),
  requireNetworkPermissions([constants.ORG_USER_ASSIGN], "net_id"),
  createNetworkController.listAvailableUsers
);

router.post(
  "/",
  networkValidations.create,
  enhancedJWTAuth,
  requirePermissions([constants.NETWORK_CREATE, constants.SYSTEM_ADMIN]),
  createNetworkController.create
);

router.post(
  "/:net_id/assign-users",
  networkValidations.assignUsers,
  enhancedJWTAuth,
  requireNetworkPermissions([constants.ORG_USER_ASSIGN], "net_id"),
  createNetworkController.assignUsers
);

router.post(
  "/find",
  networkValidations.getNetworkFromEmail,
  enhancedJWTAuth,
  createNetworkController.getNetworkFromEmail
);

router.delete(
  "/:net_id/unassign-many-users",
  networkValidations.unAssignManyUsers,
  enhancedJWTAuth,
  requireNetworkPermissions([constants.ORG_USER_ASSIGN], "net_id"),
  createNetworkController.unAssignManyUsers
);

router.delete(
  "/:net_id/unassign-user/:user_id",
  networkValidations.unAssignUser,
  enhancedJWTAuth,
  requireNetworkPermissions([constants.ORG_USER_ASSIGN], "net_id"),
  createNetworkController.unAssignUser
);

router.get(
  "/:net_id/roles",
  networkValidations.listRolesForNetwork,
  enhancedJWTAuth,
  pagination(),
  requireNetworkPermissions([constants.ROLE_VIEW], "net_id"),
  createNetworkController.listRolesForNetwork
);

router.get(
  "/:net_id",
  networkValidations.getNetworkById,
  enhancedJWTAuth,
  pagination(),
  // requireNetworkPermissions([constants.NETWORK_VIEW], "net_id"),
  createNetworkController.list
);

router.delete(
  "/:net_id",
  networkValidations.deleteNetwork,
  enhancedJWTAuth,
  requirePermissions([constants.NETWORK_DELETE, constants.SYSTEM_ADMIN]),
  createNetworkController.delete
);

router.put(
  "/:net_id",
  networkValidations.update,
  enhancedJWTAuth,
  requireNetworkPermissions([constants.NETWORK_EDIT], "net_id"),
  createNetworkController.update
);

router.patch(
  "/:net_id",
  networkValidations.refresh,
  enhancedJWTAuth,
  requireNetworkPermissions([constants.NETWORK_EDIT], "net_id"),
  createNetworkController.refresh
);

module.exports = router;
