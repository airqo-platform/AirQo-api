// search-history.routes.js
const express = require("express");
const router = express.Router();
const createSearchHistoryController = require("@controllers/search-history.controller");
const searchHistoryValidations = require("@validators/search-history.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
  setJWTAuth,
  authJWT,
  createSearchHistoryController.list
);

router.get(
  "/users/:firebase_user_id",
  searchHistoryValidations.listByUserId,
  setJWTAuth,
  authJWT,
  createSearchHistoryController.list
);

router.post(
  "/",
  searchHistoryValidations.create,
  setJWTAuth,
  authJWT,
  createSearchHistoryController.create
);

router.post(
  "/syncSearchHistory/:firebase_user_id",
  searchHistoryValidations.syncSearchHistory,
  setJWTAuth,
  authJWT,
  createSearchHistoryController.syncSearchHistory
);

router.put(
  "/:search_history_id",
  searchHistoryValidations.update,
  setJWTAuth,
  authJWT,
  createSearchHistoryController.update
);

router.delete(
  "/:search_history_id",
  searchHistoryValidations.delete,
  setJWTAuth,
  authJWT,
  createSearchHistoryController.delete
);

router.get(
  "/:search_history_id",
  searchHistoryValidations.getById,
  setJWTAuth,
  authJWT,
  createSearchHistoryController.list
);

module.exports = router;
