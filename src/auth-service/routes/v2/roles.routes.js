// roles.routes.js
const express = require("express");
const router = express.Router();
const createRoleController = require("@controllers/role.controller");
const roleValidations = require("@validators/roles.validators");
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
router.use(roleValidations.pagination);

router.get(
  "/",
  roleValidations.list,
  setJWTAuth,
  authJWT,
  createRoleController.list
);

router.get(
  "/summary",
  roleValidations.listSummary,
  setJWTAuth,
  authJWT,
  createRoleController.listSummary
);

router.post(
  "/",
  roleValidations.create,
  setJWTAuth,
  authJWT,
  createRoleController.create
);

router.put(
  "/:role_id",
  roleValidations.update,
  setJWTAuth,
  authJWT,
  createRoleController.update
);

router.delete(
  "/:role_id",
  roleValidations.deleteRole,
  setJWTAuth,
  authJWT,
  createRoleController.delete
);

router.get(
  "/:role_id/users",
  roleValidations.listUsersWithRole,
  setJWTAuth,
  authJWT,
  createRoleController.listUsersWithRole
);

router.get(
  "/:role_id/available_users",
  roleValidations.listAvailableUsersForRole,
  setJWTAuth,
  authJWT,
  createRoleController.listAvailableUsersForRole
);

router.post(
  "/:role_id/users",
  roleValidations.assignManyUsersToRole,
  setJWTAuth,
  authJWT,
  createRoleController.assignManyUsersToRole
);

router.post(
  "/:role_id/user",
  roleValidations.assignUserToRole,
  setJWTAuth,
  authJWT,
  createRoleController.assignUserToRole
);

router.put(
  "/:role_id/user/:user_id",
  roleValidations.assignUserToRolePut,
  setJWTAuth,
  authJWT,
  createRoleController.assignUserToRole
);

router.delete(
  "/:role_id/users",
  roleValidations.unAssignManyUsersFromRole,
  setJWTAuth,
  authJWT,
  createRoleController.unAssignManyUsersFromRole
);

router.delete(
  "/:role_id/user/:user_id",
  roleValidations.unAssignUserFromRole,
  setJWTAuth,
  authJWT,
  createRoleController.unAssignUserFromRole
);

router.get(
  "/:role_id/permissions",
  roleValidations.listPermissionsForRole,
  setJWTAuth,
  authJWT,
  createRoleController.listPermissionsForRole
);

router.get(
  "/:role_id/available_permissions",
  roleValidations.listAvailablePermissionsForRole,
  setJWTAuth,
  authJWT,
  createRoleController.listAvailablePermissionsForRole
);

router.post(
  "/:role_id/permissions",
  roleValidations.assignPermissionToRole,
  setJWTAuth,
  authJWT,
  createRoleController.assignPermissionToRole
);

router.delete(
  "/:role_id/permissions",
  roleValidations.unAssignManyPermissionsFromRole,
  setJWTAuth,
  authJWT,
  createRoleController.unAssignManyPermissionsFromRole
);

router.put(
  "/:role_id/permissions",
  roleValidations.updateRolePermissions,
  setJWTAuth,
  authJWT,
  createRoleController.updateRolePermissions
);

router.delete(
  "/:role_id/permissions/:permission_id",
  roleValidations.unAssignPermissionFromRole,
  setJWTAuth,
  authJWT,
  createRoleController.unAssignPermissionFromRole
);

router.get(
  "/:role_id",
  roleValidations.getRoleById,
  setJWTAuth,
  authJWT,
  createRoleController.list
);

module.exports = router;
