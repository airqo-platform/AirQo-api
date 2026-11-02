require("module-alias/register");
const { EventEmitter } = require("events");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

const {
  COMMAND_TIMEOUT_MS,
  CIRCUIT_COOLDOWN_MS,
  CONNECT_RETRY_DELAY_MS,
} = require("@config/redis-sentinel");

const buildSentinelStub = () => {
  const stub = new EventEmitter();
  stub.isOpen = true;
  stub.isReady = true;
  stub.connect = sinon.stub().resolves();
  stub.close = sinon.stub().resolves();
  stub.destroy = sinon.stub().resolves();
  stub.get = sinon.stub().resolves("value");
  stub.set = sinon.stub().resolves("OK");
  return stub;
};

const loadSentinelClient = (createSentinel) =>
  proxyquire("@config/redis-sentinel", {
    redis: { createSentinel },
  }).createSentinelClient({ name: "mymaster" });

describe("Redis Sentinel client", () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: 1000000 });
  });

  afterEach(() => {
    clock.restore();
  });

  it("is unavailable and rejects commands before connecting", async () => {
    const client = loadSentinelClient(sinon.stub());

    expect(client.isOpen).to.equal(false);
    expect(client.isReady).to.equal(false);

    let error;
    await client.get("key").catch((err) => (error = err));
    expect(error).to.be.an("error");
  });

  it("forwards commands once connected", async () => {
    const sentinel = buildSentinelStub();
    const client = loadSentinelClient(sinon.stub().returns(sentinel));

    await client.connect();

    expect(client.isOpen).to.equal(true);
    expect(client.isReady).to.equal(true);
    expect(await client.set("key", "value", { NX: true })).to.equal("OK");
    sinon.assert.calledOnceWithExactly(sentinel.set, "key", "value", {
      NX: true,
    });
  });

  it("times out a hung command and fails fast during the cooldown", async () => {
    const sentinel = buildSentinelStub();
    sentinel.get = sinon.stub().returns(new Promise(() => {}));
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const hung = client.get("key").catch((err) => err);
    await clock.tickAsync(COMMAND_TIMEOUT_MS);

    expect((await hung).message).to.include("timed out");
    expect(client.isReady).to.equal(false);

    const failedFast = await client.get("key").catch((err) => err);
    expect(failedFast).to.be.an("error");
    sinon.assert.calledOnce(sentinel.get);
  });

  it("does not open the circuit when a command fails on its own", async () => {
    const sentinel = buildSentinelStub();
    sentinel.get = sinon.stub().rejects(new Error("WRONGTYPE"));
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const error = await client.get("key").catch((err) => err);

    expect(error.message).to.equal("WRONGTYPE");
    expect(client.isReady).to.equal(true);
  });

  it("allows a single probe after the cooldown and recovers on success", async () => {
    const sentinel = buildSentinelStub();
    sentinel.get = sinon.stub();
    sentinel.get.onFirstCall().returns(new Promise(() => {}));
    sentinel.get.onSecondCall().resolves("recovered");
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const hung = client.get("key").catch((err) => err);
    await clock.tickAsync(COMMAND_TIMEOUT_MS);
    await hung;
    await clock.tickAsync(CIRCUIT_COOLDOWN_MS);
    expect(client.isReady).to.equal(true);

    const probe = client.get("key");
    const concurrent = await client.get("key").catch((err) => err);

    expect(concurrent).to.be.an("error");
    expect(await probe).to.equal("recovered");
    sinon.assert.calledTwice(sentinel.get);
    expect(client.isReady).to.equal(true);
  });

  it("retries a failed connect with a new Sentinel instance", async () => {
    const failed = buildSentinelStub();
    failed.connect = sinon.stub().rejects(new Error("no sentinels"));
    const healthy = buildSentinelStub();
    const createSentinel = sinon.stub();
    createSentinel.onFirstCall().returns(failed);
    createSentinel.onSecondCall().returns(healthy);
    const client = loadSentinelClient(createSentinel);
    const errors = [];
    client.on("error", (error) => errors.push(error));

    const connecting = client.connect();
    await clock.tickAsync(CONNECT_RETRY_DELAY_MS);
    await connecting;

    sinon.assert.calledOnce(failed.destroy);
    sinon.assert.calledTwice(createSentinel);
    expect(errors[0].message).to.equal("no sentinels");
    expect(client.isReady).to.equal(true);
  });

  it("emits string errors from the Sentinel client as Error objects", async () => {
    const sentinel = buildSentinelStub();
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    const errors = [];
    client.on("error", (error) => errors.push(error));
    await client.connect();

    sentinel.emit("error", "obseve client error: boom");

    expect(errors[0]).to.be.an("error");
    expect(errors[0].message).to.include("boom");
  });

  it("closes the underlying Sentinel client on quit and disconnect", async () => {
    const sentinel = buildSentinelStub();
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    await client.quit();
    await client.disconnect();

    sinon.assert.calledOnce(sentinel.close);
    sinon.assert.calledOnce(sentinel.destroy);
  });
});

describe("Redis mode selection", () => {
  const loadRedisConfig = (constants) => {
    const standaloneClient = new EventEmitter();
    standaloneClient.connect = sinon.stub().resolves();
    const sentinelClient = new EventEmitter();
    sentinelClient.connect = sinon.stub().resolves();
    const createClient = sinon.stub().returns(standaloneClient);
    const createSentinelClient = sinon.stub().returns(sentinelClient);

    const redisConfig = proxyquire("@config/redis", {
      "./constants": { ENVIRONMENT: "TEST", ...constants, "@noCallThru": true },
      "./redis-sentinel": { createSentinelClient },
      redis: { createClient },
    });

    return { redisConfig, createClient, createSentinelClient };
  };

  it("uses the standalone client when the flag is off", () => {
    const { redisConfig, createClient, createSentinelClient } = loadRedisConfig(
      {
        REDIS_USE_SENTINEL: false,
        REDIS_SERVER: "redis-master",
        REDIS_PORT: "6379",
        REDIS_HOST: "redis-sentinel",
      },
    );

    sinon.assert.notCalled(createSentinelClient);
    expect(createClient.firstCall.args[0].url).to.equal(
      "redis://redis-master:6379",
    );
    const status = redisConfig.redisUtils.getStatus();
    expect(status.mode).to.equal("standalone");
    expect(status.server).to.equal("redis-master:6379");
  });

  it("uses the Sentinel client and its settings when the flag is on", () => {
    const { redisConfig, createClient, createSentinelClient } = loadRedisConfig(
      {
        REDIS_USE_SENTINEL: true,
        REDIS_HOST: "redis-sentinel",
        REDIS_SERVER: "redis-master",
        REDIS_PORT: "26379",
        REDIS_SENTINEL_MASTER: "primary",
        REDIS_PASSWORD: "secret",
        REDIS_DB: "2",
      },
    );

    sinon.assert.notCalled(createClient);
    const options = createSentinelClient.firstCall.args[0];
    expect(options.name).to.equal("primary");
    expect(options.RESP).to.equal(2);
    expect(options.sentinelRootNodes).to.deep.equal([
      { host: "redis-sentinel", port: 26379 },
    ]);
    expect(options.nodeClientOptions.password).to.equal("secret");
    expect(options.nodeClientOptions.database).to.equal(2);
    expect(options.nodeClientOptions.disableOfflineQueue).to.equal(true);
    expect(options.sentinelClientOptions.password).to.equal("secret");
    const status = redisConfig.redisUtils.getStatus();
    expect(status.mode).to.equal("sentinel");
    expect(status.server).to.equal("redis-sentinel:26379");
  });

  it("falls back to REDIS_SERVER and default Sentinel settings", () => {
    const { createSentinelClient } = loadRedisConfig({
      REDIS_USE_SENTINEL: true,
      REDIS_SERVER: "redis-server",
    });

    const options = createSentinelClient.firstCall.args[0];
    expect(options.name).to.equal("mymaster");
    expect(options.sentinelRootNodes).to.deep.equal([
      { host: "redis-server", port: 26379 },
    ]);
    expect(options.nodeClientOptions.password).to.equal(undefined);
    expect(options.nodeClientOptions.database).to.equal(undefined);
  });

  it("does not connect when the flag is on but no host is configured", () => {
    const { redisConfig, createClient, createSentinelClient } = loadRedisConfig(
      { REDIS_USE_SENTINEL: true },
    );

    sinon.assert.notCalled(createSentinelClient);
    sinon.assert.calledOnceWithExactly(createClient, {});
    sinon.assert.notCalled(createClient.firstCall.returnValue.connect);
    expect(redisConfig.redisUtils.getStatus().server).to.equal(
      "Not configured",
    );
  });
});
