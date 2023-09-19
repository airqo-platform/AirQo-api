const express = require("express");
const router = express.Router();

router.use("/activities", require("@routes/v2/activities"));
router.use("/airqlouds", require("@routes/v2/airqlouds"));
router.use("/sites", require("@routes/v2/sites"));
router.use("/devices", require("@routes/v2/devices"));
router.use("/events", require("@routes/v2/events"));
router.use("/measurements", require("@routes/v2/measurements"));
router.use("/locations", require("@routes/v2/locations"));
router.use("/photos", require("@routes/v2/photos"));
router.use("/tips", require("@routes/v2/tips"));
router.use("/kya", require("@routes/v2/kya"));
router.use("/sensors", require("@routes/v2/sensors"));
router.use("/cohorts", require("@routes/v2/cohorts"));
router.use("/grids", require("@routes/v2/grids"));
router.use("/metadata", require("@routes/v2/metadata"));
router.use("/transmit", require("@routes/v2/transmit"));
router.use("/", require("@routes/v2/devices"));

module.exports = router;
