const express = require('express');
const router = express.Router();
const managerController = require('../controllers/manager');
const { authJWT } = require('../services/auth');
const middlewareConfig = require('../config/router.middleware');

middlewareConfig(router)

router.get('/:id/sensors', managerController.listAll);
router.post('/:id/sensors', managerController.addSensor)
router.post('/:id/sensors/:sensor_id/value', managerController.addValue);
router.get('/:id/sensors/:sensor_id', managerController.listOne);
router.delete('/:id/sensors/:sensor_id', managerController.delete);
router.put('/:id/sensors/:sensor_id/name', managerController.updateSensor);

module.exports = router;