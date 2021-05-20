const ComponentSchema = require("../models/Component");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logElement, logText } = require("../utils/log");

const createComponentOnPlatform = async (tenant, componentBody) => {
  try {
    const createdComponent = await getModelByTenant(
      tenant,
      "component",
      ComponentSchema
    ).createComponent(componentBody);
    logElement("component addition response", createdComponent);
    if (createdComponent) {
      return {
        success: true,
        message: "successfully created the component",
        createdComponent,
      };
    } else {
      return {
        success: false,
        message: "unable to create the component",
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "unable to create the component",
      error: error.message,
    };
  }
};

module.exports = {
  createComponentOnPlatform,
};
