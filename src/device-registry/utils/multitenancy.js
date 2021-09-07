const mongodb = require("../config/database");
const constants = require("../config/constants");
const { logElement, logText, logObject } = require("../utils/log");
const log4js = require("log4js");
const logger = log4js.getLogger("multitenancy");

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
  return tenantDb.model(modelName);
};

module.exports = { getModelByTenant };
