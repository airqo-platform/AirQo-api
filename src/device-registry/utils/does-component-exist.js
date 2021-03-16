const ComponentSchema = require("../models/Component");
const DeviceSchema = require("../models/Device");
const ComponentTypeSchema = require("../models/ComponentType");
const { logObject, logText, logElement } = require("./log");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("./multitenancy");

const getApiKeys = async (deviceName, tenant) => {
  logText("...................................");
  logText("getting api keys...");
  const deviceDetails = await getModelByTenant(
    tenant.toLowerCase(),
    "component",
    ComponentSchema
  )
    .find({
      name: deviceName,
    })
    .exec();
  logElement("the write key", deviceDetails.writeKey);
  logElement("the read key", deviceDetails.readKey);
  const writeKey = deviceDetails.writeKey;
  const readKey = deviceDetails.readKey;
  return { writeKey, readKey };
};

const getArrayLength = async (array, model, event) => {};

const doesDeviceExist = async (deviceName, tenant) => {
  try {
    logText(".......................................");
    logText("doesDeviceExist?...");
    const device = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    ).find({
      name: deviceName,
    });
    if (!isEmpty(device)) {
      return true;
    } else if (isEmpty(device)) {
      return false;
    }
  } catch (e) {
    logElement("unable to check device existence in system", e);
    return false;
  }
};

const doesComponentExist = async (componentName, deviceName, tenant) => {
  try {
    logText(".......................................");
    logText("doesComponentExist?...");
    const component = await getModelByTenant(
      tenant.toLowerCase(),
      "component",
      ComponentSchema
    ).find({
      name: componentName,
      deviceID: deviceName,
    });
    if (!isEmpty(component)) {
      return true;
    } else if (isEmpty(component)) {
      return false;
    }
  } catch (e) {
    logElement("unable to check Component existence in system", e);
    return false;
  }
};

const doesComponentTypeExist = async (name, tenant) => {
  try {
    logText(".......................................");
    logText("doesComponentExist?...");
    const componentType = await getModelByTenant(
      tenant.toLowerCase(),
      "componentType",
      ComponentTypeSchema
    )
      .find({
        name: name,
      })
      .exec();
    logElement("component type element", componentType);
    logObject("component type Object", componentType);
    logElement("does component type exist?", !isEmpty(componentType));
    if (!isEmpty(componentType)) {
      return true;
    } else if (isEmpty(componentType)) {
      return false;
    }
  } catch (e) {
    logElement("unable to check component type existence in system", e);
    return false;
  }
};

module.exports = {
  getApiKeys,
  getArrayLength,
  doesDeviceExist,
  doesComponentExist,
  doesComponentTypeExist,
};
