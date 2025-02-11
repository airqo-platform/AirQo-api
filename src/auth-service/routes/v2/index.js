const express = require("express");
const router = express.Router();

router.use("/networks", require("@routes/v2/networks.routes"));
router.use("/permissions", require("@routes/v2/permissions.routes"));
router.use("/favorites", require("@routes/v2/favorites.routes"));
router.use("/roles", require("@routes/v2/roles.routes"));
router.use("/inquiries", require("@routes/v2/inquiries.routes"));
router.use("/analytics", require("@routes/v2/analytics.routes"));
router.use("/candidates", require("@routes/v2/candidates.routes"));
router.use("/requests", require("@routes/v2/requests.routes"));
router.use("/defaults", require("@routes/v2/defaults.routes"));
router.use("/checklist", require("@routes/v2/checklist.routes"));
router.use("/preferences", require("@routes/v2/preferences.routes"));
router.use(
  "/notification-preferences",
  require("@routes/v2/notification-preferences.routes")
);
router.use("/maintenances", require("@routes/v2/maintenance.routes"));
router.use("/types", require("@routes/v2/types.routes"));
router.use("/tokens", require("@routes/v2/tokens.routes"));
router.use("/clients", require("@routes/v2/clients.routes"));
router.use("/scopes", require("@routes/v2/scopes.routes"));
router.use("/departments", require("@routes/v2/departments.routes"));
router.use("/transactions", require("@routes/v2/transactions.routes"));
router.use("/campaigns", require("@routes/v2/campaign.routes"));
router.use("/groups", require("@routes/v2/groups.routes"));
router.use("/locationHistory", require("@routes/v2/location-history.routes"));
router.use("/searchHistory", require("@routes/v2/search-history.routes"));
router.use("/", require("@routes/v2/users.routes"));

module.exports = router;
