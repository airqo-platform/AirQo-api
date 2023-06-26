const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const createCohortUtil = require("@utils/create-cohort");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-cohort-controller`
);

const createCohort = {
  createNetwork: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromCreateNetwork = await createCohortUtil.createNetwork(
        request
      );
      logObject(
        "responseFromCreateNetwork in controller",
        responseFromCreateNetwork
      );
      if (responseFromCreateNetwork.success === true) {
        const status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateNetwork.message,
          cohort: responseFromCreateNetwork.data,
        });
      } else if (responseFromCreateNetwork.success === false) {
        const status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateNetwork.message,
          errors: responseFromCreateNetwork.errors
            ? responseFromCreateNetwork.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listNetworks: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromListNetworks = await createCohortUtil.listNetworks(
        request
      );
      logElement(
        "has the response for listing cohorts been successful?",
        responseFromListNetworks.success
      );
      if (responseFromListNetworks.success === true) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListNetworks.message,
          networks: responseFromListNetworks.data,
        });
      } else if (responseFromListNetworks.success === false) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListNetworks.message,
          errors: responseFromListNetworks.errors
            ? responseFromListNetworks.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  updateNetwork: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromUpdateNetwork = await createCohortUtil.updateNetwork(
        request
      );
      logObject("responseFromUpdateNetwork", responseFromUpdateNetwork);
      if (responseFromUpdateNetwork.success === true) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateNetwork.message,
          cohort: responseFromUpdateNetwork.data,
        });
      } else if (responseFromUpdateNetwork.success === false) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateNetwork.message,
          errors: responseFromUpdateNetwork.errors
            ? responseFromUpdateNetwork.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  deleteNetwork: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromRemoveNetwork = await createNetworkUtil.deleteNetwork(
        request
      );

      if (responseFromRemoveNetwork.success === true) {
        const status = responseFromRemoveNetwork.status
          ? responseFromRemoveNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveNetwork.message,
          cohort: responseFromRemoveNetwork.data,
        });
      } else if (responseFromRemoveNetwork.success === false) {
        const status = responseFromRemoveNetwork.status
          ? responseFromRemoveNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveNetwork.message,
          errors: responseFromRemoveNetwork.errors
            ? responseFromRemoveNetwork.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromListCohorts = await createCohortUtil.list(request);
      logElement(
        "has the response for listing cohorts been successful?",
        responseFromListCohorts.success
      );
      if (responseFromListCohorts.success === true) {
        const status = responseFromListCohorts.status
          ? responseFromListCohorts.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListCohorts.message,
          cohorts: responseFromListCohorts.data,
        });
      } else if (responseFromListCohorts.success === false) {
        const status = responseFromListCohorts.status
          ? responseFromListCohorts.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListCohorts.message,
          errors: responseFromListCohorts.errors
            ? responseFromListCohorts.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromUpdateCohort = await createCohortUtil.update(request);
      logObject("responseFromUpdateCohort", responseFromUpdateCohort);
      if (responseFromUpdateCohort.success === true) {
        const status = responseFromUpdateCohort.status
          ? responseFromUpdateCohort.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateCohort.message,
          cohort: responseFromUpdateCohort.data,
        });
      } else if (responseFromUpdateCohort.success === false) {
        const status = responseFromUpdateCohort.status
          ? responseFromUpdateCohort.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateCohort.message,
          errors: responseFromUpdateCohort.errors
            ? responseFromUpdateCohort.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  delete: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromRemoveCohort = await createCohortUtil.delete(request);

      if (responseFromRemoveCohort.success === true) {
        const status = responseFromRemoveCohort.status
          ? responseFromRemoveCohort.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveCohort.message,
          cohort: responseFromRemoveCohort.data,
        });
      } else if (responseFromRemoveCohort.success === false) {
        const status = responseFromRemoveCohort.status
          ? responseFromRemoveCohort.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveCohort.message,
          errors: responseFromRemoveCohort.errors
            ? responseFromRemoveCohort.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`Internal Server Error -- ${e.message}`);
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromCreateCohort = await createCohortUtil.create(request);
      logObject(
        "responseFromCreateCohort in controller",
        responseFromCreateCohort
      );
      if (responseFromCreateCohort.success === true) {
        const status = responseFromCreateCohort.status
          ? responseFromCreateCohort.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateCohort.message,
          cohort: responseFromCreateCohort.data,
        });
      } else if (responseFromCreateCohort.success === false) {
        const status = responseFromCreateCohort.status
          ? responseFromCreateCohort.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateCohort.message,
          errors: responseFromCreateCohort.errors
            ? responseFromCreateCohort.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listSummary: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all cohorts by query params provided");
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
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      request["query"]["summary"] = "yes";
      let responseFromListCohorts = await createCohortUtil.list(request);
      logElement(
        "has the response for listing cohorts been successful?",
        responseFromListCohorts.success
      );
      if (responseFromListCohorts.success === true) {
        const status = responseFromListCohorts.status
          ? responseFromListCohorts.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListCohorts.message,
          cohorts: responseFromListCohorts.data,
        });
      } else if (responseFromListCohorts.success === false) {
        const status = responseFromListCohorts.status
          ? responseFromListCohorts.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListCohorts.message,
          errors: responseFromListCohorts.errors
            ? responseFromListCohorts.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
  listDashboard: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all cohorts by query params provided");
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
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      request["query"]["dashboard"] = "yes";
      let responseFromListCohorts = await createCohortUtil.list(request);
      logElement(
        "has the response for listing cohorts been successful?",
        responseFromListCohorts.success
      );
      if (responseFromListCohorts.success === true) {
        const status = responseFromListCohorts.status
          ? responseFromListCohorts.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListCohorts.message,
          cohorts: responseFromListCohorts.data,
        });
      } else if (responseFromListCohorts.success === false) {
        const status = responseFromListCohorts.status
          ? responseFromListCohorts.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListCohorts.message,
          errors: responseFromListCohorts.errors
            ? responseFromListCohorts.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  listAvailableDevices: async (req, res) => {
    try {
      logText("listing available devices....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListAvailableDevices = await createCohortUtil.listAvailableDevices(
        request
      );

      logObject(
        "responseFromListAvailableDevices in controller",
        responseFromListAvailableDevices
      );

      if (responseFromListAvailableDevices.success === true) {
        const status = responseFromListAvailableDevices.status
          ? responseFromListAvailableDevices.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListAvailableDevices.message,
          available_devices: responseFromListAvailableDevices.data,
        });
      } else if (responseFromListAvailableDevices.success === false) {
        const status = responseFromListAvailableDevices.status
          ? responseFromListAvailableDevices.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableDevices.message,
          errors: responseFromListAvailableDevices.errors
            ? responseFromListAvailableDevices.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logElement("Internal Server Error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listAssignedDevices: async (req, res) => {
    try {
      logText("listing assigned devices....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListAssignedDevices = await createCohortUtil.listAssignedDevices(
        request
      );

      logObject(
        "responseFromListAssignedDevices in controller",
        responseFromListAssignedDevices
      );

      if (responseFromListAssignedDevices.success === true) {
        const status = responseFromListAssignedDevices.status
          ? responseFromListAssignedDevices.status
          : httpStatus.OK;
        if (responseFromListAssignedDevices.data.length === 0) {
          return res.status(status).json({
            success: true,
            message: "no assigned devices to this cohort",
            assigned_devices: [],
          });
        }
        return res.status(status).json({
          success: true,
          message:
            "successfully retrieved the assigned devices for this cohort",
          assigned_devices: responseFromListAssignedDevices.data,
        });
      } else if (responseFromListAssignedDevices.success === false) {
        const status = responseFromListAssignedDevices.status
          ? responseFromListAssignedDevices.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListAssignedDevices.message,
          errors: responseFromListAssignedDevices.errors
            ? responseFromListAssignedDevices.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logElement("Internal Server Error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  assignManyDevicesToCohort: async (req, res) => {
    try {
      logText("assign many devices....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromAssignDevices = await createCohortUtil.assignManyDevicesToCohort(
        request
      );

      if (responseFromAssignDevices.success === true) {
        const status = responseFromAssignDevices.status
          ? responseFromAssignDevices.status
          : httpStatus.OK;

        return res.status(status).json({
          message: responseFromAssignDevices.message,
          updated_cohort: responseFromAssignDevices.data,
          success: true,
        });
      } else if (responseFromAssignDevices.success === false) {
        const status = responseFromAssignDevices.status
          ? responseFromAssignDevices.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignDevices.message,
          errors: responseFromAssignDevices.errors
            ? responseFromAssignDevices.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  unAssignManyDevicesFromCohort: async (req, res) => {
    try {
      logText("unAssign device....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUnassignManyDevices = await createCohortUtil.unAssignManyDevicesFromCohort(
        request
      );

      logObject(
        "responseFromUnassignManyDevices",
        responseFromUnassignManyDevices
      );

      if (responseFromUnassignManyDevices.success === true) {
        const status = responseFromUnassignManyDevices.status
          ? responseFromUnassignManyDevices.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "devices successully unassigned",
          updated_records: responseFromUnassignManyDevices.data,
          success: true,
        });
      } else if (responseFromUnassignManyDevices.success === false) {
        const status = responseFromUnassignManyDevices.status
          ? responseFromUnassignManyDevices.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignManyDevices.message,
          errors: responseFromUnassignManyDevices.errors
            ? responseFromUnassignManyDevices.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  assignOneDeviceToCohort: async (req, res) => {
    try {
      logText("assign one device....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateCohort = await createCohortUtil.assignOneDeviceToCohort(
        request
      );

      if (responseFromUpdateCohort.success === true) {
        const status = responseFromUpdateCohort.status
          ? responseFromUpdateCohort.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromUpdateCohort.message,
          updated_records: responseFromUpdateCohort.data,
        });
      } else if (responseFromUpdateCohort.success === false) {
        const status = responseFromUpdateCohort.status
          ? responseFromUpdateCohort.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateCohort.message,
          errors: responseFromUpdateCohort.errors
            ? responseFromUpdateCohort.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  unAssignOneDeviceFromCohort: async (req, res) => {
    try {
      logText("unAssign device....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUnassignDevice = await createCohortUtil.unAssignOneDeviceFromCohort(
        request
      );

      logObject("responseFromUnassignDevice", responseFromUnassignDevice);

      if (responseFromUnassignDevice.success === true) {
        const status = responseFromUnassignDevice.status
          ? responseFromUnassignDevice.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "device successully unassigned",
          updated_records: responseFromUnassignDevice.data,
          success: true,
        });
      } else if (responseFromUnassignDevice.success === false) {
        const status = responseFromUnassignDevice.status
          ? responseFromUnassignDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignDevice.message,
          errors: responseFromUnassignDevice.errors
            ? responseFromUnassignDevice.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createCohort;
