const express = require("express");
const router = express.Router();
const createClientController = require("@controllers/create-client");
const { check, oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
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
  createClientController.list
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
      body("user_id")
        .exists()
        .withMessage("the user_id is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("name")
        .exists()
        .withMessage("the name is missing in your request")
        .trim(),
      body("ip_address")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("the ip_address must not be empty IF provided")
        .bail()
        .isIP()
        .withMessage("Invalid IP address"),
      body("ip_addresses")
        .optional()
        .custom((value) => Array.isArray(value))
        .withMessage("the ip_addresses should be an array")
        .bail()
        .notEmpty()
        .withMessage("the ip_addresses should not be empty IF provided"),
      body("ip_addresses.*").isIP().withMessage("Invalid IP address provided"),
      body("redirect_url")
        .optional()
        .notEmpty()
        .withMessage("the redirect_url cannot be empty if provided")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the redirect_url cannot have spaces in it")
        .bail()
        .isURL()
        .withMessage("the redirect_url is not a valid URL")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.create
);

router.patch(
  "/:client_id/secret",
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
      param("client_id")
        .exists()
        .withMessage("the client_id param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("this client_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("client_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.updateClientSecret
);

router.put(
  "/:client_id",
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
      param("client_id")
        .exists()
        .withMessage("the client_id param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the client_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
      body("client_id")
        .not()
        .exists()
        .withMessage("the client_id should not exist in the request body"),
      body("client_secret")
        .not()
        .exists()
        .withMessage("the client_secret should not exist in the request body"),
      body("name")
        .optional()
        .notEmpty()
        .withMessage("name should not be empty if provided")
        .trim(),
      body("ip_address")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("the ip_address must not be empty IF provided")
        .bail()
        .isIP()
        .withMessage("Invalid IP address"),
      body("ip_addresses")
        .optional()
        .custom((value) => Array.isArray(value))
        .withMessage("the ip_addresses should be an array")
        .bail()
        .notEmpty()
        .withMessage("the ip_addresses should not be empty IF provided"),
      body("ip_addresses.*").isIP().withMessage("Invalid IP address provided"),
      body("redirect_url")
        .optional()
        .notEmpty()
        .withMessage("redirect_url should not be empty if provided")
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the redirect_url cannot have spaces in it")
        .bail()
        .isURL()
        .withMessage("the redirect_url is not a valid URL")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.update
);

router.post(
  "/activate/:client_id",
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
      param("client_id")
        .exists()
        .withMessage("the client_id param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the client_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
      body("isActive")
        .exists()
        .withMessage("isActive field is missing")
        .bail()
        .notEmpty()
        .withMessage("isActive should not be empty if provided")
        .bail()
        .isBoolean()
        .withMessage("isActive should be a Boolean value")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.activateClient
);

router.get(
  "/activate-request/:client_id",
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
      param("client_id")
        .exists()
        .withMessage("the client_id param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the client_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.activateClientRequest
);

router.delete(
  "/:client_id",
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
      param("client_id")
        .exists()
        .withMessage("the client_id param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the client_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.delete
);

router.get(
  "/:client_id",
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
      param("client_id")
        .exists()
        .withMessage("the client_id param is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the client_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.list
);

module.exports = router;
