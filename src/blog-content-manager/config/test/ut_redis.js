const { expect } = require("chai");
const sinon = require("sinon");
const Redis = require("ioredis");
const constants = require("@config/constants");
const { logElement } = require("@utils/log");
const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;

describe("client1 Redis instance", () => {
  let createStub;

  beforeEach(() => {
    // Stub the Redis constructor with sinon.stub()
    createStub = sinon.stub(Redis, "create").returns({
      set: sinon.stub().resolves("OK"),
      get: sinon.stub().resolves("value"),
      del: sinon.stub().resolves(1),
      hgetall: sinon.stub().resolves({ key1: "value1", key2: "value2" }),
      zrange: sinon.stub().resolves(["value1", "value2", "value3"]),
      quit: sinon.stub().resolves("OK"),
    });

    // Stub the logElement function from '@utils/log' module
    sinon.stub(logElement);
  });

  afterEach(() => {
    // Restore the original behavior of the stubbed functions
    sinon.restore();
  });

  it("should set a value in Redis", async () => {
    const client = new Redis({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });

    const result = await client.set("key", "value");

    expect(result).to.equal("OK");
    expect(createStub).to.have.been.calledOnceWith({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });
    expect(createStub().set).to.have.been.calledOnceWith("key", "value");
  });

  it("should get a value from Redis", async () => {
    const client = new Redis({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });

    const result = await client.get("key");

    expect(result).to.equal("value");
    expect(createStub).to.have.been.calledOnceWith({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });
    expect(createStub().get).to.have.been.calledOnceWith("key");
  });

  it("should delete a value from Redis", async () => {
    const client = new Redis({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });

    const result = await client.del("key");

    expect(result).to.equal(1);
    expect(createStub).to.have.been.calledOnceWith({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });
    expect(createStub().del).to.have.been.calledOnceWith("key");
  });

  it("should get all values for a hash key from Redis", async () => {
    const client = new Redis({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });

    const result = await client.hgetall("hashKey");

    expect(result).to.deep.equal({ key1: "value1", key2: "value2" });
    expect(createStub).to.have.been.calledOnceWith({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });
    expect(createStub().hgetall).to.have.been.calledOnceWith("hashKey");
  });

  it("should get the range of values from a sorted set key in Redis", async () => {
    const client = new Redis({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });

    const result = await client.zrange("setKey", 0, -1);

    expect(result).to.deep.equal(["value1", "value2", "value3"]);
    expect(createStub).to.have.been.calledOnceWith({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });
    expect(createStub().zrange).to.have.been.calledOnceWith("setKey", 0, -1);
  });

  it("should quit the Redis connection", async () => {
    const client = new Redis({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });

    const result = await client.quit();

    expect(result).to.equal("OK");
    expect(createStub).to.have.been.calledOnceWith({
      port: REDIS_PORT,
      host: REDIS_SERVER,
      showFriendlyErrorStack: true,
    });
    expect(createStub().quit).to.have.been.calledOnce;
  });
});
