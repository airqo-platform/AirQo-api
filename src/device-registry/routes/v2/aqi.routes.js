// aqi.routes.js
const express = require("express");
const router = express.Router();
const aqiController = require("@controllers/aqi.controller");
const aqiValidations = require("@validators/aqi.validators");
const { headers } = require("@validators/common");

router.use(headers);

router.get("/", aqiValidations.listRanges, aqiController.listRanges);
router.put("/", aqiValidations.updateRanges, aqiController.updateRanges);
router.delete("/", aqiValidations.deleteRanges, aqiController.deleteRanges);

module.exports = router;
