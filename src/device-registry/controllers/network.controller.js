"use strict";
const httpStatus = require("http-status");
const {
  logObject,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const networkUtil = require("@utils/network.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-controller`
);
const isEmpty = require("is-empty");

// ── Shared request/response helpers (identical pattern to cohort.controller) ──

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
  if (!result || res.headersSent) return;

  const { success, status, data, message, errors, ...rest } = result;
  const responseStatus =
    status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (success) {
    const responseBody = {
      success: true,
      message: message || "Operation Successful",
      ...rest,
    };
    if (data !== undefined) responseBody[key] = data;
    return res.status(responseStatus).json(responseBody);
  }

  return res.status(responseStatus).json({
    success: false,
    message: message || "An unexpected error occurred.",
    errors: errors || { message: "An unexpected error occurred." },
  });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

const createNetwork = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result = await networkUtil.createNetwork(request, next);
    handleResponse({ res, result, key: "new_network" });
  } catch (error) {
    handleError(error, next);
  }
};

const listNetworks = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result = await networkUtil.listNetworks(request, next);
    handleResponse({ res, result, key: "networks" });
  } catch (error) {
    handleError(error, next);
  }
};

const getNetwork = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result = await networkUtil.getNetwork(request, next);
    handleResponse({ res, result, key: "network" });
  } catch (error) {
    handleError(error, next);
  }
};

const updateNetwork = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result = await networkUtil.updateNetwork(request, next);
    handleResponse({ res, result, key: "updated_network" });
  } catch (error) {
    handleError(error, next);
  }
};

const deleteNetwork = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result = await networkUtil.deleteNetwork(request, next);
    handleResponse({ res, result, key: "deleted_network" });
  } catch (error) {
    handleError(error, next);
  }
};

module.exports = {
  createNetwork,
  listNetworks,
  getNetwork,
  updateNetwork,
  deleteNetwork,
};
