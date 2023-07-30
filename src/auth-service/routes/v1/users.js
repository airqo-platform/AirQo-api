const express = require("express");
const router = express.Router();
const createUserController = require("@controllers/create-user");
const { check, oneOf, query, body, param } = require("express-validator");

const {
  setJWTAuth,
  authJWT,
  setLocalAuth,
  authGoogleCallback,
  setGoogleAuth,
  setGuestToken,
  authLocal,
  authGuest,
  authGoogle,
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

router.get(
  "/deleteMobileUserData/:userId/:token",
  oneOf([
    param("userId")
      .exists()
      .withMessage("the userId is missing in the request")
      .bail(),
  ]),
  oneOf([
    param("token")
      .exists()
      .withMessage("The deletion token is missing in the request")
      .bail(),
  ]),
  createUserController.deleteMobileUserData
);

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

router.post(
  "/guest",
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
  setGuestToken,
  authGuest,
  createUserController.guest
);

router.post(
  "/emailLogin",
  oneOf([
    [
      body("email")
        .exists()
        .withMessage("the email must be provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address"),
    ],
  ]),
  createUserController.loginInViaEmail
);

router.post(
  "/emailAuth/:purpose?",
  oneOf([
    [
      body("email")
        .exists()
        .withMessage("the email must be provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address"),
    ],
  ]),
  oneOf([
    [
      param("purpose")
        .optional()
        .notEmpty()
        .withMessage("The purpose should not be empty if provided"),
    ],
  ]),
  createUserController.emailAuth
);

router.post(
  "/feedback",
  oneOf([
    [
      body("email")
        .exists()
        .withMessage("the email must be provided")
        .bail()
        .notEmpty()
        .withMessage("the email must not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address"),
      body("subject")
        .exists()
        .withMessage("the subject must be provided")
        .bail()
        .notEmpty()
        .withMessage("the subject must not be empty if provided"),
      body("message")
        .exists()
        .withMessage("the message must be provided")
        .bail()
        .notEmpty()
        .withMessage("the message must not be empty if provided"),
    ],
  ]),
  createUserController.sendFeedback
);

router.post(
  "/firebase/lookup",
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
    body("phoneNumber")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the phoneNumber"
      )
      .bail()
      .notEmpty()
      .withMessage("the phoneNumber must not be empty if provided")
      .bail()
      .isMobilePhone()
      .withMessage("the phoneNumber must be valid"),
  ]),
  createUserController.lookUpFirebaseUser
);

router.post(
  "/firebase/create",
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
    body("phoneNumber")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the phoneNumber"
      )
      .bail()
      .notEmpty()
      .withMessage("the phoneNumber must not be empty if provided")
      .bail()
      .isMobilePhone()
      .withMessage("the phoneNumber must be valid"),
  ]),
  createUserController.createFirebaseUser
);

router.post(
  "/firebase/login",
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
    body("phoneNumber")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the phoneNumber"
      )
      .bail()
      .notEmpty()
      .withMessage("the phoneNumber must not be empty if provided")
      .bail()
      .isMobilePhone()
      .withMessage("the phoneNumber must be valid"),
  ]),
  createUserController.loginWithFirebase
);
router.post(
  "/firebase/signup",
  oneOf([
    body("email")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the email"
      )
      .bail()
      .notEmpty()
      .withMessage("the email must not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
    body("phoneNumber")
      .exists()
      .withMessage(
        "the user identifier is missing in request, consider using the phoneNumber"
      )
      .bail()
      .notEmpty()
      .withMessage("the phoneNumber must not be empty if provided")
      .bail()
      .isMobilePhone()
      .withMessage("the phoneNumber must be valid"),
  ]),
  createUserController.signUpWithFirebase
);

/**
 * version one of verification
 */
router.post("/verify", setJWTAuth, authJWT, createUserController.verify);

router.get(
  "/verify/:user_id/:token",
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
      param("token")
        .exists()
        .withMessage("the token param is missing in the request")
        .bail()
        .trim(),
    ],
  ]),
  createUserController.verifyEmail
);

/**
 * version two of verification
 */
router.post(
  "/verification/generate",
  setJWTAuth,
  authJWT,
  createUserController.generateVerificationToken
);

router.post(
  "/verification/verify",
  setJWTAuth,
  authJWT,
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
      body("email")
        .exists()
        .withMessage("the email must be provided")
        .bail()
        .notEmpty()
        .withMessage("the email must not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address"),
      body("token")
        .exists()
        .withMessage("the token is missing in the request")
        .bail()
        .trim()
        .isInt()
        .withMessage("token must be an integer"),
    ],
  ]),
  createUserController.verifyVerificationToken
);

router.get(
  "/auth/google/callback",
  setGoogleAuth,
  authGoogleCallback,
  createUserController.googleCallback
);

router.get(
  "/auth/google",
  setGoogleAuth,
  authGoogle,
  createUserController.login
);

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
        .optional()
        .notEmpty()
        .withMessage("organization should not be empty if provided")
        .bail()
        .trim(),
      body("long_organization")
        .optional()
        .notEmpty()
        .withMessage("long_organization should not be empty if provided")
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
      body("password")
        .exists()
        .withMessage("password is missing in your request")
        .bail()
        .trim()
        .isLength({ min: 6, max: 30 })
        .withMessage("Password must be between 6 and 30 characters long")
        .bail()
        .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/)
        .withMessage(
          "Password must contain at least one letter and one number"
        ),
    ],
  ]),
  createUserController.create
);

router.put(
  "/updatePasswordViaEmail",
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
      body("resetPasswordToken")
        .exists()
        .withMessage("the resetPasswordToken must be provided")
        .trim(),
      body("password")
        .exists()
        .withMessage("the password must be provided")
        .trim(),
    ],
  ]),
  setJWTAuth,
  createUserController.updateForgottenPassword
);
router.put(
  "/updatePassword",
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
      query("id")
        .exists()
        .withMessage("the user ID must be provided")
        .trim()
        .bail()
        .isMongoId()
        .withMessage("the user ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("old_password")
        .exists()
        .withMessage("the old_password must be provided")
        .trim(),
      body("password")
        .exists()
        .withMessage("the password must be provided")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createUserController.updateKnownPassword
);
router.post(
  "/forgotPassword",
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
      body("email")
        .exists()
        .withMessage("the email must be provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
    ],
  ]),
  createUserController.forgot
);
router.put(
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
  createUserController.update
);

router.put(
  "/:user_id",
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
    param("user_id")
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
  createUserController.update
);

router.delete(
  "/",
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
    query("id")
      .exists()
      .withMessage("the user ID must be provided")
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
  createUserController.delete
);

router.delete(
  "/:user_id",
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
    param("user_id")
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
  createUserController.delete
);

router.post(
  "/newsletter/subscribe",
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
        .withMessage("the email must be provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("tags")
        .optional()
        .notEmpty()
        .withMessage("the tags should not be empty if provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
    ],
  ]),
  createUserController.subscribeToNewsLetter
);

router.get(
  "/stats",
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
  createUserController.listStatistics
);

router.get(
  "/logs",
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
  createUserController.listLogs
);

router.get(
  "/:user_id",
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
  createUserController.list
);

module.exports = router;
