const express = require("express");
const router = express.Router();
const createPreferenceController = require("@controllers/create-preference");
const { oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
// const { logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const { logText, logObject } = require("@utils/log");
const { isMongoId } = require("validator");
// const stringify = require("@utils/stringify");
const validateSelectedSites = require("@middleware/validateSelectedSites");

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

function createValidateSelectedSitesField(requiredFields, allowId = false) {
  return function (value) {
    if (!value) {
      throw new Error("Value must not be null or undefined");
    }
    // Edge case: Check if _id field is present
    if (!allowId && "_id" in value) {
      throw new Error("_id field is not allowed");
    }

    if (!requiredFields.every((field) => field in value)) {
      throw new Error(
        `Missing required fields: ${requiredFields
          .filter((field) => !(field in value))
          .join(", ")}`
      );
    }

    const isValidId = isMongoId(value._id);
    if (!isValidId && allowId) {
      throw new Error("_id must be a valid MongoDB ObjectId");
    }

    const isValidSiteId = isMongoId(value.site_id);
    if (!isValidSiteId && !allowId) {
      throw new Error("site_id must be a valid MongoDB ObjectId");
    }

    function validateNumericFields(fields) {
      for (const field of fields) {
        if (field in value) {
          const numValue = parseFloat(value[field]);
          if (Number.isNaN(numValue)) {
            throw new Error(`${field} must be a valid number`);
          } else if (
            field === "latitude" ||
            field === "longitude" ||
            field === "approximate_latitude" ||
            field === "approximate_longitude"
          ) {
            if (Math.abs(numValue) > 90) {
              throw new Error(`${field} must be between -90 and 90`);
            }
          } else if (field === "search_radius") {
            if (numValue <= 0) {
              throw new Error(`${field} must be greater than 0`);
            }
          }
        }
      }
      return true;
    }

    function validateStringFields(fields) {
      for (const field of fields) {
        if (
          field in value &&
          (typeof value[field] !== "string" || value[field].trim() === "")
        ) {
          throw new Error(`${field} must be a non-empty string`);
        } else if (!(field in value)) {
          // Log missing field
          throw new Error(`Field "${field}" is missing`);
        }
      }
      return true;
    }

    function validateTags(tags) {
      if (isEmpty(tags)) {
        return true;
      } else if (!Array.isArray(tags)) {
        throw new Error("site_tags must be an array");
      } else {
        tags.forEach((tag, index) => {
          if (typeof tag !== "string") {
            throw new Error(`site_tags[${index}] must be a string`);
          }
        });
      }
    }

    const numericValid = validateNumericFields([
      "latitude",
      "longitude",
      "approximate_latitude",
      "approximate_longitude",
    ]);

    const stringValid = validateStringFields(["name", "search_name"]);
    const tags = value && value.site_tags;
    const tagValid = validateTags(tags);

    return numericValid && stringValid && tagValid;
  };
}

const validateUniqueFieldsInSelectedSites = (req, res, next) => {
  const selectedSites = req.body.selected_sites;

  // Create Sets to track unique values for each field
  const uniqueSiteIds = new Set();
  const uniqueSearchNames = new Set();
  const uniqueNames = new Set();

  const duplicateSiteIds = [];
  const duplicateSearchNames = [];
  const duplicateNames = [];

  selectedSites.forEach((item) => {
    // Check for duplicate site_id if it exists
    if (item.site_id !== undefined) {
      if (uniqueSiteIds.has(item.site_id)) {
        duplicateSiteIds.push(item.site_id);
      } else {
        uniqueSiteIds.add(item.site_id);
      }
    }

    // Check for duplicate search_name if it exists
    if (item.search_name !== undefined) {
      if (uniqueSearchNames.has(item.search_name)) {
        duplicateSearchNames.push(item.search_name);
      } else {
        uniqueSearchNames.add(item.search_name);
      }
    }

    // Check for duplicate name if it exists
    if (item.name !== undefined) {
      if (uniqueNames.has(item.name)) {
        duplicateNames.push(item.name);
      } else {
        uniqueNames.add(item.name);
      }
    }
  });

  // Prepare error messages based on duplicates found
  let errorMessage = "";
  if (duplicateSiteIds.length > 0) {
    errorMessage +=
      "Duplicate site_ids found: " +
      [...new Set(duplicateSiteIds)].join(", ") +
      ". ";
  }
  if (duplicateSearchNames.length > 0) {
    errorMessage +=
      "Duplicate search_names found: " +
      [...new Set(duplicateSearchNames)].join(", ") +
      ". ";
  }
  if (duplicateNames.length > 0) {
    errorMessage +=
      "Duplicate names found: " +
      [...new Set(duplicateNames)].join(", ") +
      ". ";
  }

  // If any duplicates were found, respond with an error
  if (errorMessage) {
    return res.status(400).json({
      success: false,
      message: errorMessage.trim(),
    });
  }

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
      body("selected_sites")
        .optional()
        .notEmpty()
        .withMessage("the selected_sites should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the selected_sites should be an array"),
      // body("selected_sites.*")
      //   .optional()
      //   .custom(
      //     createValidateSelectedSitesField(["_id", "search_name", "name"], true)
      //   )
      //   .withMessage(
      //     "Invalid selected_sites format. Verify required fields (latitude, longitude, search_name, name, approximate_latitude, approximate_longitude), numeric fields (latitude, longitude, approximate_latitude, approximate_longitude, search_radius if present), string fields (name, search_name), and ensure site_tags is an array of strings."
      //   ),
    ],
  ]),
  createPreferenceController.upsert
);
router.patch(
  "/replace",
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
      body("selected_sites")
        .optional()
        .notEmpty()
        .withMessage("the selected_sites should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the selected_sites should be an array"),
      // body("selected_sites.*")
      //   .optional()
      //   .custom(
      //     createValidateSelectedSitesField(["_id", "search_name", "name"], true)
      //   ),
    ],
  ]),
  createPreferenceController.replace
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
      body("selected_sites")
        .optional()
        .notEmpty()
        .withMessage("the selected_sites should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the selected_sites should be an array"),
      // body("selected_sites.*")
      //   .optional()
      //   .custom(
      //     createValidateSelectedSitesField(["_id", "search_name", "name"], true)
      //   )
      //   .withMessage(
      //     "Invalid selected_sites format. Verify required fields (latitude, longitude, search_name, name, approximate_latitude, approximate_longitude), numeric fields (latitude, longitude, approximate_latitude, approximate_longitude, search_radius if present), string fields (name, search_name), and ensure site_tags is an array of strings."
      //   ),
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
      body("selected_sites")
        .optional()
        .notEmpty()
        .withMessage("the selected_sites should not be empty IF provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the selected_sites should be an array"),
      // body("selected_sites.*")
      //   .optional()
      //   .custom(
      //     createValidateSelectedSitesField(["_id", "search_name", "name"], true)
      //   )
      //   .withMessage(
      //     "Invalid selected_sites format. Verify required fields (latitude, longitude, search_name, name, approximate_latitude, approximate_longitude), numeric fields (latitude, longitude, approximate_latitude, approximate_longitude, search_radius if present), string fields (name, search_name), and ensure site_tags is an array of strings."
      //   ),
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
      .withMessage("the the user_id is missing in request")
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
  "/selected-sites",
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
  createPreferenceController.listSelectedSites
);
router.post(
  "/selected-sites",
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
  validateUniqueFieldsInSelectedSites,
  validateSelectedSites(["site_id", "search_name", "name"], false),
  setJWTAuth,
  authJWT,
  createPreferenceController.addSelectedSites
);
router.put(
  "/selected-sites/:site_id",
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
  param("site_id")
    .exists()
    .withMessage("the site_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("site_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  setJWTAuth,
  authJWT,
  createPreferenceController.updateSelectedSite
);
router.delete(
  "/selected-sites/:site_id",
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
  param("site_id")
    .exists()
    .withMessage("the site_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("site_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  setJWTAuth,
  authJWT,
  createPreferenceController.deleteSelectedSite
);
router.get(
  "/:user_id",
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
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
  setJWTAuth,
  authJWT,
  createPreferenceController.list
);

module.exports = router;
