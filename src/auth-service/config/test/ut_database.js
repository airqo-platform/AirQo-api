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
      // connectToMongoDB returns a Promise; verify it resolves to a Connection
      expect(result).to.be.an.instanceof(Promise);
      const conn = await result;
      expect(conn).to.exist;
    });
  });

  describe("getTenantDB", () => {
    it("should create a new connection for the given tenant ID and return a database connection", () => {
      const tenantId = "airqo"; // must use a tenant the connected DB serves
      const modelName = "TestModelForUT";
      const schema = new mongoose.Schema({ name: String });
      const db = getTenantDB(tenantId, modelName, schema);
      expect(db).to.exist;
      // getTenantDB returns a Mongoose db/connection-like object
      expect(db).to.be.an("object");
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
