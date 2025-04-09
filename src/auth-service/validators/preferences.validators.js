// preferences.validators.js
const { body, oneOf, query, param } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const isEmpty = require("is-empty");
const { isMongoId } = require("validator");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo", "airqount"])
      .withMessage("the tenant value is not among the expected ones"),
  ],
  userId: [
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
        .customSanitizer((value) => ObjectId(value)),
    ]),
  ],
  selectedSites: (requiredFields, allowId = false) => {
    return (req, res, next) => {
      let selectedSites = req.body.selected_sites || req.body; //check both locations for flexibility
      const errors = {};

      // If selectedSites is undefined or null, skip validation
      if (selectedSites === undefined) {
        return next();
      }

      // If allowId is true and selected_sites is not in body, skip
      if (allowId && !req.body.selected_sites) {
        return next();
      }

      // Early check for selectedSites type
      if (
        !Array.isArray(selectedSites) &&
        (typeof selectedSites !== "object" || selectedSites === null)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Request body(field) for Selected Sites should contain either an array of Site objects or be omitted.",
        });
      }

      const validateSite = (site, index) => {
        const siteErrors = [];
        if (!site) {
          siteErrors.push("Site value must not be null or undefined");
        }
        if (!allowId && "_id" in site) {
          siteErrors.push("_id field is not allowed");
        }
        requiredFields.forEach((field) => {
          if (!(field in site)) {
            siteErrors.push(`Field "${field}" is missing`);
          }
        });
        if (allowId && site._id && !isMongoId(site._id)) {
          siteErrors.push("_id must be a valid MongoDB ObjectId");
        }
        if (!allowId && site.site_id && !isMongoId(site.site_id)) {
          siteErrors.push("site_id must be a valid MongoDB ObjectId");
        }
        // Validate latitude
        if (site.latitude !== undefined) {
          const latValue = parseFloat(site.latitude);
          if (Number.isNaN(latValue) || latValue < -90 || latValue > 90) {
            siteErrors.push("latitude must be between -90 and 90");
          }
        }

        // Validate longitude
        if (site.longitude !== undefined) {
          const longValue = parseFloat(site.longitude);
          if (Number.isNaN(longValue) || longValue < -180 || longValue > 180) {
            siteErrors.push("longitude must be between -180 and 180");
          }
        }

        // Validate approximate_latitude
        if (site.approximate_latitude !== undefined) {
          const approxLatValue = parseFloat(site.approximate_latitude);
          if (
            Number.isNaN(approxLatValue) ||
            approxLatValue < -90 ||
            approxLatValue > 90
          ) {
            siteErrors.push("approximate_latitude must be between -90 and 90");
          }
        }

        // Validate approximate_longitude
        if (site.approximate_longitude !== undefined) {
          const approxLongValue = parseFloat(site.approximate_longitude);
          if (
            Number.isNaN(approxLongValue) ||
            approxLongValue < -180 ||
            approxLongValue > 180
          ) {
            siteErrors.push(
              "approximate_longitude must be between -180 and 180"
            );
          }
        }

        // Validate site_tags
        const tags = site.site_tags;
        if (!isEmpty(tags)) {
          if (!Array.isArray(tags)) {
            siteErrors.push("site_tags must be an array");
          }

          tags.forEach((tag, tagIndex) => {
            if (typeof tag !== "string") {
              siteErrors.push(`site_tags[${tagIndex}] must be a string`);
            }
          });
        }

        // Validate optional string fields only when they are present
        const optionalStringFields = [
          "country",
          "district",
          "sub_county",
          "parish",
          "county",
          "city",
          "generated_name",
          "lat_long",
          "formatted_name",
          "region",
          "search_name",
        ];

        optionalStringFields.forEach((field) => {
          if (field in site) {
            // Only check if the field is provided
            if (typeof site[field] !== "string" || site[field].trim() === "") {
              siteErrors.push(`${field} must be a non-empty string`);
            }
          }
        });

        // Validate isFeatured field
        if ("isFeatured" in site) {
          // Check only if provided
          if (typeof site.isFeatured !== "boolean") {
            siteErrors.push(`isFeatured must be a boolean`);
          }
        }

        return siteErrors;
      };

      if (Array.isArray(selectedSites)) {
        selectedSites.forEach((site, index) => {
          const siteErrors = validateSite(site, index);
          if (siteErrors.length > 0) {
            errors[`selected_sites[${index}]`] =
              errors[`selected_sites[${index}]`] || [];
            errors[`selected_sites[${index}]`].push(...siteErrors);
          }
        });

        // Unique checks after validating each item
        const uniqueSiteIds = new Set();
        const uniqueSearchNames = new Set();
        const uniqueNames = new Set();

        selectedSites.forEach((item, idx) => {
          // Check for duplicate site_id
          if (item.site_id !== undefined) {
            if (uniqueSiteIds.has(item.site_id)) {
              errors[`selected_sites[${idx}]`] =
                errors[`selected_sites[${idx}]`] || [];
              errors[`selected_sites[${idx}]`].push(
                `Duplicate site_id: ${item.site_id}`
              );
            } else {
              uniqueSiteIds.add(item.site_id);
            }
          }

          // Check for duplicate search_name
          if (item.search_name !== undefined) {
            if (uniqueSearchNames.has(item.search_name)) {
              errors[`selected_sites[${idx}]`] =
                errors[`selected_sites[${idx}]`] || [];
              errors[`selected_sites[${idx}]`].push(
                `Duplicate search_name: ${item.search_name}`
              );
            } else {
              uniqueSearchNames.add(item.search_name);
            }
          }

          // Check for duplicate name
          if (item.name !== undefined) {
            if (uniqueNames.has(item.name)) {
              errors[`selected_sites[${idx}]`] =
                errors[`selected_sites[${idx}]`] || [];
              errors[`selected_sites[${idx}]`].push(
                `Duplicate name: ${item.name}`
              );
            } else {
              uniqueNames.add(item.name);
            }
          }
        });
      } else if (typeof selectedSites === "object" && selectedSites !== null) {
        const siteErrors = validateSite(selectedSites, 0);
        if (siteErrors.length > 0) {
          errors[`selected_sites[0]`] = errors[`selected_sites[0]`] || [];
          errors[`selected_sites[0]`].push(...siteErrors);
        }
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Request body(field) for Selected Sites should contain either an array of Site objects or a single Site object",
        });
      }

      // Process errors
      // If any errors were collected, respond with them
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          success: false,
          message: "bad request errors",
          errors,
        });
      }

      next();
    };
  },
  preferenceBody: [
    //validations for the request body itself
    oneOf([
      [
        body("user_id")
          .optional()
          .notEmpty()
          .withMessage("the provided user_id should not be empty IF provided")
          .bail()
          .trim()
          .isMongoId()
          .withMessage("the user_id must be an object ID")
          .bail()
          .customSanitizer((value) => ObjectId(value)),
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
          .isISO8601({ strict: true, strictSeparator: true })
          .withMessage("startDate must be a valid datetime."),
        body("endDate")
          .optional()
          .notEmpty()
          .withMessage("the provided endDate should not be empty IF provided")
          .bail()
          .trim()
          .isISO8601({ strict: true, strictSeparator: true })
          .withMessage("endDate must be a valid datetime."),
        body("airqloud_id")
          .optional()
          .notEmpty()
          .withMessage(
            "the provided airqloud_id should not be empty IF provided"
          )
          .bail()
          .trim()
          .isMongoId()
          .withMessage("the airqloud_id must be an object ID")
          .bail()
          .customSanitizer((value) => ObjectId(value)),
        body("cohort_id")
          .optional()
          .notEmpty()
          .withMessage("the provided cohort_id should not be empty IF provided")
          .bail()
          .trim()
          .isMongoId()
          .withMessage("the cohort_id must be an object ID")
          .bail()
          .customSanitizer((value) => ObjectId(value)),
        body("grid_id")
          .optional()
          .notEmpty()
          .withMessage("the provided grid_id should not be empty IF provided")
          .bail()
          .trim()
          .isMongoId()
          .withMessage("the grid_id must be an object ID")
          .bail()
          .customSanitizer((value) => ObjectId(value)),
        body("chartTitle")
          .optional()
          .notEmpty()
          .withMessage(
            "the provided chartTitle should not be empty IF provided"
          )
          .bail()
          .trim(),
        body("period")
          .optional()
          .notEmpty()
          .withMessage("the provided period should not be empty IF provided")
          .bail()
          .custom((value) => typeof value === "object")
          .withMessage("the period should be an object"),
        body("chartSubTitle")
          .optional()
          .notEmpty()
          .withMessage(
            "the provided chartSubTitle should not be empty IF provided"
          )
          .bail()
          .trim(),
        body("site_ids")
          .optional()
          .notEmpty()
          .withMessage("the provided site_ids should not be empty IF provided")
          .bail()
          .custom((value) => Array.isArray(value))
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
          .withMessage(
            "the provided device_ids should not be empty IF provided"
          )
          .bail()
          .custom((value) => Array.isArray(value))
          .withMessage("the device_ids should be an array"),
        body("device_ids.*")
          .optional()
          .notEmpty()
          .withMessage("the provided device_id should not be empty IF provided")
          .bail()
          .trim()
          .isMongoId()
          .withMessage("device_id must be an object ID"),
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
          .withMessage(
            "the provided airqloud_id should not be empty IF provided"
          )
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
          .withMessage("the site_id must be an object ID"),
      ],
    ]),
  ],
};

const chartConfigValidation = [
  body("fieldId").isInt({ min: 1, max: 8 }).withMessage("Invalid fieldId"),
  body("title").optional().isString().withMessage("Title must be a string"),
  body("xAxisLabel")
    .optional()
    .isString()
    .withMessage("X-Axis Label must be a string"),
  body("yAxisLabel")
    .optional()
    .isString()
    .withMessage("Y-Axis Label must be a string"),
  body("color").optional().isString().withMessage("Color must be a string"),
  body("backgroundColor")
    .optional()
    .isString()
    .withMessage("Background Color must be a string"),
  body("chartType")
    .optional()
    .isIn(["Column", "Line", "Bar", "Spline", "Step"])
    .withMessage("Invalid chart type"),
  body("days").optional().isInt().withMessage("Days must be an integer"),
  body("results").optional().isInt().withMessage("Results must be an integer"),
  body("timescale")
    .optional()
    .isInt()
    .withMessage("Timescale must be an integer"),
  body("average").optional().isInt().withMessage("Average must be an integer"),
  body("median").optional().isInt().withMessage("Median must be an integer"),
  body("sum").optional().isInt().withMessage("Sum must be an integer"),
  body("rounding")
    .optional()
    .isInt()
    .withMessage("Rounding must be an integer"),
  body("dataMin")
    .optional()
    .isNumeric()
    .withMessage("Data Min must be a number"),
  body("dataMax")
    .optional()
    .isNumeric()
    .withMessage("Data Max must be a number"),
  body("yAxisMin")
    .optional()
    .isNumeric()
    .withMessage("Y-Axis Min must be a number"),
  body("yAxisMax")
    .optional()
    .isNumeric()
    .withMessage("Y-Axis Max must be a number"),
];

const preferenceValidations = {
  upsert: [
    ...commonValidations.tenant,
    ...commonValidations.userId,
    ...commonValidations.preferenceBody,
    commonValidations.selectedSites(["_id", "search_name", "name"], true),
  ],
  replace: [
    ...commonValidations.tenant,
    ...commonValidations.userId,
    ...commonValidations.preferenceBody,
    commonValidations.selectedSites(["_id", "search_name", "name"], true),
  ],
  update: [
    ...commonValidations.tenant,
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
    ...commonValidations.preferenceBody,
    commonValidations.selectedSites(["_id", "search_name", "name"], true),
  ],
  create: [
    ...commonValidations.tenant,
    ...commonValidations.userId,
    ...commonValidations.preferenceBody,
    commonValidations.selectedSites(["_id", "search_name", "name"], true),
  ],
  list: [...commonValidations.tenant, ...commonValidations.preferenceBody],
  deletePreference: [
    ...commonValidations.tenant,
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
  ],
  getSelectedSites: [
    ...commonValidations.tenant,
    ...commonValidations.preferenceBody,
  ],
  addSelectedSites: [
    ...commonValidations.tenant,
    commonValidations.selectedSites(["site_id", "search_name", "name"], false),
  ],
  updateSelectedSite: [
    ...commonValidations.tenant,
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
    commonValidations.selectedSites([], false),
  ],
  deleteSelectedSite: [
    ...commonValidations.tenant,
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
  ],
  getPreferenceByUserId: [
    ...commonValidations.tenant,
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
  pagination: (defaultLimit = 100, maxLimit = 1000) => {
    return (req, res, next) => {
      let limit = parseInt(req.query.limit || req.body.limit, 10);
      const skip = parseInt(req.query.skip || req.body.skip, 10) || 0;

      // Set default limit if not provided or invalid
      if (Number.isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }

      // Cap the limit at maxLimit
      if (limit > maxLimit) {
        limit = maxLimit;
      }

      // Set the validated limit and skip values in the request object
      req.pagination = {
        limit,
        skip,
      };

      next();
    };
  },
  createChart: [
    ...commonValidations.tenant,
    param("deviceId")
      .exists()
      .withMessage("Device ID is required")
      .isMongoId()
      .withMessage("Invalid Device ID"),
    body("chartConfig").isObject().withMessage("chartConfig must be an object"),
    ...chartConfigValidation,
  ],
  updateChart: [
    ...commonValidations.tenant,
    param("deviceId")
      .exists()
      .withMessage("Device ID is required")
      .isMongoId()
      .withMessage("Invalid Device ID"),
    param("chartId")
      .exists()
      .withMessage("Chart ID is required")
      .isMongoId()
      .withMessage("Invalid Chart ID"),
    body("fieldId")
      .optional()
      .isInt({ min: 1, max: 8 })
      .withMessage("Invalid fieldId"),
    body("title").optional().isString().withMessage("Title must be a string"),
    body("xAxisLabel")
      .optional()
      .isString()
      .withMessage("X-Axis Label must be a string"),
    body("yAxisLabel")
      .optional()
      .isString()
      .withMessage("Y-Axis Label must be a string"),
    body("color").optional().isString().withMessage("Color must be a string"),
    body("backgroundColor")
      .optional()
      .isString()
      .withMessage("Background Color must be a string"),
    body("chartType")
      .optional()
      .isIn(["Column", "Line", "Bar", "Spline", "Step"])
      .withMessage("Invalid chart type"),
    body("days").optional().isInt().withMessage("Days must be an integer"),
    body("results")
      .optional()
      .isInt()
      .withMessage("Results must be an integer"),
    body("timescale")
      .optional()
      .isInt()
      .withMessage("Timescale must be an integer"),
    body("average")
      .optional()
      .isInt()
      .withMessage("Average must be an integer"),
    body("median").optional().isInt().withMessage("Median must be an integer"),
    body("sum").optional().isInt().withMessage("Sum must be an integer"),
    body("rounding")
      .optional()
      .isInt()
      .withMessage("Rounding must be an integer"),
    body("dataMin")
      .optional()
      .isNumeric()
      .withMessage("Data Min must be a number"),
    body("dataMax")
      .optional()
      .isNumeric()
      .withMessage("Data Max must be a number"),
    body("yAxisMin")
      .optional()
      .isNumeric()
      .withMessage("Y-Axis Min must be a number"),
    body("yAxisMax")
      .optional()
      .isNumeric()
      .withMessage("Y-Axis Max must be a number"),
  ],
  deleteChart: [
    ...commonValidations.tenant,
    param("deviceId")
      .exists()
      .withMessage("Device ID is required")
      .isMongoId()
      .withMessage("Invalid Device ID"),
    param("chartId")
      .exists()
      .withMessage("Chart ID is required")
      .isMongoId()
      .withMessage("Invalid Chart ID"),
  ],
  getChartConfigurations: [
    ...commonValidations.tenant,
    param("deviceId")
      .exists()
      .withMessage("Device ID is required")
      .isMongoId()
      .withMessage("Invalid Device ID"),
  ],
  exportData: [
    ...commonValidations.tenant,
    param("deviceId")
      .exists()
      .withMessage("Device ID is required")
      .isMongoId()
      .withMessage("Invalid Device ID"),
    query("fields")
      .optional()
      .isString()
      .withMessage("Fields must be a comma-separated string of field IDs"),
    query("days").optional().isInt().withMessage("Days must be an integer"),
  ],
};

module.exports = preferenceValidations;
