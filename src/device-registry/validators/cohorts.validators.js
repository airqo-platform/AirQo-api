// cohorts.validators.js
const {
  oneOf,
  check,
  query,
  body,
  param,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = require("mongoose");
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const { validateNetwork, validateAdminLevels } = require("@validators/common");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError(
        "Validation error",
        httpStatus.BAD_REQUEST,
        errors.mapped(),
      ),
    );
  }
  next();
};

const validateTenant = query("tenant")
  .optional()
  .notEmpty()
  .withMessage("tenant should not be empty if provided")
  .trim()
  .toLowerCase()
  .bail()
  .isIn(constants.NETWORKS)
  .withMessage("the tenant value is not among the expected ones");

const createFromCohorts = [
  validateTenant,
  body("name")
    .exists()
    .withMessage("the new cohort's name is required")
    .bail()
    .notEmpty()
    .withMessage("the name must not be empty")
    .trim()
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "the name can only contain letters, numbers, spaces, hyphens and underscores",
    ),
  body("description")
    .optional()
    .notEmpty()
    .withMessage("the description must not be empty if provided")
    .trim(),
  body("cohort_ids")
    .exists()
    .withMessage("cohort_ids are required")
    .bail()
    .isArray({ min: 1 })
    .withMessage("cohort_ids must be a non-empty array of cohort ObjectIDs"),
  body("cohort_ids.*")
    .isMongoId()
    .withMessage("Each ID in cohort_ids must be a valid MongoDB ObjectId"),
];

const commonValidations = {
  tenant: [
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
  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
    return (req, res, next) => {
      let limit = parseInt(req.query.limit, 10);
      const skip = parseInt(req.query.skip, 10);
      if (Number.isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }
      if (limit > maxLimit) {
        limit = maxLimit;
      }
      if (Number.isNaN(skip) || skip < 0) {
        req.query.skip = 0;
      }
      req.query.limit = limit;
      req.query.skip = skip;

      next();
    };
  },
  name: [
    body("name")
      .exists()
      .withMessage("the name is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the name should not be empty")
      .trim()
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the name can only contain letters, numbers, spaces, hyphens and underscores",
      ),
  ],
  nameOptional: [
    body("name")
      .optional()
      .notEmpty()
      .withMessage("the name should not be empty if provided")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the name can only contain letters, numbers, spaces, hyphens and underscores",
      ),
  ],
  description: [
    body("description")
      .optional()
      .notEmpty()
      .withMessage("the description should not be empty if provided"),
  ],
  visibility: [
    body("visibility")
      .optional()
      .notEmpty()
      .withMessage("visibility cannot be empty IF provided")
      .bail()
      .trim()
      .isBoolean()
      .withMessage("visibility must be Boolean"),
  ],
  cohort_tags: [
    body("cohort_tags")
      .optional()
      .isArray()
      .withMessage("cohort_tags must be an array of strings")
      .bail()
      .notEmpty()
      .withMessage("cohort_tags should not be an empty array if provided"),
    body("cohort_tags.*")
      .isString()
      .withMessage("Each tag must be a string"),
  ],

  groups: [
    body("groups")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the groups should be an array")
      .bail()
      .notEmpty()
      .withMessage("the groups should not be empty"),
  ],

  network: [
    body("network")
      .exists()
      .withMessage("the network is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the network should not be empty")
      .bail()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the network value is not among the expected ones"),
  ],

  networkOptional: [
    body("network")
      .optional()
      .notEmpty()
      .withMessage("the network should not be empty if provided")
      .bail()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the network value is not among the expected ones"),
  ],

  validObjectId: (field, location = query) => {
    return location(field)
      .optional()
      .notEmpty()
      .withMessage("id cannot be empty")
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      });
  },

  paramObjectId: (field, location = param) => {
    return location(field)
      .exists()
      .withMessage(`the ${field} is missing in request`)
      .bail()
      .trim()
      .isMongoId()
      .withMessage(`${field} must be an object ID`)
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      });
  },
  deviceIdentifiers: oneOf([
    [
      body("devices")
        .exists()
        .withMessage(
          "device identifiers are missing in the request, consider using devices",
        )
        .bail()
        .custom((value) => Array.isArray(value))
        .withMessage("the devices should be an array")
        .bail()
        .notEmpty()
        .withMessage("the devices should not be empty"),
      body("devices.*")
        .isMongoId()
        .withMessage("device provided must be an object ID"),
    ],
    [
      body("device_ids")
        .exists()
        .withMessage(
          "device identifiers are missing in the request, consider using device_ids",
        )
        .bail()
        .custom((value) => Array.isArray(value))
        .withMessage("the device_ids should be an array")
        .bail()
        .notEmpty()
        .withMessage("the device_ids should not be empty"),
      body("device_ids.*")
        .isMongoId()
        .withMessage("device_id provided must be an object ID"),
    ],
    [
      body("device_names")
        .exists()
        .withMessage(
          "device identifiers are missing in the request, consider using device_names",
        )
        .bail()
        .custom((value) => Array.isArray(value))
        .withMessage("the device_names should be an array")
        .bail()
        .notEmpty()
        .withMessage("the device_names should not be empty"),
      body("device_names.*")
        .custom((value) => !/\s/.test(value))
        .withMessage("device_name provided must not contain spaces"),
    ],
  ]),
};

const cohortValidations = {
  createFromCohorts,
  updateCohortName: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    body("name")
      .exists()
      .withMessage("name is required for name updates")
      .bail()
      .notEmpty()
      .withMessage("name cannot be empty")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the name can only contain letters, numbers, spaces, hyphens and underscores",
      ),
    body("confirm_update")
      .exists()
      .withMessage("confirm_update is required for name updates")
      .bail()
      .isBoolean()
      .withMessage("confirm_update must be a boolean")
      .bail()
      .equals("true")
      .withMessage(
        "confirm_update must be set to true to proceed with name update",
      ),
    body("update_reason")
      .exists()
      .withMessage("update_reason is required for name updates")
      .bail()
      .notEmpty()
      .withMessage("update_reason cannot be empty")
      .bail()
      .isLength({ min: 10, max: 500 })
      .withMessage("update_reason must be between 10 and 500 characters"),
    handleValidationErrors,
  ],
  deleteCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    handleValidationErrors,
  ],

  updateCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    ...commonValidations.nameOptional,
    ...commonValidations.description,
    ...commonValidations.visibility,
    ...commonValidations.cohort_tags,
    ...commonValidations.groups,
    ...commonValidations.networkOptional,
    handleValidationErrors,
  ],

  createCohort: [
    ...commonValidations.tenant,
    ...commonValidations.name,
    ...commonValidations.description,
    ...commonValidations.groups,
    ...commonValidations.networkOptional,
    handleValidationErrors,
  ],
  listCohorts: [
    ...commonValidations.tenant,
    oneOf([commonValidations.validObjectId("id"), commonValidations.name]),
    query("sortBy")
      .optional()
      .notEmpty()
      .trim(),
    query("order")
      .optional()
      .notEmpty()
      .trim()
      .toLowerCase()
      .isIn(["asc", "desc"])
      .withMessage("the order value is not among the expected ones"),
    query("tags")
      .optional()
      .notEmpty()
      .withMessage("tags must not be empty if provided")
      .bail()
      .isString()
      .withMessage("tags must be a comma-separated string of tags"),
    handleValidationErrors,
  ],

  listUserCohorts: [
    ...commonValidations.tenant,
    // This endpoint is for listing all user cohorts and does not support filtering by id or name.
    // The underlying utility overrides any name filter with a regex to find user-specific cohorts.
    query("id")
      .not()
      .exists()
      .withMessage(
        "filtering by id is not supported on this endpoint; use the general /cohorts endpoint instead",
      ),
    query("name")
      .not()
      .exists()
      .withMessage("filtering by name is not supported on this endpoint"),
    query("sortBy")
      .optional()
      .notEmpty()
      .trim(),
    query("order")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("tags must not be empty if provided"),
    handleValidationErrors,
  ],
  listCohortsSummary: [
    ...commonValidations.tenant,
    oneOf([
      query("cohort_id")
        .optional()
        .notEmpty()
        .isString()
        .withMessage("cohort_id must be a string")
        .bail()
        .custom((value) => {
          const ids = value.split(",").map((id) => id.trim());
          for (const id of ids) {
            if (!isValidObjectId(id)) {
              throw new Error(`Invalid cohort_id: ${id}`);
            }
          }
          return true;
        }),
      commonValidations.name,
    ]),
    handleValidationErrors,
  ],

  listCohortsDashboard: [
    ...commonValidations.tenant,
    oneOf([commonValidations.validObjectId("id"), commonValidations.name]),
    handleValidationErrors,
  ],
  assignOneDeviceToCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    commonValidations.paramObjectId("device_id"),
    handleValidationErrors,
  ],
  listAssignedDevices: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    handleValidationErrors,
  ],

  listAvailableDevices: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    handleValidationErrors,
  ],

  assignManyDevicesToCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    body("device_ids")
      .exists()
      .withMessage("the device_ids should be provided")
      .bail()
      .custom((value) => Array.isArray(value))
      .withMessage("the device_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the device_ids should not be empty"),
    body("device_ids.*")
      .isMongoId()
      .withMessage("device_id provided must be an object ID"),
    handleValidationErrors,
  ],
  unAssignManyDevicesFromCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    body("device_ids")
      .exists()
      .withMessage("the device_ids should be provided")
      .bail()
      .custom((value) => Array.isArray(value))
      .withMessage("the device_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the device_ids should not be empty"),
    body("device_ids.*")
      .isMongoId()
      .withMessage("device_id provided must be an object ID"),
    handleValidationErrors,
  ],

  unAssignOneDeviceFromCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    commonValidations.paramObjectId("device_id"),
    handleValidationErrors,
  ],

  filterNonPrivateDevices: [
    ...commonValidations.tenant,
    body().custom((value) => {
      if (!value) {
        return false;
      }
      const fields = ["devices", "device_ids", "device_names"];
      const presentFields = fields.filter((field) => value[field]);
      if (presentFields.length > 1 || presentFields.length === 0) {
        throw new Error(
          "Only one of devices, device_ids, or device_names should be provided",
        );
      }
      return true;
    }),
    commonValidations.deviceIdentifiers,
    handleValidationErrors,
  ],

  createNetwork: [
    ...commonValidations.tenant,
    body("admin_secret")
      .exists()
      .withMessage("the admin secret is required")
      .bail()
      .isString()
      .withMessage("the admin secret must be a string")
      .bail()
      .notEmpty()
      .withMessage("the admin secret should not be empty"),
    body("net_name")
      .exists()
      .withMessage("the net_name is required")
      .bail()
      .notEmpty()
      .withMessage("the net_name must not be empty")
      .trim(),
    body("net_email")
      .exists()
      .withMessage("the net_email is required")
      .bail()
      .isEmail()
      .withMessage("the net_email is not a valid email address")
      .trim(),
    body("net_website")
      .optional()
      .notEmpty()
      .withMessage("the net_website must not be empty if provided")
      .bail()
      .isURL()
      .withMessage("the net_website is not a valid URL")
      .trim(),
    body("net_category")
      .optional()
      .notEmpty()
      .withMessage("the net_category must not be empty if provided")
      .trim(),
    body("net_description")
      .optional()
      .notEmpty()
      .withMessage("the net_description must not be empty if provided")
      .trim(),
    handleValidationErrors,
  ],
  updateNetwork: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("net_id"),
    handleValidationErrors,
  ],

  deleteNetwork: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("net_id"),
    handleValidationErrors,
  ],

  listNetworks: [...commonValidations.tenant, handleValidationErrors],

  getNetwork: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("net_id"),
    handleValidationErrors,
  ],

  getSiteAndDeviceIds: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    handleValidationErrors,
  ],
  verifyCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    handleValidationErrors,
  ],

  getCohort: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("cohort_id"),
    handleValidationErrors,
  ],
  listDevices: [
    validateTenant,
    body("cohort_ids")
      .exists()
      .withMessage("cohort_ids are required")
      .bail()
      .isArray({ min: 1 })
      .withMessage("cohort_ids must be a non-empty array of cohort ObjectIDs"),
    body("cohort_ids.*")
      .isMongoId()
      .withMessage("Each ID in cohort_ids must be a valid MongoDB ObjectId"),
    check("search")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("search must not be empty if provided"),
    check("category")
      .optional()
      .trim()
      .toLowerCase()
      .isIn(constants.DEVICE_FILTER_TYPES)
      .withMessage(
        `category must be one of: ${constants.DEVICE_FILTER_TYPES.join(", ")}`,
      ),
    check("device_category")
      .optional()
      .trim()
      .toLowerCase(),
    check("name")
      .optional()
      .trim(),
    check("device")
      .optional()
      .trim(),
    check("device_name")
      .optional()
      .trim(),
    check("device_number")
      .optional()
      .isInt()
      .toInt(),
    check("serial_number")
      .optional()
      .trim(),
    check("status")
      .optional()
      .trim(),
    check("online_status")
      .optional()
      .isIn(["online", "offline"]),
    check("mobility")
      .optional()
      .isBoolean()
      .toBoolean(),
    check("visibility")
      .optional()
      .isBoolean()
      .toBoolean(),
    check("authRequired")
      .optional()
      .isBoolean()
      .toBoolean(),
    check("last_active")
      .optional()
      .isISO8601()
      .toDate(),
    check("last_active_before")
      .optional()
      .isISO8601()
      .toDate(),
    check("last_active_after")
      .optional()
      .isISO8601()
      .toDate(),
    check("network")
      .optional()
      .trim(),
    check("group")
      .optional()
      .trim(),
    handleValidationErrors,
  ],

  listSites: [
    validateTenant,
    body("cohort_ids")
      .exists()
      .withMessage("cohort_ids are required")
      .bail()
      .isArray({ min: 1 })
      .withMessage("cohort_ids must be a non-empty array of cohort ObjectIDs"),
    body("cohort_ids.*")
      .isMongoId()
      .withMessage("Each ID in cohort_ids must be a valid MongoDB ObjectId"),
    check("search")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("search must not be empty if provided"),
    check("category")
      .optional()
      .trim()
      .toLowerCase()
      .isIn(constants.DEVICE_FILTER_TYPES)
      .withMessage(
        `category must be one of: ${constants.DEVICE_FILTER_TYPES.join(", ")}`,
      ),
    check("lat_long")
      .optional()
      .trim(),
    check("generated_name")
      .optional()
      .trim(),
    check("district")
      .optional()
      .trim(),
    check("region")
      .optional()
      .trim(),
    check("city")
      .optional()
      .trim(),
    check("street")
      .optional()
      .trim(),
    check("country")
      .optional()
      .trim(),
    check("county")
      .optional()
      .trim(),
    check("parish")
      .optional()
      .trim(),
    check("google_place_id")
      .optional()
      .trim(),
    check("online_status")
      .optional()
      .isIn(["online", "offline"]),
    check("last_active")
      .optional()
      .isISO8601()
      .toDate(),
    check("last_active_before")
      .optional()
      .isISO8601()
      .toDate(),
    check("last_active_after")
      .optional()
      .isISO8601()
      .toDate(),
    check("network")
      .optional()
      .trim(),
    check("group")
      .optional()
      .trim(),
    check("site_codes")
      .optional()
      .trim(),
    handleValidationErrors,
  ],
};

module.exports = {
  ...cohortValidations,
  pagination: commonValidations.pagination,
};
