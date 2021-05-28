const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const { createDeviceRequestBodies } = require("../utils/create-request-body");
const nearestDevices = require("../utils/nearest-device");
const {
  tryCatchErrors,
  missingQueryParams,
  itemAlreadyExists,
} = require("../utils/errors");
const { deleteOnPlatform, deleteDevice } = require("../utils/delete-device");
const {
  createDevice,
  createDeviceOnPlatform,
} = require("../utils/create-device");
const {
  updateDevice,
  updateDeviceOnPlatform,
} = require("../utils/update-device");

const { getDeviceDetailsOnPlatform } = require("../utils/get-device-details");

const device = {
  create: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        const tsURL = constants.CREATE_THING_URL;
        const clarityURL = "";
        let { name } = req.body;
        let { tsBody, deviceBody, clarityBody } = createDeviceRequestBodies(
          req,
          res
        );
        let enrichedTSBody = {
          ...tsBody,
          ...constants.DEVICE_CREATION,
        };
        const deviceDetails = await getDeviceDetailsOnPlatform(tenant, name);
        logObject("deviceDetails", deviceDetails);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent?", doesDeviceExist);
        if (doesDeviceExist) {
          let responseFromCreatingDevice = await createDevice(
            tenant,
            tsURL,
            enrichedTSBody,
            clarityURL,
            clarityBody,
            deviceBody
          );

          if (responseFromCreatingDevice.success == true) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              message: responseFromCreatingDevice.message,
              success: true,
            });
          } else if (responseFromCreatingDevice.success == false) {
            if (responseFromCreatingDevice.error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromCreatingDevice.message,
                success: false,
                error: responseFromCreatingDevice.error,
              });
            } else {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromCreatingDevice.message,
                success: false,
              });
            }
          }
        } else {
          itemAlreadyExists(device, res);
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
  delete: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      /**
       * ************************************************
       * Just comment out this temporary redirect in order to enable this logic
       * for device deletion
       */
      return res.status(HTTPStatus.TEMPORARY_REDIRECT).json({
        message: "endpoint temporarily disabled",
        success: false,
        device,
      });
      /**
       * *************************************************
       */
      if (tenant) {
        if (!device) {
          res.status(HTTPStatus.BAD_REQUEST).json({
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          });
        }
        const deviceDetails = await getDeviceDetailsOnPlatform(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          const channelID = deviceDetails[0].channelID;
          logElement("the channel ID", channelID);
          logText("deleting device from TS.......");
          logElement("the channel ID", channelID);
          await axios
            .delete(constants.DELETE_THING_URL(channelID))
            .then(async (response) => {
              deleteDevice(tenant, res, device);
            })
            .catch(function(error) {
              logElement("unable to delete device from TS", error);
              logElement("this is the error response", error.response.status);

              if (error.response.status == 404) {
                deleteDevice(tenant, res, device);
              } else {
                tryCatchErrors(res, error);
              }
            });
        } else {
          logText("device does not exist in the network");
          res.status(HTTPStatus.BAD_REQUEST).json({
            message: "device does not exist in the network",
            success: false,
            device,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      logElement(
        "unable to carry out the entire deletion of device",
        e.message
      );
      logObject("unable to carry out the entire deletion of device", e.message);
      tryCatchErrors(res, e);
    }
  },

  update: async (req, res) => {
    try {
      let { device, tenant } = req.query;
      if (tenant && device) {
        const deviceDetails = await getDeviceDetailsOnPlatform(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent?", doesDeviceExist);
        if (doesDeviceExist) {
          const channelID = deviceDetails[0].channelID;
          logElement("the channel ID", channelID);
          logText(".............................................");
          logText("updating the thing.......");
          const deviceFilter = { _id: device };
          let { tsBody, deviceBody, options } = createDeviceRequestBodies(
            req,
            res
          );
          delete deviceBody.channelID;
          delete deviceBody.deviceCode;
          delete deviceBody._id;

          logObject("TS body", tsBody);
          logObject("device body", deviceBody);
          logElement("the channel ID", channelID);

          let responseFromUpdateDevice = await updateDevice(
            channelID,
            deviceBody,
            tsBody,
            deviceFilter,
            tenant,
            options
          );

          logObject(
            "response from updating a device",
            responseFromUpdateDevice
          );

          if (responseFromUpdateDevice.success === true) {
            return res.status(HTTPStatus.OK).json({
              message: responseFromUpdateDevice.message,
              updatedDevice: responseFromUpdateDevice.updatedDevice,
              success: true,
            });
          } else if (responseFromUpdateDevice.success === false) {
            if (responseFromUpdateDevice.error) {
              logElement("the error", responseFromUpdateDevice.error);
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromUpdateDevice.message,
                success: false,
                error: responseFromUpdateDevice.error,
              });
            } else {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: responseFromUpdateDevice.message,
                success: false,
              });
            }
          }
        } else {
          logText(`device ${device} does not exist in DB`);
          res.status(HTTPStatus.BAD_REQUEST).json({
            message: `device ${device} does not exist`,
            success: false,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      logElement("unable to perform update operation", e);
      tryCatchErrors(res, e);
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all devices by tenant...");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant, name, chid, loc, site, map, primary, active } = req.query;
      if (tenant) {
        const devices = await getDeviceDetailsOnPlatform(
          tenant,
          id,
          chid,
          loc,
          site,
          map,
          primary,
          active,
          limit,
          skip
        );
        if (devices.length) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Devices fetched successfully",
            devices,
          });
        } else {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Device(s) not available",
            devices,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  listAllByNearestCoordinates: async (req, res) => {
    try {
      const { tenant, latitude, longitude, radius } = req.query;

      try {
        if (!(tenant && latitude && longitude && radius)) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: "missing query params, please check documentation",
          });
        }

        logElement("latitude ", latitude);
        logElement("longitude ", longitude);

        const devices = await getDetail(tenant);

        const nearest_devices = nearestDevices.findNearestDevices(
          devices,
          radius,
          latitude,
          longitude
        );

        return res.status(HTTPStatus.OK).json(nearest_devices);
      } catch (e) {
        return res.status(HTTPStatus.BAD_REQUEST).json(e);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
  updateOnPlatformOnly: async (req, res) => {
    try {
      const { tenant, device } = req.query;
      const deviceBody = req.body;
      const deviceFilter = {
        _id: device,
      };
      let options = {
        new: true,
        upsert: true,
      };
      if (tenant && device) {
        const deviceDetails = await getDeviceDetailsOnPlatform(tenant, device);
        logObject("device details", deviceDetails);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          let responseFromPlatform = await updateDeviceOnPlatform(
            deviceBody,
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
          logText(`device ${device} does not exist in the system`);
          res.status(HTTPStatus.BAD_REQUEST).json({
            message: `device ${device} does not exist in the system`,
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

  deleteOnPlatformOnly: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      if (tenant && device) {
        if (!device) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          });
        }
        const deviceDetails = await getDeviceDetailsOnPlatform(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          let responseFromDeleteOnPlatform = await deleteOnPlatform(
            tenant,
            device
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
          logText(`device ${device} does not exist in the system`);
          res.status(HTTPStatus.BAD_REQUEST).json({
            message: `device ${device} does not exist in the system`,
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

  createOnPlatformOnly: async (req, res) => {
    try {
      const { tenant } = req.query;
      let deviceBody = req.body;
      if (tenant) {
        let responseFromCreateOnPlatform = await createDeviceOnPlatform(
          tenant,
          deviceBody
        );
        if (responseFromCreateOnPlatform.success === true) {
          return res.status(HTTPStatus.CREATED).json({
            success: false,
            message: responseFromCreateOnPlatform.message,
            createdDevice: responseFromCreateOnPlatform.createdDevice,
          });
        } else if (responseFromCreateOnPlatform === false) {
          if (responseFromCreateOnPlatform.error) {
            return res.status(HTTPStatus.CREATED).json({
              success: false,
              message: responseFromCreateOnPlatform.message,
              error: responseFromCreateOnPlatform.error,
            });
          } else {
            return res.status(HTTPStatus.CREATED).json({
              success: false,
              message: responseFromCreateOnPlatform.message,
            });
          }
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
};

module.exports = device;
