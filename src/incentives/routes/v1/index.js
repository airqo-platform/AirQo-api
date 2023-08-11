const express = require("express");
const router = express.Router();

router.use("/transactions", require("@routes/v1/transactions"));
router.use("/hosts", require("@routes/v1/hosts"));

module.exports = router;
