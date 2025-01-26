// feeds.routes.js
const express = require("express");
const router = express.Router();
const transformController = require("@controllers/feed.controller");
const feedsValidations = require("@validators/feeds.validators");

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

router.get(
  "/recent/:ch_id",
  feedsValidations.getLastFeed,
  transformController.getLastFeed
);

router.get(
  "/transform/recent",
  feedsValidations.generateDescriptiveLastEntry,
  transformController.generateDescriptiveLastEntry
);

module.exports = router;
