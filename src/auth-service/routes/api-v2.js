const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join");
const requestController = require("../controllers/request");
const defaultsController = require("../controllers/defaults");
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
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setLocalAuth,
  authLocal,
  joinController.login
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
        .if(body("pollutant").exists())
        .notEmpty()
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .if(body("frequency").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly and monthly"
        ),
      body("chartType")
        .if(body("chartType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .if(body("startDate").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .if(body("endDate").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),
      body("user")
        .if(body("user").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the user must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("airqloud")
        .if(body("airqloud").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the airqloud must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("chartTitle").if(body("chartTitle").exists()).notEmpty().trim(),
      body("period")
        .if(body("period").exists())
        .notEmpty()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the period should be an object"),
      body("chartSubTitle")
        .if(body("chartSubTitle").exists())
        .notEmpty()
        .trim(),
      body("chartTitle").if(body("chartTitle").exists()).notEmpty().trim(),
      body("sites")
        .if(body("sites").exists())
        .notEmpty()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array"),
      body("sites.*")
        .if(body("sites.*").exists())
        .notEmpty()
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
        .if(body("pollutant").exists())
        .notEmpty()
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .if(body("frequency").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly and monthly"
        ),
      body("chartType")
        .if(body("chartType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .if(body("startDate").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .if(body("endDate").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),
      body("user")
        .if(body("user").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the user must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("chartTitle").if(body("chartTitle").exists()).notEmpty().trim(),
      body("period")
        .if(body("period").exists())
        .notEmpty()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the period should be an object"),
      body("chartSubTitle")
        .if(body("chartSubTitle").exists())
        .notEmpty()
        .trim(),
      body("airqloud")
        .if(body("airqloud").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the airqloud must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("sites")
        .if(body("sites").exists())
        .notEmpty()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array"),
      body("sites.*")
        .if(body("sites.*").exists())
        .notEmpty()
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
        .if(query("id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("user")
        .if(query("user").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("user must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("airqloud")
        .if(query("airqloud").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the airqloud must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site")
        .if(query("site").exists())
        .notEmpty()
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
        .if(body("status").exists())
        .notEmpty()
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

module.exports = router;
