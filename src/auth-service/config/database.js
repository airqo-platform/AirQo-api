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
const presto = require("presto-client");

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

// Presto connection configuration
const PRESTO_CONFIG = {
  host: constants.PRESTO_HOST || "localhost",
  port: constants.PRESTO_PORT || 8080,
  user: constants.PRESTO_USER || "presto",
  basic_auth: {
    user: constants.PRESTO_AUTH_USER || "",
    password: constants.PRESTO_AUTH_PASSWORD || "",
  },
  // Catalog pointing to your MongoDB instances
  catalog: "mongodb",
  schema: constants.DB_NAME,
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
    dbName: `${constants.DB_NAME}`,
  });

// Connection storage
let commandDB = null;
let queryDB = null;
let prestoClientInstance = null; // More descriptive name

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

const connectToDatabases = () => {
  try {
    // Establish MongoDB connections
    commandDB = createCommandConnection();
    setupConnectionHandlers(commandDB, "command");

    queryDB = createQueryConnection();
    setupConnectionHandlers(queryDB, "query");

    // Initialize Presto client
    prestoClientInstance = new presto.Client(PRESTO_CONFIG);

    logger.info("Presto client initialized successfully");

    // Set up global error handlers
    process.on("unhandledRejection", (reason, p) => {
      logger.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    });

    process.on("uncaughtException", (err) => {
      logger.error("There was an uncaught error", err);
    });

    return { commandDB, queryDB, prestoClient: prestoClientInstance };
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    throw error;
  }
};

// Initialize all database connections
const {
  commandDB: commandMongoDB,
  queryDB: queryMongoDB,
  prestoClient,
} = connectToDatabases();

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

/**
 * Execute a federated query across multiple MongoDB instances using Presto
 * @param {string} query - SQL query to execute against federated databases
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Query results
 */
function executeFederatedQuery(query, options = {}) {
  return new Promise((resolve, reject) => {
    const results = [];

    prestoClient.execute({
      // Use the already declared presto variable
      query: query,
      catalog: options.catalog || PRESTO_CONFIG.catalog,
      schema: options.schema || PRESTO_CONFIG.schema,
      source: "nodejs-federation",
      state: function (error, query_id, stats) {
        if (error) {
          logger.error(`Presto query state error: ${error}`);
        }
      },
      columns: function (error, data) {
        if (error) {
          logger.error(`Presto columns error: ${error}`);
        }
      },
      data: function (error, data, columns, stats) {
        if (error) {
          return reject(error);
        }
        if (data) {
          results.push(...data);
        }
      },
      success: function (error, stats) {
        if (error) {
          return reject(error);
        }
        resolve(results);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

/**
 * Execute a federated query across multiple tenant databases
 * @param {Array} tenantIds - Array of tenant IDs to query across
 * @param {string} query - SQL query template (with placeholders for tenant IDs)
 * @returns {Promise<Array>} - Combined results
 */
async function queryAcrossTenants(tenantIds, queryTemplate) {
  // Create a UNION ALL query across multiple tenant databases
  const unionQueries = tenantIds.map((tenantId) => {
    // Replace placeholders with actual tenant IDs
    return queryTemplate.replace(/\${tenantId}/g, tenantId);
  });

  const fullQuery = unionQueries.join(" UNION ALL ");
  return executeFederatedQuery(fullQuery);
}

module.exports = {
  getModelByTenant,
  getTenantDB,
  connectToDatabases,
  getCommandModelByTenant,
  getQueryModelByTenant,
  getCommandTenantDB,
  getQueryTenantDB,
  executeFederatedQuery,
  queryAcrossTenants,
  prestoClient,
};
