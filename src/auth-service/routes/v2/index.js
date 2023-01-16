const defaults = require("@routes/v2/defaults");
const departments = require("@routes/v2/departments");
const groups = require("@routes/v2/groups");
const inquiries = require("@routes/v2/inquiries");
const networks = require("@routes/v2/networks");
const permissions = require("@routes/v2/permissions");
const requests = require("@routes/v2/requests");
const roles = require("@routes/v2/roles");
const users = require("@routes/v2/users");
const tokens = require("@routes/v2/tokens");
const express = require("express");
const router = express.Router();

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
};
