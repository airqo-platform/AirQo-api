const httpStatus = require("http-status");
const moment = require("moment-timezone");
const constants = require("@config/constants");
const usageUtil = require("@utils/usage.util");
const usageRecorder = require("@utils/usage-recorder.util");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- usage-controller`);

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error && error.stack}`);
  if (error instanceof HttpError) return next(error);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message:
        process.env.NODE_ENV !== "production"
          ? error.message
          : "An unexpected error occurred",
    }),
  );
};

const prepare = (req, next, { needsMonth = false } = {}) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }
  req.query = req.query || {};
  req.query.tenant = req.query.tenant || constants.DEFAULT_TENANT || "airqo";
  if (needsMonth && !req.query.month) {
    req.query.month = moment.utc().format("YYYY-MM");
  }
  return req;
};

const sendResult = (res, result) => {
  if (res.headersSent) return;
  if (result.success && result.csv !== undefined) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    return res.status(result.status).send(result.csv);
  }
  if (result.success) {
    return res
      .status(result.status)
      .json({ success: true, message: result.message, data: result.data });
  }
  return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: result.message,
    errors: result.errors,
  });
};

const handler = (fn, options) => async (req, res, next) => {
  try {
    const request = prepare(req, next, options);
    if (!request) return;
    sendResult(res, await fn(request));
  } catch (error) {
    handleError(error, next);
  }
};

const usage = {
  userCalendar: handler(usageUtil.userCalendar),
  userSummary: handler(usageUtil.userSummary, { needsMonth: true }),
  userBreakdown: handler(usageUtil.userBreakdown, { needsMonth: true }),
  userTimeline: handler(usageUtil.userTimeline),
  userRhythm: handler(usageUtil.userRhythm),
  overview: handler(usageUtil.usageOverview, { needsMonth: true }),
  pages: handler(usageUtil.usagePages, { needsMonth: true }),
  users: handler(usageUtil.usageUsers, { needsMonth: true }),
  retention: handler(usageUtil.usageRetention),

  /**
   * Page-event beacon. Acknowledges immediately; the events only touch the
   * in-memory recorder, so this endpoint adds no database work per request.
   */
  recordEvents: async (req, res, next) => {
    try {
      const request = prepare(req, next);
      if (!request) return;
      const accepted = usageRecorder.recordPageEvents({
        tenant: request.query.tenant,
        user: request.user,
        events: request.body.events,
      });
      return res.status(httpStatus.ACCEPTED).json({
        success: true,
        message: "events accepted",
        accepted,
      });
    } catch (error) {
      handleError(error, next);
    }
  },
};

module.exports = usage;
