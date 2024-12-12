const { query, body, oneOf } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const numeral = require("numeral");
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const decimalPlaces = require("decimal-places");
const NetworkModel = require("@models/Network");

const validNetworks = async () => {
  const networks = await NetworkModel("airqo").distinct("name");
  return networks.map((network) => network.toLowerCase());
};

const validateNetwork = async (value) => {
  const networks = await validNetworks();
  if (!networks.includes(value.toLowerCase())) {
    throw new Error("Invalid network");
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

const validateDeviceIdentifier = oneOf([
  query("device_number")
    .exists()
    .withMessage(
      "the device identifier is missing in request, consider using the device_number"
    )
    .bail()
    .trim()
    .isInt()
    .withMessage("the device_number should be an integer value"),
  query("id")
    .exists()
    .withMessage(
      "the device identifier is missing in request, consider using the device_id"
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
      "the device identifier is missing in request, consider using the name"
    )
    .bail()
    .trim()
    .isLowercase()
    .withMessage("device name should be lower case")
    .bail()
    .matches(constants.WHITE_SPACES_REGEX, "i")
    .withMessage("the device names do not have spaces in them"),
]);

const validateCreateDevice = [
  oneOf([
    body("name")
      .exists()
      .withMessage(
        "device identification details are missing in the request, consider using the name"
      )
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the name should not be empty if provided"),
    body("long_name")
      .exists()
      .withMessage(
        "device identification details are missing in the request, consider using the long_name"
      )
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the long_name should not be empty if provided"),
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
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("category")
        .optional()
        .notEmpty()
        .withMessage("the category should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["bam", "lowcost", "gas"])
        .withMessage(
          "the category value is not among the expected ones which include: lowcost, gas and bam"
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
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
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
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
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
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
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
    .trim(),
  body("mountType")
    .optional()
    .notEmpty()
    .trim()
    .toLowerCase()
    .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
    .withMessage(
      "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
    ),
  body("powerType")
    .optional()
    .notEmpty()
    .trim()
    .toLowerCase()
    .isIn(["solar", "mains", "alternator"])
    .withMessage(
      "the powerType value is not among the expected ones which include: solar, mains and alternator"
    ),
  body("isActive")
    .optional()
    .notEmpty()
    .trim()
    .isBoolean()
    .withMessage("isActive must be Boolean"),
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
  body("mobility")
    .optional()
    .notEmpty()
    .trim()
    .isBoolean()
    .withMessage("mobility must be Boolean"),
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
  body("latitude")
    .optional()
    .notEmpty()
    .trim()
    .matches(constants.LATITUDE_REGEX, "i")
    .withMessage("please provide valid latitude value")
    .bail()
    .custom((value) => {
      let dp = decimalPlaces(value);
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
      let dp = decimalPlaces(value);
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
      "the category value is not among the expected ones which include: lowcost, bam and gas"
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
      .trim(),
    query("online_status")
      .optional()
      .notEmpty()
      .withMessage("the online_status should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["online", "offline"])
      .withMessage(
        "the online_status value is not among the expected ones which include: online, offline"
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
        "the category value is not among the expected ones which include: lowcost, gas and bam"
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
        "the device_category value is not among the expected ones which include: lowcost, gas and bam"
      ),
    query("last_active_before")
      .optional()
      .notEmpty()
      .withMessage("last_active_before date cannot be empty IF provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage(
        "last_active_before date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ).."
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
        "last_active_after date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
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
        "last_active date must be a valid ISO8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)."
      )
      .bail()
      .toDate(),
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
        "the encrypted_key should not be empty for all provided entries"
      ),
    body("*.device_number")
      .exists()
      .trim()
      .withMessage("device_number is missing in one of the inputs")
      .bail()
      .isInt()
      .withMessage(
        "the device_number in some of the inputs should be an integer value"
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
          `Cannot update more than ${MAX_BULK_UPDATE_DEVICES} devices in a single request`
        );
      }
      return true;
    })
    .bail()
    .custom((value) => {
      const invalidIds = value.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id)
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
    .isObject()
    .withMessage("updateData must be an object")
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
        "visibility",
        "long_name",
        "mountType",
        "powerType",
        "isActive",
        "groups",
        "isRetired",
        "mobility",
        "nextMaintenance",
        "isPrimaryInLocation",
        "isUsedForCollocation",
        "owner",
        "host_id",
        "phoneNumber",
        "height",
        "elevation",
        "writeKey",
        "readKey",
        "latitude",
        "longitude",
        "description",
        "product_name",
        "device_manufacturer",
        "device_codes",
        "category",
      ];

      const invalidFields = Object.keys(value).filter(
        (field) => !allowedFields.includes(field)
      );
      if (invalidFields.length > 0) {
        throw new Error(
          `Invalid fields in updateData: ${invalidFields.join(", ")}`
        );
      }

      return true;
    }),
  ...validateUpdateDevice,
];

module.exports = {
  validateTenant,
  validateDeviceIdentifier,
  validateArrayBody,
  validateCreateDevice,
  validateUpdateDevice,
  validateEncryptKeys,
  validateListDevices,
  validateDecryptKeys,
  validateDecryptManyKeys,
  validateBulkUpdateDevices,
};
