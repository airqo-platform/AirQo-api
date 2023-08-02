require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

// Stub the environment variables
const env = {
  MONGO_URI_DEV: "mongodb://localhost:27017/dev-db",
  MONGO_DEV: "dev-db",
  REDIS_SERVER_DEV: "localhost",
  REDIS_PORT: "6379",
  KAFKA_BOOTSTRAP_SERVERS_DEV: "kafka1:9092,kafka2:9092",
  KAFKA_TOPICS_DEV: "topic1,topic2",
  SCHEMA_REGISTRY_DEV: "http://schema-registry:8081",
  KAFKA_RAW_MEASUREMENTS_TOPICS_DEV: "raw_topic1,raw_topic2",
  KAFKA_CLIENT_ID_DEV: "client_id_dev",
  KAFKA_CLIENT_GROUP_DEV: "client_group_dev",
  DATAWAREHOUSE_METADATA_DEV: "metadata_table_dev",
  DATAWAREHOUSE_AVERAGED_DATA_DEV: "averaged_data_table_dev",
  MONGO_URI_PROD: "mongodb://mongo-prod:27017/prod-db",
  MONGO_PROD: "prod-db",
  // Add more environment variables for staging and production if needed
  NODE_ENV: "development", // Change this to test different environments
};

// Mock the module with proxyquire and stub the required log4js module
const log4jsStub = { getLogger: sinon.stub().returns({}) };
const configModule = proxyquire("./configModule", {
  log4js: log4jsStub,
});

describe("Configuration Module", () => {
  let cloudinaryConfig;

  before(() => {
    // Stub the process.env object with our custom environment variables
    sinon.stub(process, "env").value(env);

    // Require the module to initialize the configuration
    cloudinaryConfig = require("./configModule");
  });

  after(() => {
    // Restore the original process.env object after the tests
    sinon.restore();
  });

  describe("Development Environment", () => {
    it("should use development configuration for NODE_ENV=development", () => {
      expect(cloudinaryConfig.ENVIRONMENT).to.equal("DEVELOPMENT ENVIRONMENT");
      expect(cloudinaryConfig.MONGO_URI).to.equal(env.MONGO_URI_DEV);
      expect(cloudinaryConfig.DB_NAME).to.equal(env.MONGO_DEV);
      // Add more assertions for other development configuration properties
    });
  });

  describe("Staging Environment", () => {
    it("should use staging configuration for NODE_ENV=staging", () => {
      // Set NODE_ENV to "staging" to simulate staging environment
      process.env.NODE_ENV = "staging";

      // Require the module again to trigger the configuration
      cloudinaryConfig = require("./configModule");

      expect(cloudinaryConfig.ENVIRONMENT).to.equal("STAGING ENVIRONMENT");
      expect(cloudinaryConfig.MONGO_URI).to.equal(env.MONGO_URI_STAGE);
      expect(cloudinaryConfig.DB_NAME).to.equal(env.MONGO_STAGE);
      // Add more assertions for other staging configuration properties
    });
  });

  describe("Production Environment", () => {
    it("should use production configuration for NODE_ENV=production", () => {
      // Set NODE_ENV to "production" to simulate production environment
      process.env.NODE_ENV = "production";

      // Require the module again to trigger the configuration
      cloudinaryConfig = require("./configModule");

      expect(cloudinaryConfig.ENVIRONMENT).to.equal("PRODUCTION ENVIRONMENT");
      expect(cloudinaryConfig.MONGO_URI).to.equal(env.MONGO_URI_PROD);
      expect(cloudinaryConfig.DB_NAME).to.equal(env.MONGO_PROD);
      // Add more assertions for other production configuration properties
    });
  });

  // Add more describe blocks for other configuration properties if necessary
});
