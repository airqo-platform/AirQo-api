const DeviceSchema = require("../models/Device");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const isEmpty = require("is-empty");
const client = new iot.v1.DeviceManagerClient();
// const privateKeyFile = `./rsa_private.pem`;
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const {
  createOnThingSpeak,
  createOnClarity,
  registerDeviceUtil,
} = require("../utils/create-device");

const {
  updateThingBodies,
  getChannelID,
} = require("../utils/does-device-exist");
const updateDeviceUtil = require("../utils/update-device");
const nearestDevices = require("../utils/nearest-device");
const { validationResult } = require("express-validator");
const {
  tryCatchErrors,
  missingQueryParams,
  badRequest,
  logger_v2,
  errorCodes,
} = require("../utils/errors");
const getDetail = require("../utils/get-device-details");
const log4js = require("log4js");
const logger = log4js.getLogger("create-device-controller");

const device = {
  decryptKey: async (req, res) => {
    let { encrypted_key } = req.body;
    let responseFromDecryptKey = await registerDeviceUtil.decryptKey(
      encrypted_key
    );
    if (responseFromDecryptKey.success) {
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: responseFromDecryptKey.message,
        decrypted_key: responseFromDecryptKey.data,
      });
    } else {
      let error = responseFromDecryptKey.error
        ? responseFromDecryptKey.error
        : "";
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: responseFromDecryptKey.message,
        error,
      });
    }
  },
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }

      let responseFromCreateDevice = await registerDeviceUtil.create(req);
      logger.info(
        `responseFromCreateDevice -- ${JSON.stringify(
          responseFromCreateDevice
        )}`
      );
      if (responseFromCreateDevice.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromCreateDevice.message,
          created_device: responseFromCreateDevice.data,
        });
      }

      if (responseFromCreateDevice.success == false) {
        let error = responseFromCreateDevice.error
          ? responseFromCreateDevice.error
          : "";

        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromCreateDevice.message,
          error,
        });
      }
    } catch (e) {
      logger.error(`server error in the create controller -- ${e.message}`);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        message: "server error in the create controller",
        error: e.message,
      });
    }
  },
  generateQRCode: async (req, res) => {
    try {
      logger.info(`the generate QR Code operation starts here....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
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

      let responseFromGenerateQRCode = await registerDeviceUtil.generateQR(
        request
      );
      logger.info(
        `responseFromGenerateQRCode -- ${responseFromGenerateQRCode}`
      );
      if (responseFromGenerateQRCode.success) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromGenerateQRCode.message,
          data: responseFromGenerateQRCode.data,
        });
      }
      if (!responseFromGenerateQRCode.success) {
        let error = responseFromGenerateQRCode.error
          ? responseFromGenerateQRCode.error
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromGenerateQRCode.message,
          error,
        });
      }
    } catch (err) {
      logger.error(`server side error -- ${err.message}`);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
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
        return badRequest(res, "bad request errors", nestedErrors);
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

      let responseFromRemoveDevice = await registerDeviceUtil.delete(
        requestObject
      );

      logger.info(
        `responseFromRemoveDevice -- ${JSON.stringify(
          responseFromRemoveDevice
        )}`
      );

      if (responseFromRemoveDevice.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      }

      if (responseFromRemoveDevice.success == false) {
        let error = responseFromRemoveDevice.error
          ? responseFromRemoveDevice.error
          : "";
        let status = HTTPStatus.BAD_REQUEST;
        if (!isEmpty(responseFromRemoveDevice.status)) {
          status = errorCodes.serverErrors.includes(
            responseFromRemoveDevice.status
          )
            ? HTTPStatus.BAD_GATEWAY
            : HTTPStatus.NOT_FOUND;
        }

        return res.status(status).json({
          success: false,
          message: responseFromRemoveDevice.message,
          error,
        });
      }
    } catch (e) {
      logger.error(`server error - delete device --- ${e.message}`);
      logger_v2.tryCatchErrors("server error", e.message);
    }
  },

  update: async (req, res) => {
    try {
      logger.info(`the device update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
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

      let responseFromUpdateDevice = await registerDeviceUtil.update(
        requestBody
      );
      logger.info(
        `responseFromUpdateDevice ${JSON.stringify(responseFromUpdateDevice)}`
      );
      if (responseFromUpdateDevice.success) {
        return res.status(HTTPStatus.OK).json({
          message: responseFromUpdateDevice.message,
          success: true,
          updated_device: responseFromUpdateDevice.data,
        });
      }
      if (!responseFromUpdateDevice.success) {
        let error = responseFromUpdateDevice.error
          ? responseFromUpdateDevice.error
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          message: responseFromUpdateDevice.message,
          success: false,
          error,
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list devices based on query params...");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      let responseFromListDeviceDetails = await registerDeviceUtil.list(req);
      logElement(
        "is responseFromListDeviceDetails in controller a success?",
        responseFromListDeviceDetails.success
      );

      if (responseFromListDeviceDetails.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromListDeviceDetails.message,
          devices: responseFromListDeviceDetails.data,
        });
      }

      if (responseFromListDeviceDetails.success == false) {
        let error = responseFromListDeviceDetails.error
          ? responseFromListDeviceDetails
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromListDeviceDetails.message,
          error: responseFromListDeviceDetails.error,
        });
      }
    } catch (e) {
      tryCatchErrors(res, e, "create device controller");
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

  updateOnPlatform: async (req, res) => {
    try {
      logText("the soft update operation starts....");
      logger.info(`the soft update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      const { tenant, device, device_number, name, id } = req.query;
      const { body } = req;
      let requestObject = {};
      requestObject["query"] = {
        id,
        device_number,
        name,
        device,
        tenant,
        body,
      };
      logObject("we see", requestObject);
      let responseFromUpdateDeviceOnPlatform = await registerDeviceUtil.updateOnPlatform(
        requestObject
      );

      logger.info(
        `responseFromUpdateDeviceOnPlatform ${JSON.stringify(
          responseFromUpdateDeviceOnPlatform
        )}`
      );

      if (responseFromUpdateDeviceOnPlatform.success == true) {
        return res.status(HTTPStatus.OK).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: true,
          updated_device: responseFromUpdateDeviceOnPlatform.data,
        });
      }

      if (responseFromUpdateDeviceOnPlatform.success == false) {
        let error = responseFromUpdateDeviceOnPlatform.error
          ? responseFromUpdateDeviceOnPlatform.error
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: false,
          error,
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  deleteOnPlatform: async (req, res) => {
    try {
      logger.info(`the soft delete operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
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

      let responseFromRemoveDevice = await registerDeviceUtil.deleteOnPlatform(
        requestObject
      );

      logger.info(
        `responseFromRemoveDevice -- ${JSON.stringify(
          responseFromRemoveDevice
        )}`
      );

      if (responseFromRemoveDevice.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      }

      if (responseFromRemoveDevice.success == false) {
        let error = responseFromRemoveDevice.error
          ? responseFromRemoveDevice.error
          : "";

        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromRemoveDevice.message,
          error,
        });
      }
    } catch (e) {
      logger.error(`server error --- ${e.message}`);
      logger_v2.tryCatchErrors("server error", e.message);
    }
  },

  createOnPlatform: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      const { tenant } = req.query;
      const { body } = req;

      let requestBody = {};
      requestBody["query"] = {};
      requestBody["query"]["tenant"] = tenant;
      requestBody["body"] = body;

      let responseFromCreateOnPlatform = await registerDeviceUtil.createOnPlatform(
        requestBody
      );
      logger.info(
        `responseFromCreateOnPlatform -- ${JSON.stringify(
          responseFromCreateOnPlatform
        )}`
      );
      if (responseFromCreateOnPlatform.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromCreateOnPlatform.message,
          created_device: responseFromCreateOnPlatform.data,
        });
      }

      if (responseFromCreateOnPlatform.success == false) {
        let error = responseFromCreateOnPlatform.error
          ? responseFromCreateOnPlatform.error
          : "";

        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromCreateOnPlatform.message,
          error,
        });
      }
    } catch (e) {
      logger.error(`server error in the create one controller -- ${e.message}`);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        message: "server error in the createOnPlatform controller",
        error: e.message,
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
