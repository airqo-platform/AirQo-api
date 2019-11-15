const express = require('express');
const router = express.Router();
const incentivesController = require('../controllers/incentivise');
const middlewareConfig = require('../config/router.middleware');

middlewareConfig(router)

router.post('/transfer', incentivesController.transfer);
router.post('/callback', incentivesController.callback);



module.exports = router;