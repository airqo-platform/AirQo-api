const express = require("express");
const router = express.Router();
const createDefaultController = require("@controllers/create-default");
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

/************************* settings/ **********************************/
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
        .isIn(["daily", "hourly", "monthly", "diurnal"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly, diurnal and monthly"
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
        .optional()
        .notEmpty()
        .withMessage("period cannot be empty if provided")
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the period should be an object"),
      body("period.unitValue")
        .if(body("period.unitValue").exists())
        .notEmpty()
        .withMessage("period.unitValue cannot be empty if provided")
        .trim()
        .bail()
        .isFloat()
        .withMessage("period.unitValue must be a number"),
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
  createDefaultController.update
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
  createDefaultController.create
);

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
  createDefaultController.list
);

router.delete(
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
  createDefaultController.delete
);

module.exports = router;
