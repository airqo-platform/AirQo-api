const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-activity-controller`
);
const createActivityUtil = require("@utils/create-activity");
const errors = require("@utils/errors");

const activity = {
  deploy: async (req, res) => {
    try {
      logText("we are deploying....");
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
      request["query"]["tenant"] = tenant;

      const responseFromDeployDevice = await createActivityUtil.deploy(request);
      if (responseFromDeployDevice.success === true) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeployDevice.message,
          createdActivity: responseFromDeployDevice.data.createdActivity,
          updatedDevice: responseFromDeployDevice.data.updatedDevice,
        });
      } else if (responseFromDeployDevice.success === false) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeployDevice.message,
          errors: responseFromDeployDevice.errors
            ? responseFromDeployDevice.errors
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
  recall: async (req, res) => {
    try {
      logText("we are recalling....");
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

      request["query"]["tenant"] = tenant;

      const responseFromRecallDevice = await createActivityUtil.recall(request);
      if (responseFromRecallDevice.success === true) {
        const status = responseFromRecallDevice.status
          ? responseFromRecallDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRecallDevice.message,
          createdActivity: responseFromRecallDevice.data.createdActivity,
          updatedDevice: responseFromRecallDevice.data.updatedDevice,
        });
      } else if (responseFromRecallDevice.success === false) {
        const status = responseFromRecallDevice.status
          ? responseFromRecallDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRecallDevice.message,
          errors: responseFromRecallDevice.errors
            ? responseFromRecallDevice.errors
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
  maintain: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request["query"] = {};
      request["query"]["tenant"] = tenant;

      const responseFromMaintainDevice = await createActivityUtil.maintain(
        request
      );
      if (responseFromMaintainDevice.success === true) {
        const status = responseFromMaintainDevice.status
          ? responseFromMaintainDevice.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromMaintainDevice.message,
          createdActivity: responseFromMaintainDevice.data.createdActivity,
          updatedDevice: responseFromMaintainDevice.data.updatedDevice,
        });
      } else if (responseFromMaintainDevice.success === false) {
        const status = responseFromMaintainDevice.status
          ? responseFromMaintainDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromMaintainDevice.message,
          errors: responseFromMaintainDevice.errors
            ? responseFromMaintainDevice.errors
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

  bulkAdd: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      let request = {};
      let { body } = req;
      let { query } = req;
      const { network } = query;
      logText("adding activities................");
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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
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
      let request = {};
      let { body } = req;
      let { query } = req;
      const { network } = query;
      logText("updating activity................");
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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      logText("updating activity................");
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
      request["query"]["tenant"] = tenant;
      const responseFromUpdateActivity = await createActivityUtil.update(
        request
      );
      logObject("responseFromUpdateActivity", responseFromUpdateActivity);
      if (responseFromUpdateActivity.success === true) {
        const status = responseFromUpdateActivity.status
          ? responseFromUpdateActivity.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateActivity.message,
          updated_activity: responseFromUpdateActivity.data,
        });
      } else if (responseFromUpdateActivity.success === false) {
        const status = responseFromUpdateActivity.status
          ? responseFromUpdateActivity.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateActivity.message,
          errors: responseFromUpdateActivity.errors
            ? responseFromUpdateActivity.errors
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
  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete activity............");
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
      request["query"]["tenant"] = tenant;
      const responseFromRemoveActivity = await createActivityUtil.delete(
        request
      );

      if (responseFromRemoveActivity.success === true) {
        const status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveActivity.message,
          deleted_activity: responseFromRemoveActivity.data,
        });
      } else if (responseFromRemoveActivity.success === false) {
        const status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveActivity.message,
          errors: responseFromRemoveActivity.errors
            ? responseFromRemoveActivity.errors
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
  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all activities by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      logObject("req.query", req.query);
      logElement("hasErrors", hasErrors);
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
      request["query"]["tenant"] = tenant;
      let responseFromListActivities = await createActivityUtil.list(request);
      logElement(
        "has the response for listing activities been successful?",
        responseFromListActivities.success
      );
      if (responseFromListActivities.success === true) {
        const status = responseFromListActivities.status
          ? responseFromListActivities.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListActivities.message,
          site_activities: responseFromListActivities.data,
        });
      } else if (responseFromListActivities.success === false) {
        const status = responseFromListActivities.status
          ? responseFromListActivities.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListActivities.message,
          errors: responseFromListActivities.errors
            ? responseFromListActivities.errors
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
};

module.exports = activity;
