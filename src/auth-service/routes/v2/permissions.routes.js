// permissions.routes.js
const express = require("express");
const router = express.Router();
const createPermissionController = require("@controllers/permission.controller");
const permissionValidations = require("@validators/permissions.validators");
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
router.use(permissionValidations.pagination);

router.get(
  "/",
  permissionValidations.list,
  setJWTAuth,
  authJWT,
  createPermissionController.list
);

router.post(
  "/",
  permissionValidations.create,
  setJWTAuth,
  authJWT,
  createPermissionController.create
);

router.put(
  "/:permission_id",
  permissionValidations.update,
  setJWTAuth,
  authJWT,
  createPermissionController.update
);

router.delete(
  "/:permission_id",
  permissionValidations.deletePermission,
  setJWTAuth,
  authJWT,
  createPermissionController.delete
);

router.get(
  "/:permission_id",
  permissionValidations.getById,
  setJWTAuth,
  authJWT,
  createPermissionController.list
);

module.exports = router;
