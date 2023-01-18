const express = require("express");
const router = express.Router();
const createTokenController = require("@controllers/create-token");

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
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .trim()
      .toLowerCase()
      .bail()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.list
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
      body("firstName")
        .exists()
        .withMessage("firstName is missing in your request")
        .bail()
        .trim(),
      body("lastName")
        .exists()
        .withMessage("lastName is missing in your request")
        .bail()
        .trim(),
      body("email")
        .exists()
        .withMessage("email is missing in your request")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("organization")
        .exists()
        .withMessage("organization is missing in your request")
        .bail()
        .trim(),
      body("long_organization")
        .exists()
        .withMessage("long_organization is missing in your request")
        .bail()
        .trim(),
      body("privilege")
        .exists()
        .withMessage("privilege is missing in your request")
        .bail()
        .trim(),
    ],
  ]),
  createTokenController.create
);

router.put(
  "/:token_id",
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
    param("token_id")
      .exists()
      .withMessage("the user ID parameter is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("networks")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the networks should be an array")
        .bail()
        .notEmpty()
        .withMessage("the networks should not be empty"),
      body("networks.*")
        .optional()
        .isMongoId()
        .withMessage("each network should be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.update
);

router.delete(
  "/:token_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("token_id")
      .exists()
      .withMessage("the user ID parameter is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.delete
);

router.get(
  "/:token_id",
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
      param("token_id")
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
  createTokenController.list
);

module.exports = router;
