const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const client = new iot.v1.DeviceManagerClient();
const { logObject, logElement, logText } = require("@utils/log");
const createDeviceUtil = require("@utils/create-device");
const distance = require("@utils/distance");
const { validationResult } = require("express-validator");
const constants = require("@config/constants");
const errors = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-device-controller`
);

const isEmpty = require("is-empty");

const device = {
  bulkCreate: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
    } catch (error) {
      logObject("error", error);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "updating all the metadata",
        errors: { message: error.message },
      });
    }
  },
  bulkUpdate: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
    } catch (error) {
      logObject("error", error);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "updating all the metadata",
        errors: { message: error.message },
      });
    }
  },
  decryptManyKeys: (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let arrayOfEncryptedKeys = req.body;
      let responseFromDecryptManyKeys = createDeviceUtil.decryptManyKeys(
        arrayOfEncryptedKeys
      );

      if (responseFromDecryptManyKeys.success === true) {
        const status = responseFromDecryptManyKeys.status
          ? responseFromDecryptManyKeys.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDecryptManyKeys.message,
          decrypted_keys: responseFromDecryptManyKeys.data,
        });
      } else if (responseFromDecryptManyKeys.success === false) {
        const status = responseFromDecryptManyKeys.status
          ? responseFromDecryptManyKeys.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDecryptManyKeys.message,
          errors: responseFromDecryptManyKeys.errors
            ? responseFromDecryptManyKeys.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  decryptKey: (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { encrypted_key } = req.body;
      let responseFromDecryptKey = createDeviceUtil.decryptKey(encrypted_key);

      if (responseFromDecryptKey.success === true) {
        const status = responseFromDecryptKey.status
          ? responseFromDecryptKey.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDecryptKey.message,
          decrypted_key: responseFromDecryptKey.data,
        });
      } else if (responseFromDecryptKey.success === false) {
        const status = responseFromDecryptKey.status
          ? responseFromDecryptKey.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDecryptKey.message,
          errors: responseFromDecryptKey.errors
            ? responseFromDecryptKey.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  getDevicesCount: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        const nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      const request = {
        query: { tenant },
      };

      const result = await createDeviceUtil.getDevicesCount(request);

      if (result.success === true) {
        const status = result.status ? result.status : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          devices: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      const { query, body } = req;
      let { tenant } = query;
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromCreateDevice = await createDeviceUtil.create(request);

      if (responseFromCreateDevice.success === true) {
        const status = responseFromCreateDevice.status
          ? responseFromCreateDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateDevice.message,
          created_device: responseFromCreateDevice.data,
        });
      } else if (responseFromCreateDevice.success === false) {
        const status = responseFromCreateDevice.status
          ? responseFromCreateDevice.status
          : HTTPStatus.BAD_GATEWAY;

        return res.status(status).json({
          success: false,
          message: responseFromCreateDevice.message,
          errors: responseFromCreateDevice.errors
            ? responseFromCreateDevice.errors
            : "",
        });
      }
    } catch (e) {
      logger.error(`server error in the create controller -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "server error in the create controller",
        errors: { message: e.message },
      });
    }
  },
  generateQRCode: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        const nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request = {
        query: {
          tenant,
        },
      };

      const response = await createDeviceUtil.generateQR(request);

      if (response.success === true) {
        const status = response.status ? response.status : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: response.message,
          data: response.data,
        });
      } else if (response.success === false) {
        const status = response.status
          ? response.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: response.message,
          errors: response.errors ? response.errors : { message: "" },
        });
      }
    } catch (err) {
      logger.error(`server side error -- ${err.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "unable to generate the QR code",
        errors: { message: err.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
      // logger.info(`the general delete device operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromRemoveDevice = await createDeviceUtil.delete(request);

      if (responseFromRemoveDevice.success === true) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      } else if (responseFromRemoveDevice.success === false) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveDevice.message,
          errors: responseFromRemoveDevice.error
            ? responseFromRemoveDevice.error
            : { message: "" },
        });
      }
    } catch (e) {
      logger.error(`server error - delete device --- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      // logger.info(`the device update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateDevice = await createDeviceUtil.update(request);

      if (responseFromUpdateDevice.success === true) {
        const status = responseFromUpdateDevice.status
          ? responseFromUpdateDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateDevice.message,
          success: true,
          updated_device: responseFromUpdateDevice.data,
        });
      } else if (responseFromUpdateDevice.success === false) {
        const status = responseFromUpdateDevice.status
          ? responseFromUpdateDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateDevice.message,
          success: false,
          errors: responseFromUpdateDevice.errors
            ? responseFromUpdateDevice.errors
            : { message: "" },
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  refresh: async (req, res) => {
    try {
      logText("refreshing device details................");
      let { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NEWORK || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      let responseFromRefreshDevice = await createDeviceUtil.refresh(request);
      logObject("responseFromRefreshDevice", responseFromRefreshDevice);
      if (responseFromRefreshDevice.success === true) {
        const status = responseFromRefreshDevice.status
          ? responseFromRefreshDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRefreshDevice.message,
          refreshed_device: responseFromRefreshDevice.data,
        });
      } else if (responseFromRefreshDevice.success === false) {
        const status = responseFromRefreshDevice.status
          ? responseFromRefreshDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRefreshDevice.message,
          errors: responseFromRefreshDevice.errors
            ? responseFromRefreshDevice.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  encryptKeys: async (req, res) => {
    try {
      logText("the soft update operation starts....");
      // logger.info(`the soft update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromEncryptKeys = await createDeviceUtil.encryptKeys(
        request
      );

      if (responseFromEncryptKeys.success === true) {
        const status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : HTTPStatus.OK;
        return res.status(status).json({
          message: responseFromEncryptKeys.message,
          success: true,
          updated_device: responseFromEncryptKeys.data,
        });
      } else if (responseFromEncryptKeys.success === false) {
        const status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromEncryptKeys.message,
          success: false,
          errors: responseFromEncryptKeys.errors
            ? responseFromEncryptKeys.errors
            : { message: "" },
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list devices based on query params...");
      // logger.info("we are listing devices...", "yeah");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

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
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListDeviceDetails.message,
          devices: responseFromListDeviceDetails.data,
        });
      } else if (responseFromListDeviceDetails.success === false) {
        const status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListDeviceDetails.message,
          errors: responseFromListDeviceDetails.errors
            ? responseFromListDeviceDetails.errors
            : { message: "" },
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

  listSummary: async (req, res) => {
    try {
      logText(".....................................");
      logText("list Summary of devices based on query params...");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let tenant = req.query.tenant;
      let request = Object.assign({}, req);
      if (!isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      request.query.category = "summary";
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
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListDeviceDetails.message,
          devices: responseFromListDeviceDetails.data,
        });
      } else if (responseFromListDeviceDetails.success === false) {
        const status = responseFromListDeviceDetails.status
          ? responseFromListDeviceDetails.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListDeviceDetails.message,
          errors: responseFromListDeviceDetails.errors
            ? responseFromListDeviceDetails.errors
            : { message: "" },
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
      const { tenant, latitude, longitude, radius, chid } = req.query;
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

        if (isEmpty(tenant)) {
          tenant = "airqo";
        }

        let request = Object.assign({}, req);
        request.query.name = device;
        request.query.tenant = tenant;
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
          devices,
          radius,
          latitude,
          longitude
        );

        return res.status(HTTPStatus.OK).json(nearest_devices);
      } catch (e) {
        logger.error(`internal server error -- ${e.message}`);
        return res.status(HTTPStatus.BAD_REQUEST).json(e);
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  updateOnPlatform: async (req, res) => {
    try {
      logText("the soft update operation starts....");
      // logger.info(`the soft update operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant, device } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateDeviceOnPlatform = await createDeviceUtil.updateOnPlatform(
        request
      );

      if (responseFromUpdateDeviceOnPlatform.success === true) {
        const status = responseFromUpdateDeviceOnPlatform.status
          ? responseFromUpdateDeviceOnPlatform.status
          : HTTPStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: true,
          updated_device: responseFromUpdateDeviceOnPlatform.data,
        });
      } else if (responseFromUpdateDeviceOnPlatform.success === false) {
        const status = responseFromUpdateDeviceOnPlatform.status
          ? responseFromUpdateDeviceOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateDeviceOnPlatform.message,
          success: false,
          errors: responseFromUpdateDeviceOnPlatform.errors
            ? responseFromUpdateDeviceOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  deleteOnPlatform: async (req, res) => {
    try {
      // logger.info(`the soft delete operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query = {
        tenant,
      };

      let responseFromRemoveDevice = await createDeviceUtil.deleteOnPlatform(
        request
      );

      if (responseFromRemoveDevice.success === true) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveDevice.message,
          deleted_device: responseFromRemoveDevice.data,
        });
      } else if (responseFromRemoveDevice.success === false) {
        const status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromRemoveDevice.message,
          errors: responseFromRemoveDevice.error
            ? responseFromRemoveDevice.error
            : { message: "" },
        });
      }
    } catch (e) {
      logger.error(`server error --- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  createOnPlatform: async (req, res) => {
    try {
      const { query, body } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromCreateOnPlatform = await createDeviceUtil.createOnPlatform(
        request
      );

      if (responseFromCreateOnPlatform.success === true) {
        const status = responseFromCreateOnPlatform.status
          ? responseFromCreateOnPlatform.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateOnPlatform.message,
          created_device: responseFromCreateOnPlatform.data,
        });
      } else if (responseFromCreateOnPlatform.success === false) {
        const status = responseFromCreateOnPlatform.status
          ? responseFromCreateOnPlatform.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateOnPlatform.message,
          errors: responseFromCreateOnPlatform.errors
            ? responseFromCreateOnPlatform.errors
            : { message: "" },
        });
      }
    } catch (e) {
      logger.error(`server error in the create one controller -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "server error in the createOnPlatform controller",
        errors: { message: e.message },
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
      .catch((err) => {});
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
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },
};

module.exports = device;
