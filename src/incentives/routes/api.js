const express = require('express');
const router = express.Router();
const incentivesController = require('../controllers/incentivize');
const middlewareConfig = require('../config/router.middleware');

middlewareConfig(router)

router.post('/data', incentivesController.data);
router.post('/momo', incentivesController.momo);
router.post('/callback', incentivesController.callback);
router.get('/balance', incentivesController.getBalance);


module.exports = router;