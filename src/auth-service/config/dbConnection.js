import mongoose from "mongoose";
import config from "./constants";

const URI = config.MONGO_URI;
const db = mongoose.connection;
mongoose.connect(URI);

// When successfully connected
db.on("connected", () => {
  console.log("Established Mongoose Default Connection");
});

// When connection throws an error
db.on("error", err => {
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
