// Mocha `--require` fixture (see .mocharc.yml). Must be .mjs: in Mocha's
// non-parallel run mode, `--require`'d CommonJS files are only used to
// register `mochaGlobalSetup`/`mochaGlobalTeardown`, which actually run
// *after* all spec files are already loaded — too late, since spec files
// transitively require config/database.js, which connects to MONGO_URI at
// module-load time. An .mjs file is loaded with `import()` and awaited by
// Mocha before any spec file loads, so top-level await here genuinely runs
// first and can set MONGO_URI before anything else reads it.
import { MongoMemoryServer } from "mongodb-memory-server";

// Pin to 4.4.x: the app's mongoose@5 / mongodb-driver@3.7 stack does not
// reliably speak the wire protocol of newer MongoDB server versions.
const mongod = await MongoMemoryServer.create({
  binary: { version: "4.4.18" },
});

process.env.MONGO_URI = mongod.getUri();
process.env.QUERY_MONGO_URI = mongod.getUri();
process.env.DB_NAME = process.env.DB_NAME || "airqo_test";

// These are read once into config/core/envs.js the first time @config/constants
// is required anywhere in the suite, then frozen for the rest of the run — so
// setting them later, from inside an individual test file, is too late for
// every spec file that loaded earlier. Real CI/dev secrets (if present) win.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
// Must start with "pdl_" — config/paddle.js only builds a real (test-stubbable)
// paddleClient when the key looks like a valid Paddle Billing key; otherwise
// paddleClient stays null and every Paddle-touching test fails on that null.
process.env.PADDLE_API_KEY = process.env.PADDLE_API_KEY || "pdl_test_dummy_key_for_unit_tests";
process.env.MAIL_USER = process.env.MAIL_USER || "test-mailer@example.com";
process.env.MAIL_PASS = process.env.MAIL_PASS || "test-mailer-password";

export const mochaGlobalTeardown = async () => {
  const { default: mongoose } = await import("mongoose");
  await mongoose.disconnect();
  await mongod.stop();
};
