// photos.validators.js
const {
  oneOf,
  query,
  body,
  param,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const { validateNetwork, validateAdminLevels } = require("@validators/common");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant cannot be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
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
  validObjectId: (field, isRequired = true, location = query) => {
    const chain = location(field)
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      });
    return isRequired ? chain : chain.optional();
  },

  deviceNumber: [
    query("device_number")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .isInt()
      .withMessage("should be an integer value"),
  ],

  deviceName: [
    query("device_name")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("should not have spaces in it"),
  ],

  photoIdentifier: oneOf([
    body("site_id")
      .exists()
      .withMessage(
        "a key photo identifier is missing in the request, consider adding a site_id",
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("device_id")
      .exists()
      .withMessage(
        "a key photo identifier is missing in the request, consider adding a device_id",
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("device_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("airqloud_id")
      .exists()
      .withMessage(
        "a key photo identifier is missing in the request, consider adding a airqloud_id",
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("airqloud_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  deviceDetails: [
    body("device_number")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty if provided")
      .bail()
      .trim()
      .isInt()
      .withMessage("should be an integer value"),
    body("device_name")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty if provided")
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ],
  photos: [
    body("photos")
      .exists()
      .withMessage("the photos are missing in your request")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the photos should be an array"),
  ],

  photosOptional: [
    body("photos")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("should be an array"),
  ],

  optionalBodyValues: [
    body("device_number")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .isInt()
      .withMessage("should be an integer value"),
    body("device_id")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("airqloud_id")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("site_id")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("device_name")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("should not have spaces in them"),
  ],
};

const photoValidations = {
  deletePhoto: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      [
        ...commonValidations.deviceNumber,
        body("device_id")
          .optional()
          .notEmpty()
          .withMessage("cannot be empty")
          .bail()
          .trim()
          .isMongoId()
          .withMessage("must be an object ID")
          .bail()
          .customSanitizer((value) => {
            return ObjectId(value);
          }),
        body("device_name")
          .optional()
          .notEmpty()
          .withMessage("cannot be empty")
          .bail()
          .trim()
          .matches(constants.WHITE_SPACES_REGEX, "i")
          .withMessage("should not have spaces in it"),
      ],
    ]),
    (req, res, next) => {
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
    },
  ],

  createPhoto: [
    ...commonValidations.tenant,
    commonValidations.photoIdentifier,
    ...commonValidations.deviceDetails,
    ...commonValidations.photos,
    (req, res, next) => {
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
    },
  ],

  updatePhoto: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    ...commonValidations.optionalBodyValues,
    ...commonValidations.photosOptional,

    (req, res, next) => {
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
    },
  ],

  listPhotos: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id", false),
      [
        ...commonValidations.deviceNumber,
        ...commonValidations.deviceName,
        commonValidations.validObjectId("device_id", false),
        commonValidations.validObjectId("airqloud_id", false),
      ],
    ]),

    (req, res, next) => {
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
    },
  ],

  createPhotoOnPlatform: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("site_id", true, body),
      commonValidations.validObjectId("device_id", true, body),
      commonValidations.validObjectId("airqloud_id", true, body),
      body("device_name")
        .exists()
        .withMessage(
          "a key photo identifier is missing in the request, consider adding either  device_name (preferred) or airqloud_id or device_id or site_id",
        )
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device_name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("should not have spaces in them"),
    ]),

    ...commonValidations.deviceDetails,
    body("image_url")
      .exists()
      .withMessage("missing in request")
      .bail()
      .trim()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("cannot have spaces in it")
      .bail()
      .isURL()
      .withMessage("not a valid URL")
      .trim(),
    body("tags")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("should be an array"),
    body("metadata")
      .optional()
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("should be an object")
      .bail()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("cannot be empty if provided"),
    body("metadata.url")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty when provided")
      .bail()
      .trim()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("cannot have spaces in it")
      .bail()
      .isURL()
      .withMessage("not a valid URL")
      .trim(),
    body("metadata.public_id")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty when provided")
      .bail()
      .trim()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("cannot have spaces in it")
      .trim(),

    (req, res, next) => {
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
    },
  ],

  updatePhotoOnPlatform: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
    ...commonValidations.optionalBodyValues,
    body("image_url")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .isURL()
      .withMessage("not a valid URL"),

    body("description")
      .optional()
      .trim(),
    body("image_code")
      .optional()
      .trim(),

    body("tags")
      .optional()
      .notEmpty()
      .withMessage("cannot be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("should be an array"),

    body("metadata")
      .optional()
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("should be an object")
      .bail()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("cannot be empty"),

    body("metadata.url")
      .optional()
      .notEmpty()
      .withMessage("should not be empty")
      .bail()
      .isURL()
      .withMessage("should be a valid URL")
      .bail()
      .trim(),

    body("metadata.public_id")
      .optional()
      .notEmpty()
      .withMessage("should not be empty if provided")
      .bail()
      .trim(),
    body("metadata.version")
      .optional()
      .notEmpty()
      .withMessage("should not be empty if provided")
      .bail()
      .isFloat()
      .withMessage("should be a number")
      .bail()
      .trim(),
    body("metadata.signature")
      .optional()
      .notEmpty()
      .withMessage("should not be empty")
      .trim(),
    body("metadata.width")
      .optional()
      .notEmpty()
      .withMessage("should not be empty if provided")
      .isFloat()
      .withMessage("should be a number")
      .bail()
      .trim(),
    body("metadata.height")
      .optional()
      .notEmpty()
      .withMessage("should not be empty if provided")
      .isFloat()
      .withMessage("should be a number")
      .bail()
      .trim(),
    body("metadata.format")
      .optional()
      .trim(),
    body("metadata.resource_type")
      .optional()
      .trim(),

    body("metadata.created_at")
      .optional()
      .trim(),
    body("metadata.bytes")
      .optional()
      .notEmpty()
      .withMessage("should not be empty if provided")
      .isFloat()
      .withMessage("should be a number")
      .bail()
      .trim(),
    body("metadata.type")
      .optional()
      .trim(),
    body("metadata.secure_url")
      .optional()
      .notEmpty()
      .withMessage("should not be empty if provided")
      .bail()
      .isURL()
      .withMessage("should be a valid URL")
      .bail()
      .trim(),

    (req, res, next) => {
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
    },
  ],

  deletePhotoOnPlatform: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    (req, res, next) => {
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
    },
  ],

  createPhotoOnCloudinary: [
    body("resource_type")
      .exists()
      .withMessage("resource_type is missing in request")
      .trim(),
    body("path")
      .exists()
      .withMessage("path is missing in request")
      .trim(),
    body("device_name")
      .exists()
      .withMessage("device_name is missing in request")
      .trim(),
    (req, res, next) => {
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
    },
  ],

  deletePhotoOnCloudinary: [
    body("image_urls")
      .exists()
      .withMessage("image_urls is missing in the request body")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("must be an array")
      .bail()
      .notEmpty()
      .withMessage("cannot be empty")
      .trim(),

    body("image_urls.*")
      .isURL()
      .withMessage("not a valid URL"),

    query("device_name")
      .exists()
      .withMessage(
        "the device_name query parameter must be provided for this operation",
      )
      .trim(),
    (req, res, next) => {
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
    },
  ],
  updatePhotoOnCloudinary: [
    (req, res, next) => {
      next();
    },
  ],
};

module.exports = {
  ...photoValidations,
  pagination: commonValidations.pagination,
};
