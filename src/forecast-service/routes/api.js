const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecast');
const middlewareConfig = require('../config/router.middleware');
middlewareConfig(router);

router.post('/', forecastController.forecast);
router.get('/channels', forecastController.storeChannels);
router.get('/feeds/:id', forecastController.storeFeeds);

module.exports = router;