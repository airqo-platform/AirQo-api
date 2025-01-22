const {
  query,
  body,
  param,
  oneOf,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const isEmpty = require("is-empty");
const { isMongoId } = require("validator");
const Joi = require("joi");

const validateTenant = () => {
  return query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones");
};

const pagination = (req, res, next) => {
  let limit = parseInt(req.query.limit || req.body.limit, 10) || 100;
  const skip = parseInt(req.query.skip || req.body.skip, 10) || 0;

  if (Number.isNaN(limit) || limit < 1) {
    limit = 100;
  }

  if (limit > 1000) {
    limit = 1000;
  }

  req.pagination = { limit, skip };

  next();
};

const validatePreferences = () => {
  return [
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
      .withMessage("the provided airqloud_id should not be empty IF provided")
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
      .withMessage("the provided chartTitle should not be empty IF provided")
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
      .withMessage("the provided chartSubTitle should not be empty IF provided")
      .bail()
      .trim(),
    body("site_ids")
      .optional()
      .notEmpty()
      .withMessage("the provided site_ids should not be empty IF provided")
      .bail()
      .isArray()
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
      .isArray()
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
      .customSanitizer((value) => ObjectId(value)),
    query("user_id")
      .optional()
      .notEmpty()
      .withMessage("the provided user_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => ObjectId(value)),
    query("airqloud_id")
      .optional()
      .notEmpty()
      .withMessage("the provided airqloud_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the airqloud_id must be an object ID")
      .bail()
      .customSanitizer((value) => ObjectId(value)),
    query("cohort_id")
      .optional()
      .notEmpty()
      .withMessage("the provided cohort_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the cohort_id must be an object ID")
      .bail()
      .customSanitizer((value) => ObjectId(value)),
    query("grid_id")
      .optional()
      .notEmpty()
      .withMessage("the provided grid_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the grid_id must be an object ID")
      .bail()
      .customSanitizer((value) => ObjectId(value)),
    query("site_id")
      .optional()
      .notEmpty()
      .withMessage("the provided site_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the site_id must be an object ID"),
  ];
};

const validateSelectedSites = (requiredFields, allowId = false) => {
  return [
    (req, res, next) => {
      const selectedSites = req.body.selected_sites || req.body;
      const errors = {};

      if (allowId && !req.body.selected_sites) {
        return next();
      }

      if (selectedSites === undefined) {
        return next();
      }

      if (!Array.isArray(selectedSites) && typeof selectedSites !== "object") {
        return next(
          new Error(
            "Invalid selected_sites format. Must be an array or object."
          )
        );
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

        if (site.latitude !== undefined) {
          const latValue = parseFloat(site.latitude);
          if (Number.isNaN(latValue) || latValue < -90 || latValue > 90) {
            siteErrors.push("latitude must be between -90 and 90");
          }
        }

        if (site.longitude !== undefined) {
          const longValue = parseFloat(site.longitude);
          if (Number.isNaN(longValue) || longValue < -180 || longValue > 180) {
            siteErrors.push("longitude must be between -180 and 180");
          }
        }

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
          if (
            field in site &&
            (typeof site[field] !== "string" || site[field].trim() === "")
          ) {
            siteErrors.push(`${field} must be a non-empty string`);
          }
        });

        if ("isFeatured" in site && typeof site.isFeatured !== "boolean") {
          siteErrors.push(`isFeatured must be a boolean`);
        }

        return siteErrors;
      };

      if (Array.isArray(selectedSites)) {
        selectedSites.forEach((site, index) => {
          const siteErrors = validateSite(site, index);
          if (siteErrors.length > 0) {
            errors[`selected_sites[${index}]`] = siteErrors;
          }
        });

        const uniqueSiteIds = new Set();
        const uniqueSearchNames = new Set();
        const uniqueNames = new Set();

        selectedSites.forEach((item, idx) => {
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
          errors[`selected_sites[0]`] = siteErrors;
        }
      } else {
        return next(
          new Error(
            "Invalid selected_sites format. Must be an array or object."
          )
        );
      }

      const validationErrors = validationResult(req);

      if (!validationErrors.isEmpty()) {
        return next(new Error(validationErrors.array()));
      }

      req.selectedSites = selectedSites;
      next();
    },
  ];
};

const validateUserIdBody = [
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
];

const validateUserIdParam = [
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
    .customSanitizer((value) => ObjectId(value)),
];

const validateSiteIdParam = oneOf([
  // Define validateSiteIdParam here, before it's used
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
]);

const upsert = [
  validateTenant(),
  validateUserIdBody,
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const replace = [
  validateTenant(),
  validateUserIdBody,
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const update = [
  validateTenant(),
  validateUserIdParam,
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const create = [
  validateTenant(),
  validateUserIdBody,
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const list = [
  validateTenant(),
  validatePreferences(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const deletePreference = [
  validateTenant(),
  validateUserIdParam,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const listSelectedSites = [
  validateTenant(),
  validatePreferences(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const addSelectedSites = [
  validateTenant(),
  validateSelectedSites(["site_id", "search_name", "name"], false),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const updateSelectedSite = [
  validateTenant(),
  validateSiteIdParam, //  Use validateSiteIdParam here
  validateSelectedSites([], false),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const deleteSelectedSite = [
  validateTenant(),
  validateSiteIdParam, //  Use validateSiteIdParam here
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const getPreferenceByUserId = [
  validateTenant(),
  validateUserIdParam,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).uppercase().default("USD"),
  customerId: Joi.string().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        priceId: Joi.string().required(),
        quantity: Joi.number().positive().default(1),
      })
    )
    .optional(),
});

const validatePayment = (req, res, next) => {
  const { error, value } = paymentSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: "Invalid payment details",
      details: error.details.map((detail) => detail.message),
    });
  }

  req.validatedPayment = value;
  next();
};

module.exports = {
  tenant: validateTenant,
  pagination,
  upsert,
  replace,
  update,
  create,
  list,
  deletePreference,
  listSelectedSites,
  addSelectedSites,
  updateSelectedSite,
  deleteSelectedSite,
  getPreferenceByUserId,
  validatePayment,
};
