// feeds.routes.js
const express = require("express");
const router = express.Router();
const transformController = require("@controllers/feed.controller");
const feedsValidations = require("@validators/feeds.validators");
const { headers, pagination } = require("@validators/common");
router.use(headers);

router.get(
  "/recent/:ch_id",
  feedsValidations.getLastFeed,
  pagination(),
  transformController.getLastFeed
);

router.get(
  "/transform/recent",
  feedsValidations.generateDescriptiveLastEntry,
  pagination(),
  transformController.generateDescriptiveLastEntry
);

module.exports = router;
