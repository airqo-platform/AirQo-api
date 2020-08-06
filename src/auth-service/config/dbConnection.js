const mongoose = require("mongoose");
const constants = require("./constants");
const log = require("../utils/log");
const URI = `mongodb://localhost/`;
const { logElement, logText, logObject } = require("../utils/log");
// const URI = constants.MONGO_URI;
logElement("environment", process.env.NODE_ENV);
logElement("the URI string", URI);

//the DB connection options....
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
  dbName: "airqo-auth-dev",
};

const connect = () => mongoose.createConnection(URI, options);

const connectToMongoDB = () => {
  const db = connect();
  db.on("open", () => {
    console.log(`Mongoose connection opened on: ${URI}`);
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

module.exports = mongodb;
