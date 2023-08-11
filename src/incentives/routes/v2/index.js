const express = require("express");
const router = express.Router();

router.use("/transactions", require("@routes/v2/transactions"));
router.use("/hosts", require("@routes/v2/hosts"));

module.exports = router;
