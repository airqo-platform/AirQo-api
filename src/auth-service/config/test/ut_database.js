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
  afterEach(() => {
    sinon.restore();
  });

  describe("connectToMongoDB", () => {
    it("should connect to the MongoDB and return a promise resolving to a connection", async () => {
      const result = connectToMongoDB();
      expect(result).to.be.an.instanceof(Promise);
      const conn = await result;
      expect(conn).to.exist;
      // The connection should be open (readyState 1) since the global before hook ensures this
      expect(conn.readyState).to.equal(1);
    });
  });

  describe("getTenantDB", () => {
    it("should create a new connection for the given tenant ID and return a database connection", () => {
      const tenantId = "airqo";
      const modelName = "TestModelForUT";
      const schema = new mongoose.Schema({ name: String });
      const db = getTenantDB(tenantId, modelName, schema);
      expect(db).to.exist;
      expect(db).to.be.an("object");
      // db must expose a model() method — that is how database.js uses the tenant DB handle
      expect(db.model).to.be.a("function");
      const Model = db.model(modelName);
      expect(Model).to.exist;
    });
  });

  describe("getModelByTenant", () => {
    it("should return the model for the given tenant ID, model name, and schema", () => {
      const tenantId = "airqo";
      const modelName = "TestModelForUT2";
      const schema = new mongoose.Schema({ name: String });
      const model = getModelByTenant(tenantId, modelName, schema);
      expect(model).to.exist;
      expect(model).to.be.a("function");
    });
  });

  // Add more test cases to cover additional scenarios or edge cases if needed.
});

// You can add more test cases to cover additional scenarios or edge cases.
