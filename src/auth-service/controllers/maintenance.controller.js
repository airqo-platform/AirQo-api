const maintenanceUtil = require("@utils/maintenance.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- maintenances-controller`
);
const { createControllerHandler } = require("@utils/shared");

const maintenances = {
  update: createControllerHandler(
    maintenanceUtil.update,
    "maintenance",
    logger
  ),
  create: createControllerHandler(
    maintenanceUtil.create,
    "maintenance",
    logger
  ),
  list: async (req, res, next) => {
    return createControllerHandler(maintenanceUtil.list, "maintenance", logger)(
      req,
      res,
      next
    );
  },
  delete: async (req, res, next) => {
    return createControllerHandler(
      maintenanceUtil.delete,
      "maintenance",
      logger
    )(req, res, next);
  },
};

module.exports = maintenances;
