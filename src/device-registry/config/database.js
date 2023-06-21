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

    db.on("error", (err) => {
      // process.exit(0);
    });

    db.on("disconnection", (err) => {});

    process.on("unlimitedRejection", (reason, p) => {
      console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
      // process.exit(0);
      // db.close(() => {
      //   process.exit(0);
      // });
    });

    process.on("uncaughtException", (err) => {
      console.error("There was an uncaught error", err);
      // process.exit(1);
    });

    return db;
  } catch (error) {}
};

const mongodb = connectToMongoDB();

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

module.exports = { getModelByTenant, getTenantDB, mongodb };
