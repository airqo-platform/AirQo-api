const mongoose = require("mongoose");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");

const healthUtil = {
  getHealth: async (req, next) => {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      const jobStats = global.jobMetrics ? global.jobMetrics.getStats() : {};

      const healthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        },
        jobs: jobStats,
        database:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      };

      return {
        success: true,
        message: "health check successful",
        data: healthStatus,
        status: httpStatus.OK,
      };
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

  getJobMetrics: async (req, next) => {
    try {
      const jobStats = global.jobMetrics ? global.jobMetrics.getStats() : {};
      const cronJobs = global.cronJobs ? Object.keys(global.cronJobs) : [];

      const jobMetrics = {
        metrics: jobStats,
        registeredJobs: cronJobs,
        cronJobsCount: cronJobs.length,
        activeJobDetails: Array.from(jobStats.activeJobs || []).map(
          (jobName) => {
            const jobStartTimes = global.jobMetrics?.jobStartTimes;
            const start = jobStartTimes?.get?.(jobName) || null;
            return {
              name: jobName,
              startTime: start,
              duration: start ? Date.now() - start : null,
            };
          }
        ),
      };

      return {
        success: true,
        message: "job metrics retrieved successfully",
        data: jobMetrics,
        status: httpStatus.OK,
      };
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

module.exports = healthUtil;
