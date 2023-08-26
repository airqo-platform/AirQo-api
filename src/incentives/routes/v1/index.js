const express = require("express");
const router = express.Router();

router.use("/transactions", require("@routes/v1/transactions"));
router.use("/hosts", require("@routes/v1/hosts"));
router.use("/sims", require("@routes/v1/sims"));
router.use("/networks", require("@routes/v1/networks"));

module.exports = router;
