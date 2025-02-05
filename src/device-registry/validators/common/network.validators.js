const NetworkModel = require("@models/Network");
const DEFAULT_TENANT = "airqo";

const validNetworks = async (tenant) => {
  const networks = await NetworkModel(tenant).distinct("name");
  return networks.map((network) => network.toLowerCase());
};

const validateNetwork = async (value, { req }) => {
  if (!value || typeof value !== "string") {
    throw new Error("Network value must be a non-empty string");
  }
  try {
    const tenant = req.query.tenant || DEFAULT_TENANT;
    const networks = await validNetworks(tenant);
    if (!networks.includes(value.toLowerCase())) {
      throw new Error(
        `Invalid network "${value}" for tenant "${tenant}". Valid networks are: ${networks.join(
          ", "
        )}`
      );
    }
    return true;
  } catch (error) {
    if (error.message.startsWith("Invalid network")) {
      throw error;
    }
    throw new Error("Failed to validate network due to internal error");
  }
};

module.exports = { validateNetwork };
