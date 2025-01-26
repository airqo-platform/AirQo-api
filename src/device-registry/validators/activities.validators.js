// activities.validators.js
const { oneOf, query, body, param } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = require("mongoose");
const constants = require("@config/constants");
const { validateNetwork, validateAdminLevels } = require("@validators/common");

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
      .optional()
      .custom((value) => {
        let values = Array.isArray(value)
          ? value
          : value?.toString().split(",");
        for (const v of values) {
          if (v && !isValidObjectId(v)) {
            throw new Error(`${field}: ${errorMessage} - ${v}`);
          }
        }
        return true;
      })
      .customSanitizer((value) => {
        if (value) {
          let values;
          if (Array.isArray(value)) {
            values = value;
          } else {
            values = value?.toString().split(",");
          }
          return values
            .map((v) => (isValidObjectId(v) ? ObjectId(v) : null))
            .filter((v) => v !== null);
        }
        return value;
      });
  },
  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
    return (req, res, next) => {
      let limit = parseInt(req.query.limit, 10);
      const skip = parseInt(req.query.skip, 10);

      if (isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }
      if (limit > maxLimit) {
        limit = maxLimit;
      }
      req.query.limit = limit;

      if (isNaN(skip) || skip < 0) {
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
      .withMessage("date must be a valid datetime."),
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
    ...commonValidations.recallType,
    ...commonValidations.firstName,
    ...commonValidations.lastName,
    ...commonValidations.userName,
    ...commonValidations.email,
    commonValidations.objectId("user_id", body),
  ],

  deployActivity: [
    ...commonValidations.tenant,
    ...commonValidations.deviceName,
    ...commonValidations.powerType,
    ...commonValidations.mountType,
    ...commonValidations.height,
    ...commonValidations.isPrimaryInLocation,
    commonValidations.objectId("site_id", body),
    commonValidations.objectId("host_id", body),
    commonValidations.objectId("user_id", body),
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
  ],

  batchDeployActivity: [
    ...commonValidations.tenant,
    ...commonValidations.deviceNameBody,
    ...commonValidations.powerType,
    ...commonValidations.mountType,
    ...commonValidations.height,
    ...commonValidations.isPrimaryInLocation,
    ...commonValidations.latitude,
    ...commonValidations.longitude,
    ...commonValidations.siteName,
    ...commonValidations.network,
    commonValidations.objectId("user_id", body),
    commonValidations.objectId("host_id", body),
    ...commonValidations.date,
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
