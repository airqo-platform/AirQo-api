const express = require("express");
const router = express.Router();
const createClientController = require("@controllers/create-client");
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
      body("name")
        .exists()
        .withMessage("name is missing in your request")
        .bail()
        .trim(),
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
  "secret/:client_id",
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
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("client_id")
        .not()
        .exists()
        .withMessage("the client_id should not exist in the request body"),
      body("name")
        .not()
        .exists()
        .withMessage("the name should not exist in the request body")
        .trim(),
      body("client_secret")
        .exists()
        .withMessage("client_secret should be provided")
        .notEmpty()
        .withMessage("the client_secret cannot be empty")
        .trim(),
      body("redirect_url")
        .not()
        .exists()
        .withMessage("redirect_url should not exist in the request body"),
      body("description")
        .not()
        .exists()
        .withMessage("description should not exist in the request body"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.update
);

router.patch(
  "name/:client_id",
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
        .trim(),
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
        .exists()
        .withMessage("the name should be provided")
        .bail()
        .notEmpty()
        .withMessage("name should not be empty")
        .trim(),
      body("redirect_url")
        .not()
        .exists()
        .withMessage("redirect_url should not exist in the request body"),
      body("description")
        .not()
        .exists()
        .withMessage("description should not exist in the request body"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.update
);

router.patch(
  "id/:client_id",
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
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("name")
        .not()
        .exists()
        .withMessage("the name should not exist in the request body"),
      body("client_secret")
        .not()
        .exists()
        .withMessage("the client_secret should not exist in the request body"),
      body("client_id")
        .exists()
        .withMessage("client_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("client_id should not be empty")
        .trim(),
      body("redirect_url")
        .not()
        .exists()
        .withMessage("redirect_url should not exist in the request body"),
      body("description")
        .not()
        .exists()
        .withMessage("description should not exist in the request body"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.update
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
        .trim(),
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
        .trim(),
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
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createClientController.list
);

module.exports = router;
