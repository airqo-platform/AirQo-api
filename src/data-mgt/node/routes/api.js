const express = require("express");
const router = express.Router();
const transformController = require("../controllers/transform");
const middlewareConfig = require("../config/router.middleware");
middlewareConfig(router);

router.get("/channels", transformController.getChannels);
router.get("/feeds/:ch_id", transformController.getFeeds);
router.get("/feeds/recent/:ch_id", transformController.getLastEntry);
router.get("/feeds/hourly/:ch_id", transformController.hourly);
router.get("/channels/age", transformController.getChannelLastEntryAge);
router.get("/channels/fields/age", transformController.getLastFieldEntryAge);
router.get("/channels/count", transformController.getDeviceCount);
router.get(
  "/feeds/json/recent",
  transformController.generateDescriptiveLastEntry
);

module.exports = router;
