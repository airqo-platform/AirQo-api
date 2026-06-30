require("dotenv").config({ path: ".env.test" });
// Raise the listener limit for test suites: createServer() registers SIGINT/SIGTERM/
// uncaughtException/unhandledRejection on each call, and multiple beforeEach hooks
// accumulate them above Node's default cap of 10.
process.setMaxListeners(50);
// Prevent Mongoose from buffering operations when no DB connection is present.
// Without this, ops buffer for 10 s before throwing, causing mocha timeouts in
// tests that don't (intentionally) connect to MongoDB.
const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);
