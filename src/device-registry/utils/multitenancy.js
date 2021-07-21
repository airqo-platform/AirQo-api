const mongodb = require("../config/database");
const constants = require("../config/constants");
const { logElement, logText, logObject } = require("../utils/log");
const log4js = require("log4js");
const logger = log4js.getLogger("multitenancy");

/****
 * creating a new mongoDB connection by switching tenant
 * using this to create a new connection based on tenant ID
 */
const getTenantDB = (tenantId, modelName, schema) => {
  const dbName = `${constants.DB_NAME}_${tenantId}`;
  if (mongodb) {
    const db = mongodb.useDb(dbName, { useCache: true });
    db.model(modelName, schema);
    return db;
  }
};

const getModelByTenant = (tenantId, modelName, schema) => {
  logElement("tenantId", tenantId);
  const tenantDb = getTenantDB(tenantId, modelName, schema);
  const model = tenantDb.model(modelName);

  model.ensureIndexes(function(err) {
    logger.info("ENSURE INDEX");
    if (err) {
      logger.error(`ensureIndexes -- ${err}`);
    }
  });

  model.on("index", function(err) {
    logger.info("ON INDEX");
    if (err) {
      logger.error(`ensureIndexes -- ${err}`);
    }
  });

  return model;
};

module.exports = { getModelByTenant };
