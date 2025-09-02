// search-history.routes.js
const express = require("express");
const router = express.Router();
const createSearchHistoryController = require("@controllers/search-history.controller");
const searchHistoryValidations = require("@validators/search-history.validators");
const { enhancedJWTAuth } = require("@middleware/passport");

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
router.use(searchHistoryValidations.pagination);

router.get(
  "/",
  searchHistoryValidations.list,
  enhancedJWTAuth,
  createSearchHistoryController.list
);

router.get(
  "/users/:firebase_user_id",
  searchHistoryValidations.listByUserId,
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
