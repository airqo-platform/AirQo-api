const mongoose = require("mongoose");
const constants = require("./constants");

mongoose.Promise = global.Promise;

try {
  console.log("the value for MONGO URL is: " + constants.MONGO_URI);
  mongoose.connect(
    constants.MONGO_URI,
    { dbName: constants.DB_NAME },
    { useNewUrlParser: true }
  );
} catch (e) {
  mongoose.createConnection(constants.MONGO_URI);
}

mongoose.connection
  .once("open", () => console.log("MongoDB Running"))
  .on("error", (e) => {
    throw e;
  });
