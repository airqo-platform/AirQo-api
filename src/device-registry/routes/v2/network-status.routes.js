const express = require("express");
const router = express.Router();
const networkStatusController = require("@controllers/network-status.controller");
const networkStatusValidations = require("@validators/network-status.validators");
const { oneOf } = require("express-validator");
const { headers, pagination } = require("@validators/common");

router.use(headers);

/******************* network status alerts use-case ***************/
router.post(
  "/",
  oneOf(networkStatusValidations.create),
  networkStatusController.create
);

router.get(
  "/",
  oneOf(networkStatusValidations.list),
  pagination(),
  networkStatusController.list
);

router.get(
  "/statistics",
  oneOf(networkStatusValidations.getStatistics),
  networkStatusController.getStatistics
);

router.get(
  "/trends/hourly",
  oneOf(networkStatusValidations.getHourlyTrends),
  networkStatusController.getHourlyTrends
);

router.get(
  "/recent",
  oneOf(networkStatusValidations.getRecentAlerts),
  networkStatusController.getRecentAlerts
);

router.get(
  "/uptime-summary",
  oneOf(networkStatusValidations.getUptimeSummary),
  networkStatusController.getUptimeSummary
);

module.exports = router;
