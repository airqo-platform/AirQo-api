const express = require("express");
const router = express.Router();
const createGroupController = require("@controllers/create-group");
const { check, oneOf, query, body, param } = require("express-validator");

const { setJWTAuth, authJWT } = require("@middleware/passport");

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

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
router.use(validatePagination);

router.delete(
  "/:grp_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grp_id")
      .exists()
      .withMessage("the group ID parameter should be provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the group ID parameter must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.delete
);
router.put(
  "/:grp_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grp_id")
      .exists()
      .withMessage("the group ID parameter is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the group ID parameter must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("grp_description")
        .optional()
        .notEmpty()
        .withMessage("the grp_description should not be empty if provided")
        .trim(),
      body("grp_country")
        .optional()
        .notEmpty()
        .withMessage("the grp_country should not be empty if provided")
        .bail()
        .trim(),
      body("grp_timezone")
        .optional()
        .notEmpty()
        .withMessage("the grp_timezone should not be empty if provided")
        .bail()
        .trim(),
      body("grp_industry")
        .optional()
        .notEmpty()
        .withMessage("the grp_industry should not be empty if provided")
        .bail()
        .trim(),
      body("grp_image")
        .optional()
        .notEmpty()
        .withMessage("the grp_image should not be empty if provided")
        .bail()
        .trim(),
      body("grp_website")
        .optional()
        .notEmpty()
        .withMessage("the grp_website should not be empty if provided")
        .bail()
        .isURL()
        .withMessage("the grp_website must be a valid URL")
        .trim(),
      body("grp_status")
        .optional()
        .notEmpty()
        .withMessage("the grp_status should not be empty if provided")
        .bail()
        .trim()
        .toUpperCase()
        .isIn(["INACTIVE", "ACTIVE"])
        .withMessage(
          "the grp_status value is not among the expected ones, use ACTIVE or INACTIVE"
        ),
    ],
  ]),
  createGroupController.update
);
router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("grp_id")
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID IF provided")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("grp_title")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("grp_title should not be empty IF provided")
      .bail(),
    query("grp_status")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("grp_status should not be empty IF provided")
      .bail()
      .trim()
      .toUpperCase()
      .isIn(["INACTIVE", "ACTIVE"])
      .withMessage(
        "the grp_status value is not among the expected ones, use ACTIVE or INACTIVE"
      ),
  ]),
  createGroupController.list
);
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("grp_title")
        .exists()
        .withMessage("the grp_title is required")
        .bail()
        .notEmpty()
        .withMessage("the grp_title should not be empty")
        .trim(),
      body("grp_description")
        .exists()
        .withMessage("the grp_description is required")
        .bail()
        .notEmpty()
        .withMessage("the grp_description should not be empty")
        .trim(),
      body("user_id")
        .optional()
        .notEmpty()
        .withMessage("the user_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("grp_country")
        .optional()
        .notEmpty()
        .withMessage("the grp_country should not be empty if provided")
        .bail()
        .trim(),
      body("grp_image")
        .optional()
        .notEmpty()
        .withMessage("the grp_image should not be empty if provided")
        .bail()
        .trim(),
      body("grp_timezone")
        .optional()
        .notEmpty()
        .withMessage("the grp_timezone should not be empty if provided")
        .bail()
        .trim(),
      body("grp_industry")
        .optional()
        .notEmpty()
        .withMessage("the grp_industry should not be empty if provided")
        .bail()
        .trim(),
      body("grp_website")
        .optional()
        .notEmpty()
        .withMessage("the grp_website should not be empty if provided")
        .bail()
        .isURL()
        .withMessage("the grp_website must be a valid URL"),
    ],
  ]),
  createGroupController.create
);

router.post(
  "/removeUniqueConstraints",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.removeUniqueConstraint
);
router.put(
  "/:grp_id/assign-user/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grp_id")
        .exists()
        .withMessage("the group ID parameter is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the group ID parameter must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user ID parameter is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user ID parameter must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.assignOneUser
);
router.get(
  "/summary",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  createGroupController.listSummary
);
router.get(
  "/:grp_id/assigned-users",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grp_id")
      .exists()
      .withMessage("the group ID parameter is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the group ID parameter must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGroupController.listAssignedUsers
);
router.get(
  "/:grp_id/available-users",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grp_id")
      .exists()
      .withMessage("the group ID parameter is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the group ID parameter must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGroupController.listAvailableUsers
);
router.post(
  "/:grp_id/assign-users",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grp_id")
        .exists()
        .withMessage("the group ID parameter is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the group ID parameter must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("user_ids")
        .exists()
        .withMessage("the user_ids should be provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the user_ids should be an array")
        .bail()
        .notEmpty()
        .withMessage("the user_ids should not be empty"),
      body("user_ids.*")
        .isMongoId()
        .withMessage("user_id provided must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.assignUsers
);
router.delete(
  "/:grp_id/unassign-user/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grp_id")
        .exists()
        .withMessage("the network ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the network ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("user ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.unAssignUser
);
router.delete(
  "/:grp_id/unassign-many-users",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grp_id")
        .exists()
        .withMessage("the network ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the network ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("user_ids")
        .exists()
        .withMessage("the user_ids should be provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the user_ids should be an array")
        .bail()
        .notEmpty()
        .withMessage("the user_ids should not be empty"),
      body("user_ids.*")
        .isMongoId()
        .withMessage("user_id provided must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.unAssignManyUsers
);
router.get(
  "/:grp_id/roles",
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
      param("grp_id")
        .exists()
        .withMessage("the group ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the group ID param cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the group ID provided must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.listRolesForGroup
);
router.get(
  "/:grp_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grp_id")
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGroupController.list
);

module.exports = router;
