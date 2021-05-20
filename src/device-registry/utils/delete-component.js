const ComponentSchema = require("../models/Component");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");

const deleteOnPlatform = async (tenant, component) => {
  try {
    logText("deleting component from the platform.......");
    const componentRemovedFromPlatform = await getModelByTenant(
      tenant.toLowerCase(),
      "component",
      ComponentSchema
    )
      .findOneAndRemove({
        _id: component,
      })
      .exec();
    if (componentRemovedFromPlatform) {
      return {
        message: "successfully deleted the component",
        success: true,
        component,
      };
    } else if (!componentRemovedFromPlatform) {
      return {
        message: "unable to delete the component",
        success: false,
        component,
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
  deleteOnPlatform,
};
