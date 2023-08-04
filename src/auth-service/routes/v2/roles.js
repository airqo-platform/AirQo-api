const express = require("express");
const router = express.Router();
const createRoleController = require("@controllers/create-role");
const { check, oneOf, query, body, param } = require("express-validator");

const { setJWTAuth, authJWT } = require("@middleware/passport");

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
      query("network_id")
        .optional()
        .notEmpty()
        .withMessage("network_id must not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("network_id must be an object ID")
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
  "/summary",
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
  createRoleController.listSummary
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
        .optional()
        .notEmpty()
        .withMessage("role_code should not be empty IF provided")
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
      body("role_permission")
        .optional()
        .notEmpty()
        .withMessage("role_permission must not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role_permission must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("network_id")
        .exists()
        .withMessage("network_id must be provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("network_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.create
);

router.put(
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
      body("role_status")
        .optional()
        .notEmpty()
        .withMessage("the role_status should not be empty if provided")
        .bail()
        .toUpperCase()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage(
          "the status value is not among the expected ones which include: ACTIVE, INACTIVE"
        )
        .trim(),
      body("role_name")
        .not()
        .isEmpty()
        .withMessage("the role_name should not be provided when updating")
        .trim(),
      body("role_code")
        .not()
        .isEmpty()
        .withMessage("the role_code should not be provided when updating")
        .trim(),
      body("network_id")
        .optional()
        .notEmpty()
        .withMessage("network_id must not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("network_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("role_permission")
        .optional()
        .notEmpty()
        .withMessage("role_permission must not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the role_permission must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
  "/:role_id/available_users",
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
      body("user_ids")
        .exists()
        .withMessage("the user_ids are missing in the request body")
        .bail()
        .notEmpty()
        .withMessage("the user_ids should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the user_ids should be an array"),
      body("user_ids.*")
        .isMongoId()
        .withMessage("user_id provided must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.assignManyUsersToRole
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

router.put(
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
  createRoleController.assignUserToRole
);

router.delete(
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
        body("user_ids")
          .exists()
          .withMessage("the user_ids are missing in the request body")
          .bail()
          .notEmpty()
          .withMessage("the user_ids should not be empty")
          .bail()
          .custom((value) => {
            return Array.isArray(value);
          })
          .withMessage("the user_ids should be an array"),
        body("user_ids.*")
          .isMongoId()
          .withMessage("user_id provided must be an object ID"),
      ],
    ]),
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.unAssignManyUsersFromRole
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
  "/:role_id/available_permissions",
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
        .withMessage("the permissions is missing in the request body")
        .bail()
        .notEmpty()
        .withMessage("the permissions should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the permissions should be an array"),
      body("permissions.*")
        .isMongoId()
        .withMessage("the permission provided must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.assignPermissionToRole
);

router.delete(
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
      body("permission_ids")
        .exists()
        .withMessage("the permission_ids are missing in the request body")
        .bail()
        .notEmpty()
        .withMessage("the permission_ids should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the permission_ids should be an array"),
      body("permission_ids.*")
        .isMongoId()
        .withMessage("Every permission_id provided must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.unAssignManyPermissionsFromRole
);

router.put(
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
      body("permission_ids")
        .exists()
        .withMessage("the permission_ids are missing in the request body")
        .bail()
        .notEmpty()
        .withMessage("the permission_ids should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the permission_ids should be an array"),
      body("permission_ids.*")
        .isMongoId()
        .withMessage("Every permission_id provided must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.updateRolePermissions
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
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the permission ID must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRoleController.unAssignPermissionFromRole
);

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

module.exports = router;
