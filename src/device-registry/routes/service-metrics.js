const express = require("express");
const router = express.Router();
const metricsController = require("../controllers/service-metrics");

router.get('/', metricsController.default);

module.exports = router;