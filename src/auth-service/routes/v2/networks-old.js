const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/create-network");
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
  "/:net_id",
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
    param("net_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createNetworkController.delete
);

router.put(
  "/:net_id",
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
    param("net_id")
      .exists()
      .withMessage("the net_ids is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("net_email")
        .optional()
        .notEmpty()
        .withMessage("the email should not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("net_website")
        .optional()
        .notEmpty()
        .withMessage("the net_website should not be empty if provided")
        .bail()
        .isURL()
        .withMessage("the net_website is not a valid URL")
        .trim(),
      body("net_status")
        .optional()
        .notEmpty()
        .withMessage("the net_status should not be empty if provided")
        .bail()
        .toLowerCase()
        .isIn(["active", "inactive", "pending"])
        .withMessage(
          "the net_status value is not among the expected ones which include: active, inactive, pending"
        )
        .trim(),
      body("net_phoneNumber")
        .optional()
        .notEmpty()
        .withMessage("the phoneNumber should not be empty if provided")
        .bail()
        .isMobilePhone()
        .withMessage("the phoneNumber is not a valid one")
        .bail()
        .trim(),
      body("net_category")
        .optional()
        .notEmpty()
        .withMessage("the net_category should not be empty if provided")
        .bail()
        .toLowerCase()
        .isIn([
          "business",
          "research",
          "policy",
          "awareness",
          "school",
          "others",
        ])
        .withMessage(
          "the status value is not among the expected ones which include: business, research, policy, awareness, school, others"
        )
        .trim(),
      body("net_name")
        .if(body("net_name").exists())
        .notEmpty()
        .withMessage("the net_name should not be empty")
        .trim(),
      body("net_users")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the net_users should be an array")
        .bail()
        .notEmpty()
        .withMessage("the net_users should not be empty"),
      body("net_users.*")
        .optional()
        .isMongoId()
        .withMessage("each use should be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createNetworkController.update
);

router.put(
  "/:net_id/assign-user/:user_id",
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
      param("net_id")
        .exists()
        .withMessage("the network ID param is missing in the request")
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
  createNetworkController.update
);

router.put(
  "/:net_id/set-manager/:user_id",
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
      param("net_id")
        .exists()
        .withMessage("the network ID param is missing in the request")
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
  createNetworkController.update
);

router.get(
  "/:net_id",
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
    param("net_id")
      .optional()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createNetworkController.list
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
    param("net_id")
      .optional()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createNetworkController.list
);

router.get(
  "/:net_id/assigned-users",
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
    param("net_id")
      .optional()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createNetworkController.listAssignedUsers
);

router.get(
  "/:net_id/available-users",
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
    param("net_id")
      .optional()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createNetworkController.listAvailableUsers
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
      body("net_email")
        .exists()
        .withMessage("the network's email address is required")
        .bail()
        .isEmail()
        .withMessage("This is not a valid email address")
        .trim(),
      body("net_website")
        .exists()
        .withMessage("the net_network's website is required")
        .bail()
        .isURL()
        .withMessage("the net_website is not a valid URL")
        .trim(),
      body("net_status")
        .optional()
        .notEmpty()
        .withMessage("the net_status should not be empty")
        .bail()
        .toLowerCase()
        .isIn(["active", "inactive", "pending"])
        .withMessage(
          "the status value is not among the expected ones which include: active, inactive, pending"
        )
        .trim(),
      body("net_phoneNumber")
        .exists()
        .withMessage("the net_phoneNumber is required")
        .bail()
        .isMobilePhone()
        .withMessage("the net_phoneNumber is not a valid one")
        .bail()
        .trim(),
      body("net_category")
        .exists()
        .withMessage("the net_category is required")
        .bail()
        .toLowerCase()
        .isIn([
          "business",
          "research",
          "policy",
          "awareness",
          "school",
          "others",
        ])
        .withMessage(
          "the status value is not among the expected ones which include: business, research, policy, awareness, school, others"
        )
        .trim(),
      body("net_description")
        .exists()
        .withMessage("the net_description is required")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createNetworkController.create
);

router.post(
  "/:net_id/assign-user",
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
      param("net_id")
        .exists()
        .withMessage("the network ID param is missing in the request")
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
  createNetworkController.update
);

router.post(
  "/find",
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
      body("email")
        .exists()
        .withMessage("the organization's email address is required")
        .bail()
        .isEmail()
        .withMessage("This is not a valid email address")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createNetworkController.getNetworkFromEmail
);

router.delete(
  "/:net_id/unassign-user/:user_id",
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
      param("net_id")
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
  createNetworkController.update
);

module.exports = router;
