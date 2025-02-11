// networks.routes.js
const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/network.controller");
const networkValidations = require("@validators/networks.validators");
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
router.use(networkValidations.pagination);

router.put(
  "/:net_id/assign-user/:user_id",
  networkValidations.assignOneUser,
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
  createNetworkController.create
);

router.post(
  "/:net_id/assign-users",
  networkValidations.assignUsers,
  setJWTAuth,
  authJWT,
  createNetworkController.assignUsers
);

router.post(
  "/find",
  networkValidations.getNetworkFromEmail,
  setJWTAuth,
  authJWT,
  createNetworkController.getNetworkFromEmail
);

router.delete(
  "/:net_id/unassign-many-users",
  networkValidations.unAssignManyUsers,
  setJWTAuth,
  authJWT,
  createNetworkController.unAssignManyUsers
);

router.delete(
  "/:net_id/unassign-user/:user_id",
  networkValidations.unAssignUser,
  setJWTAuth,
  authJWT,
  createNetworkController.unAssignUser
);

router.get(
  "/:net_id/roles",
  networkValidations.listRolesForNetwork,
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
  createNetworkController.delete
);

router.put(
  "/:net_id",
  networkValidations.update,
  setJWTAuth,
  authJWT,
  createNetworkController.update
);

router.patch(
  "/:net_id",
  networkValidations.refresh,
  setJWTAuth,
  authJWT,
  createNetworkController.refresh
);

module.exports = router;
