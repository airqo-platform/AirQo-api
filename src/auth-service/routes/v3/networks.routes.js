// networks.routes.js
const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/network.controller");
const networkValidations = require("@validators/networks.validators");
const {
  requirePermissions,
  requireNetworkPermissions,
  requireNetworkManager,
} = require("@middleware/permissionAuth");
const { enhancedJWTAuth } = require("@middleware/passport");

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
router.use(networkValidations.pagination);

router.put(
  "/:net_id/assign-user/:user_id",
  networkValidations.assignOneUser,
  enhancedJWTAuth,
  requireNetworkPermissions(["USER_MANAGEMENT"], "net_id"),
  createNetworkController.assignOneUser
);

router.get(
  "/",
  networkValidations.list,
  enhancedJWTAuth,
  requirePermissions(["NETWORK_VIEW"]),
  createNetworkController.list
);

router.get(
  "/summary",
  networkValidations.listSummary,
  enhancedJWTAuth,
  requirePermissions(["NETWORK_VIEW"]),
  createNetworkController.listSummary
);

router.put(
  "/:net_id/set-manager/:user_id",
  networkValidations.setManager,
  enhancedJWTAuth,
  requireNetworkManager("net_id"),
  createNetworkController.setManager
);

router.get(
  "/:net_id/assigned-users",
  networkValidations.listAssignedUsers,
  enhancedJWTAuth,
  requireNetworkPermissions(["USER_VIEW"], "net_id"),
  createNetworkController.listAssignedUsers
);

router.get(
  "/:net_id/available-users",
  networkValidations.listAvailableUsers,
  enhancedJWTAuth,
  requireNetworkPermissions(["USER_MANAGEMENT"], "net_id"),
  createNetworkController.listAvailableUsers
);

router.post(
  "/",
  networkValidations.create,
  enhancedJWTAuth,
  requirePermissions(["NETWORK_CREATE", "SYSTEM_ADMIN"]),
  createNetworkController.create
);

router.post(
  "/:net_id/assign-users",
  networkValidations.assignUsers,
  enhancedJWTAuth,
  requireNetworkPermissions(["USER_MANAGEMENT"], "net_id"),
  createNetworkController.assignUsers
);

router.post(
  "/find",
  networkValidations.getNetworkFromEmail,
  enhancedJWTAuth,
  requirePermissions(["NETWORK_VIEW"]),
  createNetworkController.getNetworkFromEmail
);

router.delete(
  "/:net_id/unassign-many-users",
  networkValidations.unAssignManyUsers,
  enhancedJWTAuth,
  requireNetworkPermissions(["USER_MANAGEMENT"], "net_id"),
  createNetworkController.unAssignManyUsers
);

router.delete(
  "/:net_id/unassign-user/:user_id",
  networkValidations.unAssignUser,
  enhancedJWTAuth,
  requireNetworkPermissions(["USER_MANAGEMENT"], "net_id"),
  createNetworkController.unAssignUser
);

router.get(
  "/:net_id/roles",
  networkValidations.listRolesForNetwork,
  enhancedJWTAuth,
  requireNetworkPermissions(["ROLE_VIEW"], "net_id"),
  createNetworkController.listRolesForNetwork
);

router.get(
  "/:net_id",
  networkValidations.getNetworkById,
  enhancedJWTAuth,
  requireNetworkPermissions(["NETWORK_VIEW"], "net_id"),
  createNetworkController.list
);

router.delete(
  "/:net_id",
  networkValidations.deleteNetwork,
  enhancedJWTAuth,
  requireNetworkPermissions(["NETWORK_DELETE"], "net_id"),
  createNetworkController.delete
);

router.put(
  "/:net_id",
  networkValidations.update,
  enhancedJWTAuth,
  requireNetworkPermissions(["NETWORK_EDIT"], "net_id"),
  createNetworkController.update
);

router.patch(
  "/:net_id",
  networkValidations.refresh,
  enhancedJWTAuth,
  requireNetworkPermissions(["NETWORK_EDIT"], "net_id"),
  createNetworkController.refresh
);

module.exports = router;
