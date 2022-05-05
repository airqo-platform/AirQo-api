const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");
const { getModelByTenant } = require("../utils/multitenancy");
const log4js = require("log4js");
const logger = log4js.getLogger("create-activity-util");
const createActivityUtil = require("../utils/create-activity");
const errors = require("../utils/errors");

const activity = {
  deploy: async (req, res) => {
    try {
      logText("we are deploying....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      const {
        date,
        height,
        mountType,
        powerType,
        isPrimaryInLocation,
        site_id,
      } = body;
      const { tenant, deviceName } = query;
      let request = {};

      request["body"] = {};
      request["query"] = {};
      request["body"]["date"] = date;
      request["body"]["height"] = height;
      request["body"]["mountType"] = mountType;
      request["body"]["powerType"] = powerType;
      request["body"]["isPrimaryInLocation"] = isPrimaryInLocation;
      request["body"]["site_id"] = site_id;

      request["query"]["tenant"] = tenant;
      request["query"]["deviceName"] = deviceName;
      request["query"]["type"] = "deploy";

      const responseFromDeployDevice = await createActivityUtil.create(request);
      if (responseFromDeployDevice.success === true) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.OK;
        const data = responseFromDeployDevice.data;
        return res.status(status).json({
          success: true,
          message: responseFromDeployDevice.message,
          createdActivity: data.createdActivity,
          updatedDevice: data.updatedDevice,
        });
      } else if (responseFromDeployDevice.success === false) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromDeployDevice.errors
          ? responseFromDeployDevice.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromDeployDevice.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  recall: async (req, res) => {
    try {
      const { body, query } = req;
      const {
        date,
        height,
        mountType,
        powerType,
        isPrimaryInLocation,
        site_id,
      } = body;
      const { tenant, deviceName } = query;
      let request = {};

      request["body"] = {};
      request["query"] = {};
      request["body"]["date"] = date;
      request["body"]["height"] = height;
      request["body"]["mountType"] = mountType;
      request["body"]["powerType"] = powerType;
      request["body"]["isPrimaryInLocation"] = isPrimaryInLocation;
      request["body"]["site_id"] = site_id;

      request["query"]["tenant"] = tenant;
      request["query"]["deviceName"] = deviceName;
      request["query"]["type"] = "recall";

      const responseFromDeployDevice = await createActivityUtil.create(request);
      if (responseFromDeployDevice.success === true) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.OK;
        const data = responseFromDeployDevice.data;
        return res.status(status).json({
          success: true,
          message: responseFromDeployDevice.message,
          createdActivity: data.createdActivity,
          updatedDevice: data.updatedDevice,
        });
      } else if (responseFromDeployDevice.success === false) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromDeployDevice.errors
          ? responseFromDeployDevice.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromDeployDevice.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  maintain: async (req, res) => {
    try {
      const { body, query } = req;
      const {
        date,
        height,
        mountType,
        powerType,
        isPrimaryInLocation,
        tags,
        description,
        site_id,
      } = body;
      const { tenant, deviceName } = query;
      let request = {};

      request["body"] = {};
      request["query"] = {};
      request["body"]["date"] = date;
      request["body"]["height"] = height;
      request["body"]["mountType"] = mountType;
      request["body"]["powerType"] = powerType;
      request["body"]["isPrimaryInLocation"] = isPrimaryInLocation;
      request["body"]["site_id"] = site_id;
      request["body"]["description"] = description;
      request["body"]["tags"] = tags;
      request["query"]["tenant"] = tenant;
      request["query"]["deviceName"] = deviceName;
      request["query"]["type"] = "maintain";

      const responseFromDeployDevice = await createActivityUtil.create(request);
      if (responseFromDeployDevice.success === true) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.OK;
        const data = responseFromDeployDevice.data;
        return res.status(status).json({
          success: true,
          message: responseFromDeployDevice.message,
          createdActivity: data.createdActivity,
          updatedDevice: data.updatedDevice,
        });
      } else if (responseFromDeployDevice.success === false) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromDeployDevice.errors
          ? responseFromDeployDevice.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromDeployDevice.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
    try {
      let request = {};
      let { body } = req;
      let { query } = req;
      logText("updating activity................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["body"] = body;
      request["query"] = query;
      let responseFromUpdateActivity = await createActivityUtil.update(request);
      logObject("responseFromUpdateActivity", responseFromUpdateActivity);
      if (responseFromUpdateActivity.success === true) {
        let status = responseFromUpdateActivity.status
          ? responseFromUpdateActivity.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateActivity.message,
          updated_activity: responseFromUpdateActivity.data,
        });
      }

      if (responseFromUpdateActivity.success === false) {
        let errors = responseFromUpdateActivity.errors
          ? responseFromUpdateActivity.errors
          : "";

        let status = responseFromUpdateActivity.status
          ? responseFromUpdateActivity.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateActivity.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".................................................");
      logText("inside delete activity............");
      const { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      let responseFromRemoveActivity = await createActivityUtil.delete(request);

      if (responseFromRemoveActivity.success === true) {
        let status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveActivity.message,
          deleted_activity: responseFromRemoveActivity.data,
        });
      } else if (responseFromRemoveActivity.success === false) {
        let errors = responseFromRemoveActivity.errors
          ? responseFromRemoveActivity.errors
          : "";
        let status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveActivity.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  list: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all activities by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      let responseFromListActivities = await createActivityUtil.list(request);
      logElement(
        "has the response for listing activities been successful?",
        responseFromListActivities.success
      );
      if (responseFromListActivities.success === true) {
        let status = responseFromListActivities.status
          ? responseFromListActivities.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListActivities.message,
          site_activities: responseFromListActivities.data,
        });
      } else if (responseFromListActivities.success === false) {
        let errors = responseFromListActivities.errors
          ? responseFromListActivities.errors
          : "";
        let status = responseFromListActivities.status
          ? responseFromListActivities.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListActivities.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = activity;
