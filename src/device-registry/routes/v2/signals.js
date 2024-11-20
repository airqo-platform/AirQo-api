const express = require("express");
const router = express.Router();
const eventController = require("@controllers/create-event");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const cacheGenerator = require("@utils/cache-id-generator");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const NetworkModel = require("@models/Network");
const redis = require("@config/redis");

const cacheMiddleware = async (req, res, next) => {
  try {
    const cacheID = cacheGenerator.generateCacheID(req, next);

    // Attach cache-related data to the request object
    req.cacheID = cacheID;
    req.cache = {
      get: async () => await redis.get(cacheID),
      set: async (data) => await redis.set(cacheID, JSON.stringify(data)),
    };

    // Check for cached data
    const cachedData = await redis.get(cacheID);
    if (cachedData) {
      req.cachedData = JSON.parse(cachedData);
    }

    // Always call next() to proceed to the route handler
    next();
  } catch (error) {
    next(error);
  }
};

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
// router.use(cacheMiddleware);

/******************* create-events use-case *******************************/

router.get("/map", eventController.signalsForMap);

module.exports = router;
