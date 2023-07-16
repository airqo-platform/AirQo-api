require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const { expect } = chai;
const { getModelByTenant, getTenantDB, mongodb } = require("./database");

describe("database", () => {
  let mongooseCreateConnectionStub;
  let mongooseConnectionStub;
  let mongooseModelStub;

  before(() => {
    mongooseCreateConnectionStub = sinon.stub(mongoose, "createConnection");
    mongooseConnectionStub = sinon.stub(mongoose.connection, "on");
    mongooseModelStub = sinon.stub(mongoose.Model, "model");
  });

  after(() => {
    mongooseCreateConnectionStub.restore();
    mongooseConnectionStub.restore();
    mongooseModelStub.restore();
  });

  it("should create a connection to the MongoDB database", () => {
    const dbMock = { on: sinon.stub() };
    mongooseCreateConnectionStub.returns(dbMock);

    const result = mongodb;

    expect(result).to.equal(dbMock);
    expect(mongooseCreateConnectionStub.calledOnce).to.be.true;
    expect(mongooseCreateConnectionStub.firstCall.args[0]).to.equal(
      "mongodb://localhost/"
    );
    expect(mongooseCreateConnectionStub.firstCall.args[1]).to.deep.equal({
      useCreateIndex: true,
      useNewUrlParser: true,
      useFindAndModify: false,
      useUnifiedTopology: true,
      autoIndex: true,
      poolSize: 10,
      bufferMaxEntries: 0,
      connectTimeoutMS: 1200000,
      socketTimeoutMS: 600000,
      serverSelectionTimeoutMS: 3600000,
      dbName: undefined,
    });
    expect(mongooseConnectionStub.calledThrice).to.be.true;
    expect(mongooseConnectionStub.getCall(0).args[0]).to.equal("open");
    expect(mongooseConnectionStub.getCall(1).args[0]).to.equal("error");
    expect(mongooseConnectionStub.getCall(2).args[0]).to.equal("disconnection");
  });

  it("should create a new database connection by switching tenant", () => {
    const dbMock = { on: sinon.stub(), useDb: sinon.stub() };
    mongooseCreateConnectionStub.returns(dbMock);

    const result = getTenantDB("tenant1", "modelName", "schema");

    expect(result).to.equal(dbMock);
    expect(dbMock.useDb.calledOnce).to.be.true;
    expect(dbMock.useDb.firstCall.args[0]).to.equal("DB_NAME_tenant1");
    expect(dbMock.useDb.firstCall.args[1]).to.deep.equal({ useCache: true });
  });

  it("should return the model as per tenant", () => {
    const tenantDbMock = { model: sinon.stub() };
    const getTenantDBStub = sinon.stub().returns(tenantDbMock);
    const modelName = "modelName";
    const schema = "schema";

    const result = getModelByTenant("tenant1", modelName, schema);

    expect(result).to.equal(tenantDbMock.model);
    expect(getTenantDBStub.calledOnce).to.be.true;
    expect(getTenantDBStub.firstCall.args[0]).to.equal("tenant1");
    expect(getTenantDBStub.firstCall.args[1]).to.equal(modelName);
    expect(getTenantDBStub.firstCall.args[2]).to.equal(schema);
    expect(tenantDbMock.model.calledOnce).to.be.true;
    expect(tenantDbMock.model.firstCall.args[0]).to.equal(modelName);
  });
});
