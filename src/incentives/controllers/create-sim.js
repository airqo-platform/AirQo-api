const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createSimUtil = require("@utils/create-sim");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-sim-controller`
);
const isEmpty = require("is-empty");

const createSim = {
  create: async (req, res, next) => {
    logText("registering sim.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateSim = await createSimUtil.createLocal(
        request,
        next
      );
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  createBulk: async (req, res, next) => {
    logText("registering sim.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateSim = await createSimUtil.createBulkLocal(
        request
      );
      logObject("responseFromCreateSim in controller", responseFromCreateSim);
      if (responseFromCreateSim.success === true) {
        let status = responseFromCreateSim.status
          ? responseFromCreateSim.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateSim.message,
          created_sims: responseFromCreateSim.data,
          failures: responseFromCreateSim.failedCreations,
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete sim............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveSim = await createSimUtil.deleteLocal(
        request,
        next
      );

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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  update: async (req, res, next) => {
    try {
      logText("updating sim................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateSim = await createSimUtil.updateLocal(
        request,
        next
      );
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListSims = await createSimUtil.listLocal(request, next);
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  checkStatus: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCheckStatus = await createSimUtil.checkStatus(
        request,
        next
      );

      logObject(
        "responseFromCheckStatus in controller",
        responseFromCheckStatus
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  activateSim: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromActivateSim = await createSimUtil.activateSim(
        request,
        next
      );
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  deactivateSim: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  updateSimName: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  rechargeSim: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all sims by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRechargeSim = await createSimUtil.rechargeSim(
        request,
        next
      );
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = createSim;
