const express = require("express");
const router = express.Router();
const transformController = require("@controllers/transform");
const { check, oneOf, query, body, param } = require("express-validator");

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

router.get("/channels", transformController.getChannels);
// router.get("/feeds/:ch_id", transformController.getFeeds);
router.get("/feeds/recent/:ch_id", transformController.getLastEntry);
router.get("/hourly/feeds", transformController.hourly);
router.get("/channels/age", transformController.getChannelLastEntryAge);
router.get("/channels/fields/age", transformController.getLastFieldEntryAge);
router.get("/channels/count", transformController.getDeviceCount);
router.get(
  "/feeds/transform/recent",
  oneOf([
    [
      query("channel")
        .exists()
        .withMessage(
          "the channel query parameter must always be available in the request"
        )
        .notEmpty()
        .withMessage(
          "the channel query parameter cannot be empty in the request"
        )
        .bail()
        .isNumeric()
        .withMessage("the channel must be a number")
        .trim(),
      query("start")
        .optional()
        .notEmpty()
        .withMessage("start date cannot be empty if provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("start date must be a valid datetime.")
        .toDate(),
      query("end")
        .optional()
        .notEmpty()
        .withMessage("end date cannot be empty if provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("end date must be a valid datetime.")
        .toDate(),
    ],
  ]),
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
  transformController.readFeeds
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
  transformController.readMostRecentFeeds
);

module.exports = router;
