const express = require("express");
const router = express.Router();
const createLocationHistoryController = require("@controllers/create-location-history");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");

const { setJWTAuth, authJWT } = require("@middleware/passport");

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(validatePagination);

router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createLocationHistoryController.list
);

router.get(
  "/users/:firebase_user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
      param("firebase_user_id")
        .exists()
        .withMessage(
          "the firebase_user_id param is missing in request path, consider using firebase_user_id"
        )
        .bail()
        .notEmpty()
        .withMessage("the firebase_user_id must not be empty")
        .bail()
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createLocationHistoryController.list
);
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("name")
        .exists()
        .withMessage("name is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the name must not be empty")
        .bail()
        .trim(),
      body("location")
        .exists()
        .withMessage("location is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the location must not be empty")
        .bail()
        .trim(),
      body("place_id")
        .exists()
        .withMessage("place_id is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the place_id must not be empty")
        .bail()
        .trim(),
      body("reference_site")
        .optional()
        .notEmpty()
        .withMessage("the reference_site should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("reference_site must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("firebase_user_id")
        .exists()
        .withMessage("the firebase_user_id is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the firebase_user_id must not be empty")
        .bail()
        .trim(),
      body("latitude")
        .exists()
        .withMessage("the latitude is is missing in your request")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail(),

      body("longitude")
        .exists()
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail(),
      body("date_time")
        .exists()
        .withMessage("the date time is missing in your request")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startTime must be a valid datetime.")
        .bail(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createLocationHistoryController.create
);

router.post(
  "/syncLocationHistory/:firebase_user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("firebase_user_id")
        .exists()
        .withMessage("the firebase_user_id is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the firebase_user_id must not be empty")
        .bail()
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("location_histories")
        .exists()
        .withMessage("the location_histories are missing in the request body")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage(
          "Invalid request body format. The location_histories should be an array"
        ),
      body("location_histories.*")
        .optional()
        .isObject()
        .withMessage("Each location history should be an object"),
      body("location_histories.*.name")
        .exists()
        .withMessage("name is missing in the location history object")
        .bail()
        .notEmpty()
        .withMessage("the name must not be empty")
        .bail()
        .trim(),
      body("location_histories.*.location")
        .exists()
        .withMessage("location is missing in the location history object")
        .bail()
        .notEmpty()
        .withMessage("the location must not be empty")
        .bail()
        .trim(),
      body("location_histories.*.place_id")
        .exists()
        .withMessage("place_id is missing in the location history object")
        .bail()
        .notEmpty()
        .withMessage("the place_id must not be empty")
        .bail()
        .trim(),
      body("location_histories.*.reference_site")
        .optional()
        .notEmpty()
        .withMessage("the reference_site should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("reference_site must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("location_histories.*.firebase_user_id")
        .exists()
        .withMessage(
          "the firebase_user_id is missing in the location history object"
        )
        .bail()
        .notEmpty()
        .withMessage("the firebase_user_id must not be empty")
        .bail()
        .trim(),
      body("location_histories.*.latitude")
        .exists()
        .withMessage(
          "the latitude is is missing in the location history object"
        )
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid"),
      body("location_histories.*.longitude")
        .exists()
        .withMessage(
          "the longitude is is missing in the location history object"
        )
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid"),
      body("location_histories.*.date_time")
        .exists()
        .withMessage("the date_time is missing in the location history object")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startTime must be a valid datetime."),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createLocationHistoryController.syncLocationHistory
);

router.put(
  "/:location_history_id",
  (req, res, next) => {
    if (!Object.keys(req.body).length) {
      return res.status(400).json({ errors: "request body is empty" });
    }
    next();
  },
  oneOf([
    param("location_history_id")
      .exists()
      .withMessage(
        "the location_history_id param is missing in request path, consider using location_history_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("location_history_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
      body("name")
        .optional()
        .notEmpty()
        .withMessage("name should not be empty IF provided")
        .bail(),
      body("location")
        .optional()
        .notEmpty()
        .withMessage("location should not be empty IF provided")
        .bail()
        .notEmpty()
        .withMessage("the location must not be empty")
        .bail()
        .trim(),
      body("place_id")
        .optional()
        .notEmpty()
        .withMessage("place_id should not be empty IF provided")
        .bail()
        .notEmpty()
        .withMessage("the place_id must not be empty")
        .bail()
        .trim(),
      body("reference_site")
        .optional()
        .notEmpty()
        .withMessage("reference_site should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("reference_site must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("firebase_user_id")
        .optional()
        .notEmpty()
        .withMessage("the firebase_user_id should not be empty IF provided")
        .bail()
        .trim(),
      body("latitude")
        .optional()
        .notEmpty()
        .withMessage("the latitude should not be empty IF provided")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail(),
      body("longitude")
        .optional()
        .notEmpty()
        .withMessage("the longitude should not be empty IF provided")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail(),
      body("date_time")
        .optional()
        .notEmpty()
        .withMessage("the date_time should not be empty IF provided")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startTime must be a valid datetime.")
        .bail(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createLocationHistoryController.update
);

router.delete(
  "/:location_history_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("location_history_id")
      .exists()
      .withMessage(
        "the location_history_id param is missing in request path, consider using location_history_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("location_history_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createLocationHistoryController.delete
);

router.get(
  "/:location_history_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
      param("location_history_id")
        .exists()
        .withMessage(
          "the location_history_id param is missing in request path, consider using location_history_id"
        )
        .bail()
        .trim()
        .isMongoId()
        .withMessage("location_history_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createLocationHistoryController.list
);

module.exports = router;
