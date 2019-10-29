const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensor');
const middlewareConfig = require('../config/router.middleware');

middlewareConfig(router)

router.get('/:d_id/sensors', sensorController.listAll);
router.post('/:d_id/sensors', sensorController.addSensor);
router.post('/:d_id/sensors/:s_id/value', sensorController.addValue);
router.get('/:d_id/sensors/:s_id', sensorController.listOne);
router.delete('/:d_id/sensors/:s_id', sensorController.delete);
router.put('/:d_id/sensors/:s_id', sensorController.update);

module.exports = router;