const express = require("express");
const router = express.Router();
const createRoleController = require("@controllers/create-role");
const { check, oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

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

router.get(
  "/:role_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),

  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.list
);

router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.list
);

router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("role_code")
        .exists()
        .withMessage("role_code is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the role_code must not be empty")
        .bail()
        .trim()
        .escape()
        .customSanitizer((value) => {
          return value.replace(/ /g, "_").toUpperCase();
        }),
      body("role_name")
        .exists()
        .withMessage("role_name is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the role_name must not be empty")
        .bail()
        .trim()
        .escape()
        .customSanitizer((value) => {
          return value.replace(/ /g, "_").toUpperCase();
        }),
      body("role_status")
        .optional()
        .notEmpty()
        .withMessage("role_status must not be empty if provided")
        .bail()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage(
          "the role_status value is not among the expected ones: ACTIVE or INACTIVE"
        )
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.create
);

router.patch(
  "/:role_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
      body("role_name")
        .not()
        .exists()
        .withMessage("role_name should not exist in the request body"),
      body("role_code")
        .not()
        .exists()
        .withMessage("role_code should not exist in the request body"),
      body("role_status")
        .exists()
        .withMessage("role_status should be provided")
        .bail()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage(
          "the role_status value is not among the expected ones: ACTIVE or INACTIVE"
        )
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.update
);

router.delete(
  "/:role_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.delete
);

router.get(
  "/:role_id/users",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.listUsersWithRole
);

router.get(
  "/:role_id/available-users",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.listAvailableUsersForRole
);

router.post(
  "/:role_id/user",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("user")
        .exists()
        .withMessage("the user ID is missing in the request body")
        .bail()
        .notEmpty()
        .withMessage("the user ID cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.assignUserToRole
);

router.delete(
  "/:role_id/user/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
    oneOf([
      [
        param("role_id")
          .exists()
          .withMessage("the role ID param is missing in the request")
          .bail()
          .trim()
          .isMongoId()
          .withMessage("the role ID must be an object ID")
          .bail()
          .customSanitizer((value) => {
            return ObjectId(value);
          }),
        param("user_id")
          .exists()
          .withMessage("the user ID param is missing in the request")
          .bail()
          .trim()
          .isMongoId()
          .withMessage("the user ID must be an object ID")
          .bail()
          .customSanitizer((value) => {
            return ObjectId(value);
          }),
      ],
    ]),
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.unAssignUserFromRole
);

router.get(
  "/:role_id/permissions",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),

  setJWTAuth,
  authJWT,
  createRoleController.listPermissionsForRole
);

router.get(
  "/:role_id/available-permissions",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.listAvailablePermissionsForRole
);

router.post(
  "/:role_id/permissions",
  (req, res, next) => {
    if (!Object.keys(req.body).length) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ success: false, errors: "request body is empty" });
    }
    next();
  },
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("permissions")
        .exists()
        .withMessage("the permission ID is missing in the request body")
        .bail()
        .notEmpty()
        .withMessage("the permission_id should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the permissions should be an array"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.assignPermissionToRole
);

router.delete(
  "/:role_id/permissions/:permission_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("role_id")
        .exists()
        .withMessage("the role ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the role ID param cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("permission_id")
        .exists()
        .withMessage("the permission ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the permission ID param cannot be empty")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.unAssignPermissionFromRole
);

module.exports = router;
