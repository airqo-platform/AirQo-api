const httpStatus = require("http-status");
const healthUtil = require("@utils/health.util");
const { HttpError } = require("@utils/shared");

const healthController = {
  check: async (req, res, next) => {
    try {
      const result = await healthUtil.getHealth(req, next);
      if (result && result.success) {
        return res.status(result.status).json(result.data);
      }

      const status =
        (result && result.status) || httpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        success: false,
        message: (result && result.message) || "health check failed",
        errors: result ? result.errors : undefined,
      });
    } catch (error) {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getJobMetrics: async (req, res, next) => {
    try {
      const result = await healthUtil.getJobMetrics(req, next);
      if (result && result.success) {
        return res.status(result.status).json(result.data);
      }

      const status =
        (result && result.status) || httpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        success: false,
        message: (result && result.message) || "job metrics retrieval failed",
        errors: result ? result.errors : undefined,
      });
    } catch (error) {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = healthController;
