const express = require("express");
const router = express.Router();

router.use("/feeds", require("@routes/v1/feeds"));
router.use("/channels", require("@routes/v1/channels"));
router.use("/hourly", require("@routes/v1/hourly"));

module.exports = router;
