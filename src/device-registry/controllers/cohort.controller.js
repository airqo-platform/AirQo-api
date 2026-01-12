const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const createCohortUtil = require("@utils/cohort.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- cohort-controller`
);
const isEmpty = require("is-empty");

const handleRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }
  const request = req;
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  request.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;
  return request;
};

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

function handleResponse({ res, result, key = "data" }) {
  if (!result || res.headersSent) {
    return;
  }

  const { success, status, data, message, errors, ...rest } = result;

  const responseStatus =
    status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (success) {
    const responseBody = {
      success: true,
      message: message || "Operation Successful",
      ...rest,
    };
    if (data !== undefined) {
      responseBody[key] = data;
    }
    return res.status(responseStatus).json(responseBody);
  } else {
    return res.status(responseStatus).json({
      success: false,
      message: message || "An unexpected error occurred.",
      errors: errors || { message: "An unexpected error occurred." },
    });
  }
}

const createCohort = {
  createFromCohorts: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.createCohortFromCohortIDs(
        request,
        next
      );
      handleResponse({ res, result });
    } catch (error) {
      handleError(error, next);
    }
  },
  createNetwork: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.createNetwork(request, next);
      handleResponse({ res, result, key: "new_network" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listNetworks: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.listNetworks(request, next);
      handleResponse({ res, result, key: "networks" });
    } catch (error) {
      handleError(error, next);
    }
  },
  updateNetwork: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.updateNetwork(request, next);
      handleResponse({ res, result, key: "updated_network" });
    } catch (error) {
      handleError(error, next);
    }
  },
  deleteNetwork: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.deleteNetwork(request, next);
      handleResponse({ res, result, key: "deleted_network" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listUserCohorts: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.listUserCohorts(request, next);
      handleResponse({ res, result, key: "cohorts" });
    } catch (error) {
      handleError(error, next);
    }
  },
  list: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.list(request, next);
      handleResponse({ res, result, key: "cohorts" });
    } catch (error) {
      handleError(error, next);
    }
  },
  verify: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.verify(request, next);
      handleResponse({ res, result });
    } catch (error) {
      handleError(error, next);
    }
  },
  update: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.update(request, next);
      handleResponse({ res, result, key: "cohort" });
    } catch (error) {
      handleError(error, next);
    }
  },
  updateName: async (req, res, next) => {
    try {
      logText("updating cohort name................");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.updateName(request, next);
      handleResponse({ res, result, key: "cohort" });
    } catch (error) {
      handleError(error, next);
    }
  },
  delete: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.delete(request, next);
      handleResponse({ res, result, key: "cohort" });
    } catch (error) {
      handleError(error, next);
    }
  },
  create: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.create(request, next);
      handleResponse({ res, result, key: "cohort" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all cohorts by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.detailLevel = "summary";

      const result = await createCohortUtil.list(request, next);
      handleResponse({ res, result, key: "cohorts" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listDashboard: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all cohorts by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.detailLevel = "full";

      const result = await createCohortUtil.list(request, next);
      handleResponse({ res, result, key: "cohorts" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listAvailableDevices: async (req, res, next) => {
    try {
      logText("listing available devices....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.listAvailableDevices(request, next);
      handleResponse({ res, result, key: "available_devices" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listAssignedDevices: async (req, res, next) => {
    try {
      logText("listing assigned devices....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.listAssignedDevices(request, next);
      handleResponse({ res, result, key: "assigned_devices" });
    } catch (error) {
      handleError(error, next);
    }
  },
  assignManyDevicesToCohort: async (req, res, next) => {
    try {
      logText("assign many devices....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.assignManyDevicesToCohort(
        request,
        next
      );
      handleResponse({ res, result, key: "updated_cohort" });
    } catch (error) {
      handleError(error, next);
    }
  },
  unAssignManyDevicesFromCohort: async (req, res, next) => {
    try {
      logText("unAssign device....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.unAssignManyDevicesFromCohort(
        request,
        next
      );
      handleResponse({ res, result, key: "updated_records" });
    } catch (error) {
      handleError(error, next);
    }
  },
  assignOneDeviceToCohort: async (req, res, next) => {
    try {
      logText("assign one device....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.assignOneDeviceToCohort(
        request,
        next
      );
      handleResponse({ res, result, key: "updated_records" });
    } catch (error) {
      handleError(error, next);
    }
  },
  unAssignOneDeviceFromCohort: async (req, res, next) => {
    try {
      logText("unAssign device....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.unAssignOneDeviceFromCohort(
        request,
        next
      );
      handleResponse({ res, result, key: "updated_records" });
    } catch (error) {
      handleError(error, next);
    }
  },
  getSiteAndDeviceIds: async (req, res, next) => {
    try {
      logText("generate Sites and Devices from provided Grid ID....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.getSiteAndDeviceIds(request, next);
      handleResponse({ res, result, key: "sites_and_devices" });
    } catch (error) {
      handleError(error, next);
    }
  },
  filterOutPrivateDevices: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.filterOutPrivateDevices(
        request,
        next
      );
      handleResponse({ res, result, key: "devices" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listDevicesByCohort: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.listDevices(request, next);
      handleResponse({ res, result, key: "devices" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listSitesByCohort: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createCohortUtil.listSites(request, next);
      handleResponse({ res, result, key: "sites" });
    } catch (error) {
      handleError(error, next);
    }
  },
};

module.exports = createCohort;
