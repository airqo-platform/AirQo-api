const ComponentSchema = require("../models/Component");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const jsonify = require("./jsonify");
const { generateComponentsFilter } = require("./generate-filter");

const getComponentDetails = async (
  tenant,
  id,
  device,
  limitValue,
  skipValue
) => {
  try {
    const limit = parseInt(limitValue, 0);
    const skip = parseInt(skipValue, 0);
    const filter = generateComponentsFilter(id, device);
    logObject("the filter object", filter);
    const components = await getModelByTenant(
      tenant.toLowerCase(),
      "component",
      ComponentSchema
    ).list({ skip, limit, filter });
    let parsedComponents = jsonify(components);
    return parsedComponents;
  } catch (error) {
    logElement("error", error);
  }
};

module.exports = { getComponentDetails };
