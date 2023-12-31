const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);
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
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  dbName: constants.DB_NAME,
};

const connect = () => mongoose.createConnection(URI, options);

const connectToMongoDB = () => {
  const db = connect();
  db.on("open", () => {
    logText(`mongoose connection opened on: ${URI}`);
  });

  db.on("error", (err) => {
    logElement("Mongoose connection error" + err);
    process.exit(0);
  });

  process.on("unlimitedRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
    process.exit(0);
    // db.close(() => {
    //   logText("mongoose is disconnected through the app");
    //   process.exit(0);
    // });
  });
  return db;
};

module.exports = connectToMongoDB;
