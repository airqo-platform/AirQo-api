"use strict";
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const DeviceBulkUpdateJobModel = require("@models/DeviceBulkUpdateJob");
const DeviceModel = require("@models/Device");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const qs = require("qs");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device-bulk-update-job-util`
);

const deviceBulkUpdateJobUtil = {
  // ── Create ──────────────────────────────────────────────────────────────────
  create: async (request, next) => {
    try {
      const tenant =
        request.query.tenant || constants.DEFAULT_TENANT || "airqo";
      const { name, description, filter, updateData, batchSize, dryRun, createdBy } =
        request.body;

      // Confirm the filter would actually match at least one device before
      // persisting the job, so we fail-fast on typos in the filter.
      const matchCount = await DeviceModel(tenant).countDocuments(filter);
      if (matchCount === 0) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message:
              "The provided filter matches 0 devices. Verify the filter criteria before creating the job.",
            filter,
          })
        );
      }

      const job = await DeviceBulkUpdateJobModel(tenant).create({
        name,
        description,
        tenant,
        filter,
        updateData,
        batchSize: batchSize || 30,
        dryRun: dryRun || false,
        createdBy,
      });

      logger.info(
        `Bulk update job "${name}" created (${job._id}). Matches ${matchCount} device(s).`
      );

      return {
        success: true,
        message: `Bulk update job created. ${matchCount} device(s) match the filter.`,
        data: job,
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error(`🐛🐛 deviceBulkUpdateJobUtil.create: ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ── List ────────────────────────────────────────────────────────────────────
  list: async (request, next) => {
    try {
      const tenant =
        request.query.tenant || constants.DEFAULT_TENANT || "airqo";
      const {
        status,
        limit: rawLimit,
        skip: rawSkip,
      } = request.query;

      const _limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20));
      const _skip = Math.max(0, parseInt(rawSkip, 10) || 0);

      const filter = { tenant };
      if (status) filter.status = status;

      const [jobs, total] = await Promise.all([
        DeviceBulkUpdateJobModel(tenant)
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(_skip)
          .limit(_limit)
          .lean(),
        DeviceBulkUpdateJobModel(tenant).countDocuments(filter),
      ]);

      const baseUrl =
        typeof request.protocol === "string" &&
        typeof request.get === "function"
          ? `${request.protocol}://${request.get("host")}${
              request.originalUrl.split("?")[0]
            }`
          : "";

      const meta = {
        total,
        totalResults: jobs.length,
        limit: _limit,
        skip: _skip,
        page: Math.floor(_skip / _limit) + 1,
        totalPages: Math.ceil(total / _limit),
      };

      if (baseUrl) {
        if (_skip + _limit < total) {
          meta.nextPage = `${baseUrl}?${qs.stringify({
            ...request.query,
            skip: _skip + _limit,
            limit: _limit,
          })}`;
        }
        if (_skip > 0) {
          meta.previousPage = `${baseUrl}?${qs.stringify({
            ...request.query,
            skip: Math.max(0, _skip - _limit),
            limit: _limit,
          })}`;
        }
      }

      return {
        success: true,
        message: isEmpty(jobs)
          ? "No bulk update jobs found"
          : "Successfully retrieved bulk update jobs",
        data: jobs,
        meta,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 deviceBulkUpdateJobUtil.list: ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ── Get one ─────────────────────────────────────────────────────────────────
  get: async (request, next) => {
    try {
      const tenant =
        request.query.tenant || constants.DEFAULT_TENANT || "airqo";
      const { jobId } = request.params;

      const job = await DeviceBulkUpdateJobModel(tenant)
        .findById(jobId)
        .lean();

      if (!job) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Bulk update job ${jobId} not found`,
          })
        );
      }

      // Attach a live progress percentage for convenience.
      const progress =
        job.totalDevices && job.totalDevices > 0
          ? Math.round((job.processedCount / job.totalDevices) * 100)
          : null;

      return {
        success: true,
        message: "Successfully retrieved bulk update job",
        data: { ...job, progress },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 deviceBulkUpdateJobUtil.get: ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ── Update (pause / resume / cancel / patch settings) ───────────────────────
  update: async (request, next) => {
    try {
      const tenant =
        request.query.tenant || constants.DEFAULT_TENANT || "airqo";
      const { jobId } = request.params;
      const { status, description, batchSize, dryRun } = request.body;

      const job = await DeviceBulkUpdateJobModel(tenant).findById(jobId);
      if (!job) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Bulk update job ${jobId} not found`,
          })
        );
      }

      // Completed / cancelled jobs are immutable — no field can be changed.
      // Create a new job instead.
      if (["completed", "cancelled"].includes(job.status)) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: `A ${job.status} job cannot be modified. Create a new job instead.`,
          })
        );
      }

      const patch = {};
      if (status !== undefined) patch.status = status;
      if (description !== undefined) patch.description = description;
      if (batchSize !== undefined) patch.batchSize = batchSize;
      if (dryRun !== undefined) patch.dryRun = dryRun;

      const updated = await DeviceBulkUpdateJobModel(tenant)
        .findByIdAndUpdate(jobId, { $set: patch }, { new: true })
        .lean();

      return {
        success: true,
        message: "Bulk update job updated",
        data: updated,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 deviceBulkUpdateJobUtil.update: ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ── Delete ──────────────────────────────────────────────────────────────────
  delete: async (request, next) => {
    try {
      const tenant =
        request.query.tenant || constants.DEFAULT_TENANT || "airqo";
      const { jobId } = request.params;

      const job = await DeviceBulkUpdateJobModel(tenant).findById(jobId);
      if (!job) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Bulk update job ${jobId} not found`,
          })
        );
      }

      if (job.status === "running") {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message:
              "Cannot delete a running job. Pause or cancel it first, then delete.",
          })
        );
      }

      await DeviceBulkUpdateJobModel(tenant).findByIdAndDelete(jobId);

      return {
        success: true,
        message: "Bulk update job deleted",
        data: { jobId },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 deviceBulkUpdateJobUtil.delete: ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ── Manual trigger ───────────────────────────────────────────────────────────
  trigger: async (request, next) => {
    try {
      const tenant =
        request.query.tenant || constants.DEFAULT_TENANT || "airqo";
      const { jobId } = request.params;

      const job = await DeviceBulkUpdateJobModel(tenant)
        .findById(jobId)
        .lean();

      if (!job) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Bulk update job ${jobId} not found`,
          })
        );
      }

      if (job.status === "running") {
        return next(
          new HttpError("Conflict", httpStatus.CONFLICT, {
            message: "Job is already running.",
          })
        );
      }

      if (job.status === "cancelled") {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message:
              "A cancelled job cannot be re-triggered. Create a new job instead.",
          })
        );
      }

      // Set to pending — the job runner will pick it up.
      await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
        $set: { status: "pending" },
      });

      // Fire-and-forget — the runner handles its own error logging.
      const runPendingBulkUpdateJobs = require("@bin/jobs/device-bulk-update-job");
      runPendingBulkUpdateJobs(tenant).catch((err) =>
        logger.error(`🐛🐛 trigger fire-and-forget error: ${err.message}`)
      );

      return {
        success: true,
        message: "Job queued for immediate execution.",
        data: { jobId, status: "pending" },
        status: httpStatus.ACCEPTED,
      };
    } catch (error) {
      logger.error(`🐛🐛 deviceBulkUpdateJobUtil.trigger: ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

module.exports = deviceBulkUpdateJobUtil;
