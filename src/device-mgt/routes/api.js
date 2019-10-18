const express = require('express');
const router = express.Router();
const managerController = require('../controllers/manager');
const { authJWT } = require('../services/auth');
const middlewareConfig = require('../config/router.middleware');

middlewareConfig(router)

router.get('/:id/sensors', managerController.listAll);
router.post('/:id/sensors', managerController.addSensor)
router.get('/:id/sensors/:sensor_id', managerController.listOne);
router.delete('/:id/sensors/:sensor_id', managerController.delete);
router.put('/:id/sensors/:sensor_id/name', managerController.updateName);
router.put('/:id/sensors/:sensor_id/unit', managerController.updateUnit);
router.put('/:id/sensors/:sensor_id/calib', managerController.calibrate);
router.post('/:id/sensors/:sensor_id/value', managerController.addValue);
router.put('/:id/sensors/:sensor_id/description', managerController.updateDescription);

module.exports = router;