const express = require("express");
const router = express.Router();

router.use("/networks", require("@routes/v2/networks"));
router.use("/permissions", require("@routes/v2/permissions"));
router.use("/favorites", require("@routes/v2/favorites"));
router.use("/roles", require("@routes/v2/roles"));
router.use("/inquiries", require("@routes/v2/inquiries"));
router.use("/candidates", require("@routes/v2/candidates"));
router.use("/requests", require("@routes/v2/requests"));
router.use("/defaults", require("@routes/v2/defaults"));
router.use("/checklist", require("@routes/v2/checklist"));
router.use("/preferences", require("@routes/v2/preferences"));
router.use("/types", require("@routes/v2/user-types"));
router.use("/tokens", require("@routes/v2/tokens"));
router.use("/clients", require("@routes/v2/clients"));
router.use("/scopes", require("@routes/v2/scopes"));
router.use("/departments", require("@routes/v2/departments"));
router.use("/groups", require("@routes/v2/groups"));
router.use("/locationHistory", require("@routes/v2/locationHistory"));
router.use("/searchHistory", require("@routes/v2/searchHistory"));
router.use("/", require("@routes/v2/users"));

module.exports = router;
