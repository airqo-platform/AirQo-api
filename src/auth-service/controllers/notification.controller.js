const notificationUtil = require("@utils/notification.util");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- notification-controller`,
);

/**
 * Wraps a notification util in the service's standard controller flow:
 * validation errors -> 400, default tenant, then success/failure mapping.
 * `dataKey` names the response field that carries result.data.
 */
const handle = (utilFn, dataKey) => async (req, res, next) => {
  try {
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }
    const request = req;
    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    request.query.tenant = isEmpty(req.query.tenant)
      ? defaultTenant
      : req.query.tenant;

    const result = await utilFn(request, next);

    if (isEmpty(result) || res.headersSent) {
      return;
    }

    if (result.success === true) {
      const status = result.status ? result.status : httpStatus.OK;
      return res.status(status).json({
        success: true,
        message: result.message ? result.message : "",
        [dataKey]: result.data !== undefined ? result.data : [],
        ...(result.meta ? { meta: result.meta } : {}),
      });
    } else if (result.success === false) {
      const status = result.status
        ? result.status
        : httpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        success: false,
        message: result.message ? result.message : "",
        errors: result.errors ? result.errors : { message: "" },
      });
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      }),
    );
    return;
  }
};

const notification = {
  list: handle(notificationUtil.list, "notifications"),
  getUnreadCount: handle(notificationUtil.getUnreadCount, "data"),
  markRead: handle(notificationUtil.markRead, "notification"),
  markAllRead: handle(notificationUtil.markAllRead, "data"),
  delete: handle(notificationUtil.delete, "notification"),
  sendToGroup: handle(notificationUtil.sendToGroup, "data"),
  broadcast: handle(notificationUtil.broadcast, "data"),
};

module.exports = notification;
