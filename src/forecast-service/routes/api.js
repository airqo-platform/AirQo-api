const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecast');
const middlewareConfig = require('../config/router.middleware');

middlewareConfig(router);

router.post('/', forecastController.forecast);
router.post('/channels', forecastController.channels)
router.post('/feeds', forecastController.feeds);

module.exports = router;