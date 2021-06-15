const mongoose = require("mongoose");
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("debug", false);
mongoose.set("serverSelectionTimeoutMS", 3600000);
mongoose.set("connectTimeoutMS", 1200000);
mongoose.set("socketTimeoutMS", 600000);
const constants = require("./constants");
const { logElement, logText, logObject } = require("../utils/log");
const URI = constants.MONGO_URI;
logElement("the URI string", URI);

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
    db.on("open", () => {
      logText(`mongoose connection opened on: ${URI}`);
    });

    db.on("error", (err) => {
      logElement("Mongoose connection error", err);
      // process.exit(0);
    });

    db.on("disconnection", (err) => {
      logElement("mongoose disconnected", err);
    });

    process.on("unlimitedRejection", (reason, p) => {
      console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
      // process.exit(0);
      // db.close(() => {
      //   logText("mongoose is disconnected through the app");
      //   process.exit(0);
      // });
    });

    process.on("uncaughtException", (err) => {
      console.error("There was an uncaught error", err);
      // process.exit(1);
    });

    return db;
  } catch (error) {
    logElement("dbConnnection server error", error.message);
  }
};

const mongodb = connectToMongoDB();

module.exports = mongodb;
