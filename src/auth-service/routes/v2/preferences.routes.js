const express = require("express");
const router = express.Router();
const createPreferenceController = require("@controllers/preference.controller");
const { oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
// const { logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const { logObject, logText, logElement, HttpError } = require("@utils/shared");
const { isMongoId } = require("validator");
const { stringify } = require("@utils/common");
const validateSelectedSites = require("@middleware/validateSelectedSites");
const validatePreferences = require("@middleware/validatePreferences");
const validateTenant = require("@middleware/validateTenant");
const validatePagination = require("@middleware/validatePagination");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};
router.use(headers);
router.use(validatePagination(100, 1000));

router.post(
  "/upsert",
  validateTenant(),
  body("user_id")
    .exists()
    .withMessage("the user_id should be provided in the request body")
    .bail()
    .notEmpty()
    .withMessage("the provided user_id should not be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the user_id must be an object ID")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  createPreferenceController.upsert
);
router.patch(
  "/replace",
  validateTenant(),
  body("user_id")
    .exists()
    .withMessage("the user_id should be provided in the request body")
    .bail()
    .notEmpty()
    .withMessage("the provided user_id should not be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the user_id must be an object ID")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  createPreferenceController.replace
);
router.put(
  "/:user_id",
  validateTenant(),
  param("user_id")
    .exists()
    .withMessage(
      "the record's identifier is missing in request, consider using the user_id"
    )
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  createPreferenceController.update
);
router.post(
  "/",
  validateTenant(),
  body("user_id")
    .exists()
    .withMessage("the user_id should be provided in the request body")
    .bail()
    .notEmpty()
    .withMessage("the provided user_id should not be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the user_id must be an object ID")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  createPreferenceController.create
);
router.get(
  "/",
  validateTenant(),
  validatePreferences(),
  createPreferenceController.list
);
router.delete(
  "/:user_id",
  validateTenant(),
  param("user_id")
    .exists()
    .withMessage("the the user_id is missing in request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  setJWTAuth,
  authJWT,
  createPreferenceController.delete
);
router.get(
  "/selected-sites",
  validateTenant(),
  validatePreferences(),
  createPreferenceController.listSelectedSites
);
router.post(
  "/selected-sites",
  validateTenant(),
  validateSelectedSites(["site_id", "search_name", "name"], false),
  setJWTAuth,
  authJWT,
  createPreferenceController.addSelectedSites
);
router.put(
  "/selected-sites/:site_id",
  validateTenant(),
  param("site_id")
    .exists()
    .withMessage("the site_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("site_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  validateSelectedSites([], false),
  setJWTAuth,
  authJWT,
  createPreferenceController.updateSelectedSite
);
router.delete(
  "/selected-sites/:site_id",
  validateTenant(),
  param("site_id")
    .exists()
    .withMessage("the site_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("site_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  setJWTAuth,
  authJWT,
  createPreferenceController.deleteSelectedSite
);
router.get(
  "/:user_id",
  validateTenant(),
  param("user_id")
    .exists()
    .withMessage("the user ID param is missing in the request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the user ID must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  setJWTAuth,
  authJWT,
  createPreferenceController.list
);

module.exports = router;
