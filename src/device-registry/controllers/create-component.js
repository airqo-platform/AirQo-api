const ComponentSchema = require("../models/Component");
const { getDetailsOnPlatform } = require("../utils/get-device-details");
const { getComponentDetails } = require("../utils/get-component-details");
const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("../utils/multitenancy");
const { deleteOnPlatform } = require("../utils/delete-component");
const { createComponentOnPlatform } = require("../utils/create-component");
const { updateComponentOnPlatform } = require("../utils/update-component");

const {
  tryCatchErrors,
  missingQueryParams,
  itemDoesNotExist,
} = require("../utils/errors");

const Component = {
  list: async (req, res) => {
    try {
      logText("list components.......");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { component, device, tenant } = req.query;
      if (tenant) {
        const components = await getComponentDetails(
          tenant,
          component,
          device,
          limit,
          skip
        );
        logObject("components", components);
        const doesComponentExist = !isEmpty(components);
        logElement("isComponentPresent?", doesComponentExist);

        if (components.length) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Components fetched successfully",
            components,
          });
        } else {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Component(s) not available",
            components,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e.message);
    }
  },

  create: async (req, res) => {
    logText("................................");
    logText("adding Component....");
    try {
      let { device, tenant } = req.query;
      let { measurement, description, name, calibration } = req.body;
      let componentBody = {
        ...req.body,
        deviceID: device,
      };
      if (device && measurement && description && tenant) {
        const deviceDetails = await getDetailsOnPlatform(tenant, device);
        logObject("deviceDetails", deviceDetails);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent?", doesDeviceExist);
        if (doesDeviceExist) {
          let responseFromCreateOnPlatform = await createComponentOnPlatform(
            tenant,
            componentBody
          );

          if (responseFromCreateOnPlatform.success === true) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully created the component",
              component: responseFromCreateOnPlatform.createdComponent,
            });
          } else if (responseFromCreateOnPlatform.success === false) {
            if (responseFromCreateOnPlatform.error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                success: false,
                message: "successfully created the component",
                error: responseFromCreateOnPlatform.error,
              });
            } else {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                success: false,
                message: "successfully created the component",
              });
            }
          }
        } else {
          itemDoesNotExist(device, res);
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e.message);
    }
  },

  delete: async (req, res) => {
    try {
      const { component, tenant } = req.query;
      if (tenant && component) {
        const componentDetails = await getComponentDetails(tenant, component);
        const doesComponentExist = !isEmpty(componentDetails);
        logElement("isDevicePresent ?", doesComponentExist);
        if (doesComponentExist) {
          let responseFromDeleteOnPlatform = await deleteOnPlatform(
            tenant,
            component
          );
          if (responseFromDeleteOnPlatform.success === true) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: responseFromDeleteOnPlatform.message,
            });
          } else if (responseFromDeleteOnPlatform.success === false) {
            if (responseFromDeleteOnPlatform.error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                success: false,
                message: responseFromDeleteOnPlatform.message,
                error: responseFromDeleteOnPlatform.error,
              });
            } else {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                success: false,
                message: responseFromDeleteOnPlatform.message,
              });
            }
          }
        } else {
          itemDoesNotExist(component, res);
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  update: async (req, res) => {
    try {
      const { tenant, component } = req.query;
      const componentBody = req.body;
      const deviceFilter = {
        _id: component,
      };
      let options = {
        new: true,
        upsert: true,
      };
      if (tenant && component) {
        const componentDetails = await getComponentDetails(tenant, component);
        logObject("component details", componentDetails);
        const doesDeviceExist = !isEmpty(componentDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          let responseFromPlatform = await updateComponentOnPlatform(
            componentBody,
            deviceFilter,
            tenant,
            options
          );
          logObject("response from platform", responseFromPlatform);
          if (responseFromPlatform.success === true) {
            return res.status(HTTPStatus.OK).json({
              message: responseFromPlatform.message,
              success: true,
              updatedDevice: responseFromPlatform.updatedDevice,
            });
          } else if (responseFromPlatform.success === false) {
            if (responseFromPlatform.error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromPlatform.message,
                success: false,
                error: responseFromPlatform.error,
              });
            } else {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromPlatform.message,
                success: false,
              });
            }
          }
        } else {
          logText(`component ${component} does not exist in the system`);
          res.status(HTTPStatus.BAD_REQUEST).json({
            message: `component ${component} does not exist in the system`,
            success: false,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
};

module.exports = Component;
