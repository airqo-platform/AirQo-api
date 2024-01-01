const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createCohortUtil = require("@utils/create-cohort");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-cohort-controller`
);
const isEmpty = require("is-empty");

const createCohort = {
  createNetwork: async (req, res, next) => {
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
          new_network: responseFromCreateNetwork.data,
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
  listNetworks: async (req, res, next) => {
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
  updateNetwork: async (req, res, next) => {
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
          updated_network: responseFromUpdateNetwork.data,
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
  deleteNetwork: async (req, res, next) => {
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

      const responseFromRemoveNetwork = await createCohortUtil.deleteNetwork(
        request
      );

      if (responseFromRemoveNetwork.success === true) {
        const status = responseFromRemoveNetwork.status
          ? responseFromRemoveNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveNetwork.message,
          deleted_network: responseFromRemoveNetwork.data,
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
  create: async (req, res, next) => {
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
  listSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all cohorts by query params provided");
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
      request.query.summary = "yes";

      const responseFromListCohorts = await createCohortUtil.list(request);

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
    } catch (errors) {
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
  listDashboard: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all cohorts by query params provided");
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
      request.query.dashboard = "yes";

      const responseFromListCohorts = await createCohortUtil.list(request);

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
  listAvailableDevices: async (req, res, next) => {
    try {
      logText("listing available devices....");
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
  listAssignedDevices: async (req, res, next) => {
    try {
      logText("listing assigned devices....");
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
  assignManyDevicesToCohort: async (req, res, next) => {
    try {
      logText("assign many devices....");
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
  unAssignManyDevicesFromCohort: async (req, res, next) => {
    try {
      logText("unAssign device....");
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
  assignOneDeviceToCohort: async (req, res, next) => {
    try {
      logText("assign one device....");
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
  unAssignOneDeviceFromCohort: async (req, res, next) => {
    try {
      logText("unAssign device....");
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

      const responseFromUnassignDevice = await createCohortUtil.unAssignOneDeviceFromCohort(
        request
      );

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
  getSiteAndDeviceIds: async (req, res, next) => {
    try {
      logText("generate Sites and Devices from provided Grid ID....");
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

      const responseFromGetSiteAndDeviceIds = await createCohortUtil.getSiteAndDeviceIds(
        request
      );

      if (responseFromGetSiteAndDeviceIds.success === true) {
        const status = responseFromGetSiteAndDeviceIds.status
          ? responseFromGetSiteAndDeviceIds.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromGetSiteAndDeviceIds.message,
          sites_and_devices: responseFromGetSiteAndDeviceIds.data,
        });
      } else if (responseFromGetSiteAndDeviceIds.success === false) {
        const status = responseFromGetSiteAndDeviceIds.status
          ? responseFromGetSiteAndDeviceIds.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromGetSiteAndDeviceIds.message,
          errors: responseFromGetSiteAndDeviceIds.errors
            ? responseFromGetSiteAndDeviceIds.errors
            : { message: "Internal Server Error" },
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
      return;
    }
  },
  filterOutPrivateDevices: async (req, res, next) => {
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

      const filterResponse = await createCohortUtil.filterOutPrivateDevices(
        request,
        next
      );
      const status =
        filterResponse.status ||
        (filterResponse.success
          ? httpStatus.OK
          : httpStatus.INTERNAL_SERVER_ERROR);

      res.status(status).json({
        success: filterResponse.success,
        message: filterResponse.message,
        ...(filterResponse.success
          ? { devices: filterResponse.data }
          : {
              errors: filterResponse.errors || {
                message: "Internal Server Error",
              },
            }),
      });
    } catch (error) {
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

module.exports = createCohort;
