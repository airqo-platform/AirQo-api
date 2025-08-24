const express = require("express");
const router = express.Router();
const lookupController = require("@controllers/lookup.controller");
const {
  validateTenant,
  getIdFromName,
  getNameFromId,
  suggestDeviceNames,
} = require("@validators/device.validators");

router.get(
  "/devices/id/:name",
  validateTenant,
  getIdFromName,
  lookupController.getIdFromName
);

router.get(
  "/devices/name/:id",
  validateTenant,
  getNameFromId,
  lookupController.getNameFromId
);

router.get(
  "/devices/suggest",
  validateTenant,
  suggestDeviceNames,
  lookupController.suggestDeviceNames
);

module.exports = router;
