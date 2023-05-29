const express = require("express");
const router = express.Router();
const createUserController = require("@controllers/create-user");
const { check, oneOf, query, body, param } = require("express-validator");

const {
  setJWTAuth,
  authJWT,
  setLocalAuth,
  authLocal,
} = require("@middleware/passport");

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

router.post(
  "/loginUser",
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
      body("userName").exists().withMessage("the userName must be provided"),
      body("password").exists().withMessage("the password must be provided"),
    ],
  ]),
  setLocalAuth,
  authLocal,
  createUserController.login
);

router.post("/verify", setJWTAuth, authJWT, createUserController.verify);
router.get(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  createUserController.list
);

router.post(
  "/registerUser",
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
        .optional()
        .notEmpty()
        .withMessage("privilege should not be empty if provided")
        .bail()
        .isIn(["admin", "netmanager", "user", "super"])
        .withMessage("the privilege value is not among the expected ones")
        .trim(),
    ],
  ]),
  createUserController.register
);
router.get(
  "/email/confirm/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  createUserController.confirmEmail
);
router.put(
  "/updatePasswordViaEmail",
  setJWTAuth,
  createUserController.updateForgottenPassword
);
router.put(
  "/updatePassword",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  createUserController.updateKnownPassword
);
router.post(
  "/forgotPassword",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  createUserController.forgot
);
router.put(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using id"
      )
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
      body("organizations")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the organizations should be an array")
        .bail()
        .notEmpty()
        .withMessage("the organizations should not be empty"),
      body("organizations.*")
        .optional()
        .isMongoId()
        .withMessage("each organizations should be a mongo/object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createUserController.update
);
router.delete(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  createUserController.delete
);

module.exports = router;
