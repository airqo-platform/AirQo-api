const { validateNetwork } = require("./network.validators");
const { validateAdminLevels } = require("./admin-levels.validators");

module.exports = {
  validateNetwork,
  validateAdminLevels,
};
