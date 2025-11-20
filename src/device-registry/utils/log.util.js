const ActivityLogModel = require("@models/ActivityLog");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const { generateFilter } = require("@utils/common");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- log-util`);

const logUtil = {
  list: async (request, next) => {
    try {
      const { tenant, limit, skip, sortBy, order, detailLevel } = request.query;
      const filter = generateFilter.logs(request, next);

      const response = await ActivityLogModel(tenant).list(
        {
          filter,
          limit,
          skip,
          sortBy,
          order,
          detailLevel,
        },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = logUtil;
