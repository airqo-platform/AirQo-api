const { validateNetwork } = require("./network.validators");
const { validateAdminLevels } = require("./admin-levels.validators");
const headers = require("./headers.validators");
const pagination = require("./pagination.validators");

module.exports = {
  validateNetwork,
  validateAdminLevels,
  headers,
  pagination,
};
