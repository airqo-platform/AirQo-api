const { validationResult } = require("express-validator");
const createSearchHistoryUtil = require("@utils/create-search-history");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
    `${constants.ENVIRONMENT} -- create-search-history-controller`
);

const createSearchHistory = {
    syncSearchHistory: async (req, res) => {
        try {
            logText("Syncing Search History.....");
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

            const responseFromSyncSearchHistories = await createSearchHistoryUtil.syncSearchHistories(
                request
            );

            if (responseFromSyncSearchHistories.success === true) {
                const status = responseFromSyncSearchHistories.status
                    ? responseFromSyncSearchHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromSyncSearchHistories.message
                        ? responseFromSyncSearchHistories.message
                        : "",
                    search_histories: responseFromSyncSearchHistories.data
                        ? responseFromSyncSearchHistories.data
                        : [],
                });
            } else if (responseFromSyncSearchHistories.success === false) {
                const status = responseFromSyncSearchHistories.status
                    ? responseFromSyncSearchHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromSyncSearchHistories.message
                        ? responseFromSyncSearchHistories.message
                        : "",
                    errors: responseFromSyncSearchHistories.errors
                        ? responseFromSyncSearchHistories.errors
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
            logText("creating Search History.....");
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

            const responseFromCreatesearchHistory = await createSearchHistoryUtil.create(
                request
            );

            if (responseFromCreatesearchHistory.success === true) {
                const status = responseFromCreatesearchHistory.status
                    ? responseFromCreatesearchHistory.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromCreatesearchHistory.message
                        ? responseFromCreatesearchHistory.message
                        : "",
                    created_search_history: responseFromCreatesearchHistory.data
                        ? responseFromCreatesearchHistory.data
                        : [],
                });
            } else if (responseFromCreatesearchHistory.success === false) {
                const status = responseFromCreatesearchHistory.status
                    ? responseFromCreatesearchHistory.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromCreatesearchHistory.message
                        ? responseFromCreatesearchHistory.message
                        : "",
                    errors: responseFromCreatesearchHistory.errors
                        ? responseFromCreatesearchHistory.errors
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
            const responseFromListSearchHistories = await createSearchHistoryUtil.list(request);

            if (responseFromListSearchHistories.success === true) {
                const status = responseFromListSearchHistories.status
                    ? responseFromListSearchHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromListSearchHistories.message
                        ? responseFromListSearchHistories.message
                        : "",
                    search_histories: responseFromListSearchHistories.data
                        ? responseFromListSearchHistories.data
                        : [],
                });
            } else if (responseFromListSearchHistories.success === false) {
                const status = responseFromListSearchHistories.status
                    ? responseFromListSearchHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromListSearchHistories.message
                        ? responseFromListSearchHistories.message
                        : "",
                    errors: responseFromListSearchHistories.errors
                        ? responseFromListSearchHistories.errors
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
            const responseFromDeleteSearchHistories = await createSearchHistoryUtil.delete(
                request
            );

            if (responseFromDeleteSearchHistories.success === true) {
                const status = responseFromDeleteSearchHistories.status
                    ? responseFromDeleteSearchHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromDeleteSearchHistories.message
                        ? responseFromDeleteSearchHistories.message
                        : "",
                    deleted_search_histories: responseFromDeleteSearchHistories.data
                        ? responseFromDeleteSearchHistories.data
                        : [],
                });
            } else if (responseFromDeleteSearchHistories.success === false) {
                const status = responseFromDeleteSearchHistories.status
                    ? responseFromDeleteSearchHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromDeleteSearchHistories.message
                        ? responseFromDeleteSearchHistories.message
                        : "",
                    errors: responseFromDeleteSearchHistories.errors
                        ? responseFromDeleteSearchHistories.errors
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
            const responseFromUpdateSearchHistories = await createSearchHistoryUtil.update(
                request
            );

            if (responseFromUpdateSearchHistories.success === true) {
                const status = responseFromUpdateSearchHistories.status
                    ? responseFromUpdateSearchHistories.status
                    : httpStatus.OK;
                return res.status(status).json({
                    success: true,
                    message: responseFromUpdateSearchHistories.message
                        ? responseFromUpdateSearchHistories.message
                        : "",
                    updated_search_history: responseFromUpdateSearchHistories.data
                        ? responseFromUpdateSearchHistories.data
                        : [],
                });
            } else if (responseFromUpdateSearchHistories.success === false) {
                const status = responseFromUpdateSearchHistories.status
                    ? responseFromUpdateSearchHistories.status
                    : httpStatus.INTERNAL_SERVER_ERROR;
                return res.status(status).json({
                    success: false,
                    message: responseFromUpdateSearchHistories.message
                        ? responseFromUpdateSearchHistories.message
                        : "",
                    errors: responseFromUpdateSearchHistories.errors
                        ? responseFromUpdateSearchHistories.errors
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

module.exports = createSearchHistory;