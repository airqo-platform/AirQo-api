const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join-platform");
const requestController = require("../controllers/request-access");
const defaultsController = require("../controllers/create-defaults");
const organizationController = require("../controllers/create-organization");
const { check, oneOf, query, body, param } = require("express-validator");

const {
  setJWTAuth,
  authJWT,
  setLocalAuth,
  authLocal,
} = require("../services/auth");

const privileges = require("../utils/privileges");

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

//************************* users ***************************************************
router.post(
  "/loginUser",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if/when provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      body("userName")
        .exists()
        .withMessage("the userName must be provided")
        .notEmpty()
        .withMessage("the useraName must not be empty"),
      body("password")
        .exists()
        .withMessage("the password must be provided")
        .bail()
        .notEmpty()
        .withMessage("the password must not be empty"),
    ],
  ]),
  setLocalAuth,
  authLocal,
  joinController.login
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
  joinController.loginInViaEmail
);

router.post(
  "/emailAuth",
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
  joinController.emailAuth
);

router.post("/verify", setJWTAuth, authJWT, joinController.verify);
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
  joinController.list
);
router.post(
  "/registerUser",
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
    [
      body("firstName").exists().withMessage("the firstName must be provided"),
      body("lastName").exists().withMessage("the lastName must be provided"),
      body("email")
        .exists()
        .withMessage("the email should be provided")
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("privilege").exists().withMessage("the privilege must be provided"),
      body("organization")
        .exists()
        .withMessage("the organization must be provided"),
      body("long_organization")
        .exists()
        .withMessage("the long_organization must be provided"),
    ],
  ]),
  joinController.register
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
  joinController.confirmEmail
);
router.put(
  "/updatePasswordViaEmail",
  setJWTAuth,
  joinController.updateForgottenPassword
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
  oneOf([
    [
      body("password")
        .exists()
        .withMessage("the password must be provided")
        .bail()
        .isLength({ min: 6, max: 30 })
        .withMessage(
          "password must be at least 6 characters and not more than 30 characters"
        )
        .bail()
        .isStrongPassword({
          minLength: 6,
          minLowercase: 1,
          minUppercase: 1,
          minNumbers: 1,
          minSymbols: 0,
          returnScore: false,
          pointsPerUnique: 1,
          pointsPerRepeat: 0.5,
          pointsForContainingLower: 10,
          pointsForContainingUpper: 10,
          pointsForContainingNumber: 10,
          pointsForContainingSymbol: 10,
        })
        .withMessage(
          "the password is not strong enough, please check documentation"
        ),
      body("old_password")
        .exists()
        .withMessage("the old_password must be provided")
        .bail()
        .notEmpty()
        .withMessage("the old_password should not be empty"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  joinController.updateKnownPassword
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
  oneOf([
    [
      body("email")
        .exists()
        .withMessage("the email must be provided")
        .bail()
        .isEmail()
        .withMessage("the provided email is invalid")
        .bail()
        .trim(),
    ],
  ]),
  joinController.forgot
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
  setJWTAuth,
  authJWT,
  joinController.update
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
  joinController.delete
);

/************************* settings/defaults **********************************/
router.put(
  "/defaults",
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
        "the record's identifier is missing in request, consider using the id"
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
      body("pollutant")
        .optional()
        .notEmpty()
        .withMessage("pollutant should not be empty if/when provided")
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .optional()
        .notEmpty()
        .withMessage("frequency should not be empty if/when provided")
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly", "diurnal"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly, diurnal and monthly"
        ),
      body("chartType")
        .optional()
        .notEmpty()
        .withMessage("chartType should not be empty if/when provided")
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .optional()
        .notEmpty()
        .withMessage("startDate should not be empty if/when provided")
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .optional()
        .notEmpty()
        .withMessage("endDate should not be empty if/when provided")
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),
      body("user")
        .optional()
        .notEmpty()
        .withMessage("user should not be empty if/when provided")
        .trim()
        .isMongoId()
        .withMessage("the user must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("airqloud")
        .optional()
        .notEmpty()
        .withMessage("airqloud should not be empty if/when provided")
        .trim()
        .isMongoId()
        .withMessage("the airqloud must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("chartTitle should not be empty if/when provided")
        .trim(),
      body("period")
        .optional()
        .notEmpty()
        .withMessage("period should not be empty if/when provided")
        .trim()
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the period should be an object"),
      body("period.unitValue")
        .optional()
        .notEmpty()
        .withMessage("period.unitValue should not be empty if/when provided")
        .trim()
        .bail()
        .isFloat()
        .withMessage("period.unitValue must be a number"),
      body("chartSubTitle")
        .optional()
        .notEmpty()
        .withMessage("chartSubTitle should not be empty if/when provided")
        .trim(),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("chartTitle should not be empty if/when provided")
        .trim(),
      body("sites")
        .optional()
        .notEmpty()
        .withMessage("sites should not be empty if/when provided")
        .trim()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array"),
      body("sites.*")
        .optional()
        .notEmpty()
        .withMessage("each provided sites should not be empty if/when provided")
        .trim()
        .isMongoId()
        .withMessage("site must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  defaultsController.update
);

router.post(
  "/defaults",
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
    [
      body("pollutant")
        .exists()
        .withMessage("pollutant is missing in your request")
        .bail()
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .exists()
        .withMessage("frequency is missing in your request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly", "diurnal"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly, diurnal and monthly"
        ),
      body("chartType")
        .exists()
        .withMessage("chartType is missing in your request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .exists()
        .withMessage("startDate is missing in your request")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .exists()
        .withMessage("endDate is missing in your request")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),
      body("user")
        .exists()
        .withMessage("user is missing in your request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("airqloud")
        .exists()
        .withMessage("airqloud is missing in your request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("chartTitle")
        .exists()
        .withMessage("chartTitle is missing in your request")
        .bail()
        .trim(),
      body("period")
        .exists()
        .withMessage("period is missing in your request")
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the period should be an object"),
      body("period.unit")
        .exists()
        .withMessage("period.unit is missing in your request"),
      body("period.unitValue")
        .exists()
        .withMessage("period.unitValue is missing in your request")
        .bail()
        .isFloat()
        .withMessage("period.unitValue must be a number"),
      body("period.label")
        .exists()
        .withMessage("period.label is missing in your request"),
      body("period.value")
        .exists()
        .withMessage("period.value is missing in your request"),
      body("chartSubTitle")
        .exists()
        .withMessage("chartSubTitle is missing in your request")
        .bail()
        .trim(),
      body("sites")
        .exists()
        .withMessage("sites is missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array"),
      body("sites.*")
        .exists()
        .withMessage("No Sites included in your request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site must be an object ID"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  defaultsController.create
);

router.get(
  "/defaults",
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
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("id should not be empty if/when provided")
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("user")
        .optional()
        .notEmpty()
        .withMessage("user should not be empty if/when provided")
        .trim()
        .isMongoId()
        .withMessage("user must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("airqloud")
        .optional()
        .notEmpty()
        .withMessage("airqloud should not be empty if/when provided")
        .trim()
        .isMongoId()
        .withMessage("the airqloud must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site")
        .optional()
        .notEmpty()
        .withMessage("site should not be empty if/when provided")
        .trim()
        .isMongoId()
        .withMessage("the site must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  defaultsController.list
);

router.delete(
  "/defaults",
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
        "the defaults identifier is missing in request, consider using the id"
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
  setJWTAuth,
  authJWT,
  defaultsController.delete
);

//************************ candidates ***********************************************
router.post(
  "/candidates/register",
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
    body("email")
      .exists()
      .withMessage("the email should be provided")
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("firstName").exists().withMessage("the firstName must be provided"),
    body("lastName").exists().withMessage("the lastName must be provided"),
    body("category").exists().withMessage("the category must be provided"),
    body("jobTitle").exists().withMessage("the jobTitle must be provided"),
    body("website").exists().withMessage("the website must be provided"),
    body("description")
      .exists()
      .withMessage("the description must be provided"),
    body("long_organization")
      .exists()
      .withMessage("the long_organization must be provided"),
  ]),
  requestController.create
);
router.get(
  "/candidates",
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
  requestController.list
);
router.post(
  "/candidates/confirm",
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
  requestController.confirm
);

router.post(
  "/candidates/email/confirm",
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
    query("confirmationCode")
      .exists()
      .withMessage("the confirmationCode should be provided")
      .bail()
      .trim(),
  ]),
  setJWTAuth,
  authJWT,
  requestController.confirmEmail
);

router.delete(
  "/candidates",
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
        "the candidate identifier is missing in request, consider using the id"
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
  setJWTAuth,
  authJWT,
  requestController.delete
);
router.put(
  "/candidates",
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
        "the candidate identifier is missing in request, consider using the id"
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
      body("status")
        .optional()
        .notEmpty()
        .withMessage("status should not be empty if/when provided")
        .trim()
        .toLowerCase()
        .isIn(["pending", "rejected"])
        .withMessage(
          "the status value is not among the expected ones which include: rejected and pending"
        ),
    ],
  ]),
  setJWTAuth,
  authJWT,
  requestController.update
);

/**************** create organization use case ***********************/
router.delete(
  "/organizations",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if/when provided")
      .trim()
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
        "the record's identifier is missing in request, consider using the id"
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
  setJWTAuth,
  authJWT,
  organizationController.delete
);

router.put(
  "/organizations",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if/when provided")
      .trim()
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
        "the record's identifier is missing in request, consider using the id"
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
      body("email")
        .optional()
        .notEmpty()
        .withMessage("email should not be empty if/when provided")
        .trim()
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("website")
        .optional()
        .notEmpty()
        .withMessage("website should not be empty if/when provided")
        .trim()
        .bail()
        .isURL()
        .withMessage("the website is not a valid URL")
        .trim(),
      body("isAlias")
        .optional()
        .notEmpty()
        .withMessage("isAlias should not be empty if/when provided")
        .trim()
        .bail()
        .isBoolean()
        .withMessage("isAlias must be a Boolean")
        .trim(),
      body("isActive")
        .optional()
        .notEmpty()
        .withMessage("isActive should not be empty if/when provided")
        .trim()
        .bail()
        .isBoolean()
        .withMessage("isActive must be a Boolean")
        .trim(),
      body("status")
        .optional()
        .notEmpty()
        .withMessage("status should not be empty if/when provided")
        .trim()
        .bail()
        .toLowerCase()
        .isIn(["active", "inactive", "pending"])
        .withMessage(
          "the status value is not among the expected ones which include: active, inactive, pending"
        )
        .trim(),
      body("phoneNumber")
        .optional()
        .notEmpty()
        .withMessage("phoneNumber should not be empty if/when provided")
        .trim()
        .bail()
        .isMobilePhone()
        .withMessage("the phoneNumber is not a valid one")
        .bail()
        .trim(),
      body("category")
        .optional()
        .notEmpty()
        .withMessage("category should not be empty if/when provided")
        .bail()
        .trim(),
      body("name")
        .optional()
        .notEmpty()
        .withMessage("name should not be empty if/when provided")
        .trim(),
      body("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if/when provided")
        .trim()
        .toLowerCase(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  organizationController.update
);

router.get(
  "/organizations",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if/when provided")
      .trim()
      .bail()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  organizationController.list
);

router.post(
  "/organizations",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if/when provided")
      .trim()
      .bail()

      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
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
      body("website")
        .exists()
        .withMessage("the organization's website is required")
        .bail()
        .isURL()
        .withMessage("the website is not a valid URL")
        .trim(),
      body("isAlias")
        .exists()
        .withMessage("isAlias is required")
        .bail()
        .isBoolean()
        .withMessage("isAlias must be a Boolean")
        .trim(),
      body("isActive")
        .optional()
        .notEmpty()
        .withMessage("isActive should not be empty if/when provided")
        .trim()
        .bail()
        .isBoolean()
        .withMessage("isActive must be a Boolean")
        .trim(),
      body("status")
        .optional()
        .notEmpty()
        .withMessage("status should not be empty if/when provided")
        .trim()
        .bail()
        .toLowerCase()
        .isIn(["active", "inactive", "pending"])
        .withMessage(
          "the status value is not among the expected ones which include: active, inactive, pending"
        )
        .trim(),
      body("phoneNumber")
        .exists()
        .withMessage("the organization's phoneNumber is required")
        .bail()
        .isMobilePhone()
        .withMessage("the phoneNumber is not a valid one")
        .bail()
        .trim(),
      body("category")
        .exists()
        .withMessage("the organization's category is required")
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
      body("name")
        .exists()
        .withMessage("the organization's name is required")
        .trim(),
      body("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if/when provided")
        .trim()
        .toLowerCase(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  organizationController.create
);

router.post(
  "/organizations/tenant",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if/when provided")
      .trim()
      .bail()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
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
  organizationController.getTenantFromEmail
);

module.exports = router;
