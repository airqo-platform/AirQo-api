const express = require("express");
const router = express.Router();
const createUserTypeController = require("@controllers/create-user-type");
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

router.get(
  "/:user_type/users",
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
    query("net_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using net_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the net_id must be an Object ID"),
    ,
    query("grp_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using grp_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the grid_id must be an Object ID"),
  ]),
  oneOf([
    [
      param("user_type")
        .exists()
        .withMessage("the user_type ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the user_type cannot be empty if provided"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createUserTypeController.listUsersWithUserType
);
router.get(
  "/:user_type/available_users",
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
    query("net_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using net_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the net_id must be an Object ID"),
    ,
    query("grp_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using grp_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the grid_id must be an Object ID"),
  ]),
  oneOf([
    [
      param("user_type")
        .exists()
        .withMessage("the user_type ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the user_type cannot be empty if provided"),
      ,
    ],
  ]),
  setJWTAuth,
  authJWT,
  createUserTypeController.listAvailableUsersForUserType
);
router.post(
  "/:user_type/users",
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
    query("net_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using net_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the net_id must be an Object ID"),
    ,
    query("grp_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using grp_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the grid_id must be an Object ID"),
  ]),
  oneOf([
    [
      param("user_type")
        .exists()
        .withMessage("the user_type ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the user_type cannot be empty if provided"),
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
  createUserTypeController.assignManyUsersToUserType
);
router.post(
  "/:user_type/user",
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
    query("net_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using net_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the net_id must be an Object ID"),
    ,
    query("grp_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using grp_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the grid_id must be an Object ID"),
  ]),
  oneOf([
    [
      param("user_type")
        .exists()
        .withMessage("the user_type ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the user_type cannot be empty if provided"),
      ,
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
  createUserTypeController.assignUserType
);
router.put(
  "/:user_type/user/:user_id",
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
    query("net_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using net_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the net_id must be an Object ID"),
    ,
    query("grp_id")
      .exists()
      .withMessage(
        "the organisational identifier is missing in request, consider using grp_id"
      )
      .bail()
      .isMongoId()
      .withMessage("the grid_id must be an Object ID"),
  ]),
  oneOf([
    [
      param("user_type")
        .exists()
        .withMessage("the user_type ID param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the user_type cannot be empty if provided"),
      ,
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
  createUserTypeController.assignUserType
);

module.exports = router;
