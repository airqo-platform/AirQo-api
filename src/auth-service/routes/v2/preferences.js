const express = require("express");
const router = express.Router();
const createPreferenceController = require("@controllers/create-preference");
const { oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
// const { logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const { logText, logObject } = require("@utils/log");
const { isMongoId } = require("validator");
// const stringify = require("@utils/stringify");
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

const validateUniqueFieldsInSelectedSites = (req, res, next) => {
  const selectedSites = req.body.selected_sites;

  // Create Sets to track unique values for each field
  const uniqueSiteIds = new Set();
  const uniqueSearchNames = new Set();
  const uniqueNames = new Set();

  const duplicateSiteIds = [];
  const duplicateSearchNames = [];
  const duplicateNames = [];

  selectedSites.forEach((item) => {
    // Check for duplicate site_id if it exists
    if (item.site_id !== undefined) {
      if (uniqueSiteIds.has(item.site_id)) {
        duplicateSiteIds.push(item.site_id);
      } else {
        uniqueSiteIds.add(item.site_id);
      }
    }

    // Check for duplicate search_name if it exists
    if (item.search_name !== undefined) {
      if (uniqueSearchNames.has(item.search_name)) {
        duplicateSearchNames.push(item.search_name);
      } else {
        uniqueSearchNames.add(item.search_name);
      }
    }

    // Check for duplicate name if it exists
    if (item.name !== undefined) {
      if (uniqueNames.has(item.name)) {
        duplicateNames.push(item.name);
      } else {
        uniqueNames.add(item.name);
      }
    }
  });

  // Prepare error messages based on duplicates found
  let errorMessage = "";
  if (duplicateSiteIds.length > 0) {
    errorMessage +=
      "Duplicate site_ids found: " +
      [...new Set(duplicateSiteIds)].join(", ") +
      ". ";
  }
  if (duplicateSearchNames.length > 0) {
    errorMessage +=
      "Duplicate search_names found: " +
      [...new Set(duplicateSearchNames)].join(", ") +
      ". ";
  }
  if (duplicateNames.length > 0) {
    errorMessage +=
      "Duplicate names found: " +
      [...new Set(duplicateNames)].join(", ") +
      ". ";
  }

  // If any duplicates were found, respond with an error
  if (errorMessage) {
    return res.status(400).json({
      success: false,
      message: errorMessage.trim(),
    });
  }

  next();
};
router.use(headers);
router.use(validatePagination(100, 1000));

router.post(
  "/upsert",
  validateTenant(),
  validatePreferences(),
  validateSelectedSites(["_id", "search_name", "name"], true),
  createPreferenceController.upsert
);
router.patch(
  "/replace",
  validateTenant(),
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
  validateUniqueFieldsInSelectedSites,
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
