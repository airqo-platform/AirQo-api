require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

// Stub the required modules
const mongooseStub = {
  createConnection: sinon.stub(),
  set: sinon.stub(),
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

  });

  describe("getModelByTenant", () => {

  });

  // Add more describe blocks for other functions in the module if necessary

  describe("idempotent model registration", () => {
    function makeModule(connectionDb) {
      const freshMongoose = {
        createConnection: sinon.stub().returns(connectionDb),
        set: sinon.stub(),
      };
      const mod = proxyquire("@config/database", {
        mongoose: freshMongoose,
        "@config/constants": constantsStub,
        log4js: log4jsStub,
      });
      mod.connectToMongoDB();
      return mod;
    }

    function makeTenantDb() {
      const tenantDb = { model: sinon.stub() };
      // First call to model(name) throws — model not yet registered
      tenantDb.model.withArgs("TestModel").onFirstCall().throws(
        new Error("Schema hasn't been registered for model 'TestModel'")
      );
      return tenantDb;
    }

    it("registers model on first call and retrieves it (not re-registers) on second query call", () => {
      const tenantDb = makeTenantDb();
      const connectionDb = { on: sinon.stub(), useDb: sinon.stub().returns(tenantDb) };
      const mod = makeModule(connectionDb);

      mod.getQueryTenantDB("airqo", "TestModel", {});
      mod.getQueryTenantDB("airqo", "TestModel", {});

      const registrations = tenantDb.model.args.filter((a) => a.length === 2);
      expect(registrations).to.have.length(1);
    });

    it("registers model on first call and retrieves it (not re-registers) on second command call", () => {
      const tenantDb = makeTenantDb();
      const connectionDb = { on: sinon.stub(), useDb: sinon.stub().returns(tenantDb) };
      const mod = makeModule(connectionDb);

      mod.getCommandTenantDB("airqo", "TestModel", {});
      mod.getCommandTenantDB("airqo", "TestModel", {});

      const registrations = tenantDb.model.args.filter((a) => a.length === 2);
      expect(registrations).to.have.length(1);
    });

    it("registers model on first call and retrieves it (not re-registers) on second snapshot call", () => {
      const tenantDb = makeTenantDb();
      const connectionDb = { on: sinon.stub(), useDb: sinon.stub().returns(tenantDb) };
      const mod = makeModule(connectionDb);

      mod.getSnapshotTenantDB("airqo", "TestModel", {});
      mod.getSnapshotTenantDB("airqo", "TestModel", {});

      const registrations = tenantDb.model.args.filter((a) => a.length === 2);
      expect(registrations).to.have.length(1);
    });
  });
});
