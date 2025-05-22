// groups.routes.js
const express = require("express");
const router = express.Router();
const groupController = require("@controllers/group.controller");
const groupValidations = require("@validators/groups.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const { adminCheck } = require("@middleware/admin-access.middleware");

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
  groupController.delete
);

router.put("/:grp_id", groupValidations.update, groupController.update);

router.get("/", groupValidations.list, groupController.list);

router.post(
  "/",
  groupValidations.create,
  setJWTAuth,
  authJWT,
  groupController.create
);

router.get(
  "/:groupSlug/dashboard",
  setJWTAuth,
  authJWT,
  adminCheck,
  groupController.getDashboard
);

router.get(
  "/:groupSlug/members",
  setJWTAuth,
  authJWT,
  adminCheck,
  groupController.getMembers
);

router.get(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  adminCheck,
  groupController.getSettings
);

// Update group settings
router.put(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  adminCheck,
  groupController.updateSettings
);

router.post(
  "/removeUniqueConstraints",
  groupValidations.removeUniqueConstraint,
  setJWTAuth,
  authJWT,
  groupController.removeUniqueConstraint
);

router.put(
  "/:grp_id/assign-user/:user_id",
  groupValidations.assignOneUser,
  setJWTAuth,
  authJWT,
  groupController.assignOneUser
);

router.get(
  "/summary",
  groupValidations.listSummary,
  groupController.listSummary
);

router.put(
  "/:grp_id/set-manager/:user_id",
  groupValidations.setManager,
  setJWTAuth,
  authJWT,
  groupController.setManager
);

router.get(
  "/:grp_id/assigned-users",
  groupValidations.listAssignedUsers,
  groupController.listAssignedUsers
);

router.get(
  "/:grp_id/all-users",
  groupValidations.listAllGroupUsers,
  groupController.listAllGroupUsers
);

router.get(
  "/:grp_id/available-users",
  groupValidations.listAvailableUsers,
  groupController.listAvailableUsers
);

router.post(
  "/:grp_id/assign-users",
  groupValidations.assignUsers,
  setJWTAuth,
  authJWT,
  groupController.assignUsers
);

router.delete(
  "/:grp_id/unassign-user/:user_id",
  groupValidations.unAssignUser,
  setJWTAuth,
  authJWT,
  groupController.unAssignUser
);

router.delete(
  "/:grp_id/unassign-many-users",
  groupValidations.unAssignManyUsers,
  setJWTAuth,
  authJWT,
  groupController.unAssignManyUsers
);

router.get(
  "/:grp_id/roles",
  groupValidations.listRolesForGroup,
  setJWTAuth,
  authJWT,
  groupController.listRolesForGroup
);

router.get("/:grp_id", groupValidations.getGroupById, groupController.list);

module.exports = router;
