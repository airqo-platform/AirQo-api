require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

// Stub the required modules
const constantsStub = {
  REDIS_SERVER: "localhost",
  REDIS_PORT: 6379,
};

const redisClientStub = {
  on: sinon.stub(),
};

const redisModule = proxyquire("@config/redis", {
  "@config/constants": constantsStub,
  redis: {
    createClient: sinon.stub().returns(redisClientStub),
  },
  "@utils/log": {
    logElement: sinon.stub(),
  },
});

describe("Redis Client Configuration", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should create a Redis client with the correct host and port", () => {
    expect(redisModule.host).to.equal(constantsStub.REDIS_SERVER);
    expect(redisModule.port).to.equal(constantsStub.REDIS_PORT);

    sinon.assert.calledOnceWithExactly(redis.createClient, {
      host: constantsStub.REDIS_SERVER,
      port: constantsStub.REDIS_PORT,
      retry_strategy: sinon.match.func,
    });
  });

  it("should set up error event listener", () => {
    const errorListener = redisClientStub.on.withArgs("error").args[0][1];
    expect(errorListener).to.be.a("function");

    // Test the error event handling here if needed
  });

  it("should set up ready event listener", () => {
    const readyListener = redisClientStub.on.withArgs("ready").args[0][1];
    expect(readyListener).to.be.a("function");

    // Test the ready event handling here if needed
  });

  // Add more tests for other properties or behavior if necessary
});
