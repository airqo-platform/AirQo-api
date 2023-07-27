const { validationResult } = require("express-validator");
const createLocationHistoryUtil = require("@utils/create-location-history");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
    `${constants.ENVIRONMENT} -- create-location-history-controller`
);

const createLocationHistory = {
    syncLocationHistory: async (req, res) => {
        try {
            logText("Syncing Location History.....");
            const { query } = req;
            let { tenant } = query;
            const hasErrors = !validationResult(req).isEmpty();
            logObject("hasErrors", hasErrors);
            if (hasErrors) {
                let nestedErrors = validationResult(req).errors[0].nestedErrors;
                return badRequest(
                    res,
                    "bad request errors",
                    convertErrorArrayToObject(nestedErrors)
                );
            }

            let request = Object.assign({}, req);
            if (isEmpty(tenant)) {
                request["query"]["tenant"] = constants.DEFAULT_TENANT;
            }

            const responseFromSyncLocationHistories = await createLocationHistoryUtil.syncLocationHistories(
                request
            );

            if (responseFromSyncLocationHistories.success === true) {
                const status = responseFromSyncLocationHistories.status
                    ? responseFromSyncLocationHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromSyncLocationHistories.message
                        ? responseFromSyncLocationHistories.message
                        : "",
                    location_histories: responseFromSyncLocationHistories.data
                        ? responseFromSyncLocationHistories.data
                        : [],
                });
            } else if (responseFromSyncLocationHistories.success === false) {
                const status = responseFromSyncLocationHistories.status
                    ? responseFromSyncLocationHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromSyncLocationHistories.message
                        ? responseFromSyncLocationHistories.message
                        : "",
                    errors: responseFromSyncLocationHistories.errors
                        ? responseFromSyncLocationHistories.errors
                        : { message: "Internal Server Error" },
                });
            }
        } catch (err) {
            logObject("error", error);
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Internal Server Error",
                errors: { message: error.message },
            });
        }

    },

    create: async (req, res) => {
        try {
            logText("creating Location History.....");
            const { query } = req;
            let { tenant } = query;
            const hasErrors = !validationResult(req).isEmpty();
            logObject("hasErrors", hasErrors);
            if (hasErrors) {
                let nestedErrors = validationResult(req).errors[0].nestedErrors;
                return badRequest(
                    res,
                    "bad request errors",
                    convertErrorArrayToObject(nestedErrors)
                );
            }

            let request = Object.assign({}, req);
            if (isEmpty(tenant)) {
                request["query"]["tenant"] = constants.DEFAULT_TENANT;
            }

            const responseFromCreatelocationHistory = await createLocationHistoryUtil.create(
                request
            );

            if (responseFromCreatelocationHistory.success === true) {
                const status = responseFromCreatelocationHistory.status
                    ? responseFromCreatelocationHistory.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromCreatelocationHistory.message
                        ? responseFromCreatelocationHistory.message
                        : "",
                    created_location_history: responseFromCreatelocationHistory.data
                        ? responseFromCreatelocationHistory.data
                        : [],
                });
            } else if (responseFromCreatelocationHistory.success === false) {
                const status = responseFromCreatelocationHistory.status
                    ? responseFromCreatelocationHistory.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromCreatelocationHistory.message
                        ? responseFromCreatelocationHistory.message
                        : "",
                    errors: responseFromCreatelocationHistory.errors
                        ? responseFromCreatelocationHistory.errors
                        : { message: "Internal Server Error" },
                });
            }
        } catch (error) {
            logObject("error", error);
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Internal Server Error",
                errors: { message: error.message },
            });
        }
    },

    list: async (req, res) => {
        console.log("In controller")
        try {
            const { query } = req;
            let { tenant } = query;
            const hasErrors = !validationResult(req).isEmpty();
            logObject("hasErrors", hasErrors);
            if (hasErrors) {
                let nestedErrors = validationResult(req).errors[0].nestedErrors;
                return badRequest(
                    res,
                    "bad request errors",
                    convertErrorArrayToObject(nestedErrors)
                );
            }
            let request = Object.assign({}, req);
            if (isEmpty(tenant)) {
                request["query"]["tenant"] = constants.DEFAULT_TENANT;
            }
            const responseFromListLocationHistories = await createLocationHistoryUtil.list(request);

            if (responseFromListLocationHistories.success === true) {
                const status = responseFromListLocationHistories.status
                    ? responseFromListLocationHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromListLocationHistories.message
                        ? responseFromListLocationHistories.message
                        : "",
                    location_histories: responseFromListLocationHistories.data
                        ? responseFromListLocationHistories.data
                        : [],
                });
            } else if (responseFromListLocationHistories.success === false) {
                const status = responseFromListLocationHistories.status
                    ? responseFromListLocationHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromListLocationHistories.message
                        ? responseFromListLocationHistories.message
                        : "",
                    errors: responseFromListLocationHistories.errors
                        ? responseFromListLocationHistories.errors
                        : { message: "Internal Server Error" },
                });
            }
        } catch (error) {
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Internal Server Error",
                errors: { message: error.message },
            });
        }
    },

    delete: async (req, res) => {
        try {
            const { query } = req;
            let { tenant } = query;
            const hasErrors = !validationResult(req).isEmpty();
            logObject("hasErrors", hasErrors);
            if (hasErrors) {
                let nestedErrors = validationResult(req).errors[0].nestedErrors;
                return badRequest(
                    res,
                    "bad request errors",
                    convertErrorArrayToObject(nestedErrors)
                );
            }

            let request = Object.assign({}, req);
            if (isEmpty(tenant)) {
                request["query"]["tenant"] = constants.DEFAULT_TENANT;
            }
            const responseFromDeleteLocationHistories = await createLocationHistoryUtil.delete(
                request
            );

            if (responseFromDeleteLocationHistories.success === true) {
                const status = responseFromDeleteLocationHistories.status
                    ? responseFromDeleteLocationHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromDeleteLocationHistories.message
                        ? responseFromDeleteLocationHistories.message
                        : "",
                    deleted_location_histories: responseFromDeleteLocationHistories.data
                        ? responseFromDeleteLocationHistories.data
                        : [],
                });
            } else if (responseFromDeleteLocationHistories.success === false) {
                const status = responseFromDeleteLocationHistories.status
                    ? responseFromDeleteLocationHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromDeleteLocationHistories.message
                        ? responseFromDeleteLocationHistories.message
                        : "",
                    errors: responseFromDeleteLocationHistories.errors
                        ? responseFromDeleteLocationHistories.errors
                        : { message: "Internal Server Error" },
                });
            }
        } catch (error) {
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Internal Server Error",
                errors: { message: error.message },
            });
        }
    },

    update: async (req, res) => {
        try {
            const { query } = req;
            let { tenant } = query;
            const hasErrors = !validationResult(req).isEmpty();
            logObject("hasErrors", hasErrors);
            if (hasErrors) {
                let nestedErrors = validationResult(req).errors[0].nestedErrors;
                return badRequest(
                    res,
                    "bad request errors",
                    convertErrorArrayToObject(nestedErrors)
                );
            }

            let request = Object.assign({}, req);
            if (isEmpty(tenant)) {
                request["query"]["tenant"] = constants.DEFAULT_TENANT;
            }
            const responseFromUpdateLocationHistories = await createLocationHistoryUtil.update(
                request
            );

            if (responseFromUpdateLocationHistories.success === true) {
                const status = responseFromUpdateLocationHistories.status
                    ? responseFromUpdateLocationHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromUpdateLocationHistories.message
                        ? responseFromUpdateLocationHistories.message
                        : "",
                    updated_location_history: responseFromUpdateLocationHistories.data
                        ? responseFromUpdateLocationHistories.data
                        : [],
                });
            } else if (responseFromUpdateLocationHistories.success === false) {
                const status = responseFromUpdateLocationHistories.status
                    ? responseFromUpdateLocationHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromUpdateLocationHistories.message
                        ? responseFromUpdateLocationHistories.message
                        : "",
                    errors: responseFromUpdateLocationHistories.errors
                        ? responseFromUpdateLocationHistories.errors
                        : { message: "Internal Server Error" },
                });
            }
        } catch (error) {
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Internal Server Error",
                errors: { message: error.message },
            });
        }
    },
};

module.exports = createLocationHistory;
