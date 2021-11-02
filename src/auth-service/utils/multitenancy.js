const mongodb = require("../config/dbConnection");
const constants = require("../config/constants");
const { logElement, logText, logObject } = require("../utils/log");

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

/****
   * return model as per tenant
  we shall use this to create the model
  afterwards, we can be able to use this model to carry out any kinds of CRUD
   */
const getModelByTenant = (tenantId, modelName, schema) => {
  logElement("organisation", tenantId);
  const tenantDb = getTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
};

module.exports = { getModelByTenant };
