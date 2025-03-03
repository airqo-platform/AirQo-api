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
    errorMessage = "Invalid ObjectId format"
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
        "the powerType value is not among the expected ones which include: solar, mains and alternator"
      ),
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
        "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
      ),
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
      .bail()
      .custom(validateDateRange),
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
        "the activity_type value is not among the expected ones which are: recallment, deployment and maintenance"
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
        "the maintenance_type value is not among the expected ones which are: corrective and preventive"
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
          constants.RECALL_TYPES
        )}`
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
    body("*.deviceName")
      .exists()
      .withMessage("deviceName is required")
      .trim(),
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
      .withMessage("Invalid powerType"),
    body("*.mountType")
      .exists()
      .withMessage("mountType is required")
      .trim()
      .toLowerCase()
      .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
      .withMessage("Invalid mountType"),
    body("*.isPrimaryInLocation")
      .exists()
      .withMessage("isPrimaryInLocation is required")
      .isBoolean()
      .withMessage("isPrimaryInLocation must be Boolean")
      .trim(),
    body("*.latitude")
      .exists()
      .withMessage("latitude is required")
      .isFloat()
      .withMessage("latitude must be a float"),
    body("*.longitude")
      .exists()
      .withMessage("longitude is required")
      .isFloat()
      .withMessage("longitude must be a float"),
    body("*.site_name")
      .exists()
      .withMessage("site_name is required")
      .trim(),
    body("*.network")
      .exists()
      .withMessage("network is required")
      .trim()
      .custom(validateNetwork),
    ...commonValidations.eachDate,
    commonValidations.objectId("*.user_id", body),
    commonValidations.objectId("*.host_id", body),
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
};

const validateUniqueDeviceNames = (req, res, next) => {
  const deviceNames = req.body.map((item) => item.deviceName);
  const duplicates = deviceNames.filter(
    (name, index) => deviceNames.indexOf(name) !== index
  );

  if (duplicates.length > 0) {
    let error = new Error(
      "Duplicate device names found: " + [...new Set(duplicates)].join(", ")
    );
    error.statusCode = 400;
    next(error);
    return;
  }
  next();
};

module.exports = {
  ...activitiesValidations,
  pagination: commonValidations.pagination,
  validateUniqueDeviceNames,
};
