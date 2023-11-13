const express = require("express");
const router = express.Router();
const createPreferenceController = require("@controllers/create-preference");
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

router.post(
  "/upsert",
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
        .withMessage("the user_id should be provided in the request body")
        .bail()
        .notEmpty()
        .withMessage("the provided user_id should not be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("pollutant")
        .optional()
        .notEmpty()
        .withMessage("the provided pollutant should not be empty IF provided")
        .bail()
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .optional()
        .notEmpty()
        .withMessage("the provided frequency should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly and monthly"
        ),
      body("chartType")
        .optional()
        .notEmpty()
        .withMessage("the provided chartType should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .optional()
        .notEmpty()
        .withMessage("the provided startDate should not be empty IF provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .optional()
        .notEmpty()
        .withMessage("the provided endDate should not be empty IF provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),

      body("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("the provided chartTitle should not be empty IF provided")
        .bail()
        .trim(),
      body("period")
        .optional()
        .notEmpty()
        .withMessage("the provided period should not be empty IF provided")
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the period should be an object"),
      body("chartSubTitle")
        .optional()
        .notEmpty()
        .withMessage(
          "the provided chartSubTitle should not be empty IF provided"
        )
        .bail()
        .trim(),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("the provided chartTitle should not be empty IF provided")
        .bail()
        .trim(),
      body("site_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided site_ids should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_ids should be an array"),
      body("site_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID"),
      body("device_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided device_ids should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the device_ids should be an array"),
      body("device_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided device_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device_id must be an object ID"),
    ],
  ]),
  createPreferenceController.upsert
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
      .withMessage(
        "the record's identifier is missing in request, consider using the user_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("user_id must be an object ID")
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
        .withMessage("the provided pollutant should not be empty IF provided")
        .bail()
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .optional()
        .notEmpty()
        .withMessage("the provided frequency should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly and monthly"
        ),
      body("chartType")
        .optional()
        .notEmpty()
        .withMessage("the provided chartType should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .optional()
        .notEmpty()
        .withMessage("the provided startDate should not be empty IF provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .optional()
        .notEmpty()
        .withMessage("the provided endDate should not be empty IF provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),

      body("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("the provided chartTitle should not be empty IF provided")
        .bail()
        .trim(),
      body("period")
        .optional()
        .notEmpty()
        .withMessage("the provided period should not be empty IF provided")
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the period should be an object"),
      body("chartSubTitle")
        .optional()
        .notEmpty()
        .withMessage(
          "the provided chartSubTitle should not be empty IF provided"
        )
        .bail()
        .trim(),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("the provided chartTitle should not be empty IF provided")
        .bail()
        .trim(),
      body("site_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided site_ids should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_ids should be an array"),
      body("site_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID"),
      body("device_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided device_ids should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the device_ids should be an array"),
      body("device_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided device_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device_id must be an object ID"),
    ],
  ]),
  createPreferenceController.update
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
        .optional()
        .notEmpty()
        .withMessage("the provided pollutant should not be empty IF provided")
        .bail()
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .optional()
        .notEmpty()
        .withMessage("the provided frequently should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly and monthly"
        ),
      body("chartType")
        .optional()
        .notEmpty()
        .withMessage("the provided chartType should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .optional()
        .notEmpty()
        .withMessage("the provided startDate should not be empty IF provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .optional()
        .notEmpty()
        .withMessage("the provided endDate should not be empty IF provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),
      body("user_id")
        .exists()
        .withMessage("the user_id should be provided in the request body")
        .bail()
        .notEmpty()
        .withMessage("the provided user_id should not be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("the provided chartTitle should not be empty IF provided")
        .trim(),
      body("period")
        .optional()
        .notEmpty()
        .withMessage("the provided period should not be empty IF provided")
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the period should be an object"),
      body("chartSubTitle")
        .optional()
        .notEmpty()
        .withMessage(
          "the provided chartSubTitle should not be empty IF provided"
        )
        .trim(),
      body("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("site_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided site_ids should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_ids should be an array"),
      body("site_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID"),
      body("device_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided device_ids should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the device_ids should be an array"),
      body("device_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided device_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device_id must be an object ID"),
    ],
  ]),
  createPreferenceController.create
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
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("user_id")
        .optional()
        .notEmpty()
        .withMessage("the provided user_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  createPreferenceController.list
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
    query("user_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the user_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createPreferenceController.delete
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
  createPreferenceController.list
);

module.exports = router;
