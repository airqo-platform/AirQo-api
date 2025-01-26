// locations.routes.js
const express = require("express");
const router = express.Router();
const locationController = require("@controllers/location.controller");
const locationValidations = require("@validators/locations.validators");

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(locationValidations.pagination());

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
