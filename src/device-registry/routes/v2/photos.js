const express = require("express");
const router = express.Router();
const photoController = require("@controllers/create-photo");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
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

const validatePagination = (req, res, next) => {
  let limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 1000;
  }
  if (limit > 2000) {
    limit = 2000;
  }
  if (isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  req.query.limit = limit;

  next();
};

const headers = (req, res, next) => {
  // const allowedOrigins = constants.DOMAIN_WHITELIST;
  // const origin = req.headers.origin;
  // if (allowedOrigins.includes(origin)) {
  //   res.setHeader("Access-Control-Allow-Origin", origin);
  // }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(validatePagination);

/******************* create-photo use-case ***************/
router.delete(
  "/",
  oneOf([
    [
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
  ]),
  oneOf([
    [
      query("id")
        .exists()
        .withMessage(
          "the photo unique identifier is missing in request, consider using the id"
        )
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device number cannot be empty")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .optional()
        .notEmpty()
        .withMessage("the device ID cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .optional()
        .notEmpty()
        .withMessage("the device name cannot be empty")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device name should not have spaces in it"),
    ],
  ]),
  photoController.delete
);
router.post(
  "/",
  oneOf([
    [
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
  ]),
  oneOf([
    body("site_id")
      .exists()
      .withMessage(
        "a key photo identifier is missing in the request, consider adding a site_id"
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
        "a key photo identifier is missing in the request, consider adding a device_id"
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
        "a key photo identifier is missing in the request, consider adding a airqloud_id"
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
  oneOf([
    [
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device_number cannot be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_name")
        .optional()
        .notEmpty()
        .withMessage("the device_name cannot be empty if provided")
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device names do not have spaces in them"),
      body("photos")
        .exists()
        .withMessage("the photos are missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the photos should be an array"),
    ],
  ]),
  photoController.create
);
router.put(
  "/",
  oneOf([
    [
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
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the photo unique identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device_number cannot be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .optional()
        .notEmpty()
        .withMessage("the device_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the airqloud_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("site_id")
        .optional()
        .notEmpty()
        .withMessage("the site_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .optional()
        .notEmpty()
        .withMessage("the device_name cannot be empty if provided")
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device names do not have spaces in them"),
      body("photos")
        .optional()
        .notEmpty()
        .withMessage("the photos cannot be empty if provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the photos should be an array"),
    ],
  ]),
  photoController.update
);
router.get(
  "/",
  oneOf([
    [
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
  ]),
  oneOf([
    [
      query("device_number")
        .optional()
        .notEmpty()
        .withMessage("this device_number cannot be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      query("device_name")
        .optional()
        .notEmpty()
        .withMessage("this device_name cannot be empty if provided")
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device_name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device_names do not have spaces in them"),
      query("device_id")
        .optional()
        .notEmpty()
        .withMessage("this device_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the airqloud_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  photoController.list
);
/*** platform */
router.post(
  "/soft",
  oneOf([
    [
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
  ]),
  oneOf([
    body("site_id")
      .exists()
      .withMessage(
        "a key photo identifier is missing in the request, consider adding either device_name (preferred) or airqloud_id, or device_id or site_id"
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
        "a key photo identifier is missing in the request, consider adding either device_name (preferred), airqloud_id or device_id or site_id"
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
        "a key photo identifier is missing in the request, consider adding either device_name (preferred) or airqloud_id or device_id or site_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("airqloud_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("device_name")
      .exists()
      .withMessage(
        "a key photo identifier is missing in the request, consider adding either  device_name (preferred) or airqloud_id or device_id or site_id"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device_name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device_names do not have spaces in them"),
  ]),
  oneOf([
    [
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device_number cannot be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("image_url")
        .exists()
        .withMessage("the image_url is missing in request")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the image_url cannot have spaces in it")
        .bail()
        .isURL()
        .withMessage("the image_url is not a valid URL")
        .trim(),
      body("tags")
        .optional()
        .notEmpty()
        .withMessage("the tags cannot be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("metadata cannot be empty if provided"),
      body("metadata.url")
        .optional()
        .notEmpty()
        .withMessage("the metadata.url cannot be empty when provided")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the metadata.url cannot be empty when provided")
        .withMessage("the cannot have spaces in it")
        .bail()
        .isURL()
        .withMessage("the metadata.url cannot be empty when provided")
        .withMessage("the metadata.url is not a valid URL")
        .trim(),
      body("metadata.public_id")
        .optional()
        .notEmpty()
        .withMessage("the metadata.public_id cannot be empty when provided")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the metadata.public_id cannot have spaces in it")
        .trim(),
    ],
  ]),
  photoController.createPhotoOnPlatform
);
router.put(
  "/soft",
  oneOf([
    [
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
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the photo unique identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device_number cannot be empty if provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .optional()
        .notEmpty()
        .withMessage("the device_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the airqloud_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("site_id")
        .optional()
        .notEmpty()
        .withMessage("the site_id cannot be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .optional()
        .notEmpty()
        .withMessage("the device_name cannot be empty if provided")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("device_name should not have spaces in it"),
      body("image_url")
        .optional()
        .notEmpty()
        .withMessage("the image_url cannot be empty if provided")
        .bail()
        .isURL()
        .withMessage("the image_url is not a valid URL"),
      body("description")
        .optional()
        .trim(),
      body("image_code")
        .optional()
        .trim(),
      body("tags")
        .optional()
        .notEmpty()
        .withMessage("the tags cannot be empty if provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage(
          "metadata cannot be empty when provided in this operation"
        ),
      body("metadata.url")
        .optional()
        .notEmpty()
        .withMessage("metadata should not be empty if provided")
        .bail()
        .isURL()
        .withMessage("metadata should be a valid URL")
        .bail()
        .trim(),
      body("metadata.public_id")
        .optional()
        .notEmpty()
        .withMessage("public_id should not be empty if provided")
        .bail()
        .trim(),
      body("metadata.version")
        .optional()
        .notEmpty()
        .withMessage("version should not be empty if provided")
        .bail()
        .isFloat()
        .withMessage("version should be a number")
        .bail()
        .trim(),
      body("metadata.signature")
        .optional()
        .notEmpty()
        .withMessage("signature should not be empty")
        .trim(),
      body("metadata.width")
        .optional()
        .notEmpty()
        .withMessage("width should not be empty if provided")
        .isFloat()
        .withMessage("the width should be a number")
        .bail()
        .trim(),
      body("metadata.height")
        .optional()
        .notEmpty()
        .withMessage("height should not be empty if provided")
        .isFloat()
        .withMessage("the height should be a number")
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
        .withMessage("bytes should not be empty if provided")
        .isFloat()
        .withMessage("the bytes should be a number")
        .bail()
        .trim(),
      body("metadata.type")
        .optional()
        .trim(),
      body("metadata.secure_url")
        .optional()
        .notEmpty()
        .withMessage("secure_url should not be empty if provided")
        .bail()
        .isURL()
        .withMessage("secure_url should be a valid URL")
        .bail()
        .trim(),
    ],
  ]),
  photoController.updatePhotoOnPlatform
);
router.delete(
  "/soft",
  oneOf([
    [
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
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  photoController.deletePhotoOnPlatform
);
/*** metadata */
router.post(
  "/cloud",
  oneOf([
    [
      body("resource_type")
        .exists()
        .withMessage("resource_type is missing in request")
        .trim(),
      body("path")
        .exists()
        .withMessage("resource_type is missing in request")
        .trim(),
      body("device_name")
        .exists()
        .withMessage("device_name is missing in request")
        .trim(),
    ],
  ]),
  photoController.createPhotoOnCloudinary
);
router.delete(
  "/cloud",
  oneOf([
    [
      body("image_urls")
        .exists()
        .withMessage("image_urls is missing in the request body")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the image_urls must be an array")
        .bail()
        .notEmpty()
        .withMessage("the image_urls cannot be empty")
        .trim(),
      body("image_urls.*")
        .isURL()
        .withMessage("the provided URL is not a valid one"),
      query("device_name")
        .exists()
        .withMessage(
          "the device_name query parameter must be provided for this operation"
        )
        .trim(),
    ],
  ]),
  photoController.deletePhotoOnCloudinary
);
router.put("/cloud", photoController.updatePhotoOnCloudinary);
module.exports = router;
