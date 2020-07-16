const mongoose = require("mongoose");
const config = require("./constants");
// const log = require("./log");

const URI = config.MONGO_URI;
const db = mongoose.connection;

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

const connectToMongDB = () => {
  const db = connect(URI);
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

exports.mongodb = connectToMongDB();
