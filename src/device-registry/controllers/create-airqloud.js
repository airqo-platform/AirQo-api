const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");
const { tryCatchErrors, badRequest } = require("../utils/errors");
const generateFilter = require("../utils/generate-filter");
const createAirQloudUtil = require("../utils/create-airqloud");
const log4js = require("log4js");
const logger = log4js.getLogger("create-airqloud-util");

const createAirqloud = {
  register: async (req, res) => {
    let request = {};
    let { body } = req;
    let { query } = req;
    logText("registering airqloud.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      const { tenant } = req.query;
      request["body"] = body;
      request["query"] = query;

      let responseFromCreateAirQloud = await createAirQloudUtil.create(request);
      logObject(
        "responseFromCreateAirQloud in controller",
        responseFromCreateAirQloud
      );
      if (responseFromCreateAirQloud.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromCreateAirQloud.message,
          airqloud: responseFromCreateAirQloud.data,
        });
      }

      if (responseFromCreateAirQloud.success === false) {
        let error = responseFromCreateAirQloud.error
          ? responseFromCreateAirQloud.error
          : "";

        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromCreateAirQloud.message,
          error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "createAirqloud controller");
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      let request = {};

      logText(".................................................");
      logText("inside delete airqloud............");
      const { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      request["query"] = query;
      let responseFromRemoveAirQloud = await createAirQloudUtil.delete(request);

      if (responseFromRemoveAirQloud.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromRemoveAirQloud.message,
          airqloud: responseFromRemoveAirQloud.data,
        });
      }

      if (responseFromRemoveAirQloud.success === false) {
        let error = responseFromRemoveAirQloud.error
          ? responseFromRemoveAirQloud.error
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromRemoveAirQloud.message,
          error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "createAirqloud controller");
    }
  },

  update: async (req, res) => {
    try {
      let request = {};
      let { body } = req;
      let { query } = req;
      logText("updating airqloud................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      request["body"] = body;
      request["query"] = query;
      let responseFromUpdateAirQloud = await createAirQloudUtil.update(request);
      logObject("responseFromUpdateAirQloud", responseFromUpdateAirQloud);
      if (responseFromUpdateAirQloud.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromUpdateAirQloud.message,
          airqloud: responseFromUpdateAirQloud.data,
        });
      }

      if (responseFromUpdateAirQloud.success === false) {
        let error = responseFromUpdateAirQloud.error
          ? responseFromUpdateAirQloud.error
          : "";

        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromUpdateAirQloud.message,
          error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "createAirqloud controller");
    }
  },

  list: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all airqlouds by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      request["query"] = query;
      let responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      }

      if (responseFromListAirQlouds.success === false) {
        let error = responseFromListAirQlouds.error
          ? responseFromListAirQlouds.error
          : "";
        res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromListAirQlouds.message,
          error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "create airqloud controller");
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      const { body } = req;
      let request = {};
      logText(".................................................");
      logText("inside delete airqloud............");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      request["query"] = query;
      request["body"] = body;
      let responseFromRemoveAirQloud = await createAirQloudUtil.delete(request);

      if (responseFromRemoveAirQloud.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromRemoveAirQloud.message,
          airqloud: responseFromRemoveAirQloud.data,
        });
      }

      if (responseFromRemoveAirQloud.success === false) {
        let error = responseFromRemoveAirQloud.error
          ? responseFromRemoveAirQloud.error
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromRemoveAirQloud.message,
          error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "manageAirQloud controller");
    }
  },
};

module.exports = createAirqloud;
