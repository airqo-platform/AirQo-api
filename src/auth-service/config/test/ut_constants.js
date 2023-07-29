require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;

const {
  defaultConfig,
  devConfig,
  prodConfig,
  stageConfig,
  envConfig,
} = require("@config/constants");

describe("Configurations", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("defaultConfig", () => {
    it("should contain the default configurations", () => {
      expect(defaultConfig).to.be.an("object");
      // Add more assertions to check specific configuration values.
      expect(defaultConfig.PORT).to.be.a("number");
      expect(defaultConfig.JWT_SECRET).to.be.a("string");
      // ... add more assertions for other configuration values
    });
  });

  describe("devConfig", () => {
    it("should contain the development configurations", () => {
      expect(devConfig).to.be.an("object");
      // Add more assertions to check specific configuration values for the development environment.
    });
  });

  describe("stageConfig", () => {
    it("should contain the staging configurations", () => {
      expect(stageConfig).to.be.an("object");
      // Add more assertions to check specific configuration values for the staging environment.
    });
  });

  describe("prodConfig", () => {
    it("should contain the production configurations", () => {
      expect(prodConfig).to.be.an("object");
      // Add more assertions to check specific configuration values for the production environment.
    });
  });

  describe("envConfig", () => {
    it("should return the development configurations when the environment is 'development'", () => {
      const config = envConfig("development");
      expect(config).to.deep.equal(devConfig);
    });

    it("should return the staging configurations when the environment is 'staging'", () => {
      const config = envConfig("staging");
      expect(config).to.deep.equal(stageConfig);
    });

    it("should return the production configurations when the environment is not 'development' or 'staging'", () => {
      const config = envConfig("production");
      expect(config).to.deep.equal(prodConfig);
    });
  });
});

// You can add more test cases to cover additional scenarios or edge cases.
