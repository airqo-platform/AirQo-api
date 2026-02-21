const { query, body, oneOf, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const createSiteUtil = require("@utils/site.util");
const Decimal = require("decimal.js");

const countDecimalPlaces = (value) => {
  try {
    const decimal = new Decimal(value);
    const decimalStr = decimal.toString();
    if (decimalStr.includes(".")) {
      return decimalStr.split(".")[1].length;
    }
    return 0;
  } catch (err) {
    return 0;
  }
};

// Utility Functions
const validateDecimalPlaces = (
  value,
  minPlaces = 5,
  fieldName = "coordinate",
) => {
  let dp = countDecimalPlaces(value);
  if (dp < minPlaces) {
    return Promise.reject(
      `the ${fieldName} must have ${minPlaces} or more decimal places`,
    );
  }
  return Promise.resolve(`${fieldName} validation test has passed`);
};

const createCoordinateValidation = (type, options = {}) => {
  const {
    minPlaces = 5,
    isOptional = false,
    existsMessage = `the ${type} is missing in your request`,
    isQuery = true,
  } = options;

  const validationChain = isQuery
    ? isOptional
      ? query(type).optional()
      : query(type)
          .exists()
          .withMessage(existsMessage)
    : isOptional
    ? body(type).optional()
    : body(type)
        .exists()
        .withMessage(existsMessage);

  return validationChain
    .notEmpty()
    .withMessage(`the ${type} should not be empty`)
    .trim()
    .matches(
      type === "latitude"
        ? constants.LATITUDE_REGEX
        : constants.LONGITUDE_REGEX,
      "i",
    )
    .withMessage(`please provide valid ${type} value`)
    .bail()
    .custom((value) => validateDecimalPlaces(value, minPlaces, type));
};

const createMongoIdValidation = (field, options = {}) => {
  const {
    isOptional = false,
    existsMessage = `the ${field} identifier is missing in request`,
    isQuery = true,
    isParam = false,
    isBody = false, // Add isBody option
  } = options;

  let validationChain;

  if (isParam) {
    validationChain = isOptional
      ? param(field).optional()
      : param(field)
          .exists()
          .withMessage(existsMessage);
  } else if (isBody) {
    validationChain = isOptional
      ? body(field).optional()
      : body(field)
          .exists()
          .withMessage(existsMessage);
  } else {
    // Default to query parameter validation
    validationChain = isQuery
      ? isOptional
        ? query(field).optional()
        : query(field)
            .exists()
            .withMessage(existsMessage)
      : isOptional
      ? body(field).optional()
      : body(field)
          .exists()
          .withMessage(existsMessage);
  }

  return validationChain
    .notEmpty()
    .withMessage(`${field} cannot be empty`)
    .trim()
    .isMongoId()
    .withMessage(`${field} must be an object ID`)
    .bail()
    .customSanitizer((value) => ObjectId(value));
};

const createTenantValidation = (options = {}) => {
  const { isOptional = false, isQuery = true } = options;

  const validationChain = isQuery
    ? isOptional
      ? query("tenant").optional()
      : query("tenant").exists()
    : isOptional
    ? body("tenant").optional()
    : body("tenant").exists();

  return validationChain
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones");
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
    if (Number.isNaN(numValue)) {
      isValid = false;
      return;
    } else if (field === "latitude") {
      if (Math.abs(numValue) > 90) {
        isValid = false;
        return;
      }
    } else if (field === "longitude") {
      if (numValue < -180 || numValue > 180) {
        isValid = false;
        return;
      }
    } else if (field === "search_radius") {
      if (numValue < 0) {
        isValid = false;
        return;
      }
    }
  });

  // Validate tags array
  if ("tags" in value && !Array.isArray(value.tags)) {
    return false;
  }

  if (
    !value.tags.every((tag) => typeof tag === "string" && tag.trim() !== "")
  ) {
    return false;
  }

  // All validations passed
  return isValid;
}

const siteIdentifierChains = [
  createMongoIdValidation("id"),
  createMongoIdValidation("site_id", { isOptional: true }),
  query("name")
    .optional()
    .notEmpty()
    .withMessage("the site name should not be empty if provided")
    .bail()
    .trim()
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "the site name can only contain letters, numbers, spaces, hyphens and underscores",
    ),
];

const validateSiteIdParam = oneOf([
  createMongoIdValidation("id", {
    isParam: true,
    existsMessage: "The site ID is missing in the request path.",
  }),
]);

// Composed Validation Middleware
const validateSiteIdentifier = siteIdentifierChains;

const validateSiteQueryParams = oneOf([
  createTenantValidation({ isOptional: true }),
  ...siteIdentifierChains,
  query("online_status")
    .optional()
    .notEmpty()
    .withMessage("the online_status should not be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["online", "offline"])
    .withMessage(
      "the online_status value is not among the expected ones which include: online, offline",
    ),
  query("isOnline")
    .optional()
    .notEmpty()
    .withMessage("isOnline should not be empty if provided")
    .bail()
    .isBoolean()
    .withMessage("isOnline must be a boolean value (true or false)"),
  query("rawOnlineStatus")
    .optional()
    .notEmpty()
    .withMessage("rawOnlineStatus should not be empty if provided")
    .bail()
    .isBoolean()
    .withMessage("rawOnlineStatus must be a boolean value (true or false)"),
  query("category")
    .optional()
    .notEmpty()
    .withMessage("the category should not be empty if provided")
    .bail()
    .trim(),
  query("last_active_before")
    .optional()
    .notEmpty()
    .withMessage("last_active_before date cannot be empty IF provided")
    .bail()
    .trim()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage(
      "last_active_before date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ).",
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
      "last_active_after date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ).",
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
      "last_active date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ).",
    )
    .bail()
    .toDate(),
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
]);

const validateMandatorySiteIdentifier = oneOf([
  createMongoIdValidation("id"),
  query("lat_long")
    .exists()
    .withMessage(
      "an identifier is missing in the request, consider using lat_long",
    )
    .bail()
    .trim(),
  query("generated_name")
    .exists()
    .withMessage(
      "an identifier is missing in the request, consider using generated_name",
    )
    .bail()
    .trim(),
]);

const validateCreateSite = [
  createCoordinateValidation("latitude", { isQuery: false }),
  createCoordinateValidation("longitude", { isQuery: false }),
  body("name")
    .exists()
    .withMessage("the name is is missing in your request")
    .bail()
    .trim()
    .custom((value) => createSiteUtil.validateSiteName(value))
    .withMessage("The name should be greater than 5 and less than 50 in length")
    .bail()
    .trim()
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "the site name can only contain letters, numbers, spaces, hyphens and underscores",
    ),
  body("site_tags")
    .optional()
    .custom((value) => Array.isArray(value))
    .withMessage("the site_tags should be an array")
    .bail()
    .notEmpty()
    .withMessage("the site_tags should not be empty"),
  body("groups")
    .optional()
    .custom((value) => Array.isArray(value))
    .withMessage("the groups should be an array")
    .bail()
    .notEmpty()
    .withMessage("the groups should not be empty"),
  body("airqlouds")
    .optional()
    .custom((value) => Array.isArray(value))
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
      "Invalid site_category format, crosscheck the types or content of all the provided nested fields. latitude, longitude & search_radius should be numbers. tags should be an array of strings. category, search_tags & search_radius are required fields",
    ),
];

const validateSiteMetadata = [
  createCoordinateValidation("latitude", { isQuery: false, minPlaces: 2 }),
  createCoordinateValidation("longitude", { isQuery: false, minPlaces: 2 }),
];

const validateUpdateSite = [
  createTenantValidation({ isOptional: true }),
  body("name")
    .optional()
    .notEmpty()
    .withMessage("name cannot be empty IF provided")
    .bail()
    .trim()
    .custom((value) => createSiteUtil.validateSiteName(value))
    .withMessage("The name should be greater than 5 and less than 50 in length")
    .bail()
    .trim()
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "the site name can only contain letters, numbers, spaces, hyphens and underscores",
    ),
  body("status")
    .optional()
    .notEmpty()
    .trim()
    .toLowerCase()
    .isIn(["active", "decommissioned"])
    .withMessage(
      "the status value is not among the expected ones which include: decommissioned, active",
    ),
  body("visibility")
    .optional()
    .notEmpty()
    .withMessage("visibility cannot be empty IF provided")
    .bail()
    .trim()
    .isBoolean()
    .withMessage("visibility must be Boolean"),
  createCoordinateValidation("latitude", {
    isOptional: true,
    isQuery: false,
  }),
  createCoordinateValidation("longitude", {
    isOptional: true,
    isQuery: false,
  }),
  body("site_tags")
    .optional()
    .custom((value) => Array.isArray(value))
    .withMessage("the site_tags should be an array")
    .bail()
    .notEmpty()
    .withMessage("the site_tags should not be empty"),
  body("site_category")
    .optional()
    .custom(validateCategoryField)
    .withMessage(
      "Invalid site_category format, crosscheck the types or content of all the provided nested fields. latitude, longitude & search_radius should be numbers. tags should be an array of strings. category, search_tags & search_radius are required fields",
    ),
];

const validateRefreshSite = [createTenantValidation({ isOptional: true })];

const validateDeleteSite = [createTenantValidation({ isOptional: true })];

const validateCreateApproximateCoordinates = [
  createCoordinateValidation("latitude", { isQuery: false, minPlaces: 2 }),
  createCoordinateValidation("longitude", { isQuery: false, minPlaces: 2 }),
];

const validateGetApproximateCoordinates = [
  createCoordinateValidation("latitude", { minPlaces: 2 }),
  createCoordinateValidation("longitude", { minPlaces: 2 }),
];

const validateNearestSite = [
  createTenantValidation({ isOptional: true }),
  createCoordinateValidation("longitude"),
  createCoordinateValidation("latitude"),
  query("radius")
    .exists()
    .withMessage("the radius is missing in request")
    .bail()
    .trim()
    .isFloat()
    .withMessage("the radius must be a number")
    .bail()
    .toFloat(),
];

const validateBulkUpdateSites = [
  createTenantValidation({ isOptional: true }),
  body("siteIds")
    .exists()
    .withMessage("siteIds must be provided in the request body")
    .bail()
    .isArray()
    .withMessage("siteIds must be an array")
    .bail()
    .custom((value) => {
      if (value.length === 0) {
        throw new Error("siteIds array cannot be empty");
      }
      return true;
    })
    .bail()
    .custom((value) => {
      const MAX_BULK_UPDATE_SITES = 30;
      if (value.length > MAX_BULK_UPDATE_SITES) {
        throw new Error(
          `Cannot update more than ${MAX_BULK_UPDATE_SITES} sites in a single request`,
        );
      }
      return true;
    })
    .bail()
    .custom((value) => {
      const invalidIds = value.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id),
      );
      if (invalidIds.length > 0) {
        throw new Error("All siteIds must be valid MongoDB ObjectIds");
      }
      return true;
    }),

  body("updateData")
    .exists()
    .withMessage("updateData must be provided in the request body")
    .bail()
    .custom((value) => {
      if (typeof value !== "object" || Array.isArray(value) || value === null) {
        throw new Error("updateData must be an object");
      }
      return true;
    })
    .bail()
    .custom((value) => {
      if (Object.keys(value).length === 0) {
        throw new Error("updateData cannot be an empty object");
      }
      return true;
    })
    .bail()
    .custom((value) => {
      const allowedFields = ["groups", "site_category"];

      const invalidFields = Object.keys(value).filter(
        (field) => !allowedFields.includes(field),
      );
      if (invalidFields.length > 0) {
        throw new Error(
          `Invalid fields in updateData: ${invalidFields.join(", ")}`,
        );
      }

      return true;
    }),
  ...validateUpdateSite,
];

const validateGetSiteCountSummary = [
  query("group_id")
    .optional()
    .isString()
    .withMessage("group_id must be a string")
    .trim(),
  query("cohort_id")
    .optional()
    .isString()
    .withMessage("cohort_id must be a string")
    .custom((value) => {
      if (value) {
        const ids = value.split(",");
        for (const id of ids) {
          if (!mongoose.Types.ObjectId.isValid(id.trim())) {
            throw new Error(`Invalid cohort ID format: ${id.trim()}`);
          }
        }
      }
      return true;
    }),
  query("network")
    .optional()
    .isString()
    .withMessage("network must be a string")
    .trim(),
];

module.exports = {
  validateTenant: createTenantValidation({ isOptional: true }),
  validateSiteIdentifier,
  validateSiteQueryParams,
  validateMandatorySiteIdentifier,
  validateCreateSite,
  validateSiteMetadata,
  validateUpdateSite,
  validateRefreshSite,
  validateDeleteSite,
  validateCreateApproximateCoordinates,
  validateGetApproximateCoordinates,
  validateNearestSite,
  validateGetSiteCountSummary,
  validateBulkUpdateSites,
  validateSiteIdParam,
  validateCategoryField,
};
