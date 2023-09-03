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
      .withMessage(
        "the record's identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("grp_id must be an object ID")
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
      .withMessage("the grp_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("grp_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("grp_title")
        .optional()
        .notEmpty()
        .withMessage("the grp_title should not be empty if provided")
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
          "the grp_status value is not among the expected ones: INACTIVE or ACTIVE"
        ),
      body("grp_tasks")
        .optional()
        .notEmpty()
        .withMessage("the grp_tasks should not be empty if provided")
        .bail()
        .isNumeric()
        .withMessage("the grp_tasks should be a number")
        .trim(),
      body("grp_network")
        .optional()
        .notEmpty()
        .withMessage("the grp_network should not be empty if provided")
        .bail()
        .isMongoId()
        .withMessage("the group_network must be an Object ID")
        .customSanitizer((value) => {
          return ObjectId(value);
        })
        .trim(),
      body("grp_description")
        .optional()
        .notEmpty()
        .withMessage("the grp_description should not be empty")
        .trim(),
      body("grp_users")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the grp_users should be an array")
        .bail()
        .notEmpty()
        .withMessage("the grp_users should not be empty"),
      body("grp_users.*")
        .optional()
        .isMongoId()
        .withMessage("each group user should be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.update
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
        .withMessage("the grp_id param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grp_id must be an object ID")
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
  createGroupController.update
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
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGroupController.listUsersWithGroup
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
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGroupController.listAvailableUsersForGroup
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
        .withMessage("the grp_title must be provided")
        .bail()
        .notEmpty()
        .withMessage("the grp_title should not be empty")
        .trim(),
      body("grp_network_id")
        .exists()
        .withMessage("the grp_network_id must be provided")
        .bail()
        .notEmpty()
        .withMessage("the grp_network_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("the group_network_id must be an Object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        })
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
          "the grp_status value is not among the expected ones: INACTIVE or ACTIVE"
        ),
      body("grp_tasks")
        .optional()
        .notEmpty()
        .withMessage("the grp_tasks should not be empty if provided")
        .bail()
        .isNumeric()
        .withMessage("the grp_tasks should be a number")
        .trim(),
      body("grp_description")
        .exists()
        .withMessage("the grp_description is required")
        .bail()
        .notEmpty()
        .withMessage("the grp_description should not be empty")
        .trim(),
      body("grp_users")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the grp_users should be an array")
        .bail()
        .notEmpty()
        .withMessage("the grp_users should not be empty"),
      body("grp_users.*")
        .optional()
        .isMongoId()
        .withMessage("each group user should be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createGroupController.create
);

router.post(
  "/:grp_id/assign-user",
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
        .withMessage("the grp_id param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grp_id must be an object ID")
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
  createGroupController.update
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
        .withMessage("the grp_id is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grp_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user_id is missing in the request")
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
  createGroupController.list
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
