const express = require("express");
const router = express.Router();

router.use("/", require("@routes/v2/feeds"));

module.exports = router;
