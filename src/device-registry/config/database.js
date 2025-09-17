const mongoose = require("mongoose");
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("debug", false);
const constants = require("./constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- dbConnection-config`
);

// Database URIs for CQRS pattern
const COMMAND_URI = constants.COMMAND_MONGO_URI || constants.MONGO_URI || "";
const QUERY_URI = constants.QUERY_MONGO_URI || constants.MONGO_URI || "";

const options = {
  useCreateIndex: true,
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
  autoIndex: true,
  keepAlive: true,
  keepAliveInitialDelay: 300000,
  poolSize: 20,
  maxPoolSize: 100,
  bufferMaxEntries: 0,
  connectTimeoutMS: 1200000,
  socketTimeoutMS: 600000,
  serverSelectionTimeoutMS: 3600000,
};

// Create separate connection functions for command and query databases
const createCommandConnection = () =>
  mongoose.createConnection(COMMAND_URI, {
    ...options,
    dbName: `${constants.DB_NAME}_command`,
  });

const createQueryConnection = () =>
  mongoose.createConnection(QUERY_URI, {
    ...options,
    dbName: `${constants.DB_NAME}`,
  });

// Store database connections
let commandDB = null;
let queryDB = null;

// Helper function to set up connection event handlers
const setupConnectionHandlers = (db, dbType) => {
  db.on("open", () => {
    // logger.info(`Connected to ${dbType} database successfully`);
  });

  db.on("error", (err) => {
    logger.error(`${dbType} database connection error: ${err.message}`);
  });

  db.on("disconnected", (err) => {
    logger.warn(
      `${dbType} database disconnected: ${
        err && err.message ? err.message : "Unknown reason"
      }`
    );
  });
};

const connectToMongoDB = () => {
  try {
    // Establish command database connection
    commandDB = createCommandConnection();
    setupConnectionHandlers(commandDB, "command");

    // Establish query database connection
    queryDB = createQueryConnection();
    setupConnectionHandlers(queryDB, "query");

    // Set up global error handlers
    process.on("unhandledRejection", (reason, p) => {
      logger.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    });

    process.on("uncaughtException", (err) => {
      logger.error("There was an uncaught error", err);
    });

    return { commandDB, queryDB };
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    throw error;
  }
};

// Initialize both database connections
const { commandDB: commandMongoDB, queryDB: queryMongoDB } = connectToMongoDB();

/**
 * Get a tenant-specific command database (for write operations)
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
 * Get a tenant-specific query database (for read operations)
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
 * Get a command model (for write operations) for a specific tenant
 */
function getCommandModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getCommandTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

/**
 * Get a query model (for read operations) for a specific tenant
 */
function getQueryModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getQueryTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

/**
 * Backward compatible function to get tenant database
 * Accepts an optional operationType parameter
 */
function getTenantDB(tenantId, modelName, schema, operationType = "query") {
  if (operationType === "command") {
    return getCommandTenantDB(tenantId, modelName, schema);
  }
  return getQueryTenantDB(tenantId, modelName, schema);
}

/**
 * Backward compatible function to get tenant model
 * Accepts an optional operationType parameter
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
 * Get a raw tenant database connection without model registration
 * Useful for migrations and operations that don't need model access
 */
function getRawTenantDB(tenantId, operationType = "query") {
  const dbName =
    operationType === "command"
      ? `${constants.DB_NAME}_command_${tenantId}`
      : `${constants.DB_NAME}_${tenantId}`;

  const connection =
    operationType === "command" ? commandMongoDB : queryMongoDB;

  if (!connection) {
    throw new Error(`${operationType} database connection not established`);
  }

  return connection.useDb(dbName, { useCache: true });
}

module.exports = {
  getModelByTenant,
  getTenantDB,
  connectToMongoDB,
  getCommandModelByTenant,
  getQueryModelByTenant,
  getCommandTenantDB,
  getQueryTenantDB,
  getRawTenantDB,
  commandMongoDB,
  queryMongoDB,
};
