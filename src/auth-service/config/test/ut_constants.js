const { expect } = require("chai");
const sinon = require("sinon");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
// const defaultConfig = require("@config");
// const stageConfig = require("@config");
// const prodConfig = require("@config");
// const devConfig = require("@config");
chai.use(require("sinon-chai"));

describe("Configuration tests", () => {
  let processEnvStub;

  beforeEach(() => {
    // Stub the process.env object
    processEnvStub = sinon.stub(process, "env");
  });

  afterEach(() => {
    // Restore the original behavior of the stubbed object
    sinon.restore();
  });

  describe("Development configuration", () => {
    beforeEach(() => {
      // Stub process.env properties before each test
      sinon
        .stub(process.env, "DEVELOPMENT_DEFAULT_NETWORK")
        .value("stubbed_default_network");
      sinon.stub(process.env, "MONGO_DEV_URI").value("stubbed_mongo_uri");
      // ... stub other process.env properties as needed
    });

    afterEach(() => {
      // Restore the stubbed process.env properties after each test
      sinon.restore();
    });
    const devConfig = {};

    it("should have the correct DEFAULT_NETWORK value", () => {
      processEnvStub.DEVELOPMENT_DEFAULT_NETWORK = "devNetwork";

      expect(devConfig.DEFAULT_NETWORK).to.equal("devNetwork");
    });

    // Add more tests for other properties in the devConfig object

    // Example test for MONGO_URI
    it("should have the correct MONGO_URI value", () => {
      processEnvStub.MONGO_DEV_URI = "devMongoURI";

      expect(devConfig.MONGO_URI).to.equal("devMongoURI");
    });

    it("should have the correct value for PWD_RESET", () => {
      expect(devConfig.PWD_RESET).to.equal(
        `${process.env.ANALYTICS_DEV_BASE_URL}/reset`
      );
    });

    it("should have the correct value for LOGIN_PAGE", () => {
      expect(devConfig.LOGIN_PAGE).to.equal(
        `${process.env.ANALYTICS_DEV_BASE_URL}/user/login`
      );
    });

    it("should have the correct value for FORGOT_PAGE", () => {
      expect(devConfig.FORGOT_PAGE).to.equal(
        `${process.env.ANALYTICS_DEV_BASE_URL}/forgot`
      );
    });

    it("should have the correct value for PLATFORM_BASE_URL", () => {
      expect(devConfig.PLATFORM_BASE_URL).to.equal(
        process.env.ANALYTICS_DEV_BASE_URL
      );
    });

    it("should have the correct value for ENVIRONMENT", () => {
      expect(devConfig.ENVIRONMENT).to.equal("DEVELOPMENT ENVIRONMENT");
    });

    it("should have the correct value for KAFKA_BOOTSTRAP_SERVERS", () => {
      // Stub process.env.KAFKA_BOOTSTRAP_SERVERS_DEV
      sinon
        .stub(process.env, "KAFKA_BOOTSTRAP_SERVERS_DEV")
        .value("kafka_server1,kafka_server2");

      expect(devConfig.KAFKA_BOOTSTRAP_SERVERS).to.deep.equal([
        "kafka_server1",
        "kafka_server2",
      ]);
    });

    it("should have the correct value for KAFKA_TOPICS", () => {
      expect(devConfig.KAFKA_TOPICS).to.equal(process.env.KAFKA_TOPICS_DEV);
    });
  });

  describe("Production configuration", () => {
    beforeEach(() => {
      // Stub process.env properties before each test
      sinon
        .stub(process.env, "PRODUCTION_DEFAULT_NETWORK")
        .value("stubbed_default_network");
      sinon.stub(process.env, "MONGO_PROD_URI").value("stubbed_mongo_uri");
      // ... stub other process.env properties as needed
    });

    afterEach(() => {
      // Restore the stubbed process.env properties after each test
      sinon.restore();
    });

    const prodConfig = {};

    it("should have the correct DEFAULT_NETWORK value", () => {
      processEnvStub.PRODUCTION_DEFAULT_NETWORK = "prodNetwork";

      expect(prodConfig.DEFAULT_NETWORK).to.equal("prodNetwork");
    });

    it("should have the correct value for DB_NAME", () => {
      expect(prodConfig.DB_NAME).to.equal(process.env.MONGO_PROD);
    });

    it("should have the correct value for PWD_RESET", () => {
      expect(prodConfig.PWD_RESET).to.equal(
        `${process.env.ANALYTICS_PRODUCTION_BASE_URL}/reset`
      );
    });

    it("should have the correct value for LOGIN_PAGE", () => {
      expect(prodConfig.LOGIN_PAGE).to.equal(
        `${process.env.ANALYTICS_PRODUCTION_BASE_URL}/user/login`
      );
    });

    it("should have the correct value for FORGOT_PAGE", () => {
      expect(prodConfig.FORGOT_PAGE).to.equal(
        `${process.env.ANALYTICS_PRODUCTION_BASE_URL}/forgot`
      );
    });

    it("should have the correct value for PLATFORM_BASE_URL", () => {
      expect(prodConfig.PLATFORM_BASE_URL).to.equal(
        process.env.ANALYTICS_PRODUCTION_BASE_URL
      );
    });

    it("should have the correct value for ENVIRONMENT", () => {
      expect(prodConfig.ENVIRONMENT).to.equal("PRODUCTION ENVIRONMENT");
    });

    it("should have the correct value for KAFKA_BOOTSTRAP_SERVERS", () => {
      // Stub process.env.KAFKA_BOOTSTRAP_SERVERS_PROD
      sinon
        .stub(process.env, "KAFKA_BOOTSTRAP_SERVERS_PROD")
        .value("kafka_server1,kafka_server2");

      expect(prodConfig.KAFKA_BOOTSTRAP_SERVERS).to.deep.equal([
        "kafka_server1",
        "kafka_server2",
      ]);
    });

    it("should have the correct value for KAFKA_TOPICS", () => {
      expect(prodConfig.KAFKA_TOPICS).to.equal(process.env.KAFKA_TOPICS_PROD);
    });

    // Add more tests for other properties in the prodConfig object
  });

  describe("Stage configuration", () => {
    beforeEach(() => {
      // Stub process.env properties before each test
      sinon
        .stub(process.env, "STAGING_DEFAULT_NETWORK")
        .value("stubbed_default_network");
      sinon.stub(process.env, "MONGO_STAGE_URI").value("stubbed_mongo_uri");
      // ... stub other process.env properties as needed
    });

    afterEach(() => {
      // Restore the stubbed process.env properties after each test
      sinon.restore();
    });
    const stageConfig = {};

    it("should have the correct DEFAULT_NETWORK value", () => {
      processEnvStub.STAGING_DEFAULT_NETWORK = "stageNetwork";

      expect(stageConfig.DEFAULT_NETWORK).to.equal("stageNetwork");
    });

    it("should have the correct value for DEFAULT_NETWORK", () => {
      expect(stageConfig.DEFAULT_NETWORK).to.equal(
        process.env.STAGING_DEFAULT_NETWORK
      );
    });

    it("should have the correct value for MONGO_URI", () => {
      expect(stageConfig.MONGO_URI).to.equal(process.env.MONGO_STAGE_URI);
    });

    it("should have the correct value for DB_NAME", () => {
      expect(stageConfig.DB_NAME).to.equal(process.env.MONGO_STAGE);
    });

    it("should have the correct value for PWD_RESET", () => {
      expect(stageConfig.PWD_RESET).to.equal(
        `${process.env.ANALYTICS_STAGING_BASE_URL}/reset`
      );
    });

    it("should have the correct value for LOGIN_PAGE", () => {
      expect(stageConfig.LOGIN_PAGE).to.equal(
        `${process.env.ANALYTICS_STAGING_BASE_URL}/user/login`
      );
    });

    it("should have the correct value for FORGOT_PAGE", () => {
      expect(stageConfig.FORGOT_PAGE).to.equal(
        `${process.env.ANALYTICS_STAGING_BASE_URL}/forgot`
      );
    });

    it("should have the correct value for PLATFORM_BASE_URL", () => {
      expect(stageConfig.PLATFORM_BASE_URL).to.equal(
        process.env.ANALYTICS_STAGING_BASE_URL
      );
    });

    it("should have the correct value for ENVIRONMENT", () => {
      expect(stageConfig.ENVIRONMENT).to.equal("STAGING ENVIRONMENT");
    });

    it("should have the correct value for KAFKA_BOOTSTRAP_SERVERS", () => {
      // Stub process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE
      sinon
        .stub(process.env, "KAFKA_BOOTSTRAP_SERVERS_STAGE")
        .value("kafka_server1,kafka_server2");

      expect(stageConfig.KAFKA_BOOTSTRAP_SERVERS).to.deep.equal([
        "kafka_server1",
        "kafka_server2",
      ]);
    });

    it("should have the correct value for KAFKA_TOPICS", () => {
      expect(stageConfig.KAFKA_TOPICS).to.equal(process.env.KAFKA_TOPICS_STAGE);
    });

    // Add more tests for other properties in the stageConfig object
  });

  describe("Default configuration", () => {
    beforeEach(() => {
      // Stub process.env properties before each test
      sinon.stub(process.env, "SESSION_SECRET").value("stubbed_session_secret");
      sinon.stub(process.env, "AIRQO_WEBSITE").value("stubbed_airqo_website");
      sinon
        .stub(process.env, "MOBILE_APP_PACKAGE_NAME")
        .value("stubbed_mobile_app_package_name");
      // ... stub other process.env properties as needed
    });

    afterEach(() => {
      // Restore the stubbed process.env properties after each test
      sinon.restore();
    });
    const defaultConfig = {};

    it("should have the correct SESSION_SECRET value", () => {
      processEnvStub.SESSION_SECRET = "sessionSecret";

      expect(defaultConfig.SESSION_SECRET).to.equal("sessionSecret");
    });

    it("should have the correct value for SESSION_SECRET", () => {
      expect(defaultConfig.SESSION_SECRET).to.equal(process.env.SESSION_SECRET);
    });

    it("should have the correct value for ACTION_CODE_SETTINGS", () => {
      expect(defaultConfig.ACTION_CODE_SETTINGS).to.deep.equal({
        url: process.env.AIRQO_WEBSITE,
        handleCodeInApp: true,
        iOS: {
          bundleId: process.env.MOBILE_APP_PACKAGE_NAME,
        },
        android: {
          packageName: process.env.MOBILE_APP_PACKAGE_NAME,
          installApp: true,
          minimumVersion: "12",
        },
        dynamicLinkDomain: process.env.MOBILE_APP_DYNAMIC_LINK_DOMAIN,
      });
    });

    it("should have the correct value for MOBILE_APP_PACKAGE_NAME", () => {
      expect(defaultConfig.MOBILE_APP_PACKAGE_NAME).to.equal(
        process.env.MOBILE_APP_PACKAGE_NAME
      );
    });

    it("should have the correct value for AIRQO_WEBSITE", () => {
      expect(defaultConfig.AIRQO_WEBSITE).to.equal(process.env.AIRQO_WEBSITE);
    });

    it("should have a valid RANDOM_PASSWORD_CONFIGURATION function", () => {
      expect(defaultConfig.RANDOM_PASSWORD_CONFIGURATION).to.be.a("function");
      const length = 10;
      const passwordConfig =
        defaultConfig.RANDOM_PASSWORD_CONFIGURATION(length);
      expect(passwordConfig).to.deep.equal({
        length: length,
        numbers: true,
        uppercase: true,
        lowercase: true,
        strict: true,
        excludeSimilarCharacters: true,
      });
    });

    it("should have a valid NETWORKS_EXCLUSION_PROJECTION function", () => {
      expect(defaultConfig.NETWORKS_EXCLUSION_PROJECTION).to.be.a("function");
      const category = "example_category";
      const projection = defaultConfig.NETWORKS_EXCLUSION_PROJECTION(category);
      // Perform your assertions on the projection object
      expect(projection).to.deep.equal({
        _id: 1,
        net_email: 1,
        net_website: 1,
        // ... assert other properties in the projection object
      });
    });

    it("should have the default LIMIT when DEFAULT_LIMIT is undefined", () => {
      delete process.env.DEFAULT_LIMIT;
      expect(defaultConfig.DEFAULT_LIMIT).to.equal(100);
    });

    it("should have the default PORT when PORT is undefined", () => {
      delete process.env.PORT;
      expect(defaultConfig.PORT).to.equal(3000);
    });

    // Add more tests for other properties in the defaultConfig object
  });
});
