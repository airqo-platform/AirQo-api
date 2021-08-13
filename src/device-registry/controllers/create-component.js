const ComponentSchema = require("../models/Component");
const DeviceSchema = require("../models/Device");
const ComponentTypeSchema = require("../models/ComponentType");
const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const EventSchema = require("../models/Event");
const axios = require("axios");
const { queryParam, filterOptions } = require("../utils/mappings");
const writeToThingMappings = require("../utils/writeToThingMappings");
const {
  uniqueNamesGenerator,
  NumberDictionary,
} = require("unique-names-generator");
const { getModelByTenant } = require("../utils/multitenancy");
const { getMeasurements } = require("utils/get-measurements");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const {
  getApiKeys,
  getArrayLength,
  doesDeviceExist,
  doesComponentExist,
  doesComponentTypeExist,
} = require("../utils/does-component-exist");

const transformMeasurements = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");

const Component = {
  listAll: async (req, res) => {
    try {
      logText("list components.......");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { comp, device, tenant } = req.query;

      if (tenant) {
        logElement("device name ", device);
        logElement("Component name ", comp);
        if (comp && device) {
          const component = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          )
            .find({
              name: comp,
              deviceID: device,
            })
            .exec();
          if (!isEmpty(component)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully listed one Component",
              component,
            });
          } else if (isEmpty(component)) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: `unable to find that Component ${comp} for device ${device}`,
            });
          }
        } else if (device && !comp) {
          const components = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          )
            .find({
              deviceID: device,
            })
            .exec();
          if (!isEmpty(components)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: `successfully listed the Components for device ${device}`,
              components,
            });
          } else if (isEmpty(components)) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: `unable to find the Components for device ${device}`,
            });
          }
        } else if (!device && !comp) {
          const components = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          ).list({ limit, skip });
          if (!isEmpty(components)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully listed all platform Components",
              tip:
                "use documented query parameters (device/comp) to filter your search results",
              components,
            });
          } else if (isEmpty(components)) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: `unable to find all the platform Components`,
            });
          }
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to list any Component",
        error: e.message,
      });
    }
  },

  addComponent: async (req, res) => {
    logText("................................");
    logText("adding Component....");
    try {
      let { device, tenant, ctype } = req.query;
      let { measurement, description } = req.body;
      if (device && ctype && measurement && description && tenant) {
        const isDevicePresent = await doesDeviceExist(device);
        logElement("isDevicePresent ?", isDevicePresent);

        const isComponentTypePresent = await doesComponentTypeExist(
          ctype,
          tenant.toLowerCase()
        );
        logElement("isComponentTypePresent ?", isComponentTypePresent);

        logObject("measurement", measurement);
        logElement("description", description);

        let componentName = `${device.trim()}_${ctype.trim()}`;
        if (isComponentTypePresent) {
          let componentBody = {
            ...req.body,
            deviceID: device,
            name: componentName,
          };

          const component = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          ).createComponent(componentBody);

          logElement("the component element", component);
          logObject("the component object", component);

          return res.status(HTTPStatus.CREATED).json({
            success: true,
            message: "successfully created the component",
            component,
          });
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message:
              "the component TYPE does not exist for this network, please first create it",
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "Required body and query parameters are missing in this request, please crosscheck documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to create the Component",
        error: e.message,
      });
    }
  },

  deleteComponent: async (req, res) => {
    try {
      logText("delete component...................");
      let { device, comp, tenant } = req.query;
      if ((comp && device, tenant)) {
        const component = await getModelByTenant(
          tenant.toLowerCase(),
          "component",
          ComponentSchema
        )
          .find({
            name: comp,
            deviceID: device,
          })
          .exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(component));

        if (isEmpty(component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `Component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }
        let ComponentFilter = { name: comp };
        if (!isEmpty(component)) {
          getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          ).findOneAndRemove(ComponentFilter, (err, removedComponent) => {
            if (err) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                err,
                success: false,
                message: "unable to delete Component",
              });
            } else {
              return res.status(HTTPStatus.OK).json({
                removedComponent,
                success: true,
                message: " Component successfully deleted",
              });
            }
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "please crosscheck your query parameters using the API documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        e,
        success: false,
        message: "unable to delete the Component",
      });
    }
  },

  updateComponent: async (req, res) => {
    try {
      logText("update component.................");
      let { device, comp, tenant } = req.query;
      if (comp && device && tenant) {
        const component = await getModelByTenant(
          tenant.toLowerCase(),
          "component",
          ComponentSchema
        )
          .find({
            name: comp,
            deviceID: device,
          })
          .exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(component));

        if (isEmpty(component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `Component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }

        let componentFilter = { name: comp };

        await getModelByTenant(
          tenant.toLowerCase(),
          "component",
          ComponentSchema
        ).findOneAndUpdate(
          componentFilter,
          req.body,
          {
            new: true,
          },
          (error, updatedComponent) => {
            if (error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: "unable to update Component",
                error,
                success: false,
              });
            } else if (updatedComponent) {
              return res.status(HTTPStatus.OK).json({
                message: "successfully updated the Component settings",
                updatedComponent,
                success: true,
              });
            } else {
              logObject("the updated Component", updatedComponent);
              return res.status(HTTPStatus.BAD_REQUEST).json({
                message: "unable to update the Component ",
                success: false,
              });
            }
          }
        );
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "please crosscheck your query parameters using the API documentation, some are missing",
        });
      }
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ error: e, messsage: "this is a bad request", success: false });
    }
  },

  createType: async (req, res) => {
    logText("................................");
    logText("adding component type....");

    try {
      logText("create types.......");
      let { name, tenant } = req.query;

      if (name && tenant) {
        const isComponentTypeExist = await doesComponentTypeExist(
          name,
          tenant.toLowerCase()
        );
        logElement("does component type exist", isComponentTypeExist);

        let componentTypeBody = {
          name: name,
        };

        const componentType = await getModelByTenant(
          tenant.toLowerCase(),
          "componentType",
          ComponentTypeSchema
        ).createComponentType(componentTypeBody);

        logElement("the component type element", componentType);
        logObject("the component type object", componentType);

        return res.status(HTTPStatus.CREATED).json({
          success: true,
          message: "successfully created the component type",
          componentType,
        });
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "request parameters missing, please check API documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to create the component type",
        error: e.message,
      });
    }
  },
  getTypes: async (req, res) => {
    try {
      logText("get types.......");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let { name, tenant } = req.query;
      logElement("the component type ", name);
      if (name && tenant) {
        const componentType = await getModelByTenant(
          tenant.toLowerCase(),
          "componentType",
          ComponentTypeSchema
        ).find({
          name: name,
        });

        return res.status(HTTPStatus.OK).json({
          success: true,
          message: `successfully listed the details of this platform's componentType `,
          componentType,
          doesExist: !isEmpty(componentType),
        });
      } else if (!name && tenant) {
        const componentTypes = await getModelByTenant(
          tenant.toLowerCase(),
          "componentType",
          ComponentTypeSchema
        ).list({
          limit,
          skip,
        });
        if (!isEmpty(componentTypes)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed all platform componentTypes",
            componentTypes,
          });
        } else if (isEmpty(componentTypes)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find all the platform componentTypes`,
          });
        }
      } else if (!tenant) {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: `missing the organisation, please crosscheck API documentation`,
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to list any component type",
        error: e.message,
      });
    }
  },
  calibrate: async (req, res) => {
    let { comp, device, tenant } = req.query;
    try {
      logText("calibrate.......");
      let ComponentFilter = { name: comp };
      await getModelByTenant(
        tenant.toLowerCase(),
        "component",
        ComponentSchema
      ).findOneAndUpdate(
        ComponentFilter,
        { ...req.body, deviceID: device },
        {
          new: true,
        },
        (error, updatedComponent) => {
          if (error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              message: "unable to calibrate",
              error,
              success: false,
            });
          } else if (updatedComponent) {
            return res.status(HTTPStatus.OK).json({
              message: "successfully calibrated the device",
              updatedComponent,
              success: true,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              message:
                "Component does not exist, please first create the Component you are trying to calibrate ",
              success: false,
            });
          }
        }
      );
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ error: e, messsage: "this is a bad request", success: false });
    }
  },
};

module.exports = Component;
