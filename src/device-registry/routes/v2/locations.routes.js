// locations.routes.js
const express = require("express");
const router = express.Router();
const locationController = require("@controllers/location.controller");
const locationValidations = require("@validators/locations.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.post(
  "/",
  locationValidations.registerLocation,
  locationController.register
);

router.get("/", locationValidations.listLocations, locationController.list);

router.put("/", locationValidations.updateLocation, locationController.update);

router.delete(
  "/",
  locationValidations.deleteLocation,
  locationController.delete
);

module.exports = router;
