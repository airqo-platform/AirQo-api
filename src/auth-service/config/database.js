const mongoose = require("mongoose");
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("debug", false);
const constants = require("./constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- config-database`);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const COMMAND_URI = constants.COMMAND_MONGO_URI || constants.MONGO_URI || "";
const QUERY_URI = constants.QUERY_MONGO_URI || constants.MONGO_URI || "";

const options = {
  useCreateIndex: true,
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
  autoIndex: true,
  poolSize: 10,
  bufferMaxEntries: 0,
  connectTimeoutMS: 1200000,
  socketTimeoutMS: 600000,
  serverSelectionTimeoutMS: 3600000,
};

// Create separate connection instances for command and query
const createCommandConnection = () =>
  mongoose.createConnection(COMMAND_URI, {
    ...options,
    dbName: `${constants.DB_NAME}_command`,
  });

const createQueryConnection = () =>
  mongoose.createConnection(QUERY_URI, {
    ...options,
    dbName: `${constants.DB_NAME}_query`,
  });

// Connection storage
let commandDB = null;
let queryDB = null;

const setupConnectionHandlers = (db, dbType) => {
  db.on("open", () => {
    // logger.info(`Connected to ${dbType} database`);
  });

  db.on("error", (err) => {
    logger.error(`${dbType} database connection error: ${err.message}`);
  });

  db.on("disconnected", () => {
    logger.warn(`${dbType} database disconnected`);
  });
};

const connectToMongoDB = () => {
  try {
    // Connect to command database
    commandDB = createCommandConnection();
    setupConnectionHandlers(commandDB, "command");

    // Connect to query database
    queryDB = createQueryConnection();
    setupConnectionHandlers(queryDB, "query");

    // Error handling for the Node process
    process.on("unhandledRejection", (reason, p) => {
      logger.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    });

    process.on("uncaughtException", (err) => {
      logger.error("There was an uncaught error", err);
    });

    return { commandDB, queryDB };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    throw error;
  }
};

// Initialize connections
const { commandDB: commandMongoDB, queryDB: queryMongoDB } = connectToMongoDB();

/**
 * Get a tenant-specific database from command DB (for write operations)
 */
function getCommandTenantDB(tenantId, modelName, schema) {
  const dbName = `${constants.DB_NAME}_command_${tenantId}`;
  if (commandMongoDB) {
    const db = commandMongoDB.useDb(dbName, { useCache: true });
    db.model(modelName, schema);
    return db;
  }
  throw new Error("Command database connection not established");
}

/**
 * Get a tenant-specific database from query DB (for read operations)
 */
function getQueryTenantDB(tenantId, modelName, schema) {
  // const dbName = `${constants.DB_NAME}_query_${tenantId}`;
  const dbName = `${constants.DB_NAME}_${tenantId}`;
  if (queryMongoDB) {
    const db = queryMongoDB.useDb(dbName, { useCache: true });
    db.model(modelName, schema);
    return db;
  }
  throw new Error("Query database connection not established");
}

/**
 * Get command model (for write operations) by tenant
 */
function getCommandModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getCommandTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

/**
 * Get query model (for read operations) by tenant
 */
function getQueryModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getQueryTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

/**
 * For backward compatibility - automatically selects appropriate database
 * based on operation type (default: query database)
 */
function getModelByTenant(
  tenantId,
  modelName,
  schema,
  operationType = "query"
) {
  if (operationType === "command") {
    return getCommandModelByTenant(tenantId, modelName, schema);
  }
  return getQueryModelByTenant(tenantId, modelName, schema);
}

/**
 * For backward compatibility
 */
function getTenantDB(tenantId, modelName, schema, operationType = "query") {
  if (operationType === "command") {
    return getCommandTenantDB(tenantId, modelName, schema);
  }
  return getQueryTenantDB(tenantId, modelName, schema);
}

module.exports = {
  getModelByTenant,
  getTenantDB,
  connectToMongoDB,
  getCommandModelByTenant,
  getQueryModelByTenant,
  getCommandTenantDB,
  getQueryTenantDB,
};
