// sharedValidators.js
const NetworkModel = require("@models/Network");

const validNetworks = async (tenant) => {
  // Add tenant parameter
  const networks = await NetworkModel(tenant).distinct("name"); // Use the passed tenant
  return networks.map((network) => network.toLowerCase());
};

const validateNetwork = async (value, { req }) => {
  // Access req object
  const tenant = req.query.tenant || "airqo"; // Default to "airqo"
  const networks = await validNetworks(tenant); // Pass the tenant to validNetworks
  if (!networks.includes(value.toLowerCase())) {
    throw new Error("Invalid network");
  }
  return true; // Important: return true for successful validation
};

module.exports = { validateNetwork };
