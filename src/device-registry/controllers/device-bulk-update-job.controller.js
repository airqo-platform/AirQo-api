"use strict";
const httpStatus = require("http-status");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const bulkUpdateJobUtil = require("@utils/device-bulk-update-job.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device-bulk-update-job-controller`
);

// ── Shared helpers (same pattern as network.controller) ───────────────────────

const handleRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }
  const request = req;
  request.query.tenant = isEmpty(req.query.tenant)
    ? constants.DEFAULT_TENANT || "airqo"
    : req.query.tenant;
  return request;
};

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error: ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

function handleResponse({ res, result, key = "data" }) {
  if (!result || res.headersSent) return;
  const { success, status, data, message, errors, meta } = result;
  const responseStatus =
    status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (success) {
    const body = { success: true, message: message || "Operation successful" };
    if (meta !== undefined) body.meta = meta;
    if (data !== undefined) body[key] = data;
    return res.status(responseStatus).json(body);
  }

  return res.status(responseStatus).json({
    success: false,
    message: message || "An unexpected error occurred.",
    errors: errors || { message: "An unexpected error occurred." },
  });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

const createBulkUpdateJob = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;
    const result = await bulkUpdateJobUtil.create(request, next);
    handleResponse({ res, result, key: "job" });
  } catch (error) {
    handleError(error, next);
  }
};

const listBulkUpdateJobs = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;
    const result = await bulkUpdateJobUtil.list(request, next);
    handleResponse({ res, result, key: "jobs" });
  } catch (error) {
    handleError(error, next);
  }
};

const getBulkUpdateJob = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;
    const result = await bulkUpdateJobUtil.get(request, next);
    handleResponse({ res, result, key: "job" });
  } catch (error) {
    handleError(error, next);
  }
};

const updateBulkUpdateJob = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;
    const result = await bulkUpdateJobUtil.update(request, next);
    handleResponse({ res, result, key: "job" });
  } catch (error) {
    handleError(error, next);
  }
};

const deleteBulkUpdateJob = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;
    const result = await bulkUpdateJobUtil.delete(request, next);
    handleResponse({ res, result, key: "job" });
  } catch (error) {
    handleError(error, next);
  }
};

const triggerBulkUpdateJob = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;
    const result = await bulkUpdateJobUtil.trigger(request, next);
    handleResponse({ res, result, key: "job" });
  } catch (error) {
    handleError(error, next);
  }
};

module.exports = {
  createBulkUpdateJob,
  listBulkUpdateJobs,
  getBulkUpdateJob,
  updateBulkUpdateJob,
  deleteBulkUpdateJob,
  triggerBulkUpdateJob,
};
