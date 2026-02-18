// activities.validators.js
const { oneOf, query, body, param } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = require("mongoose");
const constants = require("@config/constants");
const moment = require("moment");
const { validateNetwork, validateAdminLevels } = require("@validators/common");

const validateDateRange = (date) => {
  const now = moment();
  const oneMonthAgo = moment().subtract(1, "month");
  const inputDate = moment(date);

  if (inputDate.isAfter(now)) {
    throw new Error("date cannot be in the future");
  }
  if (inputDate.isBefore(oneMonthAgo)) {
    throw new Error("date cannot be more than one month in the past");
  }
  return true;
};

// Enhanced deployment type validation
const validateDeploymentType = (value) => {
  const validTypes = ["static", "mobile"];
  if (!validTypes.includes(value.toLowerCase())) {
    throw new Error(`deployment_type must be one of: ${validTypes.join(", ")}`);
  }
  return true;
};

// Custom validator to ensure either site_id OR grid_id is provided -- prevent pole-mobile conflicts + comprehensive business rules
const validateLocationReference = (value, { req }) => {
  const {
    site_id,
    grid_id,
    deployment_type,
    mountType,
    powerType,
    mobility,
  } = req.body;

  // Determine actual deployment type
  const actualDeploymentType =
    deployment_type || (grid_id ? "mobile" : "static");

  // If mobility is explicitly provided, it must match the deployment type
  if (typeof mobility === "boolean") {
    if (mobility === true && actualDeploymentType !== "mobile") {
      throw new Error(
        "mobility=true is only valid for mobile deployments (with a grid_id).",
      );
    }
    if (mobility === false && actualDeploymentType !== "static") {
      throw new Error(
        "mobility=false is only valid for static deployments (with a site_id).",
      );
    }
  }

  // MOBILE DEPLOYMENT VALIDATIONS
  if (actualDeploymentType === "mobile") {
    // Mobile requires grid_id
    if (!grid_id) {
      throw new Error("grid_id is required for mobile deployments");
    }
    if (site_id) {
      throw new Error("site_id should not be provided for mobile deployments");
    }

    // Mobile devices must be vehicle-mounted
    if (mountType && mountType !== "vehicle") {
      throw new Error(
        `Mobile devices must have mountType 'vehicle', not '${mountType}'`,
      );
    }

    // Mobile devices must use alternator power
    if (powerType && powerType !== "alternator") {
      throw new Error(
        `Mobile devices must have powerType 'alternator', not '${powerType}'`,
      );
    }
  }

  // STATIC DEPLOYMENT VALIDATIONS
  if (actualDeploymentType === "static") {
    // Static requires site_id
    if (!site_id) {
      throw new Error("site_id is required for static deployments");
    }
    if (grid_id) {
      throw new Error("grid_id should not be provided for static deployments");
    }

    // Static devices cannot be vehicle-mounted
    if (mountType === "vehicle") {
      throw new Error("Static devices cannot have mountType 'vehicle'");
    }

    // Static devices should not use alternator power (business rule)
    if (powerType === "alternator") {
      throw new Error(
        "Static devices should use 'solar' or 'mains' power, not 'alternator'",
      );
    }
  }

  // MOUNT TYPE SPECIFIC VALIDATIONS
  if (mountType === "vehicle" && actualDeploymentType !== "mobile") {
    throw new Error("Vehicle-mounted devices must be mobile deployments");
  }

  if (mountType === "pole" && actualDeploymentType !== "static") {
    throw new Error("Pole-mounted devices must be static deployments");
  }

  // POWER TYPE SPECIFIC VALIDATIONS
  if (powerType === "alternator" && actualDeploymentType !== "mobile") {
    throw new Error("Alternator power is only valid for mobile deployments");
  }

  return true;
};

// Enhanced mount type validation with business logic
const validateMountTypeConsistency = (value, { req }) => {
  const { deployment_type, grid_id, powerType, mountType } = req.body;
  const actualDeploymentType =
    deployment_type || (grid_id ? "mobile" : "static");

  if (mountType === "vehicle") {
    if (actualDeploymentType !== "mobile") {
      throw new Error("Vehicle mountType requires mobile deployment");
    }
    if (powerType && powerType !== "alternator") {
      throw new Error("Vehicle mountType requires alternator powerType");
    }
  }

  if (
    actualDeploymentType === "mobile" &&
    mountType &&
    mountType !== "vehicle"
  ) {
    throw new Error("Mobile deployments require vehicle mountType");
  }

  if (
    ["pole", "wall", "faceboard", "rooftop", "suspended"].includes(mountType) &&
    actualDeploymentType === "mobile"
  ) {
    throw new Error(
      `${mountType} mountType is not valid for mobile deployments`,
    );
  }

  return true;
};

// Enhanced power type validation with business logic
const validatePowerTypeConsistency = (value, { req }) => {
  const { deployment_type, grid_id, mountType, powerType } = req.body;
  const actualDeploymentType =
    deployment_type || (grid_id ? "mobile" : "static");

  if (powerType === "alternator") {
    if (actualDeploymentType !== "mobile") {
      throw new Error("Alternator powerType requires mobile deployment");
    }
    if (mountType && mountType !== "vehicle") {
      throw new Error("Alternator powerType requires vehicle mountType");
    }
  }

  if (
    actualDeploymentType === "mobile" &&
    powerType &&
    powerType !== "alternator"
  ) {
    throw new Error("Mobile deployments require alternator powerType");
  }

  if (
    ["solar", "mains"].includes(powerType) &&
    actualDeploymentType === "mobile"
  ) {
    throw new Error(
      `${powerType} powerType is not typically valid for mobile deployments`,
    );
  }

  return true;
};

// Batch-level cross-field validator that enforces the static/mobile
// conditional requirements that cannot be expressed with per-field
// express-validator rules alone.
//
// This is the validator-side complement to the null/NaN coordinate guard
// in the util. Between the two, a request with missing or invalid
// coordinates for a static deployment is rejected cleanly at the
// validation layer rather than reaching the database and producing an
// E11000 duplicate key error on lat_long_1 with { lat_long: null }.
const validateBatchDeploymentItems = (items, { req }) => {
  if (!Array.isArray(items)) {
    throw new Error("Request body must be an array of deployment items");
  }

  const errors = [];

  items.forEach((item, index) => {
    const deploymentType =
      item.deployment_type || (item.grid_id ? "mobile" : "static");

    if (deploymentType === "static") {
      // latitude
      const lat = Number(item.latitude);
      if (
        item.latitude === null ||
        item.latitude === undefined ||
        item.latitude === "" ||
        !Number.isFinite(lat)
      ) {
        errors.push(
          `item[${index}] (${item.deviceName || "unknown"}): ` +
            `latitude is required and must be a finite number for static deployments ` +
            `(received: ${JSON.stringify(item.latitude)})`,
        );
      }

      // longitude
      const lng = Number(item.longitude);
      if (
        item.longitude === null ||
        item.longitude === undefined ||
        item.longitude === "" ||
        !Number.isFinite(lng)
      ) {
        errors.push(
          `item[${index}] (${item.deviceName || "unknown"}): ` +
            `longitude is required and must be a finite number for static deployments ` +
            `(received: ${JSON.stringify(item.longitude)})`,
        );
      }

      // site_name
      const siteName =
        typeof item.site_name === "string"
          ? item.site_name.trim()
          : item.site_name;
      if (!siteName) {
        errors.push(
          `item[${index}] (${item.deviceName || "unknown"}): ` +
            `site_name is required for static deployments`,
        );
      }

      // grid_id must not be present
      if (item.grid_id) {
        errors.push(
          `item[${index}] (${item.deviceName || "unknown"}): ` +
            `grid_id must not be provided for static deployments`,
        );
      }
    }

    if (deploymentType === "mobile") {
      // grid_id required
      if (!item.grid_id || !isValidObjectId(item.grid_id)) {
        errors.push(
          `item[${index}] (${item.deviceName || "unknown"}): ` +
            `grid_id is required and must be a valid ObjectId for mobile deployments ` +
            `(received: ${JSON.stringify(item.grid_id)})`,
        );
      }

      // latitude/longitude must NOT be supplied for mobile (they come
      // from the grid) — warn rather than hard-fail since they are
      // harmlessly ignored, but surface the inconsistency
      // (uncomment if you want to enforce this strictly)
      // if (item.latitude !== undefined || item.longitude !== undefined) {
      //   errors.push(`item[${index}]: latitude/longitude should not be provided for mobile deployments`);
      // }
    }
  });

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return true;
};

// Define reusable validation components for deploy operations
const commonDeployValidations = {
  // Enhanced location validation supporting both site_id and grid_id
  site_id: body("site_id")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("site_id cannot be empty if provided")
    .bail()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error(
          "site_id must be a valid MongoDB ObjectId (24 hex characters)",
        );
      }
      return true;
    })
    .customSanitizer((value) => {
      return value ? ObjectId(value) : value;
    }),

  grid_id: body("grid_id")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("grid_id cannot be empty if provided")
    .bail()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error(
          "grid_id must be a valid MongoDB ObjectId (24 hex characters)",
        );
      }
      return true;
    })
    .customSanitizer((value) => {
      return value ? ObjectId(value) : value;
    }),

  deployment_type: body("deployment_type")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("deployment_type cannot be empty if provided")
    .bail()
    .customSanitizer((value) => (value ? value.toLowerCase() : "static"))
    .custom(validateDeploymentType),

  // Location reference validation (either site_id OR grid_id based on deployment_type)
  location_reference: body("site_id").custom(validateLocationReference),

  height: body("height")
    .exists()
    .withMessage("height is required")
    .bail()
    .isFloat({ gt: 0, lt: 100 })
    .withMessage("height must be a number between 0 and 100")
    .toFloat(),

  powerType: body("powerType")
    .exists()
    .withMessage("powerType is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("powerType cannot be empty")
    .bail()
    .customSanitizer((value) => value.toLowerCase())
    .isIn(["solar", "mains", "alternator"])
    .withMessage("powerType must be one of: solar, mains, alternator")
    .bail()
    .custom(validatePowerTypeConsistency),

  mountType: body("mountType")
    .exists()
    .withMessage("mountType is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("mountType cannot be empty")
    .bail()
    .customSanitizer((value) => value.toLowerCase())
    .isIn(["pole", "wall", "faceboard", "rooftop", "suspended", "vehicle"])
    .withMessage(
      "mountType must be one of: pole, wall, faceboard, rooftop, suspended, vehicle",
    )
    .bail()
    .custom(validateMountTypeConsistency),

  isPrimaryInLocation: body("isPrimaryInLocation")
    .optional()
    .isBoolean()
    .withMessage("isPrimaryInLocation must be a boolean")
    .toBoolean(),

  date: body("date")
    .optional()
    .trim()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage(
      "date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)",
    )
    .bail()
    .toDate()
    .custom(validateDateRange),

  network: body("network")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("network cannot be empty if provided")
    .bail()
    .toLowerCase()
    .custom(validateNetwork)
    .withMessage("the network value is not among the expected ones"),

  host_id: body("host_id")
    .optional()
    .trim()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error(
          "host_id must be a valid MongoDB ObjectId (24 hex characters)",
        );
      }
      return true;
    })
    .customSanitizer((value) => {
      return value && isValidObjectId(value) ? ObjectId(value) : value;
    }),

  // Required user_id (for owned device deployment)
  user_id_required: body("user_id")
    .exists()
    .withMessage("user_id is required for owned device deployment")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("user_id cannot be empty")
    .bail()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error(
          "user_id must be a valid MongoDB ObjectId (24 hex characters)",
        );
      }
      return true;
    })
    .customSanitizer((value) => {
      return isValidObjectId(value) ? ObjectId(value) : value;
    }),

  // Optional user_id (for regular deployment)
  user_id_optional: body("user_id")
    .optional()
    .trim()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error(
          "user_id must be a valid MongoDB ObjectId (24 hex characters)",
        );
      }
      return true;
    })
    .customSanitizer((value) => {
      return value && isValidObjectId(value) ? ObjectId(value) : value;
    }),

  // Optional user details for activity logging
  firstName: body("firstName")
    .optional()
    .notEmpty()
    .withMessage("firstName should not be empty if provided")
    .trim(),
  lastName: body("lastName")
    .optional()
    .notEmpty()
    .withMessage("lastName should not be empty if provided")
    .trim(),
  userName: body("userName")
    .optional()
    .notEmpty()
    .withMessage("userName should not be empty if provided")
    .trim(),
  email: body("email")
    .optional()
    .notEmpty()
    .withMessage("email should not be empty if provided")
    .bail()
    .isEmail()
    .withMessage("this is not a valid email address"),
};

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
  objectId: (
    field,
    location = query,
    errorMessage = "Invalid ObjectId format",
  ) => {
    return location(field)
      .optional() // The field is optional
      .if(location(field).exists()) // Only validate if the field exists
      .custom((value) => {
        //Handles both single and array of ObjectIds
        if (Array.isArray(value)) {
          value.forEach((v) => {
            if (!isValidObjectId(v)) {
              throw new Error(`${field}: ${errorMessage} - ${v}`);
            }
          });
        } else {
          if (!isValidObjectId(value)) {
            throw new Error(`${field}: ${errorMessage} - ${value}`);
          }
        }
        return true;
      })
      .customSanitizer((value) => {
        // No need for spliting since we are not allowing arrays here
        if (Array.isArray(value)) {
          return value
            .map((v) => (isValidObjectId(v) ? ObjectId(v) : null))
            .filter((v) => v !== null);
        } else {
          return isValidObjectId(value) ? ObjectId(value) : null;
        }
      });
  },
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
      req.query.limit = limit;

      if (Number.isNaN(skip) || skip < 0) {
        req.query.skip = 0;
      }

      next();
    };
  },
  deviceName: [
    query("deviceName")
      .exists()
      .withMessage("the deviceName is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the provided deviceName cannot be empty")
      .trim(),
  ],
  recallType: [
    body("recallType")
      .exists()
      .withMessage("recallType should be provided")
      .bail()
      .notEmpty()
      .withMessage("recallType should not be empty")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.RECALL_TYPES)
      .withMessage("the recallType value is not among the expected ones"),
  ],

  firstName: [
    body("firstName")
      .optional()
      .notEmpty()
      .withMessage("firstName should not be empty if provided")
      .trim(),
  ],
  lastName: [
    body("lastName")
      .optional()
      .notEmpty()
      .withMessage("lastName should not be empty if provided")
      .trim(),
  ],
  userName: [
    body("userName")
      .optional()
      .notEmpty()
      .withMessage("userName should not be empty if provided")
      .trim(),
  ],
  email: [
    body("email")
      .optional()
      .notEmpty()
      .withMessage("email should not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address"),
  ],

  powerType: [
    body("powerType")
      .exists()
      .withMessage("the powerType is missing in your request")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["solar", "mains", "alternator"])
      .withMessage(
        "the powerType value is not among the expected ones which include: solar, mains and alternator",
      )
      .bail()
      .custom(validatePowerTypeConsistency),
  ],
  mountType: [
    body("mountType")
      .exists()
      .withMessage("the mountType is missing in your request")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
      .withMessage(
        "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop ",
      )
      .bail()
      .custom(validateMountTypeConsistency),
  ],
  height: [
    body("height")
      .exists()
      .withMessage("the height is missing in your request")
      .bail()
      .isFloat({ gt: 0, lt: 100 })
      .withMessage("the height must be a number between 0 and 100")
      .trim(),
  ],
  isPrimaryInLocation: [
    body("isPrimaryInLocation")
      .exists()
      .withMessage("the isPrimaryInLocation is missing in your request")
      .bail()
      .isBoolean()
      .withMessage("isPrimaryInLocation must be Boolean")
      .trim(),
  ],
  date: [
    body("date")
      .exists()
      .withMessage("date is missing")
      .bail()
      .trim()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("date must be a valid datetime.")
      .bail()
      .custom(validateDateRange),
  ],
  eachDate: [
    body("*.date")
      .exists()
      .withMessage("date is missing")
      .bail()
      .trim()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("date must be a valid datetime.")
      .bail(),
  ],
  description: [
    body("description")
      .exists()
      .withMessage("the description is missing in your request")
      .trim(),
  ],
  tags: [
    body("tags")
      .exists()
      .withMessage("the tags are missing in your request")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the tags should be an array"),
  ],
  maintenanceType: [
    body("maintenanceType")
      .optional()
      .notEmpty()
      .withMessage("maintenanceType should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.MAINTENANCE_TYPES)
      .withMessage("the maintenanceType value is not among the expected ones"),
  ],
  activityType: [
    query("activity_type")
      .optional()
      .notEmpty()
      .withMessage("activity_type should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.ACTIVITY_TYPES)
      .withMessage(
        "the activity_type value is not among the expected ones which are: recallment, deployment and maintenance",
      ),
  ],
  activityTags: [
    query("activity_tags")
      .optional()
      .notEmpty()
      .withMessage("activity_tags should not be empty IF provided")
      .trim(),
  ],

  maintenanceTypeQuery: [
    query("maintenance_type")
      .optional()
      .notEmpty()
      .withMessage("maintenance_type should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.MAINTENANCE_TYPES)
      .withMessage(
        "the maintenance_type value is not among the expected ones which are: corrective and preventive",
      ),
  ],
  recallTypeQuery: [
    query("recall_type")
      .optional()
      .notEmpty()
      .withMessage("recall_type should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.RECALL_TYPES)
      .withMessage(
        `the maintenance_type value is not among the expected ones which are: ${JSON.stringify(
          constants.RECALL_TYPES,
        )}`,
      ),
  ],

  network: [
    query("network")
      .optional()
      .notEmpty()
      .withMessage("network should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the network value is not among the expected ones"),
  ],

  activityCodes: [
    query("activity_codes")
      .optional()
      .notEmpty()
      .withMessage("activity_codes should not be empty IF provided")
      .bail()
      .trim(),
  ],

  device: [
    query("device")
      .optional()
      .notEmpty()
      .withMessage("device should not be empty IF provided")
      .bail()
      .trim(),
  ],

  latitude: [
    body("*.latitude")
      .exists()
      .withMessage("latitude is missing in your request")
      .bail()
      .isFloat()
      .withMessage("latitude must be a valid float number"),
  ],
  longitude: [
    body("*.longitude")
      .exists()
      .withMessage("longitude is missing in your request")
      .bail()
      .isFloat()
      .withMessage("longitude must be a valid float number"),
  ],

  siteName: [
    body("*.site_name")
      .exists()
      .withMessage("site_name is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("site_name cannot be empty"),
  ],
  deviceNameBody: [
    body("*.deviceName")
      .exists()
      .withMessage("deviceName is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the provided deviceName cannot be empty")
      .trim(),
  ],
};

const activitiesValidations = {
  refreshCaches: [
    ...commonValidations.tenant,
    body("device_names")
      .optional()
      .isArray()
      .withMessage("device_names must be an array"),
    body("site_ids")
      .optional()
      .isArray()
      .withMessage("site_ids must be an array"),
    body("refresh_all")
      .optional()
      .isBoolean()
      .withMessage("refresh_all must be a boolean")
      .toBoolean(),
  ],
  backfillDeviceIds: [
    ...commonValidations.tenant,
    body("dry_run")
      .optional()
      .isBoolean()
      .withMessage("dry_run must be a boolean value (true or false)")
      .toBoolean(),
    body("batch_size")
      .optional()
      .isInt({ min: 10, max: 1000 })
      .withMessage("batch_size must be an integer between 10 and 1000")
      .toInt(),
  ],
  recallActivity: [
    ...commonValidations.tenant,
    ...commonValidations.deviceName,
    body("recallType")
      .exists()
      .withMessage("recallType is required")
      .bail()
      .isIn(constants.RECALL_TYPES)
      .withMessage("Invalid recallType"),
    commonValidations.objectId("user_id", body),
    ...commonValidations.date,
    ...commonValidations.firstName,
    ...commonValidations.lastName,
    ...commonValidations.userName,
    ...commonValidations.email,
  ],

  deployActivity: [
    //Required fields validation
    ...commonValidations.tenant,
    ...commonValidations.deviceName,
    body("site_id")
      .exists()
      .withMessage("site_id is required")
      .bail()
      .custom((value) => {
        if (!isValidObjectId(value)) {
          throw new Error("Invalid site_id format");
        }
        return true;
      })
      .customSanitizer((value) => {
        return isValidObjectId(value) ? ObjectId(value) : null;
      }),
    body("height")
      .exists()
      .withMessage("height is required")
      .isFloat({ gt: 0, lt: 100 })
      .withMessage("height must be a number between 0 and 100")
      .trim(),
    body("powerType")
      .exists()
      .withMessage("powerType is required")
      .trim()
      .toLowerCase()
      .isIn(["solar", "mains", "alternator"])
      .withMessage("Invalid powerType"),
    body("mountType")
      .exists()
      .withMessage("mountType is required")
      .trim()
      .toLowerCase()
      .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
      .withMessage("Invalid mountType"),
    ...commonValidations.date,
    //Optional fields validation if provided
    body("isPrimaryInLocation")
      .optional()
      .isBoolean()
      .withMessage("isPrimaryInLocation must be a boolean value")
      .trim(),
    ...commonValidations.tenant,
    ...commonValidations.deviceName,
    ...commonValidations.powerType,
    ...commonValidations.mountType,
    ...commonValidations.height,
    ...commonValidations.isPrimaryInLocation,
    commonValidations.objectId("site_id", body),
    commonValidations.objectId("host_id", body),
    commonValidations.objectId("user_id", body),
    body("network")
      .optional()
      .custom((value) => {
        if (typeof value !== "string") {
          throw new Error("Network must be a string");
        }
        return true;
      })
      .trim(),
    ...commonValidations.date,
    ...commonValidations.firstName,
    ...commonValidations.lastName,
    ...commonValidations.userName,
    ...commonValidations.email,
  ],

  maintainActivity: [
    ...commonValidations.tenant,
    ...commonValidations.deviceName,
    ...commonValidations.maintenanceType,
    ...commonValidations.description,
    ...commonValidations.tags,
    commonValidations.objectId("user_id", body),
    ...commonValidations.date,
    ...commonValidations.firstName,
    ...commonValidations.lastName,
    ...commonValidations.userName,
    ...commonValidations.email,
    body("description")
      .exists()
      .withMessage("description is required")
      .trim(),
    body("tags")
      .exists()
      .withMessage("tags is required")
      .bail()
      .isArray()
      .withMessage("tags must be an array"),
    body("maintenanceType")
      .exists()
      .withMessage("maintenanceType is required")
      .bail()
      .isIn(constants.MAINTENANCE_TYPES)
      .withMessage("Invalid maintenanceType"),
    commonValidations.objectId("site_id", body),
  ],

  batchDeployActivity: [
    ...commonValidations.tenant,

    // Top-level array check
    body()
      .isArray({ min: 1 })
      .withMessage(
        "Request body must be a non-empty array of deployment items",
      ),

    // Per-item field validation (express-validator wildcard syntax)
    body("*.deviceName")
      .exists()
      .withMessage("deviceName is required")
      .trim(),
    body("*.deployment_type")
      .optional()
      .trim()
      .customSanitizer((value) => (value ? value.toLowerCase() : "static"))
      .custom(validateDeploymentType),
    body("*.height")
      .exists()
      .withMessage("height is required")
      .isFloat({ gt: 0, lt: 100 })
      .withMessage("height must be a number between 0 and 100")
      .trim(),
    body("*.powerType")
      .exists()
      .withMessage("powerType is required")
      .trim()
      .toLowerCase()
      .isIn(["solar", "mains", "alternator"])
      .withMessage("Invalid powerType")
      .bail()
      .custom((powerType, { req, path }) => {
        // Extract the array index from the validator path (e.g. "[2].powerType")
        // so we reference the exact item under validation rather than the
        // first item whose powerType happens to match this value
        const match = path.match(/\[(\d+)\]/);
        if (match) {
          const currentItem = req.body[parseInt(match[1], 10)];
          if (currentItem) {
            const deploymentType =
              currentItem.deployment_type ||
              (currentItem.grid_id ? "mobile" : "static");
            if (powerType === "alternator" && deploymentType !== "mobile") {
              throw new Error(
                "Alternator powerType requires mobile deployment",
              );
            }
            if (deploymentType === "mobile" && powerType !== "alternator") {
              throw new Error(
                "Mobile deployments require alternator powerType",
              );
            }
          }
        }
        return true;
      }),
    body("*.mountType")
      .exists()
      .withMessage("mountType is required")
      .trim()
      .toLowerCase()
      .isIn(["pole", "wall", "faceboard", "rooftop", "suspended", "vehicle"])
      .withMessage("Invalid mountType")
      .bail()
      .custom((mountType, { req, path }) => {
        // Extract the array index from the validator path (e.g. "[2].mountType")
        // so we reference the exact item under validation rather than the
        // first item whose mountType happens to match this value
        const match = path.match(/\[(\d+)\]/);
        if (match) {
          const currentItem = req.body[parseInt(match[1], 10)];
          if (currentItem) {
            const deploymentType =
              currentItem.deployment_type ||
              (currentItem.grid_id ? "mobile" : "static");
            if (mountType === "vehicle" && deploymentType !== "mobile") {
              throw new Error("Vehicle mountType requires mobile deployment");
            }
            if (deploymentType === "mobile" && mountType !== "vehicle") {
              throw new Error("Mobile deployments require vehicle mountType");
            }
          }
        }
        return true;
      }),
    body("*.isPrimaryInLocation")
      .exists()
      .withMessage("isPrimaryInLocation is required")
      .isBoolean()
      .withMessage("isPrimaryInLocation must be Boolean")
      .trim(),

    // These are intentionally kept optional at the per-field level
    // because their requirement is conditional on deployment_type.
    // The cross-field validator below (validateBatchDeploymentItems)
    // enforces the conditional rules holistically for each item.
    body("*.latitude")
      .optional()
      .isFloat()
      .withMessage("latitude must be a float if provided"),
    body("*.longitude")
      .optional()
      .isFloat()
      .withMessage("longitude must be a float if provided"),
    body("*.site_name")
      .optional()
      .trim(),
    body("*.grid_id")
      .optional()
      .custom((value) => {
        if (value && !isValidObjectId(value)) {
          throw new Error("grid_id must be a valid MongoDB ObjectId");
        }
        return true;
      })
      .customSanitizer((value) => {
        return value && isValidObjectId(value) ? ObjectId(value) : value;
      }),

    body("*.network")
      .exists()
      .withMessage("network is required")
      .trim()
      .custom(validateNetwork),
    ...commonValidations.eachDate,
    commonValidations.objectId("*.user_id", body),
    commonValidations.objectId("*.host_id", body),
    body("*.firstName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("firstName should not be empty if provided"),
    body("*.lastName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("lastName should not be empty if provided"),
    body("*.userName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("userName should not be empty if provided"),
    body("*.email")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("email should not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("email must be a valid email address"),

    // Cross-field conditional validator — runs last so all per-field
    // validations have already completed. Enforces:
    //   static items: latitude + longitude + site_name required, no grid_id
    //   mobile items: grid_id required and valid
    //
    // This validator is one layer in a defense-in-depth strategy together
    // with the Phase 1 and Phase 3 guards in batchDeployWithCoordinates.
    // The HTTP-layer validator and Phase 1 reject invalid coordinates up
    // front, while Phase 3 provides a final null/NaN safety net so that
    // invalid coordinates do not reach the database and cause a confusing
    // E11000 duplicate key error on lat_long_1 if earlier checks are
    // bypassed or changed in the future.
    body().custom(validateBatchDeploymentItems),
  ],

  listActivities: [
    ...commonValidations.tenant,
    ...commonValidations.device,
    commonValidations.objectId("id"),
    ...commonValidations.activityType,
    ...commonValidations.activityTags,
    ...commonValidations.maintenanceTypeQuery,
    ...commonValidations.recallTypeQuery,
    commonValidations.objectId("site_id"),
    ...commonValidations.network,
    ...commonValidations.activityCodes,
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
  ],

  updateActivity: [
    ...commonValidations.tenant,
    commonValidations.objectId("id"),
  ],

  bulkUpdateActivities: [
    ...commonValidations.tenant,
    commonValidations.objectId("id"),
  ],

  bulkAddActivities: [
    ...commonValidations.tenant,
    commonValidations.objectId("id"),
  ],

  deleteActivity: [
    ...commonValidations.tenant,
    commonValidations.objectId("id"),
  ],

  enhancedDeployActivity: [
    ...commonValidations.tenant,
    ...commonValidations.deviceName,
    commonDeployValidations.deployment_type,
    commonDeployValidations.site_id,
    commonDeployValidations.grid_id,
    commonDeployValidations.location_reference,
    commonDeployValidations.height,
    commonDeployValidations.powerType,
    commonDeployValidations.mountType,
    commonDeployValidations.isPrimaryInLocation,
    commonDeployValidations.date,
    commonDeployValidations.network,
    commonDeployValidations.user_id_optional,
    commonDeployValidations.host_id,
    commonDeployValidations.firstName,
    commonDeployValidations.lastName,
    commonDeployValidations.userName,
    commonDeployValidations.email,
  ],

  validateDeployOwnedDevice: [
    ...commonValidations.tenant,
    ...commonValidations.deviceName,
    commonDeployValidations.deployment_type,
    commonDeployValidations.site_id,
    commonDeployValidations.grid_id,
    commonDeployValidations.location_reference,
    commonDeployValidations.user_id_required,
    commonDeployValidations.height,
    commonDeployValidations.powerType,
    commonDeployValidations.mountType,
    commonDeployValidations.isPrimaryInLocation,
    commonDeployValidations.date,
    commonDeployValidations.network,
    commonDeployValidations.host_id,
    commonDeployValidations.firstName,
    commonDeployValidations.lastName,
    commonDeployValidations.userName,
    commonDeployValidations.email,
  ],
  recalculate: [
    ...commonValidations.tenant,
    body("dry_run")
      .optional()
      .isBoolean()
      .withMessage("dry_run must be a boolean value (true or false)")
      .toBoolean(),
  ],
};

const validateUniqueDeviceNames = (req, res, next) => {
  const deviceNames = req.body.map((item) => item.deviceName);
  const duplicates = deviceNames.filter(
    (name, index) => deviceNames.indexOf(name) !== index,
  );

  if (duplicates.length > 0) {
    let error = new Error(
      "Duplicate device names found: " + [...new Set(duplicates)].join(", "),
    );
    error.statusCode = 400;
    next(error);
    return;
  }
  next();
};

const validateDeviceNameQuery = [
  query("deviceName")
    .exists()
    .withMessage("deviceName is required in query parameters")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("deviceName cannot be empty")
    .bail()
    .isLength({ min: 3, max: 50 })
    .withMessage("deviceName must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "deviceName can only contain letters, numbers, spaces, hyphens and underscores",
    ),
];

const validateTenantQuery = [
  query("tenant")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .toLowerCase()
    .isIn(constants.NETWORKS || ["airqo"])
    .withMessage("the tenant value is not among the expected ones"),
];

module.exports = {
  ...activitiesValidations,
  pagination: commonValidations.pagination,
  validateUniqueDeviceNames,
  validateDeviceNameQuery,
  validateTenantQuery,
  enhancedDeployActivity: activitiesValidations.enhancedDeployActivity,
  validateDeployOwnedDevice: activitiesValidations.validateDeployOwnedDevice,
  backfillDeviceIds: activitiesValidations.backfillDeviceIds,
};
