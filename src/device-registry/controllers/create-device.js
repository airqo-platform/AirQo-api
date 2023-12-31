const httpStatus = require("http-status");
const iot = require("@google-cloud/iot");
const client = new iot.v1.DeviceManagerClient();
const { logObject, logElement, logText } = require("@utils/log");
const createDeviceUtil = require("@utils/create-device");
const distance = require("@utils/distance");
const constants = require("@config/constants");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-device-controller`
);

const isEmpty = require("is-empty");

const device = {
  bulkCreate: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  bulkUpdate: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  decryptManyKeys: (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      let arrayOfEncryptedKeys = req.body;
      let responseFromDecryptManyKeys = createDeviceUtil.decryptManyKeys(
        arrayOfEncryptedKeys
      );

      if (responseFromDecryptManyKeys.success === true) {
        const status = responseFromDecryptManyKeys.status
          ? responseFromDecryptManyKeys.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDecryptManyKeys.message,
          decrypted_keys: responseFromDecryptManyKeys.data,
        });
      } else if (responseFromDecryptManyKeys.success === false) {
        const status = responseFromDecryptManyKeys.status
          ? responseFromDecryptManyKeys.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDecryptManyKeys.message,
          errors: responseFromDecryptManyKeys.errors
            ? responseFromDecryptManyKeys.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  decryptKey: (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      let { encrypted_key } = req.body;
      let responseFromDecryptKey = createDeviceUtil.decryptKey(encrypted_key);

      if (responseFromDecryptKey.success === true) {
        const status = responseFromDecryptKey.status
          ? responseFromDecryptKey.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDecryptKey.message,
          decrypted_key: responseFromDecryptKey.data,
        });
      } else if (responseFromDecryptKey.success === false) {
        const status = responseFromDecryptKey.status
          ? responseFromDecryptKey.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDecryptKey.message,
          errors: responseFromDecryptKey.errors
            ? responseFromDecryptKey.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getDevicesCount: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createDeviceUtil.getDevicesCount(request);

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          devices: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateDevice = await createDeviceUtil.create(request);

      if (responseFromCreateDevice.success === true) {
        const status = responseFromCreateDevice.status
          ? responseFromCreateDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateDevice.message,
          created_device: responseFromCreateDevice.data,
        });
      } else if (responseFromCreateDevice.success === false) {
        const status = responseFromCreateDevice.status
          ? responseFromCreateDevice.status
          : httpStatus.BAD_GATEWAY;

        return res.status(status).json({
          success: false,
          message: responseFromCreateDevice.message,
          errors: responseFromCreateDevice.errors
            ? responseFromCreateDevice.errors
            : "",
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateQRCode: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const response = await createDeviceUtil.generateQR(request);

      if (response.success === true) {
        const status = response.status ? response.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: response.message,
          data: response.data,
        });
      } else if (response.success === false) {
        const status = response.status
          ? response.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: response.message,
          errors: response.errors ? response.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (req, res, next) => {
    try {
      // logger.info(`the general delete device operation starts....`);
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveDevice = await createDeviceUtil.delete(request);

      if (responseFromRemoveDevice.success === true) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      } else if (responseFromRemoveDevice.success === false) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveDevice.message,
          errors: responseFromRemoveDevice.error
            ? responseFromRemoveDevice.error
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (req, res, next) => {
    try {
      // logger.info(`the device update operation starts....`);
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateDevice = await createDeviceUtil.update(request);

      if (responseFromUpdateDevice.success === true) {
        const status = responseFromUpdateDevice.status
          ? responseFromUpdateDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateDevice.message,
          success: true,
          updated_device: responseFromUpdateDevice.data,
        });
      } else if (responseFromUpdateDevice.success === false) {
        const status = responseFromUpdateDevice.status
          ? responseFromUpdateDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateDevice.message,
          success: false,
          errors: responseFromUpdateDevice.errors
            ? responseFromUpdateDevice.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  refresh: async (req, res, next) => {
    try {
      logText("refreshing device details................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      let responseFromRefreshDevice = await createDeviceUtil.refresh(request);
      logObject("responseFromRefreshDevice", responseFromRefreshDevice);
      if (responseFromRefreshDevice.success === true) {
        const status = responseFromRefreshDevice.status
          ? responseFromRefreshDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRefreshDevice.message,
          refreshed_device: responseFromRefreshDevice.data,
        });
      } else if (responseFromRefreshDevice.success === false) {
        const status = responseFromRefreshDevice.status
          ? responseFromRefreshDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRefreshDevice.message,
          errors: responseFromRefreshDevice.errors
            ? responseFromRefreshDevice.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  encryptKeys: async (req, res, next) => {
    try {
      logText("the soft update operation starts....");
      // logger.info(`the soft update operation starts....`);
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromEncryptKeys = await createDeviceUtil.encryptKeys(
        request
      );

      if (responseFromEncryptKeys.success === true) {
        const status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromEncryptKeys.message,
          success: true,
          updated_device: responseFromEncryptKeys.data,
        });
      } else if (responseFromEncryptKeys.success === false) {
        const status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromEncryptKeys.message,
          success: false,
          errors: responseFromEncryptKeys.errors
            ? responseFromEncryptKeys.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list devices based on query params...");
      // logger.info("we are listing devices...", "yeah");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListDeviceDetails = await createDeviceUtil.list(
        request
      );
      logElement(
        "is responseFromListDeviceDetails in controller a success?",
        responseFromListDeviceDetails.success
      );

      if (responseFromListDeviceDetails.success === true) {
        const status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListDeviceDetails.message,
          devices: responseFromListDeviceDetails.data,
        });
      } else if (responseFromListDeviceDetails.success === false) {
        const status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListDeviceDetails.message,
          errors: responseFromListDeviceDetails.errors
            ? responseFromListDeviceDetails.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list Summary of devices based on query params...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.category = "summary";
      const responseFromListDeviceDetails = await createDeviceUtil.list(
        request
      );

      if (responseFromListDeviceDetails.success === true) {
        const status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListDeviceDetails.message,
          devices: responseFromListDeviceDetails.data,
        });
      } else if (responseFromListDeviceDetails.success === false) {
        const status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListDeviceDetails.message,
          errors: responseFromListDeviceDetails.errors
            ? responseFromListDeviceDetails.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAllByNearestCoordinates: async (req, res, next) => {
    try {
      const { tenant, latitude, longitude, radius, chid } = req.query;
      logText("list all devices by coordinates...");
      if (!(tenant && latitude && longitude && radius)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }

      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.name = device;
      request.query.device_number = chid;

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
        { devices, radius, latitude, longitude },
        next
      );

      return res.status(httpStatus.OK).json(nearest_devices);
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateOnPlatform: async (req, res, next) => {
    try {
      logText("the soft update operation starts....");
      // logger.info(`the soft update operation starts....`);
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateDeviceOnPlatform = await createDeviceUtil.updateOnPlatform(
        request
      );

      if (responseFromUpdateDeviceOnPlatform.success === true) {
        const status = responseFromUpdateDeviceOnPlatform.status
          ? responseFromUpdateDeviceOnPlatform.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: true,
          updated_device: responseFromUpdateDeviceOnPlatform.data,
        });
      } else if (responseFromUpdateDeviceOnPlatform.success === false) {
        const status = responseFromUpdateDeviceOnPlatform.status
          ? responseFromUpdateDeviceOnPlatform.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: false,
          errors: responseFromUpdateDeviceOnPlatform.errors
            ? responseFromUpdateDeviceOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteOnPlatform: async (req, res, next) => {
    try {
      // logger.info(`the soft delete operation starts....`);
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveDevice = await createDeviceUtil.deleteOnPlatform(
        request
      );

      if (responseFromRemoveDevice.success === true) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      } else if (responseFromRemoveDevice.success === false) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromRemoveDevice.message,
          errors: responseFromRemoveDevice.error
            ? responseFromRemoveDevice.error
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createOnPlatform: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateOnPlatform = await createDeviceUtil.createOnPlatform(
        request
      );

      if (responseFromCreateOnPlatform.success === true) {
        const status = responseFromCreateOnPlatform.status
          ? responseFromCreateOnPlatform.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateOnPlatform.message,
          created_device: responseFromCreateOnPlatform.data,
        });
      } else if (responseFromCreateOnPlatform.success === false) {
        const status = responseFromCreateOnPlatform.status
          ? responseFromCreateOnPlatform.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateOnPlatform.message,
          errors: responseFromCreateOnPlatform.errors
            ? responseFromCreateOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listOnGCP: (req, res, next) => {
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
        return res.status(httpStatus.OK).json(response);
      })
      .catch((error) => {
        logger.error(`Internal Server Error ${error.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      });
  },
  createOnGCP: (req, res, next) => {
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
        return res.status(httpStatus.OK).json(response);
      })
      .catch((error) => {
        logger.error(`Internal Server Error ${error.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      });
  },
};

module.exports = device;
