// groups.routes.js
const express = require("express");
const router = express.Router();
const createGroupController = require("@controllers/group.controller");
const groupValidations = require("@validators/groups.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(groupValidations.pagination);

router.delete(
  "/:grp_id",
  groupValidations.deleteGroup,
  setJWTAuth,
  authJWT,
  createGroupController.delete
);

router.put("/:grp_id", groupValidations.update, createGroupController.update);

router.get("/", groupValidations.list, createGroupController.list);

router.post(
  "/",
  groupValidations.create,
  setJWTAuth,
  authJWT,
  createGroupController.create
);

router.post(
  "/removeUniqueConstraints",
  groupValidations.removeUniqueConstraint,
  setJWTAuth,
  authJWT,
  createGroupController.removeUniqueConstraint
);

router.put(
  "/:grp_id/assign-user/:user_id",
  groupValidations.assignOneUser,
  setJWTAuth,
  authJWT,
  createGroupController.assignOneUser
);

router.get(
  "/summary",
  groupValidations.listSummary,
  createGroupController.listSummary
);

router.put(
  "/:grp_id/set-manager/:user_id",
  groupValidations.setManager,
  setJWTAuth,
  authJWT,
  createGroupController.setManager
);

router.get(
  "/:grp_id/assigned-users",
  groupValidations.listAssignedUsers,
  createGroupController.listAssignedUsers
);

router.get(
  "/:grp_id/all-users",
  groupValidations.listAllGroupUsers,
  createGroupController.listAllGroupUsers
);

router.get(
  "/:grp_id/available-users",
  groupValidations.listAvailableUsers,
  createGroupController.listAvailableUsers
);

router.post(
  "/:grp_id/assign-users",
  groupValidations.assignUsers,
  setJWTAuth,
  authJWT,
  createGroupController.assignUsers
);

router.delete(
  "/:grp_id/unassign-user/:user_id",
  groupValidations.unAssignUser,
  setJWTAuth,
  authJWT,
  createGroupController.unAssignUser
);

router.delete(
  "/:grp_id/unassign-many-users",
  groupValidations.unAssignManyUsers,
  setJWTAuth,
  authJWT,
  createGroupController.unAssignManyUsers
);

router.get(
  "/:grp_id/roles",
  groupValidations.listRolesForGroup,
  setJWTAuth,
  authJWT,
  createGroupController.listRolesForGroup
);

router.get(
  "/:grp_id",
  groupValidations.getGroupById,
  createGroupController.list
);

module.exports = router;
