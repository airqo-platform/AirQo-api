require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const winstonMongodbModule = require("winston-mongodb");
const logModule = require("@models/log");
const constants = require("@config/constants");
const { winstonLogger } = require("@utils/common");

describe("winstonLogger", () => {
  beforeEach(() => {
    winstonLogger.__resetMongoTransportStateForTesting();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("adds the MongoDB transport with the expected configuration", () => {
    const fakeClient = { fake: "mongoClient" };
    const fakeConnection = { getClient: () => fakeClient };
    const fakeModel = { modelName: "logs" };

    sinon.stub(logModule, "LogDB").returns(fakeConnection);
    sinon.stub(logModule, "LogModel").returns(fakeModel);
    const addStub = sinon.stub(winstonLogger, "add");
    const MongoDBStub = sinon
      .stub(winstonMongodbModule, "MongoDB")
      .returns({ on: () => {}, log: () => {} });

    winstonLogger.__addMongoTransportForTesting();

    expect(MongoDBStub.calledOnce).to.be.true;
    const transportOptions = MongoDBStub.getCall(0).args[0];

    // The transport must receive the native MongoClient (via getClient()),
    // not the Mongoose Connection itself, plus an explicit dbName — passing
    // the raw connection instead trips winston-mongodb's deprecated
    // "preconnected object" path and logs a startup warning.
    expect(transportOptions.db).to.equal(fakeClient);
    expect(transportOptions.dbName).to.equal(`${constants.DB_NAME}_airqo`);
    expect(transportOptions.options).to.deep.equal({
      useUnifiedTopology: true,
    });
    expect(transportOptions.collection).to.equal("logs");
    expect(transportOptions.metaKey).to.equal("metadata");
    expect(transportOptions.level).to.equal("info");
    expect(transportOptions.model).to.equal(fakeModel);
    expect(addStub.calledOnce).to.be.true;
  });

  it("does not add the transport a second time once already added", () => {
    sinon.stub(logModule, "LogDB").returns({ getClient: () => ({}) });
    sinon.stub(logModule, "LogModel").returns({});
    const addStub = sinon.stub(winstonLogger, "add");
    const MongoDBStub = sinon
      .stub(winstonMongodbModule, "MongoDB")
      .returns({ on: () => {}, log: () => {} });

    winstonLogger.__addMongoTransportForTesting();
    winstonLogger.__addMongoTransportForTesting();

    expect(MongoDBStub.calledOnce).to.be.true;
    expect(addStub.calledOnce).to.be.true;
  });

  it("falls back silently if the MongoDB transport cannot be constructed", () => {
    sinon.stub(logModule, "LogDB").throws(new Error("DB not ready"));
    const addStub = sinon.stub(winstonLogger, "add");

    expect(() => winstonLogger.__addMongoTransportForTesting()).to.not.throw();
    expect(addStub.called).to.be.false;
  });
});
