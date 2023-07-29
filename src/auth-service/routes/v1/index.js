const express = require("express");
const router = express.Router();

router.use("/networks", require("@routes/v1/networks"));
router.use("/permissions", require("@routes/v1/permissions"));
router.use("/favorites", require("@routes/v1/favorites"));
router.use("/roles", require("@routes/v1/roles"));
router.use("/inquiries", require("@routes/v1/inquiries"));
router.use("/requests", require("@routes/v1/requests"));
router.use("/defaults", require("@routes/v1/defaults"));
router.use("/tokens", require("@routes/v1/tokens"));
router.use("/clients", require("@routes/v1/clients"));
router.use("/scopes", require("@routes/v1/scopes"));
router.use("/departments", require("@routes/v1/departments"));
router.use("/groups", require("@routes/v1/groups"));
router.use("/locationHistory", require("@routes/v1/locationHistory"));
router.use("/", require("@routes/v1/users"));

module.exports = router;
