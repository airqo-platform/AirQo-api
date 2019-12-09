const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device');
const { authJWT } = require('../services/auth');
const middlewareConfig = require('../config/router.middleware');
const deviceValidation = require('../utils/validations');
const validate = require('express-validation');

middlewareConfig(router);

router.get('/', deviceController.listAll);
router.get('/gcp', deviceController.listAllGcp);

router.post('/', validate(deviceValidation.createDevice), deviceController.createOne);
router.post('/gcp/', deviceController.createOneGcp);

router.get('/:id', deviceController.listOne);
router.get('/:name/gcp', deviceController.listOneGcp);

router.delete('/:id', authJWT, deviceController.delete);
router.delete('/:name/gcp', deviceController.deleteGcp);

router.put('/:id', authJWT, validate(deviceValidation.updateDevice), deviceController.updateDevice);
router.put('/:name/gcp', deviceController.updateDeviceGcp);


module.exports = router;