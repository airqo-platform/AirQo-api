const express = require("express");
const router = express.Router();
const manager = require("../controllers/manager");
const middlewareConfig = require("../config/router.middleware");
middlewareConfig(router);

router.get("/channels", manager.storeChannels);
router.get("/feeds/:ch_id", manager.storeFeeds);
router.get("/feeds/recent/:ch_id", manager.getLastEntry);

//location of devices
router.get("/channels/gps", manager.getLocationDetails);
router.post("/channels/gps", manager.updateLocationDetails);
router.put("/channels/gps", manager.insertLocationDetails);
router.delete("/channels/gps", manager.deleteLocationDetails);

module.exports = router;
