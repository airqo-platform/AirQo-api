const express = require("express");
const router = express.Router();

router.use("/activities", require("@routes/v1/activities"));
router.use("/airqlouds", require("@routes/v1/airqlouds"));
router.use("/sites", require("@routes/v1/sites"));
router.use("/devices", require("@routes/v1/devices"));
router.use("/events", require("@routes/v1/events"));
router.use("/locations", require("@routes/v1/locations"));
router.use("/photos", require("@routes/v1/photos"));
router.use("/tips", require("@routes/v1/tips"));
router.use("/kya", require("@routes/v1/kya"));
router.use("/sensors", require("@routes/v1/sensors"));
router.use("/cohorts", require("@routes/v1/cohorts"));
router.use("/grids", require("@routes/v1/grids"));
router.use("/", require("@routes/v1/devices"));

module.exports = router;
