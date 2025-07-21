require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const config = require("@config/constants");

describe("Test Configuration", () => {
  // Stub process.env before each test
  beforeEach(() => {
    sinon.stub(process.env, "NODE_ENV").value("test"); // Set NODE_ENV to 'test'
    sinon.stub(process.env, "DEV_MONGO_URI").value("dev-mongo-uri");
    sinon.stub(process.env, "DEV_MONGO_DB").value("dev-mongo-db");
    // Add other environment variables here as needed for your configuration
  });

  // Restore process.env after each test
  afterEach(() => {
    sinon.restore();
  });

  it("should use development configuration when NODE_ENV is 'development'", () => {
    sinon.stub(process.env, "NODE_ENV").value("development");
    const expectedConfig = {
      ...config,
      ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
    };
    const result = require("@config/constants");
    expect(result).to.deep.equal(expectedConfig);
  });

  it("should use staging configuration when NODE_ENV is 'staging'", () => {
    sinon.stub(process.env, "NODE_ENV").value("staging");
    const expectedConfig = { ...config, ENVIRONMENT: "STAGING ENVIRONMENT" };
    const result = require("@config/constants");
    expect(result).to.deep.equal(expectedConfig);
  });

  it("should use production configuration when NODE_ENV is neither 'development' nor 'staging'", () => {
    sinon.stub(process.env, "NODE_ENV").value("production");
    const expectedConfig = { ...config, ENVIRONMENT: "PRODUCTION ENVIRONMENT" };
    const result = require("@config/constants");
    expect(result).to.deep.equal(expectedConfig);
  });

  // Add more tests for other environment configurations and edge cases if needed
});
