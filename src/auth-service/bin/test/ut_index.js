require("module-alias/register");
// Load .env.development.json early so that subsequent test files that require
// bin/server.js (which guards SESSION_SECRET at module scope) can load cleanly.
require("@config/env-loader").loadEnvironment();

const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru().noPreserveCache();

// Global before hook — waits for the MongoDB driver connection to be open
// before any test in the entire suite runs. Tests that call Model("tenant")
// directly (e.g. to stub instance methods) need readyState === 1 to succeed.
// This hook is intentionally placed in the first test file (sorted by mocha).
before(function waitForMongoDB(done) {
  this.timeout(20000);
  const mongoose = require("mongoose");
  // Start the connection if it hasn't started yet
  require("@config/database");

  if (mongoose.connection.readyState === 1) return done();

  // Wait for the "open" event; RBAC init may still be running, but the
  // driver connection (readyState 1) is sufficient for model stub setup.
  mongoose.connection.once("open", () => done());
});

// Shared stubs for @utils/shared — controls isDevelopment / isProduction
// so the proxyquired index module uses our environment, not the real one.
function makeSharedStub(sandbox, { dev = true, prod = false } = {}) {
  return {
    logObject: sandbox.stub(),
    EnvironmentDetector: {},
    isDevelopment: () => dev,
    isProduction: () => prod,
    isStaging: () => false,
    getEnvironment: () => (prod ? "PRODUCTION" : "DEVELOPMENT"),
    getDetailedInfo: () => ({}),
    resetCache: sandbox.stub(),
  };
}

describe("bin/index entrypoint", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // Prevent accidental real process exits triggered by error paths
    sandbox.stub(process, "exit");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("skips Kafka and calls createServer in development mode", () => {
    const createServerStub = sandbox.stub();
    const kafkaConsumerStub = sandbox.stub().resolves();

    proxyquire("../index", {
      "@bin/jobs/kafka-consumer": kafkaConsumerStub,
      "./server": createServerStub,
      "@utils/shared": makeSharedStub(sandbox, { dev: true, prod: false }),
    });

    expect(createServerStub.calledOnce).to.be.true;
    expect(kafkaConsumerStub.called).to.be.false;
  });

  it("calls process.exit(1) when createServer throws", () => {
    const createServerStub = sandbox
      .stub()
      .throws(new Error("simulated server startup failure"));
    const kafkaConsumerStub = sandbox.stub().resolves();

    proxyquire("../index", {
      "@bin/jobs/kafka-consumer": kafkaConsumerStub,
      "./server": createServerStub,
      "@utils/shared": makeSharedStub(sandbox, { dev: true, prod: false }),
    });

    expect(process.exit.calledWith(1)).to.be.true;
  });
});
