const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device');
const { authJWT } = require('../services/auth');
const middlewareConfig = require('../config/router.middleware');
const deviceValidation = require('../utils/validations');
const validate = require('express-validation');

middlewareConfig(router)

router.get('/', deviceController.listAll);

router.post('/', validate(deviceValidation.createDevice), deviceController.createOne);

router.get('/:id', deviceController.listOne);

router.delete('/:id', authJWT, deviceController.delete);

router.patch('/:id', authJWT, validate(deviceValidation.updateDevice), deviceController.updateDevice);


module.exports = router;