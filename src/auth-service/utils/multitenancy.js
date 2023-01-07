const mongodb = require("../config/dbConnection");
const constants = require("../config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- multitenancy-util`
);

/****
 * creating a new mongoDB connection by switching tenant
 * using this to create a new connection based on tenant ID
 */
function getTenantDB(tenantId, modelName, schema) {
  const dbName = `${constants.DB_NAME}_${tenantId}`;
  if (mongodb) {
    const db = mongodb.useDb(dbName, { useCache: true });
    db.model(modelName, schema);
    return db;
  }
}

/****
   * return model as per tenant
  we shall use this to create the model
  afterwards, we can be able to use this model to carry out any kinds of CRUD
   */
function getModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

module.exports = { getModelByTenant };
