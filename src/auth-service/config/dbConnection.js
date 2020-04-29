const mongoose = require("mongoose");
// const { Gstore, instances } = require("gstore-node");
const config = require("./constants");
// const { Datastore } = require("@google-cloud/datastore");

// const gstore1 = new Gstore();
// const gstore2 = new Gstore({ cache: true });
// const gstore3 = new Gstore();

// const datastore1 = new Datastore({
//   namespace: "default",
//   projectId: "airqo-250220",
// });
// const datastore2 = new Datastore({
//   namespace: "cache-on",
//   projectId: "airqo-250220",
// });ç
// const datastore3 = new Datastore({
//   namespace: "staging",
//   projectId: "airqo-250220",
// });

const URI = config.MONGO_URI;
const db = mongoose.connection;

const options = {
  useCreateIndex: true,
  useNewUrlParser: true,
  useFindAndModify: false,
};

mongoose.connect(URI, options);
// gstore1.connect(datastore1);
// gstore2.connect(datastore2);
// gstore3.connect(datastore3);

//unique IDs to each instance
// instances.set("default", gstore1);
// instances.set("cache-on", gstore2);
// instances.set("staging", gstore3);

// When successfully connected
db.on("connected", () => {
  console.log("Established Mongoose Default Connection");
});

// When connection throws an error
db.on("error", (err) => {
  console.log("Mongoose Default Connection Error : " + err);
});

db.on("disconnected", () => {});

// //when nodejs stops
process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
  db.close(() => {
    console.log("mongoose is disconnected through the app");
    process.exit(0);
  });
});
