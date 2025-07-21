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

router.get("/", transformController.getChannels);
router.get("/age", transformController.getChannelLastEntryAge);
router.get("/fields/age", transformController.getLastFieldEntryAge);
router.get("/count", transformController.getDeviceCount);

module.exports = router;
