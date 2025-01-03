const mongoose = require("mongoose");
const constants = require("./constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- config-database`);

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  autoIndex: true,
  useCreateIndex: true,
  debug: false,
  poolSize: 20,
  bufferMaxEntries: 0,
  connectTimeoutMS: 1200000,
  socketTimeoutMS: 600000,
  serverSelectionTimeoutMS: 3600000,
  keepAlive: true,
  keepAliveInitialDelay: 300000,
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 60000,
  writeConcern: {
    w: "majority",
    j: true,
    wtimeout: 30000,
  },
};

const connectionMap = new Map();

const connect = (dbName = constants.DB_NAME) => {
  const URI = constants.MONGO_URI;
  return mongoose.createConnection(URI, { ...options, dbName });
};

const handleConnection = (db, dbName) => {
  db.on("connected", () => {
    // logger.info(`Connected to database: ${dbName}`);
  });

  db.on("error", (err) => {
    // logger.error(`Database connection error for ${dbName}: ${err.message}`);
    setTimeout(() => reconnect(dbName), 5000);
  });

  db.on("disconnected", () => {
    // logger.warn(`Database disconnected: ${dbName}`);
    setTimeout(() => reconnect(dbName), 5000);
  });

  return db;
};

const reconnect = async (dbName) => {
  try {
    const existingConn = connectionMap.get(dbName);
    if (existingConn && existingConn.readyState !== 1) {
      const db = connect(dbName);
      handleConnection(db, dbName);
      connectionMap.set(dbName, db);
    }
  } catch (error) {
    // logger.error(`Reconnection failed for ${dbName}: ${error.message}`);
  }
};

const connectToMongoDB = () => {
  try {
    const db = connect();
    handleConnection(db, constants.DB_NAME);
    connectionMap.set(constants.DB_NAME, db);

    process.on("unhandledRejection", (reason, promise) => {
      // logger.error("Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", (err) => {
      // logger.error("Uncaught Exception:", err);
    });

    return db;
  } catch (error) {
    // logger.error(`Database initialization error: ${error.message}`);
    throw error;
  }
};

const getTenantDB = (tenantId, modelName, schema) => {
  try {
    const dbName = `${constants.DB_NAME}_${tenantId}`;
    let db = connectionMap.get(dbName);

    if (!db || db.readyState !== 1) {
      db = connect(dbName);
      handleConnection(db, dbName);
      connectionMap.set(dbName, db);
    }

    if (!db.models[modelName]) {
      db.model(modelName, schema);
    }

    return db;
  } catch (error) {
    // logger.error(`Error getting tenant DB: ${error.message}`);
    throw error;
  }
};

const getModelByTenant = (tenantId, modelName, schema) => {
  const tenantDb = getTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
};

const mongodb = connectToMongoDB();

module.exports = { getModelByTenant, getTenantDB, connectToMongoDB };
