const httpStatus = require("http-status");
const { logElement, logText, logObject } = require("@utils/log");
const createChecklistUtil = require("@utils/create-checklist");
const { validationResult } = require("express-validator");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- checklists-controller`
);
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");

const checklists = {
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(request.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let responseFromUpdateChecklist = await createChecklistUtil.update(
        request
      );
      logObject("responseFromUpdateChecklist", responseFromUpdateChecklist);
      if (responseFromUpdateChecklist.success === true) {
        let status = responseFromUpdateChecklist.status
          ? responseFromUpdateChecklist.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdateChecklist.message,
          checklist: responseFromUpdateChecklist.data,
        });
      } else if (responseFromUpdateChecklist.success === false) {
        let errors = responseFromUpdateChecklist.errors
          ? responseFromUpdateChecklist.errors
          : { message: "" };
        let status = responseFromUpdateChecklist.status
          ? responseFromUpdateChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdateChecklist.message,
          checklist: responseFromUpdateChecklist.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  create: async (req, res) => {
    try {
      let { body, query } = req;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);

      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let responseFromCreateChecklist = await createChecklistUtil.create(
        request
      );
      logObject("responseFromCreateChecklist", responseFromCreateChecklist);
      if (responseFromCreateChecklist.success === true) {
        let status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
        });
      } else if (responseFromCreateChecklist.success === false) {
        let errors = responseFromCreateChecklist.errors
          ? responseFromCreateChecklist.errors
          : { message: "" };
        let status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  upsert: async (req, res) => {
    try {
      let { body, query } = req;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);

      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let responseFromCreateChecklist = await createChecklistUtil.upsert(
        request
      );
      logObject("responseFromCreateChecklist", responseFromCreateChecklist);
      if (responseFromCreateChecklist.success === true) {
        let status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
        });
      } else if (responseFromCreateChecklist.success === false) {
        let errors = responseFromCreateChecklist.errors
          ? responseFromCreateChecklist.errors
          : { message: "" };
        let status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all checklists by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(request.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromListChecklists = await createChecklistUtil.list(
        request
      );
      logObject("responseFromListChecklists", responseFromListChecklists);
      if (responseFromListChecklists.success === true) {
        let status = responseFromListChecklists.status
          ? responseFromListChecklists.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListChecklists.message,
          checklists: responseFromListChecklists.data,
        });
      } else if (responseFromListChecklists.success === false) {
        let errors = responseFromListChecklists.errors
          ? responseFromListChecklists.errors
          : "";

        let status = responseFromListChecklists.status
          ? responseFromListChecklists.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListChecklists.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      logText("deleting checklist..........");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromDeleteChecklist = await createChecklistUtil.delete(
        request
      );
      logObject("responseFromDeleteChecklist", responseFromDeleteChecklist);
      if (responseFromDeleteChecklist.success === true) {
        let status = responseFromDeleteChecklist.status
          ? responseFromDeleteChecklist.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeleteChecklist.message,
          checklist: responseFromDeleteChecklist.data,
        });
      } else if (responseFromDeleteChecklist.success === false) {
        let errors = responseFromDeleteChecklist.errors
          ? responseFromDeleteChecklist.errors
          : { message: "" };

        let status = responseFromDeleteChecklist.status
          ? responseFromDeleteChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromDeleteChecklist.message,
          checklist: responseFromDeleteChecklist.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = checklists;
