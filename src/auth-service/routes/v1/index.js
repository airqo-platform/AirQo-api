const defaults = require("@routes/v1/defaults");
const departments = require("@routes/v1/departments");
const groups = require("@routes/v1/groups");
const inquiries = require("@routes/v1/inquiries");
const networks = require("@routes/v1/networks");
const permissions = require("@routes/v1/permissions");
const favorites = require("@routes/v1/favorites");
const requests = require("@routes/v1/requests");
const roles = require("@routes/v1/roles");
const users = require("@routes/v1/users");
const tokens = require("@routes/v1/tokens");
const clients = require("@routes/v1/clients");
const scopes = require("@routes/v1/scopes");
const locationHistory = require("@routes/v1/locationHistory");

module.exports = {
  defaults,
  departments,
  groups,
  inquiries,
  networks,
  permissions,
  requests,
  roles,
  users,
  tokens,
  scopes,
  clients,
  favorites,
  locationHistory,
};
