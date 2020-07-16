const mongoose = require("mongoose");
const config = require("./constants");
constants = require("./constants");
// const log = require("./log");

const URI = config.MONGO_URI;

const options = {
  useCreateIndex: true,
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
  autoIndex: true,
  poolSize: 10,
  bufferMaxEntries: 0,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
};

const connect = () => mongoose.createConnection(URI, options);

const connectToMongoDB = () => {
  const db = connect(
    URI,
    { dbName: constants.DB_NAME },
    { userNewUrlParser: true }
  );
  db.on("open", () => {
    console.log("Mongoose connection opened");
  });

  db.on("error", (err) => {
    console.log("Mongoose connnection error" + err);
    process.exit(0);
  });

  // //when nodejs stops
  process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
    db.close(() => {
      console.log("mongoose is disconnected through the app");
      process.exit(0);
    });
  });

  return db;
};

const mongodb = connectToMongoDB();

// creating a new mo(ngoDB connection by swithing tenant
const getTenantDB = (tenantId, modelName, schema) => {
  const dbName = `${constants.DB_NAME}+"_"+${tenantId}`;
  if (mongodb) {
    const db = mongodb.useDb(dbName, { useCache: true });
    db.model(modelName, schema);
    return db;
  }
  //   return throwError(500, codes.CODE_8004);
};

//return model as per tenant

const getModelByTenant = (tenantId, modelName, schema) => {
  const tenantDb = getTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
};

modules.exports = { mongodb, getTenantDB };
