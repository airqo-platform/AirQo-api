const mongoose = require("mongoose");
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("debug", false);
const constants = require("./constants");
const URI = constants.MONGO_URI;
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- dbConnection-config`
);

const options = {
  useCreateIndex: true,
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
  autoIndex: true,
  keepAlive: true,
  poolSize: 10,
  bufferMaxEntries: 0,
  connectTimeoutMS: 1200000,
  socketTimeoutMS: 600000,
  serverSelectionTimeoutMS: 3600000,
  dbName: constants.DB_NAME,
};

const connect = () => mongoose.createConnection(URI, options);

const connectToMongoDB = () => {
  try {
    const db = connect();
    db.on("open", () => {});
    db.on("error", (err) => {});

    db.on("disconnection", (err) => {});

    process.on("unlimitedRejection", (reason, p) => {
      console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
    });

    process.on("uncaughtException", (err) => {
      console.error("There was an uncaught error", err);
    });

    return db;
  } catch (error) {}
};

const mongodb = connectToMongoDB();

function getTenantDB(tenantId, modelName, schema) {
  const dbName = `${constants.DB_NAME}_${tenantId}`;
  if (mongodb) {
    const db = mongodb.useDb(dbName, { useCache: true });
    db.model(modelName, schema);
    return db;
  }
}

function getModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

module.exports = { getModelByTenant, getTenantDB, connectToMongoDB };
