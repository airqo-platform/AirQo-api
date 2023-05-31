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
    body("user_id")
      .exists()
      .withMessage(
        "a token requirement is missing in request, consider using the user_id"
      )
      .bail()
      .notEmpty()
      .withMessage("this user_id cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    // body("client_id")
    //   .exists()
    //   .withMessage(
    //     "a token identifier is missing in request, consider using the client_id"
    //   )
    //   .bail()
    //   .notEmpty()
    //   .withMessage("this client_id cannot be empty")
    //   .bail()
    //   .trim()
    //   .isMongoId()
    //   .withMessage("client_id must be an object ID")
    //   .bail()
    //   .customSanitizer((value) => {
    //     return ObjectId(value);
    //   }),
  ]),
  oneOf([
    [
      body("expires")
        .optional()
        .notEmpty()
        .withMessage("expires cannot be empty if provided")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("expires must be a valid datetime.")
        .bail()
        .isAfter(new Date().toISOString().slice(0, 10))
        .withMessage("the date should not be before the current date")
        .trim(),
    ],
  ]),
  createTokenController.create
);

router.put(
  "/:token",
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
    param("token")
      .exists()
      .withMessage("the token parameter is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("token must not be empty")
      .trim(),
  ]),
  oneOf([
    [
      body("user_id")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("this user ID cannot be empty if provideds")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("expires")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("expires cannot be empty if provided")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("expires must be a valid datetime.")
        .bail()
        .isAfter(new Date().toISOString().slice(0, 10))
        .withMessage("the date should not be before the current date")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.update
);

router.delete(
  "/:token",
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
    param("token")
      .exists()
      .withMessage("the token parameter is missing in the request")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the token must not be empty"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.delete
);

router.get(
  "/:token/verify",
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
      param("token")
        .exists()
        .withMessage("the token param is missing in the request")
        .bail()
        .trim()
        .notEmpty()
        .withMessage("the token must not be empty"),
    ],
  ]),
  createTokenController.verify
);
router.get(
  "/:token",
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
      param("token")
        .exists()
        .withMessage("the token param is missing in the request")
        .bail()
        .trim()
        .notEmpty()
        .withMessage("the token must not be empty"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.list
);

module.exports = router;
