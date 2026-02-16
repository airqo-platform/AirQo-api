const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- activity-controller`,
);
const createActivityUtil = require("@utils/activity.util");

function handleResponse({
  result,
  key = "data",
  errorKey = "errors",
  res,
} = {}) {
  if (!result) {
    return;
  }

  const isSuccess = result.success;
  const defaultStatus = isSuccess
    ? httpStatus.OK
    : httpStatus.INTERNAL_SERVER_ERROR;

  const defaultMessage = isSuccess
    ? "Operation Successful"
    : "Internal Server Error";

  const status = result.status !== undefined ? result.status : defaultStatus;
  const message =
    result.message !== undefined ? result.message : defaultMessage;
  const data = result.data !== undefined ? result.data : [];
  const errors = isSuccess
    ? undefined
    : result.errors !== undefined
    ? result.errors
    : { message: "Internal Server Error" };

  return res.status(status).json({ message, [key]: data, [errorKey]: errors });
}

// Enhanced helper function to handle deployment logic with support for both static and mobile deployments
const handleDeployment = async (
  req,
  res,
  next,
  deployFunction,
  deploymentType = null,
) => {
  try {
    logText(`deploying${deploymentType ? ` ${deploymentType}` : ""}....`);
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }

    const request = req;
    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    request.query.tenant = isEmpty(req.query.tenant)
      ? defaultTenant
      : req.query.tenant;

    // Determine deployment type from request body
    const { deployment_type, site_id, grid_id } = request.body;
    const actualDeploymentType =
      deployment_type || (site_id ? "static" : grid_id ? "mobile" : "static");

    const result = await deployFunction(request, next);

    if (isEmpty(result) || res.headersSent) {
      return;
    }

    if (result.success === true) {
      const status = result.status ? result.status : httpStatus.OK;
      const response = {
        success: true,
        message: result.message,
        createdActivity: result.data.createdActivity,
        updatedDevice: result.data.updatedDevice,
        user_id: result.data.user_id,
        deployment_type: actualDeploymentType,
      };

      if (deploymentType) {
        response.deployment_method = deploymentType;
      }

      return res.status(status).json(response);
    } else if (result.success === false) {
      const status = result.status
        ? result.status
        : httpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        success: false,
        message: result.message,
        errors: result.errors ? result.errors : { message: "" },
      });
    }
  } catch (error) {
    const errorType = deploymentType
      ? `Deploy ${deploymentType} Error`
      : "Internal Server Error";
    logger.error(`🐛🐛 ${errorType} ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      }),
    );
    return;
  }
};

const activity = {
  deploy: async (req, res, next) => {
    return handleDeployment(req, res, next, createActivityUtil.deploy);
  },

  recalculateNextMaintenance: async (req, res, next) => {
    try {
      logText("Recalculating next maintenance dates...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.recalculateNextMaintenance(
        request,
        next,
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result && result.success) {
        return res.status(result.status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      }

      return res.status(result.status).json({
        success: false,
        message: result.message,
        errors: result.errors ? result.errors : { message: "" },
      });
    } catch (error) {
      logger.error(`🐛🐛 Recalculate Maintenance Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  deployOwnedDevice: async (req, res, next) => {
    return handleDeployment(
      req,
      res,
      next,
      createActivityUtil.deployWithOwnership,
      "owned_device",
    );
  },

  batchDeployWithCoordinates: async (req, res, next) => {
    try {
      logText("we are deploying....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.batchDeployWithCoordinates(
        request,
        next,
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          successful_deployments: result.successful_deployments,
          failed_deployments: result.failed_deployments,
          deployment_summary: result.deployment_summary || {
            static_deployments: result.successful_deployments.filter(
              (d) => d.deployment_type === "static" || !d.deployment_type,
            ).length,
            mobile_deployments: result.successful_deployments.filter(
              (d) => d.deployment_type === "mobile",
            ).length,
            total_successful: result.successful_deployments.length,
            total_failed: result.failed_deployments.length,
          },
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          successful_deployments: result.successful_deployments,
          failed_deployments: result.failed_deployments,
          deployment_summary: result.deployment_summary,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  recall: async (req, res, next) => {
    try {
      logText("we are recalling....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.recall(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          createdActivity: result.data.createdActivity,
          updatedDevice: result.data.updatedDevice,
          user_id: result.data.user_id,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  maintain: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.maintain(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          createdActivity: result.data.createdActivity,
          updatedDevice: result.data.updatedDevice,
          user_id: result.data.user_id,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  bulkAdd: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      logText("adding activities................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  bulkUpdate: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      logText("updating activity................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  update: async (req, res, next) => {
    try {
      logText("updating activity................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.update(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("result", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          meta: result.meta || {},
          activities: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete activity............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.delete(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          deleted_activity: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all activities by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          meta: result.meta || {},
          site_activities: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },
  getDeploymentStats: async (req, res, next) => {
    try {
      logText("retrieving deployment statistics...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.getDeploymentStatistics(
        request,
        next,
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Get Deployment Stats Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },
  getDevicesByDeploymentType: async (req, res, next) => {
    try {
      logText("retrieving devices by deployment type...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.getDevicesByDeploymentType(
        request,
        next,
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
          deployment_type: result.deployment_type,
          total_count: result.total_count,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Get Devices By Type Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },
  deployStatic: async (req, res, next) => {
    try {
      // Enforce deployment type
      req.body.deployment_type = "static";

      // Validate that site_id is provided
      if (!req.body.site_id) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "site_id is required for static deployments",
          errors: { message: "site_id is required for static deployments" },
        });
      }

      // Remove grid_id if accidentally provided
      if (req.body.grid_id) {
        delete req.body.grid_id;
      }

      // Call the standard deploy function
      return handleDeployment(
        req,
        res,
        next,
        createActivityUtil.deploy,
        "static",
      );
    } catch (error) {
      logger.error(`🐛🐛 Deploy Static Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },
  deployMobile: async (req, res, next) => {
    try {
      // Enforce deployment type
      req.body.deployment_type = "mobile";

      // Validate that grid_id is provided
      if (!req.body.grid_id) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "grid_id is required for mobile deployments",
          errors: { message: "grid_id is required for mobile deployments" },
        });
      }

      // Remove site_id if accidentally provided
      if (req.body.site_id) {
        delete req.body.site_id;
      }

      // Set mobile-friendly defaults if not provided
      if (!req.body.mountType) {
        req.body.mountType = "vehicle";
      }

      if (!req.body.powerType) {
        req.body.powerType = "alternator";
      }

      // Call the standard deploy function
      return handleDeployment(
        req,
        res,
        next,
        createActivityUtil.deploy,
        "mobile",
      );
    } catch (error) {
      logger.error(`🐛🐛 Deploy Mobile Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },
  backfillDeviceIds: async (req, res, next) => {
    try {
      logText("Starting device_id backfill process...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.backfillDeviceIds(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Backfill Device IDs Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },
  // In activity.controller.js
  refreshCaches: async (req, res, next) => {
    try {
      logText("Refreshing activity caches...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createActivityUtil.refreshActivityCaches(
        request,
        next,
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Refresh Caches Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },
};

module.exports = activity;
