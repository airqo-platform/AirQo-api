// networks.routes.js
const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/network.controller");
const networkValidations = require("@validators/networks.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(networkValidations.pagination);

router.put(
  "/:net_id/assign-user/:user_id",
  networkValidations.assignOneUser,
  enhancedJWTAuth,
  createNetworkController.assignOneUser
);

router.get("/", networkValidations.list, createNetworkController.list);

router.get(
  "/summary",
  networkValidations.listSummary,
  createNetworkController.listSummary
);

router.put(
  "/:net_id/set-manager/:user_id",
  networkValidations.setManager,
  enhancedJWTAuth,
  createNetworkController.setManager
);

router.get(
  "/:net_id/assigned-users",
  networkValidations.listAssignedUsers,
  createNetworkController.listAssignedUsers
);

router.get(
  "/:net_id/available-users",
  networkValidations.listAvailableUsers,
  createNetworkController.listAvailableUsers
);

router.post(
  "/",
  networkValidations.create,
  enhancedJWTAuth,
  createNetworkController.create
);

router.post(
  "/:net_id/assign-users",
  networkValidations.assignUsers,
  enhancedJWTAuth,
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
  createNetworkController.unAssignManyUsers
);

router.delete(
  "/:net_id/unassign-user/:user_id",
  networkValidations.unAssignUser,
  enhancedJWTAuth,
  createNetworkController.unAssignUser
);

router.get(
  "/:net_id/roles",
  networkValidations.listRolesForNetwork,
  enhancedJWTAuth,
  createNetworkController.listRolesForNetwork
);

router.get(
  "/:net_id",
  networkValidations.getNetworkById,
  createNetworkController.list
);

router.delete(
  "/:net_id",
  networkValidations.deleteNetwork,
  enhancedJWTAuth,
  createNetworkController.delete
);

router.put(
  "/:net_id",
  networkValidations.update,
  enhancedJWTAuth,
  createNetworkController.update
);

router.patch(
  "/:net_id",
  networkValidations.refresh,
  enhancedJWTAuth,
  createNetworkController.refresh
);

module.exports = router;
