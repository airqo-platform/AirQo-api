const express = require("express");
const router = express.Router();

router.use("/transactions", require("@routes/v2/transactions"));
router.use("/hosts", require("@routes/v2/hosts"));
router.use("/sims", require("@routes/v2/sims"));

module.exports = router;
