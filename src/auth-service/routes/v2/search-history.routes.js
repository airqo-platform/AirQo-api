// search-history.routes.js
const express = require("express");
const router = express.Router();
const createSearchHistoryController = require("@controllers/search-history.controller");
const searchHistoryValidations = require("@validators/search-history.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

router.get(
  "/",
  searchHistoryValidations.list,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createSearchHistoryController.list
);

router.get(
  "/users/:firebase_user_id",
  searchHistoryValidations.listByUserId,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createSearchHistoryController.list
);

router.post(
  "/",
  searchHistoryValidations.create,
  enhancedJWTAuth,
  createSearchHistoryController.create
);

router.post(
  "/syncSearchHistory/:firebase_user_id",
  searchHistoryValidations.syncSearchHistory,
  enhancedJWTAuth,
  createSearchHistoryController.syncSearchHistory
);

router.put(
  "/:search_history_id",
  searchHistoryValidations.update,
  enhancedJWTAuth,
  createSearchHistoryController.update
);

router.delete(
  "/:search_history_id",
  searchHistoryValidations.delete,
  enhancedJWTAuth,
  createSearchHistoryController.delete
);

router.get(
  "/:search_history_id",
  searchHistoryValidations.getById,
  pagination(), // Apply pagination here as it calls list
  enhancedJWTAuth,
  createSearchHistoryController.list
);

module.exports = router;
