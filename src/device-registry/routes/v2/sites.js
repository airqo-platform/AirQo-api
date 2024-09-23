const express = require("express");
const router = express.Router();
const siteController = require("@controllers/create-site");
const { oneOf, query, body } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const numeral = require("numeral");
const createSiteUtil = require("@utils/create-site");
const { logText, logObject } = require("@utils/log");
const decimalPlaces = require("decimal-places");

const validatePagination = (req, res, next) => {
  let limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 1000;
  }
  if (limit > 2000) {
    limit = 2000;
  }
  if (isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  req.query.limit = limit;

  next();
};

const headers = (req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://analytics.airqo.net, https://staging-analytics.airqo.net",
    "https://platform.airqo.net",
    "https://staging-platform.airqo.net"
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  // Check if the request method is OPTIONS (preflight request)
  if (req.method === "OPTIONS") {
    res.sendStatus(200); // Respond with a 200 status for preflight requests
  } else {
    next(); // Continue to the next middleware for non-preflight requests
  }
};

function validateCategoryField(value) {
  const requiredFields = ["category", "search_radius", "tags"];

  // Check if all required fields exist
  if (!requiredFields.every((field) => field in value)) {
    return false;
  }

  // Validate numeric fields
  const numericFields = ["latitude", "longitude", "search_radius"];
  let isValid = true;

  numericFields.forEach((field) => {
    if (!(field in value)) {
      isValid = false;
      return;
    }
    const numValue = parseFloat(value[field]);
    if (isNaN(numValue)) {
      isValid = false;
      return;
    } else if (field === "latitude" || field === "longitude") {
      if (Math.abs(numValue) > 90) {
        isValid = false;
        return;
      }
    } else if (field === "search_radius") {
      if (numValue <= 0) {
        isValid = false;
        return;
      }
    }
  });

  // Validate tags array
  if ("tags" in value && !Array.isArray(value.tags)) {
    return false;
  }
  value.tags.forEach((tag) => {
    if (typeof tag !== "string" || tag.trim() === "") {
      return false;
    }
  });

  // All validations passed
  return isValid;
}

router.use(headers);
router.use(validatePagination);

/****************************** create sites use-case *************** */
router.get(
  "/",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .trim(),
      query("online_status")
        .optional()
        .notEmpty()
        .withMessage("the online_status should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["online", "offline"])
        .withMessage(
          "the online_status value is not among the expected ones which include: online, offline"
        ),
      query("last_active_before")
        .optional()
        .notEmpty()
        .withMessage("last_active_before date cannot be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage(
          "last_active_before date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
        )
        .bail()
        .toDate(),
      query("last_active_after")
        .optional()
        .notEmpty()
        .withMessage("last_active_after date cannot be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage(
          "last_active_after date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
        )
        .bail()
        .toDate(),
      query("last_active")
        .optional()
        .notEmpty()
        .withMessage("last_active date cannot be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage(
          "last_active date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
        )
        .bail()
        .toDate(),
    ],
  ]),
  siteController.list
);
router.get(
  "/summary",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .trim(),
      query("online_status")
        .optional()
        .notEmpty()
        .withMessage("the online_status should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["online", "offline"])
        .withMessage(
          "the online_status value is not among the expected ones which include: online, offline"
        ),
      query("last_active_before")
        .optional()
        .notEmpty()
        .withMessage("last_active_before date cannot be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage(
          "last_active_before date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
        )
        .bail()
        .toDate(),
      query("last_active_after")
        .optional()
        .notEmpty()
        .withMessage("last_active_after date cannot be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage(
          "last_active_after date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
        )
        .bail()
        .toDate(),
      query("last_active")
        .optional()
        .notEmpty()
        .withMessage("last_active date cannot be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage(
          "last_active date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
        )
        .bail()
        .toDate(),
    ],
  ]),
  siteController.listSummary
);
router.get("/weather", siteController.listWeatherStations);
router.get(
  "/weather/nearest",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  siteController.listNearestWeatherStation
);
router.get(
  "/airqlouds/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  siteController.findAirQlouds
);
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("latitude")
        .exists()
        .withMessage("the latitude is is missing in your request")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .exists()
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("name")
        .exists()
        .withMessage("the name is is missing in your request")
        .bail()
        .trim()
        .custom((value) => {
          return createSiteUtil.validateSiteName(value);
        })
        .withMessage(
          "The name should be greater than 5 and less than 50 in length"
        ),
      body("site_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the site_tags should not be empty"),
      body("airqlouds")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the airqlouds should be an array")
        .bail()
        .notEmpty()
        .withMessage("the airqlouds should not be empty"),
      body("airqlouds.*")
        .optional()
        .isMongoId()
        .withMessage("each airqloud should be a mongo ID"),
      body("site_category")
        .optional()
        .custom(validateCategoryField)
        .withMessage(
          "Invalid site_category format, crosscheck the types or content of all the provided nested fields. latitude, longitude & search_radius should be numbers. tags should be an array of strings. category, search_tags & search_radius are required fields"
        ),
    ],
  ]),
  siteController.register
);
router.post(
  "/metadata",
  oneOf([
    [
      body("latitude")
        .exists()
        .withMessage("the latitude should be provided")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 2) {
            return Promise.reject(
              "the latitude must have 2 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00");
        })
        .isDecimal({ decimal_digits: 2 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .exists()
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude should be provided")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 2) {
            return Promise.reject(
              "the longitude must have 2 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00");
        })
        .isDecimal({ decimal_digits: 2 })
        .withMessage("the longitude must have atleast 2 decimal places in it"),
    ],
  ]),
  siteController.generateMetadata
);
router.put(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  oneOf([
    [
      body("status")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["active", "decommissioned"])
        .withMessage(
          "the status value is not among the expected ones which include: decommissioned, active"
        ),
      body("visibility")
        .optional()
        .notEmpty()
        .withMessage("visibility cannot be empty IF provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("nearest_tahmo_station")
        .optional()
        .notEmpty()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the nearest_tahmo_station should be an object"),
      body("createdAt")
        .optional()
        .notEmpty()
        .withMessage("createdAt cannot be empty when provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("createdAt date must be a valid datetime."),
      body("location_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the location_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("distance_to_nearest_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_primary_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_primary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_secondary_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_secondary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_tertiary_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_tertiary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_unclassified_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_unclassified_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_residential_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_residential_road must be a number")
        .bail()
        .toFloat(),
      body("bearing_to_kampala_center")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("bearing_to_kampala_center must be a number")
        .bail()
        .toFloat(),
      body("distance_to_kampala_center")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_kampala_center must be a number")
        .bail()
        .toFloat(),
      body("bearing_to_capital_city_center")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("bearing_to_capital_city_center must be a number")
        .bail()
        .toFloat(),
      body("distance_to_capital_city_center")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_capital_city_center must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_residential_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_residential_road must be a number")
        .bail()
        .toFloat(),
      body(" distance_to_nearest_city")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage(" distance_to_nearest_city must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_motorway")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_motorway must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_road must be a number")
        .bail()
        .toFloat(),
      body("landform_270")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("landform_270 must be a number")
        .bail()
        .toFloat(),
      body("landform_90")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("landform_90 must be a number")
        .bail()
        .toFloat(),
      body("greenness")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("greenness must be a number")
        .bail()
        .toFloat(),
      body("altitude")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("altitude must be a number")
        .bail()
        .toFloat(),
      body("city")
        .optional()
        .notEmpty()
        .trim(),
      body("street")
        .optional()
        .notEmpty()
        .trim(),
      body("latitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("data_provider")
        .optional()
        .notEmpty()
        .withMessage("the data_provider should not be empty")
        .trim(),
      body("site_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the site_tags should not be empty"),
      body("airqlouds")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the airqlouds should be an array")
        .bail()
        .notEmpty()
        .withMessage("the airqlouds should not be empty"),
      body("airqlouds.*")
        .optional()
        .isMongoId()
        .withMessage("each airqloud should be a mongo ID"),
      body("site_category")
        .optional()
        .custom(validateCategoryField)
        .withMessage(
          "Invalid site_category format, crosscheck the types or content of all the provided nested fields. latitude, longitude & search_radius should be numbers. tags should be an array of strings. category, search_tags & search_radius are required fields"
        ),
    ],
  ]),
  siteController.update
);
router.put(
  "/refresh",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  siteController.refresh
);
router.delete(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      ),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      ),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      ),
  ]),
  siteController.delete
);
router.get(
  "/nearest",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("longitude")
        .exists()
        .withMessage("the longitude is missing in request")
        .bail()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 1) {
            return Promise.reject(
              "the longitude must have 1 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      query("radius")
        .exists()
        .withMessage("the radius is missing in request")
        .bail()
        .trim()
        .isFloat()
        .withMessage("the radius must be a number")
        .bail()
        .toFloat(),
      query("latitude")
        .exists()
        .withMessage("the latitude is missing in the request")
        .bail()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 1) {
            return Promise.reject(
              "the latitude must have 1 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
    ],
  ]),
  siteController.findNearestSite
);
module.exports = router;
