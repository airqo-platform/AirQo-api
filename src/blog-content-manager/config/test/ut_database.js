require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const mongoose = require("mongoose");
const constants = require("@config/constants");
const {
  getModelByTenant,
  getTenantDB,
  connectToMongoDB,
} = require("@config/database");

describe("Database Connection and Utility Functions", () => {
  before(() => {
    // Connect to the MongoDB using an in-memory database for testing purposes.
    mongoose.connect(
      "mongodb://localhost:27017/testdb",
      { useNewUrlParser: true, useUnifiedTopology: true },
      (err) => {
        if (err) {
          console.error("Error connecting to the test database:", err);
        }
      }
    );
  });

  after(() => {
    // Disconnect from the MongoDB after the tests are done.
    mongoose.connection.close();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("connectToMongoDB", () => {
    it("should connect to the MongoDB and return a valid database connection", () => {
      const db = connectToMongoDB();
      expect(db).to.exist;
      expect(db).to.be.an.instanceof(mongoose.Connection);
    });
  });

  describe("getTenantDB", () => {
    it("should create a new connection for the given tenant ID and return a database connection", () => {
      const tenantId = "sampleTenantId";
      const modelName = "SampleModel";
      const schema = new mongoose.Schema({});
      const db = getTenantDB(tenantId, modelName, schema);
      expect(db).to.exist;
      expect(db).to.be.an.instanceof(mongoose.Connection);
    });
  });

  describe("getModelByTenant", () => {
    it("should return the model for the given tenant ID, model name, and schema", () => {
      const tenantId = "sampleTenantId";
      const modelName = "SampleModel";
      const schema = new mongoose.Schema({});
      const model = getModelByTenant(tenantId, modelName, schema);
      expect(model).to.exist;
      expect(model).to.be.a("function");
    });
  });

  // Add more test cases to cover additional scenarios or edge cases if needed.
});

// You can add more test cases to cover additional scenarios or edge cases.
