const express = require("express");
const router = express.Router();
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- routes-v2-index`);

// Safe require function
function safeRequire(path, name) {
  try {
    return require(path);
  } catch (error) {
    logger.error(`Failed to load route ${name}: ${error.message}`);
    console.error(`⚠️ Warning: Failed to load route ${name}: ${error.message}`);
    return null;
  }
}

// Safely load all routes
const networkRoutes = safeRequire("@routes/v2/networks.routes", "networks");
const permissionsRoutes = safeRequire(
  "@routes/v2/permissions.routes",
  "permissions"
);
const favoritesRoutes = safeRequire("@routes/v2/favorites.routes", "favorites");
const rolesRoutes = safeRequire("@routes/v2/roles.routes", "roles");
const inquiriesRoutes = safeRequire("@routes/v2/inquiries.routes", "inquiries");
const analyticsRoutes = safeRequire("@routes/v2/analytics.routes", "analytics");
const candidatesRoutes = safeRequire(
  "@routes/v2/candidates.routes",
  "candidates"
);
const requestsRoutes = safeRequire("@routes/v2/requests.routes", "requests");
const defaultsRoutes = safeRequire("@routes/v2/defaults.routes", "defaults");
const checklistRoutes = safeRequire("@routes/v2/checklist.routes", "checklist");
const preferencesRoutes = safeRequire(
  "@routes/v2/preferences.routes",
  "preferences"
);
const notificationPrefRoutes = safeRequire(
  "@routes/v2/notification-preferences.routes",
  "notification-preferences"
);
const maintenancesRoutes = safeRequire(
  "@routes/v2/maintenance.routes",
  "maintenances"
);
const typesRoutes = safeRequire("@routes/v2/types.routes", "types");
const tokensRoutes = safeRequire("@routes/v2/tokens.routes", "tokens");
const clientsRoutes = safeRequire("@routes/v2/clients.routes", "clients");
const scopesRoutes = safeRequire("@routes/v2/scopes.routes", "scopes");
const departmentsRoutes = safeRequire(
  "@routes/v2/departments.routes",
  "departments"
);
const transactionsRoutes = safeRequire(
  "@routes/v2/transactions.routes",
  "transactions"
);
const campaignsRoutes = safeRequire("@routes/v2/campaign.routes", "campaigns");
const groupsRoutes = safeRequire("@routes/v2/groups.routes", "groups");
const locationHistoryRoutes = safeRequire(
  "@routes/v2/location-history.routes",
  "location-history"
);
const searchHistoryRoutes = safeRequire(
  "@routes/v2/search-history.routes",
  "search-history"
);
const guestsRoutes = safeRequire("@routes/v2/guests.routes", "guests");
const tenantSettingsRoutes = safeRequire(
  "@routes/v2/tenant-settings.routes",
  "tenant-settings"
);
const usersRoutes = safeRequire("@routes/v2/users.routes", "users");

// Register routes if they loaded successfully
if (networkRoutes) router.use("/networks", networkRoutes);
if (permissionsRoutes) router.use("/permissions", permissionsRoutes);
if (favoritesRoutes) router.use("/favorites", favoritesRoutes);
if (rolesRoutes) router.use("/roles", rolesRoutes);
if (inquiriesRoutes) router.use("/inquiries", inquiriesRoutes);
if (analyticsRoutes) router.use("/analytics", analyticsRoutes);
if (candidatesRoutes) router.use("/candidates", candidatesRoutes);
if (requestsRoutes) router.use("/requests", requestsRoutes);
if (defaultsRoutes) router.use("/defaults", defaultsRoutes);
if (checklistRoutes) router.use("/checklist", checklistRoutes);
if (preferencesRoutes) router.use("/preferences", preferencesRoutes);
if (notificationPrefRoutes)
  router.use("/notification-preferences", notificationPrefRoutes);
if (maintenancesRoutes) router.use("/maintenances", maintenancesRoutes);
if (typesRoutes) router.use("/types", typesRoutes);
if (tokensRoutes) router.use("/tokens", tokensRoutes);
if (clientsRoutes) router.use("/clients", clientsRoutes);
if (scopesRoutes) router.use("/scopes", scopesRoutes);
if (departmentsRoutes) router.use("/departments", departmentsRoutes);
if (transactionsRoutes) router.use("/transactions", transactionsRoutes);
if (campaignsRoutes) router.use("/campaigns", campaignsRoutes);
if (groupsRoutes) router.use("/groups", groupsRoutes);
if (locationHistoryRoutes)
  router.use("/locationHistory", locationHistoryRoutes);
if (searchHistoryRoutes) router.use("/searchHistory", searchHistoryRoutes);
if (guestsRoutes) router.use("/guests", guestsRoutes);
if (tenantSettingsRoutes) router.use("/tenant-settings", tenantSettingsRoutes);
if (usersRoutes) router.use("/", usersRoutes);

module.exports = router;
