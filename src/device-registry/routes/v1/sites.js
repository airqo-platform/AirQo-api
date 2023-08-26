const express = require("express");
const router = express.Router();
const siteController = require("@controllers/create-site");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const numeral = require("numeral");
const createSiteUtil = require("@utils/create-site");
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const decimalPlaces = require("decimal-places");

const { getModelByTenant } = require("@config/database");

const NetworkSchema = require("@models/Network");
const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
  }
};

const validNetworks = async () => {
  const networks = await NetworkModel("airqo").distinct("name");
  return networks.map((network) => network.toLowerCase());
};

const validateNetwork = async (value) => {
  const networks = await validNetworks();
  if (!networks.includes(value.toLowerCase())) {
    throw new Error("Invalid network");
  }
};

const headers = (req, res, next) => {
  // const allowedOrigins = constants.DOMAIN_WHITELIST;
  // const origin = req.headers.origin;
  // if (allowedOrigins.includes(origin)) {
  //   res.setHeader("Access-Control-Allow-Origin", origin);
  // }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);

/****************************** create sites usecase *************** */

/** update metadata in bulk **/
router.put(
  "/bulk/update",
  oneOf([
    query("network")
      .exists()
      .withMessage("network should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the network value is not among the expected ones"),
  ]),
  siteController.bulkUpdate
);

/** delete metadata in bulk **/
router.delete("/bulk/delete", siteController.bulkDelete);
router.post(
  "/bulk/add",
  oneOf([
    query("network")
      .exists()
      .withMessage("network should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the network value is not among the expected ones"),
  ]),
  siteController.bulkCreate
);

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
  siteController.listSummary
);

router.get("/weather", siteController.listWeatherStations);
router.get(
  "/weather/nearest",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
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
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
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
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
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
          return numeral(value).format("0.00000000000000");
        })
        .isDecimal({ decimal_digits: 14 })
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
          return numeral(value).format("0.00000000000000");
        })
        .isDecimal({ decimal_digits: 14 })
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
        .withMessage("the longitude should be provided")
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
    ],
  ]),
  siteController.generateMetadata
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
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
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
      body("nearest_tahmo_station")
        .optional()
        .notEmpty()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the nearest_tahmo_station should be an object"),
      body("land_use")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the land_use should be an array")
        .bail()
        .notEmpty()
        .withMessage("the land_use  should not be empty if provided"),
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
      body("aspect")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("aspect must be a number")
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
      body("site_codes")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_codes should be an array if provided")
        .bail()
        .notEmpty()
        .withMessage("the site_codes should not be empty if provided"),
    ],
  ]),
  siteController.update
);
router.put(
  "/refresh",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
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
  query("tenant")
    .exists()
    .withMessage("tenant should be provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.NETWORKS)
    .withMessage("the tenant value is not among the expected ones"),
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
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
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
    ],
  ]),
  siteController.findNearestSite
);

router.post(
  "/approximate",
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
        .withMessage("the latitude must have atleast 2 decimal places in it")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000000000000");
        })
        .isDecimal({ decimal_digits: 14 }),

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
        .withMessage("the longitude must have atleast 2 decimal places in it")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000000000000");
        })
        .isDecimal({ decimal_digits: 14 }),
    ],
  ]),
  siteController.createApproximateCoordinates
);
module.exports = router;
