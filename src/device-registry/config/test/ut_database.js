require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

// Stub the required modules
const mongooseStub = {
  createConnection: sinon.stub(),
};
const constantsStub = {
  MONGO_URI: "mongodb://localhost:27017/test-db",
  ENVIRONMENT: "TEST ENVIRONMENT",
  DB_NAME: "test-db",
};
const log4jsStub = {
  getLogger: sinon.stub().returns({}),
};

const dbConnectionModule = proxyquire("@config/database", {
  mongoose: mongooseStub,
  "@config/constants": constantsStub,
  log4js: log4jsStub,
});

describe("Database Connection Module", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("connectToMongoDB", () => {
    it("should return a valid database connection", () => {
      // Simulate a successful database connection
      const dbStub = {
        on: sinon.stub(),
        model: sinon.stub(),
        useDb: sinon.stub(),
      };
      mongooseStub.createConnection.returns(dbStub);

      const dbConnection = dbConnectionModule.connectToMongoDB();

      expect(dbConnection).to.equal(dbStub);
      expect(mongooseStub.createConnection.calledOnce).to.be.true;
      expect(
        mongooseStub.createConnection.calledWith(
          constantsStub.MONGO_URI,
          constantsStub.options
        )
      ).to.be.true;
    });

    it("should handle errors during database connection", () => {
      // Simulate an error during database connection
      mongooseStub.createConnection.throws(new Error("Connection Error"));

      const dbConnection = dbConnectionModule.connectToMongoDB();

      expect(dbConnection).to.be.undefined;
      expect(mongooseStub.createConnection.calledOnce).to.be.true;
      // Add more assertions as needed for error handling
    });
  });

  describe("getModelByTenant", () => {
    it("should return a tenant-specific model", () => {
      const tenantId = "exampleTenant";
      const modelName = "ExampleModel";
      const schema = {
        /* Define the schema object here */
      };

      // Stub the tenant-specific database returned by getTenantDB
      const tenantDbStub = {
        model: sinon.stub(),
      };
      const getTenantDBStub = sinon
        .stub(dbConnectionModule, "getTenantDB")
        .returns(tenantDbStub);

      const model = dbConnectionModule.getModelByTenant(
        tenantId,
        modelName,
        schema
      );

      expect(model).to.exist;
      expect(getTenantDBStub.calledOnce).to.be.true;
      expect(getTenantDBStub.calledWith(tenantId, modelName, schema)).to.be
        .true;
      expect(tenantDbStub.model.calledOnce).to.be.true;
      expect(tenantDbStub.model.calledWith(modelName, schema)).to.be.true;
    });

    it("should return null if tenant-specific database is not available", () => {
      const tenantId = "unknownTenant";
      const modelName = "ExampleModel";
      const schema = {
        /* Define the schema object here */
      };

      // Stub the getTenantDB to return undefined
      sinon.stub(dbConnectionModule, "getTenantDB").returns(undefined);

      const model = dbConnectionModule.getModelByTenant(
        tenantId,
        modelName,
        schema
      );

      expect(model).to.be.null;
    });
  });

  // Add more describe blocks for other functions in the module if necessary
});
