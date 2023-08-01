const express = require("express");
const router = express.Router();

router.use("/", require("@routes/v1/feeds"));

module.exports = router;
