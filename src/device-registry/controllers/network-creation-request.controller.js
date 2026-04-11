"use strict";
const httpStatus = require("http-status");
const {
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const networkCreationRequestUtil = require("@utils/network-creation-request.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-creation-request-controller`
);
const isEmpty = require("is-empty");

// ── Shared request/response helpers ──────────────────────────────────────────

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

const createRequest = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result =
      await networkCreationRequestUtil.createNetworkCreationRequest(
        request,
        next
      );
    handleResponse({
      res,
      result,
      key: "network_creation_request",
    });
  } catch (error) {
    handleError(error, next);
  }
};

const listRequests = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result =
      await networkCreationRequestUtil.listNetworkCreationRequests(
        request,
        next
      );
    handleResponse({ res, result, key: "network_creation_requests" });
  } catch (error) {
    handleError(error, next);
  }
};

const getRequest = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result =
      await networkCreationRequestUtil.getNetworkCreationRequest(request, next);
    handleResponse({ res, result, key: "network_creation_request" });
  } catch (error) {
    handleError(error, next);
  }
};

const approveRequest = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result =
      await networkCreationRequestUtil.approveNetworkCreationRequest(
        request,
        next
      );
    handleResponse({ res, result, key: "approval" });
  } catch (error) {
    handleError(error, next);
  }
};

const denyRequest = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result =
      await networkCreationRequestUtil.denyNetworkCreationRequest(request, next);
    handleResponse({ res, result, key: "denied_request" });
  } catch (error) {
    handleError(error, next);
  }
};

const reviewRequest = async (req, res, next) => {
  try {
    const request = handleRequest(req, next);
    if (!request) return;

    const result =
      await networkCreationRequestUtil.reviewNetworkCreationRequest(
        request,
        next
      );
    handleResponse({ res, result, key: "reviewed_request" });
  } catch (error) {
    handleError(error, next);
  }
};

module.exports = {
  createRequest,
  listRequests,
  getRequest,
  approveRequest,
  denyRequest,
  reviewRequest,
};
