// feeds.routes.js
const express = require("express");
const router = express.Router();
const transformController = require("@controllers/feed.controller");
const feedsValidations = require("@validators/feeds.validators");
const { headers, pagination } = require("@validators/common");
router.use(headers);
router.use(pagination());

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
