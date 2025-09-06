// permissions.routes.js
const express = require("express");
const router = express.Router();
const createPermissionController = require("@controllers/permission.controller");
const permissionValidations = require("@validators/permissions.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(permissionValidations.pagination);

router.get(
  "/",
  permissionValidations.list,
  enhancedJWTAuth,
  createPermissionController.list
);

router.post(
  "/",
  permissionValidations.create,
  enhancedJWTAuth,
  createPermissionController.create
);

router.put(
  "/:permission_id",
  permissionValidations.update,
  enhancedJWTAuth,
  createPermissionController.update
);

router.delete(
  "/:permission_id",
  permissionValidations.deletePermission,
  enhancedJWTAuth,
  createPermissionController.delete
);

router.get(
  "/:permission_id",
  permissionValidations.getById,
  enhancedJWTAuth,
  createPermissionController.list
);

module.exports = router;
