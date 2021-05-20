const ComponentSchema = require("../models/Component");
const { logObject, logElement, logText } = require("./log");
const qs = require("qs");
const { getModelByTenant } = require("./multitenancy");

const updateComponentOnPlatform = async (
  componentBody,
  componentFilter,
  tenant,
  options
) => {
  try {
    const updatedComponent = await getModelByTenant(
      tenant.toLowerCase(),
      "component",
      ComponentSchema
    )
      .findByIdAndUpdate(componentFilter, componentBody, options)
      .exec();
    if (updatedComponent) {
      return {
        message: "successfully updated the component in the platform",
        updatedComponent,
        success: true,
      };
    } else if (!updatedComponent) {
      return {
        message: "unable to update component in the platform",
        success: false,
      };
    } else {
      return {
        message: "just unable to update component in the platform",
        success: false,
      };
    }
  } catch (error) {
    return {
      message: "server error",
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  updateComponentOnPlatform,
};
