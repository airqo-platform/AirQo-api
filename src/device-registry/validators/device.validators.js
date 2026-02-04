const { query, body, oneOf, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const numeral = require("numeral");
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const { validateNetwork, validateAdminLevels } = require("@validators/common");
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

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.NETWORKS)
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (defaultLimit = 1000, maxLimit = 2000) => {
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
};

const validateDeviceIdentifier = oneOf([
  query("device_number")
    .exists()
    .withMessage(
      "the device identifier is missing in request, consider using the device_number",
    )
    .bail()
    .trim()
    .isInt()
    .withMessage("the device_number should be an integer value"),
  query("id")
    .exists()
    .withMessage(
      "the device identifier is missing in request, consider using the device_id",
    )
    .bail()
    .trim()
    .isMongoId()
    .withMessage("id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  query("name")
    .exists()
    .withMessage(
      "the device identifier is missing in request, consider using the name",
    )
    .bail()
    .trim()
    .isLowercase()
    .withMessage("device name should be lower case")
    .bail()
    .matches(constants.WHITE_SPACES_REGEX, "i")
    .withMessage("the device names do not have spaces in them")
    .bail()
    .trim()
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "the device name can only contain letters, numbers, spaces, hyphens and underscores",
    )
    .bail(),
]);

const validateDeviceIdParam = [
  param("id")
    .exists()
    .withMessage("The device ID is missing in the request path.")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("Invalid device ID. Must be a valid MongoDB ObjectId.")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
];

const getIdFromName = [
  param("name")
    .exists()
    .withMessage("Device name is required in the path")
    .bail()
    .notEmpty()
    .withMessage("Device name must not be empty")
    .trim(),
];

const getNameFromId = [
  param("id")
    .exists()
    .withMessage("Device ID is required in the path")
    .bail()
    .isMongoId()
    .withMessage("A valid MongoDB Object ID is required for the device ID"),
];

const suggestDeviceNames = [
  query("name")
    .exists()
    .withMessage("A 'name' query parameter to search for is required")
    .bail()
    .notEmpty()
    .withMessage("The name must not be empty")
    .trim(),
];

const validateCreateDevice = [
  oneOf([
    body("name")
      .exists()
      .withMessage(
        "device identification details are missing in the request, consider using the name",
      )
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the name should not be empty if provided")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the device name can only contain letters, numbers, spaces, hyphens and underscores",
      )
      .bail(),
    body("long_name")
      .exists()
      .withMessage(
        "device identification details are missing in the request, consider using the long_name",
      )
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the long_name should not be empty if provided")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the device long_name can only contain letters, numbers, spaces, hyphens and underscores",
      ),
  ]),
  oneOf([
    [
      body("network")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("the network should not be empty if provided")
        .bail()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the network value is not among the expected ones"),
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device_number should not be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("generation_version")
        .optional()
        .notEmpty()
        .withMessage("the generation_version should not be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the generation_version should be an integer ")
        .toInt(),
      body("generation_count")
        .optional()
        .notEmpty()
        .withMessage("the generation_count should not be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the generation should be an integer")
        .toInt(),
      body("groups")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the groups should be an array")
        .bail()
        .notEmpty()
        .withMessage("the groups should not be empty"),
      body("mountType")
        .optional()
        .notEmpty()
        .withMessage("the mountType should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended", "vehicle"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended, rooftop, and vehicle",
        )
        .bail()
        .custom((mountType, { req }) => {
          const { mobility } = req.body;

          if (mountType === "vehicle" && !mobility) {
            throw new Error("Vehicle mountType requires mobility to be true");
          }

          if (mobility === true && mountType && mountType !== "vehicle") {
            throw new Error(
              "Mobile devices (mobility=true) require vehicle mountType",
            );
          }

          return true;
        }),
      body("category")
        .optional()
        .notEmpty()
        .withMessage("the category should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["bam", "lowcost", "gas"])
        .withMessage(
          "the category value is not among the expected ones which include: lowcost, gas and bam",
        ),
      body("powerType")
        .optional()
        .notEmpty()
        .withMessage("the powerType should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator",
        )
        .bail()
        .custom((powerType, { req }) => {
          const { mobility } = req.body;

          if (powerType === "alternator" && !mobility) {
            throw new Error(
              "Alternator powerType requires mobility to be true",
            );
          }

          if (mobility === true && powerType && powerType !== "alternator") {
            throw new Error(
              "Mobile devices (mobility=true) require alternator powerType",
            );
          }

          return true;
        }),
      body("latitude")
        .optional()
        .notEmpty()
        .withMessage("the latitude should not be empty if provided")
        .bail()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = countDecimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters",
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
        .withMessage("the longitude should not be empty if provided")
        .bail()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = countDecimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters",
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
        .withMessage("the description should not be empty if provided")
        .bail()
        .trim(),
      body("product_name")
        .optional()
        .notEmpty()
        .withMessage("the product_name should not be empty if provided")
        .bail()
        .trim(),
      body("device_manufacturer")
        .optional()
        .notEmpty()
        .withMessage("the device_manufacturer should not be empty if provided")
        .bail()
        .trim(),
      body("isActive")
        .optional()
        .notEmpty()
        .withMessage("the isActive should not be empty if provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .optional()
        .notEmpty()
        .withMessage("the isRetired should not be empty if provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .optional()
        .notEmpty()
        .withMessage("the mobility should not be empty if provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .optional()
        .notEmpty()
        .withMessage("the nextMaintenance should not be empty if provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance must be a valid datetime."),
      body("isPrimaryInLocation")
        .optional()
        .notEmpty()
        .withMessage("the isPrimaryInLocation should not be empty if provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .optional()
        .notEmpty()
        .withMessage("the isUsedForCollocation should not be empty if provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .optional()
        .notEmpty()
        .withMessage("the owner should not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .optional()
        .notEmpty()
        .withMessage("the host_id should not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .optional()
        .notEmpty()
        .withMessage("the phoneNumber should not be empty if provided")
        .bail()
        .trim()
        .custom((value) => {
          let parsedPhoneNumber = phoneUtil.parse(value);
          let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
          return isValid;
        })
        .withMessage("phoneNumber must be a valid one")
        .bail(),
      body("height")
        .optional()
        .notEmpty()
        .withMessage("the height should not be empty if provided")
        .bail()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("height must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("elevation")
        .optional()
        .notEmpty()
        .withMessage("the elevation should not be empty if provided")
        .bail()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .optional()
        .notEmpty()
        .withMessage("the writeKey should not be empty if provided")
        .bail()
        .trim(),
      body("readKey")
        .optional()
        .notEmpty()
        .withMessage("the readKey should not be empty if provided")
        .bail()
        .trim(),
    ],
  ]),
];

const validateUpdateDevice = [
  body("mobility")
    .not()
    .exists()
    .withMessage("Cannot directly update mobility. Use deployment activities."),
  body("isActive")
    .not()
    .exists()
    .withMessage(
      "Cannot directly update isActive. Use deployment/recall activities.",
    ),
  body("status")
    .not()
    .exists()
    .withMessage(
      "Cannot directly update status. Use deployment/recall activities.",
    ),
  body("deployment_type")
    .not()
    .exists()
    .withMessage(
      "Cannot directly update deployment_type. Use deployment activities.",
    ),
  body("visibility")
    .optional()
    .notEmpty()
    .withMessage("visibility cannot be empty IF provided")
    .bail()
    .trim()
    .isBoolean()
    .withMessage("visibility must be Boolean"),
  body("long_name")
    .optional()
    .notEmpty()
    .withMessage("the long_name should not be empty if provided")
    .bail()
    .trim()
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "the device long_name can only contain letters, numbers, spaces, hyphens and underscores",
    ),
  body("mountType")
    .optional()
    .notEmpty()
    .withMessage("the mountType should not be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["pole", "wall", "faceboard", "rooftop", "suspended", "vehicle"]) // ADD "vehicle"
    .withMessage(
      "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended, rooftop, and vehicle",
    )
    .bail()
    .custom((mountType, { req }) => {
      // Add business logic validation for device creation
      const { mobility, deployment_type } = req.body;

      if (mountType === "vehicle" && !mobility) {
        throw new Error("Vehicle mountType requires mobility to be true");
      }

      if (mobility === true && mountType && mountType !== "vehicle") {
        throw new Error(
          "Mobile devices (mobility=true) require vehicle mountType",
        );
      }

      return true;
    }),
  body("powerType")
    .optional()
    .notEmpty()
    .withMessage("the powerType should not be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["solar", "mains", "alternator"])
    .withMessage(
      "the powerType value is not among the expected ones which include: solar, mains and alternator",
    )
    .bail()
    .custom((powerType, { req }) => {
      const { mobility } = req.body;

      if (powerType === "alternator" && !mobility) {
        throw new Error("Alternator powerType requires mobility to be true");
      }

      if (mobility === true && powerType && powerType !== "alternator") {
        throw new Error(
          "Mobile devices (mobility=true) require alternator powerType",
        );
      }

      return true;
    }),
  body("groups")
    .optional()
    .custom((value) => {
      return Array.isArray(value);
    })
    .withMessage("the groups should be an array")
    .bail()
    .notEmpty()
    .withMessage("the groups should not be empty"),
  body("isRetired")
    .optional()
    .notEmpty()
    .trim()
    .isBoolean()
    .withMessage("isRetired must be Boolean"),
  body("nextMaintenance")
    .optional()
    .notEmpty()
    .withMessage("nextMaintenance cannot be empty")
    .trim()
    .toDate()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("nextMaintenance must be a valid datetime."),
  body("isPrimaryInLocation")
    .optional()
    .notEmpty()
    .trim()
    .isBoolean()
    .withMessage("isPrimaryInLocation must be Boolean"),
  body("isUsedForCollocation")
    .optional()
    .notEmpty()
    .trim()
    .isBoolean()
    .withMessage("isUsedForCollocation must be Boolean"),
  body("owner")
    .optional()
    .notEmpty()
    .trim()
    .isMongoId()
    .withMessage("the owner must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("host_id")
    .optional()
    .notEmpty()
    .trim()
    .isMongoId()
    .withMessage("the host_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("phoneNumber")
    .optional()
    .notEmpty()
    .trim()
    .custom((value) => {
      let parsedPhoneNumber = phoneUtil.parse(value);
      let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
      return isValid;
    })
    .withMessage("phoneNumber must be a valid one")
    .bail(),
  body("height")
    .optional()
    .notEmpty()
    .trim()
    .isFloat({ gt: 0, lt: 100 })
    .withMessage("height must be a number between 0 and 100")
    .bail()
    .toFloat(),
  body("elevation")
    .optional()
    .notEmpty()
    .trim()
    .isFloat()
    .withMessage("elevation must be a float")
    .bail()
    .toFloat(),
  body("writeKey")
    .optional()
    .notEmpty()
    .trim(),
  body("readKey")
    .optional()
    .notEmpty()
    .trim(),
  body("collocation")
    .optional()
    .isObject()
    .withMessage("collocation must be an object"),
  body("collocation.status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("collocation status must be 'active' or 'inactive'"),
  body("collocation.batch_id")
    .optional()
    .isMongoId()
    .withMessage("collocation batch_id must be a valid ObjectId"),
  body("collocation.start_date")
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
      let dp = countDecimalPlaces(value);
      if (dp < 5) {
        return Promise.reject("the latitude must have 5 or more characters");
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
      let dp = countDecimalPlaces(value);
      if (dp < 5) {
        return Promise.reject("the longitude must have 5 or more characters");
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
  body("product_name")
    .optional()
    .notEmpty()
    .trim(),
  body("device_manufacturer")
    .optional()
    .notEmpty()
    .trim(),
  body("device_codes")
    .optional()
    .custom((value) => {
      return Array.isArray(value);
    })
    .withMessage("the device_codes should be an array if provided")
    .bail()
    .notEmpty()
    .withMessage("the device_codes should not be empty if provided"),
  body("category")
    .optional()
    .notEmpty()
    .withMessage("the category should not be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["bam", "lowcost", "gas"])
    .withMessage(
      "the category value is not among the expected ones which include: lowcost, bam and gas",
    ),
];

const validateListDevices = oneOf([
  [
    query("device_number")
      .optional()
      .notEmpty()
      .trim()
      .isInt()
      .withMessage("device_number must be an integer")
      .bail()
      .toInt(),
    query("id")
      .optional()
      .notEmpty()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("site_id")
      .optional()
      .notEmpty()
      .trim()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .optional()
      .notEmpty()
      .trim()
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the device name can only contain letters, numbers, spaces, hyphens and underscores",
      )
      .bail(),
    query("mobility")
      .optional()
      .notEmpty()
      .withMessage("the mobility should not be empty if provided")
      .bail()
      .trim()
      .isBoolean()
      .withMessage("mobility must be a boolean value (true or false)"),
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
    query("category")
      .optional()
      .notEmpty()
      .withMessage("the category should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["bam", "lowcost", "gas"])
      .withMessage(
        "the category value is not among the expected ones which include: lowcost, gas and bam",
      ),
    query("device_category")
      .optional()
      .notEmpty()
      .withMessage("the device_category should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["bam", "lowcost", "gas"])
      .withMessage(
        "the device_category value is not among the expected ones which include: lowcost, gas and bam",
      ),
    query("last_active_before")
      .optional()
      .notEmpty()
      .withMessage("last_active_before date cannot be empty IF provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage(
        "last_active_before date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)..",
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
  ],
]);

const validateEncryptKeys = oneOf([
  [
    body("writeKey")
      .optional()
      .notEmpty()
      .withMessage("writeKey should not be empty")
      .trim(),
    body("readKey")
      .optional()
      .notEmpty()
      .withMessage("readKey should not be empty")
      .trim(),
  ],
]);

const validateDecryptKeys = oneOf([
  body("encrypted_key")
    .exists()
    .withMessage("encrypted_key parameter should be provided")
    .trim(),
]);

const validateDecryptManyKeys = oneOf([
  [
    body("*.encrypted_key")
      .exists()
      .trim()
      .withMessage("encrypted_key is missing")
      .bail()
      .notEmpty()
      .withMessage(
        "the encrypted_key should not be empty for all provided entries",
      ),
    body("*.device_number")
      .exists()
      .trim()
      .withMessage("device_number is missing in one of the inputs")
      .bail()
      .isInt()
      .withMessage(
        "the device_number in some of the inputs should be an integer value",
      ),
  ],
]);

const validateArrayBody = oneOf([
  body()
    .isArray()
    .withMessage("the request body should be an array"),
]);

const validateBulkUpdateDevices = [
  body("deviceIds")
    .exists()
    .withMessage("deviceIds must be provided in the request body")
    .bail()
    .isArray()
    .withMessage("deviceIds must be an array")
    .bail()
    .custom((value) => {
      if (value.length === 0) {
        throw new Error("deviceIds array cannot be empty");
      }
      return true;
    })
    .bail()
    .custom((value) => {
      const MAX_BULK_UPDATE_DEVICES = 30;
      if (value.length > MAX_BULK_UPDATE_DEVICES) {
        throw new Error(
          `Cannot update more than ${MAX_BULK_UPDATE_DEVICES} devices in a single request`,
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
        throw new Error("All deviceIds must be valid MongoDB ObjectIds");
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
      const allowedFields = [
        "groups",
        "mobility",
        "owner",
        "description",
        "product_name",
        "device_manufacturer",
        "category",
      ];

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
  ...validateUpdateDevice,
];

const validateClaimDevice = [
  body("device_name")
    .exists()
    .withMessage("device_name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("device_name cannot be empty")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "device_name can only contain letters, numbers, spaces, hyphens and underscores",
    ),

  body("claim_token")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("claim_token cannot be empty if provided"),

  body("user_id")
    .exists()
    .withMessage("user_id is required")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),

  body("cohort_id")
    .optional()
    .trim()
    .isMongoId()
    .withMessage("cohort_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),
];

const validateTransferDevice = [
  body("device_name")
    .exists()
    .withMessage("device_name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("device_name cannot be empty")
    .bail()
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "device_name can only contain letters, numbers, spaces, hyphens and underscores",
    ),

  body("from_user_id")
    .exists()
    .withMessage("from_user_id is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("from_user_id cannot be empty")
    .bail()
    .isMongoId()
    .withMessage("from_user_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => ObjectId(value)), // Only run if valid

  body("to_user_id")
    .exists()
    .withMessage("to_user_id is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("to_user_id cannot be empty")
    .bail()
    .isMongoId()
    .withMessage("to_user_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => ObjectId(value)), // Only run if valid

  body("include_deployment_history")
    .optional()
    .isBoolean()
    .withMessage("include_deployment_history must be a boolean value"),
];

const validateBulkClaim = [
  body("user_id")
    .exists()
    .withMessage("user_id is required")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => ObjectId(value)),

  body("devices")
    .exists()
    .withMessage("devices array is required")
    .bail()
    .isArray({ min: 1 })
    .withMessage("devices must be a non-empty array"),

  body("devices.*.device_name")
    .exists()
    .withMessage("device_name is required for each device")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("device_name cannot be empty")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "device_name can only contain letters, numbers, spaces, hyphens and underscores",
    ),

  body("devices.*.claim_token")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("claim_token cannot be empty if provided"),

  body("cohort_id")
    .optional()
    .trim()
    .isMongoId()
    .withMessage("cohort_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),
];

const validateListOrphanedDevices = [
  query("user_id")
    .exists()
    .withMessage("user_id is a required query parameter")
    .bail()
    .notEmpty()
    .withMessage("user_id must not be empty")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId")
    .trim(),
];

const validateGetMyDevices = [
  query("user_id")
    .exists()
    .withMessage("user_id is required")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => ObjectId(value)),

  query("organization_id")
    .optional()
    .trim()
    .isMongoId()
    .withMessage("organization_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
];

const validateDeviceAvailability = [
  param("deviceName")
    .exists()
    .withMessage("deviceName parameter is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("deviceName cannot be empty")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "deviceName can only contain letters, numbers, spaces, hyphens and underscores",
    ),
];

const validateOrganizationAssignment = [
  body("device_name")
    .exists()
    .withMessage("device_name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("device_name cannot be empty"),

  body("organization_id")
    .exists()
    .withMessage("organization_id is required")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("organization_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),

  body("user_id")
    .exists()
    .withMessage("user_id is required")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),

  body("organization_data")
    .optional()
    .custom((value) => {
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error("organization_data must be an object");
      }
      return true;
    }),

  body("organization_data.name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("organization name must be between 1 and 100 characters"),

  body("organization_data.type")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("organization type must be between 1 and 50 characters"),
];

const validateOrganizationSwitch = [
  param("organization_id")
    .exists()
    .withMessage("organization_id parameter is required")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("organization_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),

  body("user_id")
    .exists()
    .withMessage("user_id is required")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),
];

const validateQRCodeGeneration = [
  param("deviceName")
    .exists()
    .withMessage("deviceName parameter is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("deviceName cannot be empty")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "deviceName can only contain letters, numbers, spaces, hyphens and underscores",
    ),

  query("include_token")
    .optional()
    .isIn(["true", "false"])
    .withMessage("include_token must be 'true' or 'false'"),

  query("format")
    .optional()
    .isIn(["data", "image"])
    .withMessage("format must be 'data' or 'image'"),
];

const validateMigrationRequest = [
  body("dry_run")
    .optional()
    .isBoolean()
    .withMessage("dry_run must be a boolean"),

  body("batch_size")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("batch_size must be an integer between 1 and 1000"),

  body("generate_tokens")
    .optional()
    .isBoolean()
    .withMessage("generate_tokens must be a boolean"),
];

const validateGetUserOrganizations = [
  query("user_id")
    .exists()
    .withMessage("user_id is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("user_id cannot be empty")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId")
    .customSanitizer((value) => ObjectId(value)),
];

const validatePrepareDeviceShipping = [
  body("device_name")
    .exists()
    .withMessage("device_name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("device_name cannot be empty")
    .bail()
    .isLength({ min: 3, max: 50 })
    .withMessage("device_name must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "device_name can only contain letters, numbers, spaces, hyphens and underscores",
    ),

  body("token_type")
    .optional()
    .trim()
    .isIn(["hex", "readable"])
    .withMessage("token_type must be either 'hex' or 'readable'"),
];

const validateBulkPrepareDeviceShipping = [
  body("device_names")
    .exists()
    .withMessage("device_names is required")
    .bail()
    .isArray({ min: 1, max: 50 })
    .withMessage("device_names must be an array with 1-50 device names")
    .bail()
    .custom((deviceNames) => {
      // Check each device name format
      const invalidNames = deviceNames.filter(
        (name) =>
          typeof name !== "string" ||
          name.trim().length < 3 ||
          name.trim().length > 50 ||
          !/^[a-zA-Z0-9\s\-_]+$/.test(name.trim()),
      );

      if (invalidNames.length > 0) {
        throw new Error(`Invalid device names: ${invalidNames.join(", ")}`);
      }

      // Check for duplicates
      const duplicates = deviceNames.filter(
        (name, index) => deviceNames.indexOf(name) !== index,
      );
      if (duplicates.length > 0) {
        throw new Error(
          `Duplicate device names found: ${[...new Set(duplicates)].join(
            ", ",
          )}`,
        );
      }

      return true;
    }),

  body("token_type")
    .optional()
    .trim()
    .isIn(["hex", "readable"])
    .withMessage("token_type must be either 'hex' or 'readable'"),

  body("batch_name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("batch_name cannot be empty if provided"),
];

const validateCreateShippingBatch = [
  body("device_names")
    .exists()
    .withMessage("device_names is required")
    .bail()
    .isArray({ min: 1, max: 50 })
    .withMessage("device_names must be an array with 1-50 device names")
    .bail()
    .custom((deviceNames) => {
      // Check each device name format
      const invalidNames = deviceNames.filter(
        (name) =>
          typeof name !== "string" ||
          name.trim().length < 3 ||
          name.trim().length > 50 ||
          !/^[a-zA-Z0-9\s\-_]+$/.test(name.trim()),
      );

      if (invalidNames.length > 0) {
        throw new Error(`Invalid device names: ${invalidNames.join(", ")}`);
      }

      // Check for duplicates
      const duplicates = deviceNames.filter(
        (name, index) => deviceNames.indexOf(name) !== index,
      );
      if (duplicates.length > 0) {
        throw new Error(
          `Duplicate device names found: ${[...new Set(duplicates)].join(
            ", ",
          )}`,
        );
      }
      return true;
    }),

  body("token_type")
    .optional()
    .trim()
    .isIn(["hex", "readable"])
    .withMessage("token_type must be either 'hex' or 'readable'"),

  body("batch_name")
    .exists()
    .withMessage("batch_name is a required field")
    .bail()
    .notEmpty()
    .withMessage("batch_name cannot be empty"),
];

const validateGetShippingStatus = [
  query("device_names")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        // Single device name or comma-separated list
        const names = value.split(",").map((name) => name.trim());
        const invalidNames = names.filter(
          (name) =>
            name.length < 3 ||
            name.length > 50 ||
            !/^[a-zA-Z0-9\s\-_]+$/.test(name),
        );

        if (invalidNames.length > 0) {
          throw new Error(`Invalid device names: ${invalidNames.join(", ")}`);
        }
      } else if (Array.isArray(value)) {
        // Array of device names
        const invalidNames = value.filter(
          (name) =>
            typeof name !== "string" ||
            name.trim().length < 3 ||
            name.trim().length > 50 ||
            !/^[a-zA-Z0-9\s\-_]+$/.test(name.trim()),
        );

        if (invalidNames.length > 0) {
          throw new Error(`Invalid device names: ${invalidNames.join(", ")}`);
        }
      }

      return true;
    }),
];

const validateGenerateShippingLabels = [
  body("device_names")
    .exists()
    .withMessage("device_names is required")
    .bail()
    .isArray({ min: 1, max: 20 })
    .withMessage("device_names must be an array with 1-20 device names")
    .bail()
    .custom((deviceNames) => {
      const invalidNames = deviceNames.filter(
        (name) =>
          typeof name !== "string" ||
          name.trim().length < 3 ||
          name.trim().length > 50 ||
          !/^[a-zA-Z0-9\s\-_]+$/.test(name.trim()),
      );

      if (invalidNames.length > 0) {
        throw new Error(`Invalid device names: ${invalidNames.join(", ")}`);
      }

      return true;
    }),
];

const validateGetShippingBatchDetails = [
  param("id")
    .exists()
    .withMessage("The batch ID is missing in the request path.")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("Invalid batch ID. Must be a valid MongoDB ObjectId."),
];

const validateGetDeviceCountSummary = [
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
    })
    .trim(),
  query("network")
    .optional()
    .isString()
    .withMessage("network must be a string")
    .trim(),
];

const validateRemoveDevicesFromBatch = [
  param("id")
    .exists()
    .withMessage("The batch ID is missing in the request path.")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("Invalid batch ID. Must be a valid MongoDB ObjectId."),
  body("device_names")
    .exists()
    .withMessage("device_names is required")
    .bail()
    .isArray({ min: 1, max: 50 })
    .withMessage(
      "device_names must be a non-empty array of strings with at most 50 items",
    )
    .bail()
    .custom((deviceNames) => {
      const invalidNames = deviceNames.filter(
        (name) => typeof name !== "string" || name.trim().length === 0,
      );
      if (invalidNames.length > 0) {
        throw new Error("All device names must be non-empty strings");
      }
      return true;
    }),
];

const validateUserIdBody = [
  body("user_id")
    .exists()
    .withMessage("user_id is a mandatory field")
    .bail()
    .notEmpty()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId"),
];

module.exports = {
  validateTenant,
  pagination,
  validateDeviceIdentifier,
  validateArrayBody,
  validateCreateDevice,
  validateUpdateDevice,
  validateDeviceIdParam,
  validateEncryptKeys,
  validateListDevices,
  validateDecryptKeys,
  validateDecryptManyKeys,
  validateBulkUpdateDevices,
  validateClaimDevice,
  validateBulkClaim,
  validateTransferDevice,
  validateGetMyDevices,
  validateDeviceAvailability,
  validateOrganizationAssignment,
  validateOrganizationSwitch,
  validateQRCodeGeneration,
  validateMigrationRequest,
  validateGetUserOrganizations,
  validatePrepareDeviceShipping,
  validateBulkPrepareDeviceShipping,
  validateGetShippingStatus,
  validateGetShippingBatchDetails,
  validateGenerateShippingLabels,
  getIdFromName,
  getNameFromId,
  suggestDeviceNames,
  validateGetDeviceCountSummary,
  validateListOrphanedDevices,
  validateUserIdBody,
  validateCreateShippingBatch,
  validateRemoveDevicesFromBatch,
};
