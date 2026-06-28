require("dotenv").config({ path: ".env.test" });
// Raise the listener limit for test suites: createServer() registers SIGINT/SIGTERM/
// uncaughtException/unhandledRejection on each call, and multiple beforeEach hooks
// accumulate them above Node's default cap of 10.
process.setMaxListeners(50);
