const DeviceSchema = require("../models/Device");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const isEmpty = require("is-empty");
const client = new iot.v1.DeviceManagerClient();
// const privateKeyFile = `./rsa_private.pem`;
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const { getModelByTenant } = require("../utils/multitenancy");
const softUpdateDevice = require("../utils/soft-update-device");
const {
  createOnThingSpeak,
  createOnClarity,
} = require("../utils/create-device");

const {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
} = require("../utils/does-device-exist");

const updateDeviceUtil = require("../utils/update-device");

const nearestDevices = require("../utils/nearest-device");
const generateFilter = require("../utils/generate-filter");

const { validationResult } = require("express-validator");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
  missingOrInvalidValues,
  badRequest,
} = require("../utils/errors");

const { deleteFromCloudinary } = require("../utils/delete-cloudinary-image");
const deleteDevice = require("../utils/delete-device");
const getDetail = require("../utils/get-device-details");
const getLastPath = require("../utils/get-last-path");

const device = {
  createThing: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        const baseUrl = constants.CREATE_THING_URL;
        let { name } = req.body;
        let { tsBody, deviceBody } = updateThingBodies(req, res);
        let prepBodyTS = {
          ...tsBody,
          ...constants.DEVICE_CREATION,
        };
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          logText("adding device on TS...");
          let channel;
          if (tenant.toLowerCase() === "airqo") {
            await createOnThingSpeak(
              req,
              res,
              baseUrl,
              prepBodyTS,
              channel,
              name,
              deviceBody,
              tenant.toLowerCase()
            );
          } else {
            createOnClarity(tenant.toLowerCase(), req, res);
          }
        } else {
          res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `device "${name}" already exists!`,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "request is missing the required query params, please crosscheck",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
  deleteThing: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      return res.status(HTTPStatus.TEMPORARY_REDIRECT).json({
        message: "endpoint temporarily disabled",
        success: false,
        device,
      });
      // if (tenant) {
      //   if (!device) {
      //     res.status(HTTPStatus.BAD_REQUEST).json({
      //       message:
      //         "please use the correct query parameter, check API documentation",
      //       success: false,
      //     });
      //   }
      //  const deviceDetails = await getDetail(tenant, device);
      //  const doesDeviceExist = !isEmpty(deviceDetails);
      //  logElement("isDevicePresent ?", doesDeviceExist);
      //   if (doesDeviceExist) {
      //     const channelID = await getChannelID(
      //       req,
      //       res,
      //       device,
      //       tenant.toLowerCase()
      //     );
      //     logText("deleting device from TS.......");
      //     logElement("the channel ID", channelID);
      //     await axios
      //       .delete(constants.DELETE_THING_URL(channelID))
      //       .then(async (response) => {
      //         deleteDevice(tenant, res, device);
      //       })
      //       .catch(function(error) {
      //         logElement("unable to delete device from TS", error);
      //         logElement("this is the error response", error.response.status);

      //         if (error.response.status == 404) {
      //           deleteDevice(tenant, res, device);
      //         } else {
      //           tryCatchErrors(res, error);
      //         }
      //       });
      //   } else {
      //     logText("device does not exist in the network");
      //     res.status(HTTPStatus.BAD_REQUEST).json({
      //       message: "device does not exist in the network",
      //       success: false,
      //       device,
      //     });
      //   }
      // } else {
      //   return res.status(HTTPStatus.BAD_REQUEST).json({
      //     success: false,
      //     message: "missing query params, please check documentation",
      //   });
      // }
    } catch (e) {
      logElement(
        "unable to carry out the entire deletion of device",
        e.message
      );
      logObject("unable to carry out the entire deletion of device", e.message);
      tryCatchErrors(res, e);
    }
  },

  clearThing: async (req, res) => {
    try {
      const { device, tenant } = req.query;

      if (tenant) {
        if (!device) {
          res.status(HTTPStatus.BAD_REQUEST).json({
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          });
        }
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          const channelID = await getChannelID(
            req,
            res,
            device,
            tenant.toLowerCase()
          );
          logText("...................................");
          logText("clearing the Thing....");
          logElement("url", constants.CLEAR_THING_URL(channelID));
          await axios
            .delete(constants.CLEAR_THING_URL(channelID))
            .then(async (response) => {
              logText("successfully cleared the device in TS");
              logObject("response from TS", response.data);
              res.status(HTTPStatus.OK).json({
                message: `successfully cleared the data for device ${device}`,
                success: true,
                updatedDevice,
              });
            })
            .catch(function(error) {
              console.log(error);
              res.status(HTTPStatus.BAD_GATEWAY).json({
                message: `unable to clear the device data, device ${device} does not exist`,
                success: false,
              });
            });
        } else {
          logText(`device ${device} does not exist in the system`);
          res.status(HTTPStatus.OK).json({
            message: `device ${device} does not exist in the system`,
            success: false,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      logText(`unable to clear device ${device}`);
      tryCatchErrors(res, e);
    }
  },

  updateThingSettings: async (req, res) => {
    try {
      let { device, tenant } = req.query;

      if (tenant && device) {
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);

        logElement("isDevicePresent?", doesDeviceExist);

        if (doesDeviceExist) {
          const channelID = await getChannelID(
            req,
            res,
            device,
            tenant.toLowerCase()
          );
          logText(".............................................");
          logText("updating the thing.......");
          const deviceFilter = { name: device };
          let { tsBody, deviceBody, options } = updateThingBodies(req, res);
          logObject("TS body", tsBody);
          logObject("device body", deviceBody);
          logElement("the channel ID", channelID);
          await updateDeviceUtil(
            req,
            res,
            channelID,
            device,
            deviceBody,
            tsBody,
            deviceFilter,
            tenant,
            options
          );
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

  listAll: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all devices original...");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant } = req.query;
      if (!tenant) {
        missingQueryParams(req, res);
      }

      let filter = generateFilter.devices(req);
      logObject("filter", filter);
      let responseFromListDevice = await getModelByTenant(
        tenant.toLowerCase(),
        "device",
        DeviceSchema
      ).list({ skip, limit, filter });

      if (responseFromListDevice.success == false) {
        if (responseFromListDevice.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromListDevice.message,
            error: responseFromListDevice.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromListDevice.message,
          });
        }
      }

      return res.status(HTTPStatus.OK).json({
        success: true,
        message: "Devices fetched successfully",
        devices: responseFromListDevice,
      });
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  listAllByLocation: async (req, res) => {
    try {
      const { tenant, loc } = req.query;
      logElement("location ", loc);
      try {
        logText("list all devices by location...");
        if (tenant) {
          const devices = await getModelByTenant(
            tenant.toLowerCase(),
            "device",
            DeviceSchema
          )
            .find({ locationID: loc })
            .exec();
          return res.status(HTTPStatus.OK).json(devices);
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: "missing query params, please check documentation",
          });
        }
      } catch (e) {
        return res.status(HTTPStatus.BAD_REQUEST).json(e);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  listAllByNearestCoordinates: async (req, res) => {
    try {
      const { tenant, latitude, longitude, radius } = req.query;
      logText("list all devices by coordinates...");
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

  updateDevice: async (req, res) => {
    try {
      const { tenant, device } = req.query;
      const deviceBody = req.body;
      const deviceFilter = {
        name: device,
      };
      let options = {
        new: true,
        upsert: true,
      };
      if (tenant && device) {
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          await softUpdateDevice(
            res,
            device,
            deviceBody,
            deviceFilter,
            tenant,
            options
          );
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

  delete: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      if (tenant && device) {
        if (!device) {
          res.status(HTTPStatus.BAD_REQUEST).json({
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          });
        }
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          deleteDevice(tenant, res, device);
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

  deletePhotos: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      const { photos } = req.body;
      if (tenant && device && photos) {
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          let { tsBody, deviceBody, options } = updateThingBodies(req, res);
          const channelID = await getChannelID(
            req,
            res,
            device,
            tenant.toLowerCase()
          );
          const deviceFilter = { name: device };
          let photoNameWithoutExtension = [];
          photos.forEach((photo) => {
            if (photo) {
              photoNameWithoutExtension.push(getLastPath(photo));
            }
          });
          let deleteFromCloudinaryPromise = deleteFromCloudinary(
            photoNameWithoutExtension
          );
          let updateDevicePromise = updateDeviceUtil(
            req,
            res,
            channelID,
            device,
            deviceBody,
            tsBody,
            deviceFilter,
            tenant,
            options
          );

          Promise.all([deleteFromCloudinaryPromise, updateDevicePromise]).then(
            (values) => {
              logElement("the values", values);
            }
          );
        } else {
          logText("device does not exist in the network");
          res.status(HTTPStatus.BAD_REQUEST).json({
            message: "device does not exist in the network",
            success: false,
            device,
          });
        }
      } else {
        missingQueryParams(req, res);
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

  listOne: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        const device = await getModelByTenant(
          tenant.toLowerCase(),
          "device",
          DeviceSchema
        ).findById(req.params.id);
        return res.status(HTTPStatus.OK).json(device);
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  createOneGcp: (req, res) => {
    const formattedParent = client.registryPath(
      "airqo-250220",
      "europe-west1",
      "device-registry"
    );
    const device = {
      id: req.body.id,
      metadata: req.body.metadata,
    };
    const request = {
      parent: formattedParent,
      device: device,
    };
    client
      .createDevice(request)
      .then((responses) => {
        const response = responses[0];
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },

  listAllGcp: (req, res) => {
    const formattedParent = client.registryPath(
      "airqo-250220",
      "europe-west1",
      "device-registry"
    );
    const options = { autoPaginate: false };
    const callback = (responses) => {
      const resources = responses[0];
      const nextRequest = responses[1];
      for (let i = 0; i < resources.length; i += 1) {}
      if (nextRequest) {
        return client.listDeviceModels(nextRequest, options).then(callback);
      }
      let response = responses[0];
      return res.status(HTTPStatus.OK).json(response);
    };
    client
      .listDeviceModels({ parent: formattedParent }, options)
      .then(callback)
      .catch((err) => {
        console.error(err);
      });
  },

  createOne: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      const { tenant } = req.query;
      if (tenant) {
        console.log("creating one device....");
        const device = await getModelByTenant(
          tenant.toLowerCase(),
          "device",
          DeviceSchema
        ).createDevice(req.body);
        return res.status(HTTPStatus.CREATED).json(device);
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  listOneGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );
    client
      .getDevice({ name: formattedName })
      .then((responses) => {
        var response = responses[0];
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
      });
  },

  deleteGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );
    client
      .deleteDevice({ name: formattedName })
      .then((responses) => {
        let result = {
          status: "OK",
          message: `device ${device} has successfully been deleted`,
        };
        return res.status(HTTPStatus.OK).json(result);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },

  updateDeviceGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );

    var deviceUpdate = {
      name: req.params.name,
      blocked: req.body.blocked,
      metadata: req.body.metadata,
    };
    var updateMask = {
      blocked: device.blocked,
      metadata: device.metadata,
    };
    var request = {
      device: deviceUpdate,
      updateMask: updateMask,
    };
    client
      .updateDevice(request)
      .then((responses) => {
        var response = responses[0];
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },
};

module.exports = device;
