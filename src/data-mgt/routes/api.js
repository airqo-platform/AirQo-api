const express = require("express");
const router = express.Router();
const manager = require("../controllers/manager");
const middlewareConfig = require("../config/router.middleware");
middlewareConfig(router);

router.get("/channels", manager.storeChannels);
router.get("/feeds/:ch_id", manager.storeFeeds);
router.get("/feeds/recent/:ch_id", manager.getLastEntry);
router.get("/feeds/hourly/:ch_id", manager.hourly);
router.get("/channels/age/", manager.getChannelLastEntryAge);
router.get("/channels/fields/age", manager.getLastFieldEntryAge);
router.get("/channels/count", manager.getDeviceCount);

module.exports = router;