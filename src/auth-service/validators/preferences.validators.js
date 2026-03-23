// preferences.validators.js
const { body, oneOf, query, param } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const isEmpty = require("is-empty");
const { isMongoId } = require("validator");
const constants = require("@config/constants");

const themeValidations = {
  theme: [
    body("theme")
      .exists()
      .withMessage("Theme object is required")
      .bail()
      .isObject()
      .withMessage("Theme must be an object")
      .bail()
      .custom((value) => {
        // Validate theme object has at least one valid property
        const validProperties = [
          "primaryColor",
          "mode",
          "interfaceStyle",
          "contentLayout",
        ];
        const hasValidProperty = validProperties.some((prop) =>
          Object.hasOwn(value, prop),
        );
        if (!hasValidProperty) {
          throw new Error(
            "Theme must contain at least one valid property: primaryColor, mode, interfaceStyle, or contentLayout",
          );
        }
        return true;
      }),
    body("theme.primaryColor")
      .optional()
      .isString()
      .withMessage("Primary color must be a string")
      .bail()
      .custom((value) => {
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        const cssColorRegex =
          /^(red|blue|green|yellow|purple|orange|pink|cyan|magenta|black|white|gray|grey|brown)$/i;
        if (!hexColorRegex.test(value) && !cssColorRegex.test(value)) {
          throw new Error(
            "Invalid color format. Use hex (#RRGGBB) or CSS color names",
          );
        }
        return true;
      }),
    body("theme.mode")
      .optional()
      .isIn(["light", "dark", "system"])
      .withMessage("Mode must be one of: light, dark, system"),
    body("theme.interfaceStyle")
      .optional()
      .isIn(["default", "bordered"])
      .withMessage("Interface style must be one of: default, bordered"),
    body("theme.contentLayout")
      .optional()
      .isIn(["compact", "wide"])
      .withMessage("Content layout must be one of: compact, wide"),
  ],
};

const enhancedIdValidations = {
  userId: [
    param("user_id")
      .exists()
      .withMessage("User ID is required")
      .bail()
      .isMongoId()
      .withMessage("User ID must be a valid MongoDB ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  groupId: [
    param("group_id")
      .exists()
      .withMessage("Group ID is required")
      .bail()
      .isMongoId()
      .withMessage("Group ID must be a valid MongoDB ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  networkId: [
    param("network_id")
      .exists()
      .withMessage("Network ID is required")
      .bail()
      .isMongoId()
      .withMessage("Network ID must be a valid MongoDB ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  optionalGroupId: [
    query("group_id")
      .optional()
      .isMongoId()
      .withMessage("Group ID must be a valid MongoDB ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  optionalNetworkId: [
    query("network_id")
      .optional()
      .isMongoId()
      .withMessage("Network ID must be a valid MongoDB ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
};

const createNestedValidations = (prefix) => {
  return [
    // Basic fields
    body(`${prefix}.title`)
      .optional()
      .isString()
      .withMessage("Title must be a string"),
    body(`${prefix}.xAxisLabel`)
      .optional()
      .isString()
      .withMessage("X-Axis Label must be a string"),
    body(`${prefix}.yAxisLabel`)
      .optional()
      .isString()
      .withMessage("Y-Axis Label must be a string"),
    body(`${prefix}.color`)
      .optional()
      .isString()
      .withMessage("Color must be a string"),
    body(`${prefix}.backgroundColor`)
      .optional()
      .isString()
      .withMessage("Background Color must be a string"),
    body(`${prefix}.chartType`)
      .optional()
      .isIn([
        "Column",
        "Line",
        "Bar",
        "Spline",
        "Step",
        "Area",
        "Scatter",
        "Bubble",
        "Heatmap",
        "Pie",
      ])
      .withMessage(
        "Chart type must be one of: Column, Line, Bar, Spline, Step, Area, Scatter, Bubble, Heatmap, Pie",
      ),
    body(`${prefix}.days`)
      .optional()
      .isInt()
      .withMessage("Days must be an integer"),
    body(`${prefix}.results`)
      .optional()
      .isInt()
      .withMessage("Results must be an integer"),
    body(`${prefix}.timescale`)
      .optional()
      .isInt()
      .withMessage("Timescale must be an integer"),
    body(`${prefix}.average`)
      .optional()
      .isInt()
      .withMessage("Average must be an integer"),
    body(`${prefix}.median`)
      .optional()
      .isInt()
      .withMessage("Median must be an integer"),
    body(`${prefix}.sum`)
      .optional()
      .isInt()
      .withMessage("Sum must be an integer"),
    body(`${prefix}.rounding`)
      .optional()
      .isInt()
      .withMessage("Rounding must be an integer"),
    body(`${prefix}.dataMin`)
      .optional()
      .isNumeric()
      .withMessage("Data Min must be a number"),
    body(`${prefix}.dataMax`)
      .optional()
      .isNumeric()
      .withMessage("Data Max must be a number"),
    body(`${prefix}.yAxisMin`)
      .optional()
      .isNumeric()
      .withMessage("Y-Axis Min must be a number"),
    body(`${prefix}.yAxisMax`)
      .optional()
      .isNumeric()
      .withMessage("Y-Axis Max must be a number"),

    // Boolean fields
    body(`${prefix}.showLegend`)
      .optional()
      .isBoolean()
      .withMessage("showLegend must be a boolean"),
    body(`${prefix}.showGrid`)
      .optional()
      .isBoolean()
      .withMessage("showGrid must be a boolean"),
    body(`${prefix}.showTooltip`)
      .optional()
      .isBoolean()
      .withMessage("showTooltip must be a boolean"),
    body(`${prefix}.isPublic`)
      .optional()
      .isBoolean()
      .withMessage("isPublic must be a boolean"),
    body(`${prefix}.showMultipleSeries`)
      .optional()
      .isBoolean()
      .withMessage("showMultipleSeries must be a boolean"),
    body(`${prefix}.refreshInterval`)
      .optional()
      .isInt({ min: 0 })
      .withMessage("refreshInterval must be a non-negative integer"),

    // Complex nested objects
    body(`${prefix}.referenceLines`)
      .optional()
      .isArray()
      .withMessage("referenceLines must be an array"),
    body(`${prefix}.referenceLines.*.value`)
      .optional()
      .isNumeric()
      .withMessage("Reference line value must be a number"),
    body(`${prefix}.referenceLines.*.label`)
      .optional()
      .isString()
      .withMessage("Reference line label must be a string"),
    body(`${prefix}.referenceLines.*.color`)
      .optional()
      .isString()
      .withMessage("Reference line color must be a string"),
    body(`${prefix}.referenceLines.*.style`)
      .optional()
      .isIn(["solid", "dashed", "dotted"])
      .withMessage(
        "Reference line style must be one of: solid, dashed, dotted",
      ),

    body(`${prefix}.annotations`)
      .optional()
      .isArray()
      .withMessage("annotations must be an array"),
    body(`${prefix}.annotations.*.x`)
      .optional()
      .isNumeric()
      .withMessage("Annotation x value must be a number"),
    body(`${prefix}.annotations.*.y`)
      .optional()
      .isNumeric()
      .withMessage("Annotation y value must be a number"),
    body(`${prefix}.annotations.*.text`)
      .optional()
      .isString()
      .withMessage("Annotation text must be a string"),
    body(`${prefix}.annotations.*.color`)
      .optional()
      .isString()
      .withMessage("Annotation color must be a string"),

    body(`${prefix}.transformation`)
      .optional()
      .isObject()
      .withMessage("transformation must be an object"),
    body(`${prefix}.transformation.type`)
      .optional()
      .isIn(["none", "log", "sqrt", "pow"])
      .withMessage("Transformation type must be one of: none, log, sqrt, pow"),
    body(`${prefix}.transformation.factor`)
      .optional()
      .isNumeric()
      .withMessage("Transformation factor must be a number"),

    body(`${prefix}.comparisonPeriod`)
      .optional()
      .isObject()
      .withMessage("comparisonPeriod must be an object"),
    body(`${prefix}.comparisonPeriod.enabled`)
      .optional()
      .isBoolean()
      .withMessage("comparisonPeriod.enabled must be a boolean"),
    body(`${prefix}.comparisonPeriod.type`)
      .optional()
      .isIn(["previousDay", "previousWeek", "previousMonth", "previousYear"])
      .withMessage(
        "comparisonPeriod.type must be one of: previousDay, previousWeek, previousMonth, previousYear",
      ),

    body(`${prefix}.additionalSeries`)
      .optional()
      .isArray()
      .withMessage("additionalSeries must be an array"),
    body(`${prefix}.additionalSeries.*.fieldId`)
      .optional()
      .isInt({ min: 1, max: 8 })
      .withMessage(
        "Additional series fieldId must be an integer between 1 and 8",
      ),
    body(`${prefix}.additionalSeries.*.label`)
      .optional()
      .isString()
      .withMessage("Additional series label must be a string"),
    body(`${prefix}.additionalSeries.*.color`)
      .optional()
      .isString()
      .withMessage("Additional series color must be a string"),
  ];
};

const validateArrayOfObjects = (fieldName, requiredFields = []) => [
  body(fieldName)
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true;

      if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
      }

      // Check each item in the array is an object, not a string
      value.forEach((item, index) => {
        if (typeof item === "string") {
          throw new Error(
            `${fieldName}[${index}] must be an object with properties, not a string. Expected format: {_id: "...", name: "...", search_name: "..."}`,
          );
        }

        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          throw new Error(
            `${fieldName}[${index}] must be an object, received ${typeof item}`,
          );
        }

        // Check required fields
        requiredFields.forEach((field) => {
          if (!Object.prototype.hasOwnProperty.call(item, field)) {
            throw new Error(
              `${fieldName}[${index}] is missing required field: ${field}`,
            );
          }
        });
      });

      return true;
    })
    .withMessage(
      `${fieldName} must be an array of objects with required fields`,
    ),
];

const validateArrayOfObjectIds = (fieldName) => [
  body(fieldName)
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true;

      if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array of ObjectIds`);
      }

      // Check each item is a valid ObjectId string, not an object
      value.forEach((item, index) => {
        if (typeof item === "object") {
          throw new Error(
            `${fieldName}[${index}] must be an ObjectId string, not an object`,
          );
        }

        if (typeof item !== "string" || !isMongoId(item)) {
          throw new Error(
            `${fieldName}[${index}] must be a valid MongoDB ObjectId string`,
          );
        }
      });

      return true;
    })
    .withMessage(`${fieldName} must be an array of valid ObjectId strings`),
];

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
  userId: [
    oneOf([
      param("user_id")
        .exists()
        .withMessage(
          "the record's identifier is missing in request, consider using the user_id",
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
      let selectedSites = req.body.selected_sites;
      const errors = {};

      // If selectedSites is undefined or null, skip validation
      if (selectedSites === undefined || selectedSites === null) {
        return next();
      }

      // If allowId is true and selected_sites is not in body, skip validation
      if (allowId && !req.body.selected_sites) {
        return next();
      }

      // Primary type validation - check for invalid types first
      if (typeof selectedSites === "string") {
        return res.status(400).json({
          success: false,
          message: "Validation Error: selected_sites cannot be a string",
          errors: {
            selected_sites:
              "Expected an array of objects or a single object, received a string",
          },
        });
      }

      if (typeof selectedSites !== "object") {
        return res.status(400).json({
          success: false,
          message:
            "Validation Error: selected_sites must be an array of objects or a single object",
          errors: {
            selected_sites: `Expected object or array, received ${typeof selectedSites}`,
          },
        });
      }

      // If it's an array, check for string elements (common mistake)
      if (Array.isArray(selectedSites)) {
        const stringItems = selectedSites.filter((item, index) => {
          if (typeof item === "string") {
            errors[`selected_sites[${index}]`] =
              `Must be an object with properties like {_id, name, search_name}, not a string: "${item}"`;
            return true;
          }
          return false;
        });

        if (stringItems.length > 0) {
          return res.status(400).json({
            success: false,
            message:
              "Validation Error: selected_sites array contains strings instead of objects",
            errors,
          });
        }
      }

      // Validate individual site objects
      const validateSite = (site, index) => {
        const siteErrors = [];

        if (!site || typeof site !== "object" || Array.isArray(site)) {
          siteErrors.push("Site value must be a valid object");
          return siteErrors; // Return early if not an object
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
              "approximate_longitude must be between -180 and 180",
            );
          }
        }

        // Validate site_tags
        if (site.site_tags !== undefined && !isEmpty(site.site_tags)) {
          if (!Array.isArray(site.site_tags)) {
            siteErrors.push("site_tags must be an array");
          } else {
            site.site_tags.forEach((tag, tagIndex) => {
              if (typeof tag !== "string") {
                siteErrors.push(`site_tags[${tagIndex}] must be a string`);
              }
            });
          }
        }

        // Validate optional string fields
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
          if (field in site && site[field] !== undefined) {
            if (typeof site[field] !== "string" || site[field].trim() === "") {
              siteErrors.push(`${field} must be a non-empty string`);
            }
          }
        });

        // Validate isFeatured field
        if ("isFeatured" in site && site.isFeatured !== undefined) {
          if (typeof site.isFeatured !== "boolean") {
            siteErrors.push("isFeatured must be a boolean");
          }
        }

        return siteErrors;
      };

      // Process validation based on type
      if (Array.isArray(selectedSites)) {
        // Validate each site in the array
        selectedSites.forEach((site, index) => {
          const siteErrors = validateSite(site, index);
          if (siteErrors.length > 0) {
            errors[`selected_sites[${index}]`] = siteErrors;
          }
        });

        // Check for duplicates
        const uniqueSiteIds = new Set();
        const uniqueSearchNames = new Set();
        const uniqueNames = new Set();

        selectedSites.forEach((item, idx) => {
          if (typeof item === "object" && item !== null) {
            // Check for duplicate site_id
            if (item.site_id !== undefined) {
              if (uniqueSiteIds.has(item.site_id)) {
                errors[`selected_sites[${idx}]`] =
                  errors[`selected_sites[${idx}]`] || [];
                errors[`selected_sites[${idx}]`].push(
                  `Duplicate site_id: ${item.site_id}`,
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
                  `Duplicate search_name: ${item.search_name}`,
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
                  `Duplicate name: ${item.name}`,
                );
              } else {
                uniqueNames.add(item.name);
              }
            }
          }
        });
      } else {
        // Single object validation
        const siteErrors = validateSite(selectedSites, 0);
        if (siteErrors.length > 0) {
          errors[`selected_sites[0]`] = siteErrors;
        }
      }

      // If any errors were collected, respond with them
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation errors found in selected_sites",
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
            "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1",
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
            "the frequency value is not among the expected ones which include: daily, hourly and monthly",
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
            "the chartType value is not among the expected ones which include: bar, line and pie",
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
            "the provided airqloud_id should not be empty IF provided",
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
            "the provided chartTitle should not be empty IF provided",
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
            "the provided chartSubTitle should not be empty IF provided",
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
            "the provided device_ids should not be empty IF provided",
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
            "the provided airqloud_id should not be empty IF provided",
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

  // ObjectId array validations
  ...validateArrayOfObjectIds("airqloud_ids"),
  ...validateArrayOfObjectIds("cohort_ids"),
  ...validateArrayOfObjectIds("grid_ids"),
  ...validateArrayOfObjectIds("site_ids"),
  ...validateArrayOfObjectIds("device_ids"),
  ...validateArrayOfObjectIds("network_ids"),
  ...validateArrayOfObjectIds("group_ids"),

  //  validations with specific required fields
  ...validateArrayOfObjects("selected_sites", ["_id", "search_name", "name"]),
  ...validateArrayOfObjects("selected_grids", ["_id", "name"]),
  ...validateArrayOfObjects("selected_devices", ["_id", "name"]),
  ...validateArrayOfObjects("selected_cohorts", ["_id", "name"]),
  ...validateArrayOfObjects("selected_airqlouds", ["_id", "name"]),
};

const chartConfigValidation = [
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
  // Extended chart types
  body("chartType")
    .optional()
    .isIn([
      "Column",
      "Line",
      "Bar",
      "Spline",
      "Step",
      "Area",
      "Scatter",
      "Bubble",
      "Heatmap",
      "Pie",
    ])
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

  // New fields
  body("showLegend")
    .optional()
    .isBoolean()
    .withMessage("showLegend must be a boolean"),
  body("showGrid")
    .optional()
    .isBoolean()
    .withMessage("showGrid must be a boolean"),
  body("showTooltip")
    .optional()
    .isBoolean()
    .withMessage("showTooltip must be a boolean"),
  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic must be a boolean"),
  body("refreshInterval")
    .optional()
    .isInt({ min: 0 })
    .withMessage("refreshInterval must be a non-negative integer"),
  body("showMultipleSeries")
    .optional()
    .isBoolean()
    .withMessage("showMultipleSeries must be a boolean"),

  // Validation for nested objects
  body("referenceLines")
    .optional()
    .isArray()
    .withMessage("referenceLines must be an array"),
  body("referenceLines.*.value")
    .optional()
    .isNumeric()
    .withMessage("Reference line value must be a number"),
  body("referenceLines.*.label")
    .optional()
    .isString()
    .withMessage("Reference line label must be a string"),
  body("referenceLines.*.color")
    .optional()
    .isString()
    .withMessage("Reference line color must be a string"),
  body("referenceLines.*.style")
    .optional()
    .isIn(["solid", "dashed", "dotted"])
    .withMessage("Reference line style must be one of: solid, dashed, dotted"),

  body("annotations")
    .optional()
    .isArray()
    .withMessage("annotations must be an array"),
  body("annotations.*.x")
    .optional()
    .isNumeric()
    .withMessage("Annotation x value must be a number"),
  body("annotations.*.y")
    .optional()
    .isNumeric()
    .withMessage("Annotation y value must be a number"),
  body("annotations.*.text")
    .optional()
    .isString()
    .withMessage("Annotation text must be a string"),
  body("annotations.*.color")
    .optional()
    .isString()
    .withMessage("Annotation color must be a string"),

  body("transformation")
    .optional()
    .isObject()
    .withMessage("transformation must be an object"),
  body("transformation.type")
    .optional()
    .isIn(["none", "log", "sqrt", "pow"])
    .withMessage("Transformation type must be one of: none, log, sqrt, pow"),
  body("transformation.factor")
    .optional()
    .isNumeric()
    .withMessage("Transformation factor must be a number"),

  body("comparisonPeriod")
    .optional()
    .isObject()
    .withMessage("comparisonPeriod must be an object"),
  body("comparisonPeriod.enabled")
    .optional()
    .isBoolean()
    .withMessage("comparisonPeriod.enabled must be a boolean"),
  body("comparisonPeriod.type")
    .optional()
    .isIn(["previousDay", "previousWeek", "previousMonth", "previousYear"])
    .withMessage(
      "comparisonPeriod.type must be one of: previousDay, previousWeek, previousMonth, previousYear",
    ),

  body("additionalSeries")
    .optional()
    .isArray()
    .withMessage("additionalSeries must be an array"),
  body("additionalSeries.*.fieldId")
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage(
      "Additional series fieldId must be an integer between 1 and 8",
    ),
  body("additionalSeries.*.label")
    .optional()
    .isString()
    .withMessage("Additional series label must be a string"),
  body("additionalSeries.*.color")
    .optional()
    .isString()
    .withMessage("Additional series color must be a string"),
];

const preferenceValidations = {
  validatePreferenceData: [
    ...commonValidations.tenant,
    ...commonValidations.preferenceBody,
    commonValidations.selectedSites(["_id", "search_name", "name"], true),
  ],
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
        "the record's identifier is missing in request, consider using the user_id",
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
  // Replace the existing createChart validation with this improved version
  createChart: [
    ...commonValidations.tenant,
    param("deviceId")
      .exists()
      .withMessage("Device ID is required")
      .bail()
      .isMongoId()
      .withMessage("Invalid Device ID"),
    body("chartConfig")
      .exists()
      .withMessage("chartConfig object is required")
      .bail()
      .isObject()
      .withMessage("chartConfig must be an object"),
    body("chartConfig.fieldId")
      .exists()
      .withMessage("fieldId is required in chartConfig")
      .bail()
      .isInt({ min: 1, max: 8 })
      .withMessage("fieldId must be an integer between 1 and 8"),
    ...createNestedValidations("chartConfig"),
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
    // Use all validations from chartConfigValidation
    ...chartConfigValidation,
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
  getChartConfigurationById: [
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
  copyChart: [
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

  // ===========================================
  // INDIVIDUAL USER THEME VALIDATIONS
  // ===========================================

  // Personal theme validations
  getUserPersonalTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
  ],

  updateUserPersonalTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...themeValidations.theme,
  ],

  // User group theme validations
  getUserGroupTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...enhancedIdValidations.groupId,
  ],

  updateUserGroupTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...enhancedIdValidations.groupId,
    ...themeValidations.theme,
  ],

  // User default group theme validations (no group_id param)
  getUserDefaultGroupTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
  ],

  updateUserDefaultGroupTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...themeValidations.theme,
  ],

  // User network theme validations
  getUserNetworkTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...enhancedIdValidations.networkId,
  ],

  updateUserNetworkTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...enhancedIdValidations.networkId,
    ...themeValidations.theme,
  ],

  // User default network theme validations (no network_id param)
  getUserDefaultNetworkTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
  ],

  updateUserDefaultNetworkTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...themeValidations.theme,
  ],

  // ===========================================
  // ORGANIZATION THEME VALIDATIONS
  // ===========================================

  // Group theme validations
  getGroupTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.groupId,
  ],

  updateGroupTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.groupId,
    ...themeValidations.theme,
  ],

  // Network theme validations
  getNetworkTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.networkId,
  ],

  updateNetworkTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.networkId,
    ...themeValidations.theme,
  ],

  // ===========================================
  // EFFECTIVE THEME VALIDATION
  // ===========================================

  getEffectiveTheme: [
    ...commonValidations.tenant,
    ...enhancedIdValidations.userId,
    ...enhancedIdValidations.optionalGroupId,
    ...enhancedIdValidations.optionalNetworkId,
  ],
};

module.exports = preferenceValidations;
