const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const createSimUtil = require("@utils/create-sim");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-sim-controller`
);
const isEmpty = require("is-empty");

const createSim = {
  create: async (req, res) => {
    logText("registering sim.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromCreateSim = await createSimUtil.createLocal(request);
      logObject("responseFromCreateSim in controller", responseFromCreateSim);
      if (responseFromCreateSim.success === true) {
        let status = responseFromCreateSim.status
          ? responseFromCreateSim.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateSim.message,
          created_sim: responseFromCreateSim.data,
        });
      } else if (responseFromCreateSim.success === false) {
        const status = responseFromCreateSim.status
          ? responseFromCreateSim.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateSim.message,
          errors: responseFromCreateSim.errors
            ? responseFromCreateSim.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete sim............");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromRemoveSim = await createSimUtil.deleteLocal(request);

      logObject("responseFromRemoveSim", responseFromRemoveSim);

      if (responseFromRemoveSim.success === true) {
        const status = responseFromRemoveSim.status
          ? responseFromRemoveSim.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveSim.message,
          removed_sim: responseFromRemoveSim.data,
        });
      } else if (responseFromRemoveSim.success === false) {
        const status = responseFromRemoveSim.status
          ? responseFromRemoveSim.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveSim.message,
          errors: responseFromRemoveSim.errors
            ? responseFromRemoveSim.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
    try {
      logText("updating sim................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromUpdateSim = await createSimUtil.updateLocal(request);
      logObject("responseFromUpdateSim", responseFromUpdateSim);
      if (responseFromUpdateSim.success === true) {
        const status = responseFromUpdateSim.status
          ? responseFromUpdateSim.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateSim.message,
          updated_sim: responseFromUpdateSim.data,
        });
      } else if (responseFromUpdateSim.success === false) {
        const status = responseFromUpdateSim.status
          ? responseFromUpdateSim.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateSim.message,
          errors: responseFromUpdateSim.errors
            ? responseFromUpdateSim.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromListSims = await createSimUtil.listLocal(request);
      logElement(
        "has the response for listing sims been successful?",
        responseFromListSims.success
      );
      if (responseFromListSims.success === true) {
        const status = responseFromListSims.status
          ? responseFromListSims.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListSims.message,
          sims: responseFromListSims.data,
        });
      } else if (responseFromListSims.success === false) {
        const status = responseFromListSims.status
          ? responseFromListSims.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListSims.message,
          errors: responseFromListSims.errors
            ? responseFromListSims.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  checkStatus: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromCheckStatus = await createSimUtil.checkStatus(request);
      logElement(
        "has the response for listing sims been successful?",
        responseFromCheckStatus.success
      );
      if (responseFromCheckStatus.success === true) {
        const status = responseFromCheckStatus.status
          ? responseFromCheckStatus.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCheckStatus.message,
          status: responseFromCheckStatus.data,
        });
      } else if (responseFromCheckStatus.success === false) {
        const status = responseFromCheckStatus.status
          ? responseFromCheckStatus.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCheckStatus.message,
          errors: responseFromCheckStatus.errors
            ? responseFromCheckStatus.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  activateSim: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromActivateSim = await createSimUtil.activateSim(request);
      logElement(
        "has the response for listing sims been successful?",
        responseFromActivateSim.success
      );
      if (responseFromActivateSim.success === true) {
        const status = responseFromActivateSim.status
          ? responseFromActivateSim.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromActivateSim.message,
          status: responseFromActivateSim.data,
        });
      } else if (responseFromActivateSim.success === false) {
        const status = responseFromActivateSim.status
          ? responseFromActivateSim.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromActivateSim.message,
          errors: responseFromActivateSim.errors
            ? responseFromActivateSim.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  deactivateSim: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromDeactivateSim = await createSimUtil.deactivateSim(
        request
      );
      logElement(
        "has the response for listing sims been successful?",
        responseFromDeactivateSim.success
      );
      if (responseFromDeactivateSim.success === true) {
        const status = responseFromDeactivateSim.status
          ? responseFromDeactivateSim.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeactivateSim.message,
          status: responseFromDeactivateSim.data,
        });
      } else if (responseFromDeactivateSim.success === false) {
        const status = responseFromDeactivateSim.status
          ? responseFromDeactivateSim.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeactivateSim.message,
          errors: responseFromDeactivateSim.errors
            ? responseFromDeactivateSim.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  updateSimName: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromUpdateSimName = await createSimUtil.updateSimName(
        request
      );
      logElement(
        "has the response for listing sims been successful?",
        responseFromUpdateSimName.success
      );
      if (responseFromUpdateSimName.success === true) {
        const status = responseFromUpdateSimName.status
          ? responseFromUpdateSimName.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateSimName.message,
          status: responseFromUpdateSimName.data,
        });
      } else if (responseFromUpdateSimName.success === false) {
        const status = responseFromUpdateSimName.status
          ? responseFromUpdateSimName.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateSimName.message,
          errors: responseFromUpdateSimName.errors
            ? responseFromUpdateSimName.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  rechargeSim: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromRechargeSim = await createSimUtil.rechargeSim(request);
      logElement(
        "has the response for listing sims been successful?",
        responseFromRechargeSim.success
      );
      if (responseFromRechargeSim.success === true) {
        const status = responseFromRechargeSim.status
          ? responseFromRechargeSim.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRechargeSim.message,
          status: responseFromRechargeSim.data,
        });
      } else if (responseFromRechargeSim.success === false) {
        const status = responseFromRechargeSim.status
          ? responseFromRechargeSim.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRechargeSim.message,
          errors: responseFromRechargeSim.errors
            ? responseFromRechargeSim.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createSim;
