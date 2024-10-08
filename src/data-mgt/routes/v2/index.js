const express = require("express");
const router = express.Router();

router.use("/feeds", require("@routes/v2/feeds"));
router.use("/channels", require("@routes/v2/channels"));
router.use("/hourly", require("@routes/v2/hourly"));

module.exports = router;
