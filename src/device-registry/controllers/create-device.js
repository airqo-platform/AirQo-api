const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const client = new iot.v1.DeviceManagerClient();
const { logObject, logElement, logText } = require("../utils/log");
const createDeviceUtil = require("../utils/create-device");
const distance = require("../utils/distance");
const { validationResult } = require("express-validator");
const errors = require("../utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger("create-device-controller");

const device = {
  decryptKey: async (req, res) => {
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return errors.badRequest(
        res,
        "bad request errors",
        errors.convertErrorArrayToObject(nestedErrors)
      );
    }

    let { encrypted_key } = req.body;
    let responseFromDecryptKey = await createDeviceUtil.decryptKey(
      encrypted_key
    );
    logObject("responseFromDecryptKey", responseFromDecryptKey);
    if (responseFromDecryptKey.success === true) {
      let status = responseFromDecryptKey.status
        ? responseFromDecryptKey.status
        : HTTPStatus.OK;
      return res.status(status).json({
        success: true,
        message: responseFromDecryptKey.message,
        decrypted_key: responseFromDecryptKey.data,
      });
    }

    if (responseFromDecryptKey.success === false) {
      let error = responseFromDecryptKey.error
        ? responseFromDecryptKey.error
        : "";
      let status = responseFromDecryptKey.status
        ? responseFromDecryptKey.status
        : HTTPStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        success: false,
        message: responseFromDecryptKey.message,
        error,
      });
    }
  },
  getDevicesCount: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query, body } = req;
      const { tenant } = query;
      const request = {};
      request["query"] = {};
      request["query"]["tenant"] = tenant;
      await registerDeviceUtil.getDevicesCount(request, (result) => {
        if (result.success === true) {
          const status = result.status ? result.status : HTTPStatus.OK;
          return res.status(status).json({
            success: true,
            message: result.message,
            devices: result.data,
          });
        }
        if (result.success === false) {
          const status = result.status
            ? result.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : "";
          return res.status(status).json({
            success: false,
            message: result.message,
            errors,
          });
        }
      });
    } catch (error) {
      logObject("error", error);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let responseFromCreateDevice = await createDeviceUtil.create(req);
      logger.info(
        `responseFromCreateDevice -- ${JSON.stringify(
          responseFromCreateDevice
        )}`
      );
      if (responseFromCreateDevice.success === true) {
        let status = responseFromCreateDevice.status
          ? responseFromCreateDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateDevice.message,
          created_device: responseFromCreateDevice.data,
        });
      }

      if (responseFromCreateDevice.success === false) {
        let errors = responseFromCreateDevice.errors
          ? responseFromCreateDevice.errors
          : "";
        let status = responseFromCreateDevice.status
          ? responseFromCreateDevice.status
          : HTTPStatus.BAD_GATEWAY;

        return res.status(status).json({
          success: false,
          message: responseFromCreateDevice.message,
          errors,
        });
      }
    } catch (e) {
      logger.error(`server error in the create controller -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "server error in the create controller",
        errors: e.message,
      });
    }
  },
  generateQRCode: async (req, res) => {
    try {
      logger.info(`the generate QR Code operation starts here....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { body } = req;
      let { tenant, device_number, id, name, include_site } = req.query;
      let request = {};
      request["query"] = {};
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = device_number;
      request["query"]["include_site"] = include_site;
      request["query"]["id"] = id;
      request["query"]["name"] = name;
      request["body"] = body;

      let responseFromGenerateQRCode = await createDeviceUtil.generateQR(
        request
      );
      logger.info(
        `responseFromGenerateQRCode -- ${responseFromGenerateQRCode}`
      );
      if (responseFromGenerateQRCode.success === true) {
        let status = responseFromGenerateQRCode.status
          ? responseFromGenerateQRCode.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromGenerateQRCode.message,
          data: responseFromGenerateQRCode.data,
        });
      }
      if (responseFromGenerateQRCode.success === false) {
        let error = responseFromGenerateQRCode.error
          ? responseFromGenerateQRCode.error
          : "";
        let status = responseFromGenerateQRCode.status
          ? responseFromGenerateQRCode.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromGenerateQRCode.message,
          error,
        });
      }
    } catch (err) {
      logger.error(`server side error -- ${err.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "unable to generate the QR code --server side error",
        error: err.message,
      });
    }
  },
  delete: async (req, res) => {
    try {
      logger.info(`the general delete device operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { device, name, id, device_number, tenant } = req.query;

      let requestObject = {};
      requestObject["query"] = {
        device,
        name,
        id,
        device_number,
        tenant,
      };

      let responseFromRemoveDevice = await createDeviceUtil.delete(
        requestObject
      );

      logger.info(
        `responseFromRemoveDevice -- ${JSON.stringify(
          responseFromRemoveDevice
        )}`
      );

      if (responseFromRemoveDevice.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      }

      if (responseFromRemoveDevice.success === false) {
        let error = responseFromRemoveDevice.error
          ? responseFromRemoveDevice.error
          : "";
        let status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveDevice.message,
          error,
        });
      }
    } catch (e) {
      logger.error(`server error - delete device --- ${e.message}`);
      errors.logger_v2.errors.tryCatchErrors("server error", e.message);
    }
  },

  update: async (req, res) => {
    try {
      logger.info(`the device update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant, device_number, id, name, device } = req.query;
      const { body } = req;
      let requestBody = {};
      requestBody["query"] = {};
      requestBody["query"]["tenant"] = tenant;
      requestBody["query"]["device_number"] = device_number;
      requestBody["query"]["id"] = id;
      requestBody["query"]["name"] = name;
      requestBody["query"]["device"] = device;
      requestBody["body"] = body;

      let responseFromUpdateDevice = await createDeviceUtil.update(requestBody);
      logger.info(
        `responseFromUpdateDevice ${JSON.stringify(responseFromUpdateDevice)}`
      );
      if (responseFromUpdateDevice.success === true) {
        let status = responseFromUpdateDevice.status
          ? responseFromUpdateDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateDevice.message,
          success: true,
          updated_device: responseFromUpdateDevice.data,
        });
      }
      if (responseFromUpdateDevice.success === false) {
        let status = responseFromUpdateDevice.status
          ? responseFromUpdateDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromUpdateDevice.errors
          ? responseFromUpdateDevice.errors
          : "";
        return res.status(status).json({
          message: responseFromUpdateDevice.message,
          success: false,
          errors,
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: e.message,
      });
    }
  },

  encryptKeys: async (req, res) => {
    try {
      logText("the soft update operation starts....");
      logger.info(`the soft update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant, device, device_number, name, id } = req.query;
      const { body } = req;
      let requestObject = {};
      requestObject["query"] = {};
      requestObject["query"]["id"] = id;
      requestObject["query"]["device_number"] = device_number;
      requestObject["query"]["name"] = name;
      requestObject["query"]["device"] = device;
      requestObject["query"]["tenant"] = tenant;
      requestObject["body"] = body;

      logObject("we see", requestObject);
      let responseFromEncryptKeys = await createDeviceUtil.encryptKeys(
        requestObject
      );

      logger.info(
        `responseFromEncryptKeys ${JSON.stringify(responseFromEncryptKeys)}`
      );

      if (responseFromEncryptKeys.success === true) {
        let status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : HTTPStatus.OK;
        return res.status(status).json({
          message: responseFromEncryptKeys.message,
          success: true,
          updated_device: responseFromEncryptKeys.data,
        });
      }

      if (responseFromEncryptKeys.success === false) {
        let errors = responseFromEncryptKeys.errors
          ? responseFromEncryptKeys.errors
          : "";
        let status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromEncryptKeys.message,
          success: false,
          errors,
        });
      }
    } catch (e) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: e.message,
      });
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list devices based on query params...");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logObject(" nestedErrors", nestedErrors);
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let responseFromListDeviceDetails = await createDeviceUtil.list(req);
      logElement(
        "is responseFromListDeviceDetails in controller a success?",
        responseFromListDeviceDetails.success
      );

      if (responseFromListDeviceDetails.success === true) {
        let status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListDeviceDetails.message,
          devices: responseFromListDeviceDetails.data,
        });
      }

      if (responseFromListDeviceDetails.success === false) {
        let errors = responseFromListDeviceDetails.errors
          ? responseFromListDeviceDetails
          : "";
        let status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListDeviceDetails.message,
          errors,
        });
      }
    } catch (e) {
      logger.error(`listing devices  ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: e.message,
      });
    }
  },

  listAllByNearestCoordinates: async (req, res) => {
    try {
      const {
        tenant,
        latitude,
        longitude,
        radius,
        name,
        chid,
        device_number,
      } = req.query;
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

        let request = {};
        request["query"] = {};
        request["query"]["name"] = device;
        request["query"]["name"] = name;
        request["query"]["tenant"] = tenant;
        request["query"]["device_number"] = chid;
        request["query"]["device_number"] = device_number;

        const responseFromListDevice = await createDeviceUtil.list(request);

        let devices = [];

        if (responseFromListDevice.success === true) {
          devices = responseFromListDevice.data;
        } else if (responseFromListDevice.success === false) {
          logObject(
            "responseFromListDevice has an error",
            responseFromListDevice
          );
        }
        logObject("devices", devices);
        const nearest_devices = distance.findNearestDevices(
          devices,
          radius,
          latitude,
          longitude
        );

        return res.status(HTTPStatus.OK).json(nearest_devices);
      } catch (e) {
        logObject("error", e);
        return res.status(HTTPStatus.BAD_REQUEST).json(e);
      }
    } catch (e) {
      logObject("error", e);
      errors.tryCatchErrors(res, e);
    }
  },

  updateOnPlatform: async (req, res) => {
    try {
      logText("the soft update operation starts....");
      logger.info(`the soft update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant, device, device_number, name, id } = req.query;
      const { body } = req;
      let requestObject = {};
      requestObject["query"] = {};
      requestObject["query"]["id"] = id;
      requestObject["query"]["device_number"] = device_number;
      requestObject["query"]["name"] = name;
      requestObject["query"]["device"] = device;
      requestObject["query"]["tenant"] = tenant;
      requestObject["body"] = body;

      logObject("we see", requestObject);
      let responseFromUpdateDeviceOnPlatform = await createDeviceUtil.updateOnPlatform(
        requestObject
      );

      logger.info(
        `responseFromUpdateDeviceOnPlatform ${JSON.stringify(
          responseFromUpdateDeviceOnPlatform
        )}`
      );

      if (responseFromUpdateDeviceOnPlatform.success === true) {
        let status = responseFromUpdateDeviceOnPlatform.status
          ? responseFromUpdateDeviceOnPlatform.status
          : HTTPStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: true,
          updated_device: responseFromUpdateDeviceOnPlatform.data,
        });
      }

      if (responseFromUpdateDeviceOnPlatform.success === false) {
        let errors = responseFromUpdateDeviceOnPlatform.errors
          ? responseFromUpdateDeviceOnPlatform.errors
          : "";
        let status = responseFromUpdateDeviceOnPlatform.status
          ? responseFromUpdateDeviceOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: false,
          errors,
        });
      }
    } catch (e) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: e.message,
      });
    }
  },

  deleteOnPlatform: async (req, res) => {
    try {
      logger.info(`the soft delete operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { device, name, id, device_number, tenant } = req.query;

      let requestObject = {};
      requestObject["query"] = {
        device,
        name,
        id,
        device_number,
        tenant,
      };

      let responseFromRemoveDevice = await createDeviceUtil.deleteOnPlatform(
        requestObject
      );

      logger.info(
        `responseFromRemoveDevice -- ${JSON.stringify(
          responseFromRemoveDevice
        )}`
      );

      if (responseFromRemoveDevice.success === true) {
        let status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      }

      if (responseFromRemoveDevice.success === false) {
        let error = responseFromRemoveDevice.error
          ? responseFromRemoveDevice.error
          : "";

        let status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromRemoveDevice.message,
          error,
        });
      }
    } catch (e) {
      logger.error(`server error --- ${e.message}`);
      errors.logger_v2.errors.tryCatchErrors("server error", e.message);
    }
  },

  createOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      const { body } = req;

      let requestBody = {};
      requestBody["query"] = {};
      requestBody["query"]["tenant"] = tenant;
      requestBody["body"] = body;

      let responseFromCreateOnPlatform = await createDeviceUtil.createOnPlatform(
        requestBody
      );
      logger.info(
        `responseFromCreateOnPlatform -- ${JSON.stringify(
          responseFromCreateOnPlatform
        )}`
      );
      if (responseFromCreateOnPlatform.success === true) {
        let status = responseFromCreateOnPlatform.status
          ? responseFromCreateOnPlatform.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateOnPlatform.message,
          created_device: responseFromCreateOnPlatform.data,
        });
      }

      if (responseFromCreateOnPlatform.success === false) {
        let errors = responseFromCreateOnPlatform.errors
          ? responseFromCreateOnPlatform.errors
          : "";
        let status = responseFromCreateOnPlatform.status
          ? responseFromCreateOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateOnPlatform.message,
          errors,
        });
      }
    } catch (e) {
      logger.error(`server error in the create one controller -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "server error in the createOnPlatform controller",
        errors: e.message,
      });
    }
  },

  listOnGCP: (req, res) => {
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
  createOnGCP: (req, res) => {
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
  listOneOnGCP: (req, res) => {
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

  deleteOnGCP: (req, res) => {
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

  updateOnGCP: (req, res) => {
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
