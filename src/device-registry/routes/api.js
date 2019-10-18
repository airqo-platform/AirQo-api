const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device');
const { authJWT } = require('../services/auth');
const middlewareConfig = require('../config/router.middleware');

middlewareConfig(router)

router.get('/', deviceController.listAll);

router.get('/:id', deviceController.listOne);

router.delete('/:id', deviceController.delete);

router.put('/:id/name', deviceController.updateName);

router.put('/:id/location', deviceController.updateLocation);

router.put('/:id/visibility', deviceController.updateVisibility);

router.put('/:id/owner', deviceController.updateOwner);

router.put('/:id/description', deviceController.updateDescription);


module.exports = router;