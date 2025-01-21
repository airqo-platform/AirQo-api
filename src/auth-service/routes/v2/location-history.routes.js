// location-history.routes.js
const express = require("express");
const router = express.Router();
const createLocationHistoryController = require("@controllers/location-history.controller");
const locationHistoryValidations = require("@validators/location-history.validators");
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
router.use(locationHistoryValidations.pagination);

router.get(
  "/",
  locationHistoryValidations.list,
  setJWTAuth,
  authJWT,
  createLocationHistoryController.list
);

router.get(
  "/users/:firebase_user_id",
  locationHistoryValidations.listByUserId,
  setJWTAuth,
  authJWT,
  createLocationHistoryController.list
);

router.post(
  "/",
  locationHistoryValidations.create,
  setJWTAuth,
  authJWT,
  createLocationHistoryController.create
);

router.post(
  "/syncLocationHistory/:firebase_user_id",
  locationHistoryValidations.syncLocationHistory,
  setJWTAuth,
  authJWT,
  createLocationHistoryController.syncLocationHistory
);

router.put(
  "/:location_history_id",
  locationHistoryValidations.update,
  setJWTAuth,
  authJWT,
  createLocationHistoryController.update
);

router.delete(
  "/:location_history_id",
  locationHistoryValidations.deleteLocationHistory,
  setJWTAuth,
  authJWT,
  createLocationHistoryController.delete
);

router.get(
  "/:location_history_id",
  locationHistoryValidations.getById,
  setJWTAuth,
  authJWT,
  createLocationHistoryController.list
);

module.exports = router;
