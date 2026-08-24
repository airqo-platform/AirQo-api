const mongoose = require("mongoose");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { redisUtils } = require("@config/redis");
const { getConnectionStatus } = require("@config/database");

const healthUtil = {
  getHealth: async (req, next) => {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      const redisStatus = redisUtils.getStatus();
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
        redis: redisStatus,
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

  /**
   * Readiness check for the k8s readinessProbe. Unlike getHealth (liveness —
   * only confirms the process is up), this gates on the command/query/snapshot
   * Mongo connections actually being open, so the Service holds traffic back
   * from a pod until it's past the cold-start buffering window.
   */
  getReadiness: async (req, next) => {
    try {
      const dbStatus = getConnectionStatus();

      if (!dbStatus.ready) {
        return {
          success: false,
          message: "not ready",
          status: httpStatus.SERVICE_UNAVAILABLE,
          data: { status: "not_ready", database: dbStatus },
        };
      }

      return {
        success: true,
        message: "ready",
        status: httpStatus.OK,
        data: { status: "ready", database: dbStatus },
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
