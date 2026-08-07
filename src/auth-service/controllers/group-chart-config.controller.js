const httpStatus = require("http-status");
const groupChartConfigUtil = require("@utils/group-chart-config.util");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-chart-config-controller`
);
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");

const sendResponse = (res, result) => {
  if (result.success) {
    res.status(result.status || httpStatus.OK).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } else {
    res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: result.message,
      errors: result.errors,
    });
  }
};

// Every group-chart-config route needs the exact same request shaping:
// grp_id -> params.groupId (deviceId is already in params, courtesy of
// Express's own route matching) and a defaulted tenant — built fresh here
// rather than mutating req.query, since request.query would otherwise be
// the SAME object reference as req.query (a shallow spread copies the key,
// not the object it points to).
// Takes a method NAME, not the function itself — looking it up on
// groupChartConfigUtil fresh on every call (rather than capturing the
// function reference once at module-load time) is what lets
// sinon.stub(groupChartConfigUtil, "create") (etc.) actually take effect in
// tests; capturing the reference up front would freeze in the pre-stub
// implementation.
const makeHandler = (methodName) => async (req, res, next) => {
  try {
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      return next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, errors)
      );
    }

    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    const request = {
      ...req,
      params: { ...req.params, groupId: req.params.grp_id },
      query: {
        ...req.query,
        tenant: isEmpty(req.query.tenant) ? defaultTenant : req.query.tenant,
      },
    };

    const result = await groupChartConfigUtil[methodName](request, next);
    sendResponse(res, result);
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      )
    );
  }
};

const groupChartConfigController = {
  create: makeHandler("create"),
  update: makeHandler("update"),
  delete: makeHandler("delete"),
  list: makeHandler("list"),
  getById: makeHandler("getById"),
};

module.exports = groupChartConfigController;
