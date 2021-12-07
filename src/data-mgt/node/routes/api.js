const express = require("express");
const router = express.Router();
const transformController = require("../controllers/transform");
const middlewareConfig = require("../config/router.middleware");
middlewareConfig(router);
const { check, oneOf, query, body, param } = require("express-validator");

router.get("/channels", transformController.getChannels);
// router.get("/feeds/:ch_id", transformController.getFeeds);
router.get("/feeds/recent/:ch_id", transformController.getLastEntry);
router.get("/hourly/feeds", transformController.hourly);
router.get("/channels/age", transformController.getChannelLastEntryAge);
router.get("/channels/fields/age", transformController.getLastFieldEntryAge);
router.get("/channels/count", transformController.getDeviceCount);
router.get(
  "/feeds/transform/recent",
  transformController.generateDescriptiveLastEntry
);

router.get(
  "/feeds",
  oneOf([
    query("channel")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the channel"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the channel should be an integer value"),
  ]),
  transformController.readDataRangeOfEvents
);

router.get(
  "/feeds/last",
  oneOf([
    query("channel")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the channel"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the channel should be an integer value"),
  ]),
  transformController.readDataRangeOfEvents
);

module.exports = router;
