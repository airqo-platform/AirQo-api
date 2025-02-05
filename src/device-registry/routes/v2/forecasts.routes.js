const express = require("express");
const router = express.Router();
const forecastController = require("@controllers/forecast.controller");
const forecastValidations = require("@validators/forecast.validators");
const { oneOf } = require("express-validator");
const { headers, pagination } = require("@validators/common");

router.use(headers);

/******************* forecasts use-case ***************/
router.post("/", oneOf(forecastValidations.create), forecastController.create);
router.get(
  "/devices/:deviceId",
  oneOf(forecastValidations.listByDevice),
  pagination(),
  forecastController.listByDevice
);
router.get(
  "/sites/:siteId",
  oneOf(forecastValidations.listBySite),
  pagination(),
  forecastController.listBySite
);

module.exports = router;
