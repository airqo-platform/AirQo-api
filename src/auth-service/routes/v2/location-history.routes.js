// location-history.routes.js
const express = require("express");
const router = express.Router();
const createLocationHistoryController = require("@controllers/location-history.controller");
const locationHistoryValidations = require("@validators/location-history.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

router.get(
  "/",
  locationHistoryValidations.list,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createLocationHistoryController.list
);

router.get(
  "/users/:firebase_user_id",
  locationHistoryValidations.listByUserId,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createLocationHistoryController.list
);

router.post(
  "/",
  locationHistoryValidations.create,
  enhancedJWTAuth,
  createLocationHistoryController.create
);

router.post(
  "/syncLocationHistory/:firebase_user_id",
  locationHistoryValidations.syncLocationHistory,
  enhancedJWTAuth,
  createLocationHistoryController.syncLocationHistory
);

router.put(
  "/:location_history_id",
  locationHistoryValidations.update,
  enhancedJWTAuth,
  createLocationHistoryController.update
);

router.delete(
  "/:location_history_id",
  locationHistoryValidations.deleteLocationHistory,
  enhancedJWTAuth,
  createLocationHistoryController.delete
);

router.get(
  "/:location_history_id",
  locationHistoryValidations.getById,
  enhancedJWTAuth,
  createLocationHistoryController.list
);

module.exports = router;
