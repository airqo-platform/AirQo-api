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
  pagination(),
  enhancedJWTAuth,
  createSearchHistoryController.list
);

router.get(
  "/users/:firebase_user_id",
  searchHistoryValidations.listByUserId,
  pagination(),
  enhancedJWTAuth,
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
  enhancedJWTAuth,
  createSearchHistoryController.list
);

module.exports = router;
