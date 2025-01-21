const express = require("express");
const router = express.Router();

router.use("/activities", require("@routes/v2/activities.routes"));
router.use("/airqlouds", require("@routes/v2/airqlouds.routes"));
router.use("/sites", require("@routes/v2/sites.routes"));
router.use("/devices", require("@routes/v2/devices.routes"));
router.use("/events", require("@routes/v2/events.routes"));
router.use("/readings", require("@routes/v2/readings.routes"));
router.use("/uptime", require("@routes/v2/uptime.routes"));
router.use("/feeds", require("@routes/v2/feeds.routes"));
router.use("/collocations", require("@routes/v2/collocations.routes"));
router.use("/measurements", require("@routes/v2/measurements.routes"));
router.use("/signals", require("@routes/v2/signals.routes"));
router.use("/locations", require("@routes/v2/locations.routes"));
router.use("/photos", require("@routes/v2/photos.routes"));
router.use("/forecasts", require("@routes/v2/forecasts.routes"));
router.use("/tips", require("@routes/v2/tips.routes"));
router.use("/kya", require("@routes/v2/kya.routes"));
router.use("/cohorts", require("@routes/v2/cohorts.routes"));
router.use("/grids", require("@routes/v2/grids.routes"));
router.use("/metadata", require("@routes/v2/metadata.routes"));
router.use("/transmit", require("@routes/v2/transmit.routes"));
router.use("/", require("@routes/v2/devices.routes"));

module.exports = router;
