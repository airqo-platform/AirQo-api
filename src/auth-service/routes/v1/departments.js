const express = require("express");
const router = express.Router();
const createDepartmentController = require("@controllers/create-department");
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
  "/:dep_id",
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
    param("dep_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the dep_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("dep_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createDepartmentController.delete
);

router.put(
  "/:dep_id",
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
    param("dep_id")
      .exists()
      .withMessage("the net_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("dep_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("dep_network_id")
        .optional()
        .notEmpty()
        .withMessage("the dep_network_id should not be empty if provided")
        .bail()
        .isMongoId()
        .withMessage("the dep_network_id should be an Object ID")
        .trim(),
      body("dep_title")
        .optional()
        .notEmpty()
        .withMessage("the dep_title should not be empty if provided")
        .trim(),
      body("dep_description")
        .optional()
        .notEmpty()
        .withMessage("the dep_description should not be empty if provided")
        .trim(),
      body("dep_manager_username")
        .optional()
        .notEmpty()
        .withMessage("the dep_manager_username should not be empty if provided")
        .trim(),
      body("dep_manager_firstname")
        .optional()
        .notEmpty()
        .withMessage(
          "the dep_manager_firstname should not be empty if provided"
        )
        .trim(),
      body("dep_manager_lastname")
        .optional()
        .notEmpty()
        .withMessage("the dep_manager_lastname should not be empty if provided")
        .trim(),
      body("has_children")
        .optional()
        .notEmpty()
        .withMessage("has_children should not be empty if provided")
        .trim(),
      body("dep_last")
        .optional()
        .notEmpty()
        .withMessage("dep_last should not be empty if provided")
        .bail()
        .isNumeric()
        .withMessage("the dep_last should be a number")
        .trim(),
      body("dep_parent")
        .optional()
        .notEmpty()
        .withMessage("the dep_parent should not be empty if provided")
        .bail()
        .isMongoId()
        .withMessage("the dep_parent is not a valid Object ID")
        .trim(),
      body("dep_status")
        .optional()
        .notEmpty()
        .withMessage("the dep_status should not be empty if provided")
        .bail()
        .toUpperCase()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage(
          "the dep_status value is not among the expected ones which include: ACTIVE, INACTIVE"
        )
        .trim(),
      body("dep_manager")
        .optional()
        .notEmpty()
        .withMessage("the dep_manager should not be empty if provided")
        .bail()
        .isMongoId()
        .withMessage("the dep_manager must be an Object ID")
        .trim(),
      body("dep_users")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the dep_users should be an array")
        .bail()
        .notEmpty()
        .withMessage("the dep_users should not be empty"),
      body("dep_users.*")
        .optional()
        .isMongoId()
        .withMessage("each dep_user should be an object ID"),
      body("dep_children")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the dep_children should be an array")
        .bail()
        .notEmpty()
        .withMessage("the dep_children should not be empty"),
      body("dep_children.*")
        .optional()
        .isMongoId()
        .withMessage("each dep_child should be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createDepartmentController.update
);

router.put(
  "/:dep_id/assign-user/:user_id",
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
      param("dep_id")
        .exists()
        .withMessage("the dep_id param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the dep_id param must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user_id param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createDepartmentController.update
);

router.put(
  "/:dep_id/set-manager/:user_id",
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
      param("dep_id")
        .exists()
        .withMessage("the dep_id param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the dep_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user_id param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createDepartmentController.update
);

router.get(
  "/:dep_id/available-users",
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
    param("dep_id")
      .optional()
      .isMongoId()
      .withMessage("dep_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createDepartmentController.listAvailableUsersForDepartment
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
      body("dep_network_id")
        .exists()
        .withMessage("the dep_network_id is required")
        .bail()
        .notEmpty()
        .withMessage("the dep_network_id should not be empty if provided")
        .bail()
        .isMongoId()
        .withMessage("the dep_network_id should be an Object ID")
        .trim(),
      body("dep_title")
        .exists()
        .withMessage("the dep_title is required")
        .bail()
        .notEmpty()
        .withMessage("the dep_title should not be empty if provided")
        .trim(),
      body("dep_description")
        .exists()
        .withMessage("the dep_description is required")
        .bail()
        .notEmpty()
        .withMessage("the dep_description should not be empty if provided")
        .trim(),
      body("dep_manager_username")
        .optional()
        .notEmpty()
        .withMessage("the dep_manager_username should not be empty if provided")
        .trim(),
      body("dep_manager_firstname")
        .optional()
        .notEmpty()
        .withMessage(
          "the dep_manager_firstname should not be empty if provided"
        )
        .trim(),
      body("dep_manager_lastname")
        .optional()
        .notEmpty()
        .withMessage("the dep_manager_lastname should not be empty if provided")
        .trim(),
      body("has_children")
        .optional()
        .notEmpty()
        .withMessage("has_children should not be empty if provided")
        .trim(),
      body("dep_last")
        .optional()
        .notEmpty()
        .withMessage("dep_last should not be empty if provided")
        .bail()
        .isNumeric()
        .withMessage("the dep_last should be a number")
        .trim(),
      body("dep_parent")
        .optional()
        .notEmpty()
        .withMessage("the dep_parent should not be empty if provided")
        .bail()
        .isMongoId()
        .withMessage("the dep_parent is not a valid Object ID")
        .trim(),
      body("dep_status")
        .optional()
        .notEmpty()
        .withMessage("the dep_status should not be empty if provided")
        .bail()
        .toUpperCase()
        .isIn(["ACTIVE", "INACTIVE"])
        .withMessage(
          "the dep_status value is not among the expected ones which include: ACTIVE, INACTIVE"
        )
        .trim(),
      body("dep_manager")
        .optional()
        .notEmpty()
        .withMessage("the dep_manager should not be empty if provided")
        .bail()
        .isMongoId()
        .withMessage("the dep_manager must be an Object ID")
        .trim(),
      body("dep_users")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the dep_users should be an array")
        .bail()
        .notEmpty()
        .withMessage("the dep_users should not be empty"),
      body("dep_users.*")
        .optional()
        .isMongoId()
        .withMessage("each dep_user should be an object ID"),
      body("dep_children")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the dep_children should be an array")
        .bail()
        .notEmpty()
        .withMessage("the dep_children should not be empty"),
      body("dep_children.*")
        .optional()
        .isMongoId()
        .withMessage("each dep_child should be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createDepartmentController.create
);

router.post(
  "/:dep_id/assign-user",
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
      param("dep_id")
        .exists()
        .withMessage("the dep_id param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the dep_id must be an object ID")
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
  createDepartmentController.update
);

router.delete(
  "/:dep_id/unassign-user/:user_id",
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
      param("dep_id")
        .exists()
        .withMessage("the dep_id is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the dep_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user_id is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createDepartmentController.update
);

router.get(
  "/:dep_id/assigned-users",
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
    param("dep_id")
      .optional()
      .isMongoId()
      .withMessage("dep_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createDepartmentController.listUsersWithDepartment
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
  createDepartmentController.list
);

router.get(
  "/:dep_id",
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
    param("dep_id")
      .optional()
      .isMongoId()
      .withMessage("dep_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createDepartmentController.list
);

module.exports = router;
