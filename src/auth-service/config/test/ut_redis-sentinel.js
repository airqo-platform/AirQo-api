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
  stub.sendCommand = sinon.stub().resolves("OK");
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

    const error = await client.get("key").catch((err) => err);
    expect(error).to.be.an("error");
  });

  it("builds the Redis arguments for every supported command", async () => {
    const sentinel = buildSentinelStub();
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    await client.get("key");
    await client.set("key", 5, { NX: true, EX: 30 });
    await client.set("key", "value");
    await client.setEx("key", 30, "value");
    await client.incr("key");
    await client.expire("key", 30);
    await client.del("key");
    await client.del(["one", "two"]);
    await client.mGet(["one", "two"]);
    await client.ping();

    expect(sentinel.sendCommand.args.map((args) => args[1])).to.deep.equal([
      ["GET", "key"],
      ["SET", "key", "5", "NX", "EX", "30"],
      ["SET", "key", "value"],
      ["SETEX", "key", "30", "value"],
      ["INCR", "key"],
      ["EXPIRE", "key", "30"],
      ["DEL", "key"],
      ["DEL", "one", "two"],
      ["MGET", "one", "two"],
      ["PING"],
    ]);
    expect(sentinel.sendCommand.firstCall.args[0]).to.equal(false);
  });

  it("rejects unsupported SET options without sending the command", async () => {
    const sentinel = buildSentinelStub();
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const pending = client.set("key", "value", { PX: 1000 });
    expect(pending).to.be.a("promise");

    const error = await pending.catch((err) => err);
    expect(error.message).to.include("PX");
    sinon.assert.notCalled(sentinel.sendCommand);
    expect(client.isReady).to.equal(true);
  });

  it("accepts the sendCommand signature rate-limit-redis uses", async () => {
    const sentinel = buildSentinelStub();
    sentinel.sendCommand = sinon.stub().resolves("sha");
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    expect(await client.sendCommand(["SCRIPT", "LOAD", "script"])).to.equal(
      "sha",
    );
    expect(sentinel.sendCommand.firstCall.args[1]).to.deep.equal([
      "SCRIPT",
      "LOAD",
      "script",
    ]);
  });

  it("is recognised as node-redis by connect-redis and scans all keys", async () => {
    const sentinel = buildSentinelStub();
    sentinel.sendCommand = sinon.stub();
    sentinel.sendCommand.onFirstCall().resolves(["7", ["one"]]);
    sentinel.sendCommand.onSecondCall().resolves(["0", ["two", "three"]]);
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    expect("scanIterator" in client).to.equal(true);

    const keys = [];
    for await (const key of client.scanIterator({ MATCH: "a:*", COUNT: 10 })) {
      keys.push(key);
    }

    expect(keys).to.deep.equal(["one", "two", "three"]);
    expect(sentinel.sendCommand.firstCall.args[1]).to.deep.equal([
      "SCAN",
      "0",
      "MATCH",
      "a:*",
      "COUNT",
      "10",
    ]);
    expect(sentinel.sendCommand.secondCall.args[1][1]).to.equal("7");
  });

  it("times out a hung command and fails fast during the cooldown", async () => {
    const sentinel = buildSentinelStub();
    sentinel.sendCommand = sinon.stub().returns(new Promise(() => {}));
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const hung = client.get("key").catch((err) => err);
    await clock.tickAsync(COMMAND_TIMEOUT_MS);

    expect((await hung).message).to.include("timed out");
    expect(client.isReady).to.equal(false);

    const failedFast = await client.get("key").catch((err) => err);
    expect(failedFast).to.be.an("error");
    sinon.assert.calledOnce(sentinel.sendCommand);
  });

  it("aborts a command when it times out", async () => {
    const sentinel = buildSentinelStub();
    sentinel.sendCommand = sinon.stub().returns(new Promise(() => {}));
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const hung = client.get("key").catch((err) => err);
    const { abortSignal } = sentinel.sendCommand.firstCall.args[2];
    expect(abortSignal.aborted).to.equal(false);

    await clock.tickAsync(COMMAND_TIMEOUT_MS);
    await hung;

    expect(abortSignal.aborted).to.equal(true);
  });

  it("does not let a late reply from an earlier command close the circuit", async () => {
    const sentinel = buildSentinelStub();
    let finishEarlierCommand;
    sentinel.sendCommand = sinon.stub();
    sentinel.sendCommand.onFirstCall().returns(
      new Promise((resolve) => {
        finishEarlierCommand = resolve;
      }),
    );
    sentinel.sendCommand.onSecondCall().returns(new Promise(() => {}));
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const earlier = client.get("key").catch((err) => err);
    await clock.tickAsync(COMMAND_TIMEOUT_MS);
    await earlier;
    await clock.tickAsync(CIRCUIT_COOLDOWN_MS);
    const probe = client.get("key").catch((err) => err);
    await clock.tickAsync(COMMAND_TIMEOUT_MS);
    await probe;

    finishEarlierCommand("late");
    await clock.tickAsync(0);

    expect(client.isReady).to.equal(false);
  });

  it("does not let a timed-out probe's late reply close the circuit", async () => {
    const sentinel = buildSentinelStub();
    let finishProbe;
    sentinel.sendCommand = sinon.stub();
    sentinel.sendCommand.onFirstCall().returns(new Promise(() => {}));
    sentinel.sendCommand.onSecondCall().returns(
      new Promise((resolve) => {
        finishProbe = resolve;
      }),
    );
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const hung = client.get("key").catch((err) => err);
    await clock.tickAsync(COMMAND_TIMEOUT_MS);
    await hung;
    await clock.tickAsync(CIRCUIT_COOLDOWN_MS);
    const probe = client.get("key").catch((err) => err);
    await clock.tickAsync(COMMAND_TIMEOUT_MS);
    await probe;

    finishProbe("late");
    await clock.tickAsync(0);

    expect(client.isReady).to.equal(false);
  });

  it("does not open the circuit when a command fails on its own", async () => {
    const sentinel = buildSentinelStub();
    sentinel.sendCommand = sinon.stub().rejects(new Error("WRONGTYPE"));
    const client = loadSentinelClient(sinon.stub().returns(sentinel));
    await client.connect();

    const error = await client.get("key").catch((err) => err);

    expect(error.message).to.equal("WRONGTYPE");
    expect(client.isReady).to.equal(true);
  });

  it("allows a single probe after the cooldown and recovers on success", async () => {
    const sentinel = buildSentinelStub();
    sentinel.sendCommand = sinon.stub();
    sentinel.sendCommand.onFirstCall().returns(new Promise(() => {}));
    sentinel.sendCommand.onSecondCall().resolves("recovered");
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
    sinon.assert.calledTwice(sentinel.sendCommand);
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
  const originalPort = process.env.REDIS_PORT;

  afterEach(() => {
    if (originalPort === undefined) delete process.env.REDIS_PORT;
    else process.env.REDIS_PORT = originalPort;
  });

  const loadRedisConfig = (constants, redisPort) => {
    if (redisPort === undefined) delete process.env.REDIS_PORT;
    else process.env.REDIS_PORT = redisPort;

    const standaloneClient = new EventEmitter();
    const sentinelClient = new EventEmitter();
    const createClient = sinon.stub().returns(standaloneClient);
    const createSentinelClient = sinon.stub().returns(sentinelClient);

    const redisConfig = proxyquire("@config/redis", {
      "./constants": { ...constants, "@noCallThru": true },
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
        REDIS_PORT: 6379,
        REDIS_HOST: "redis-sentinel",
      },
      "6379",
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
        REDIS_PORT: 26379,
        REDIS_SENTINEL_MASTER: "primary",
        REDIS_PASSWORD: "secret",
        REDIS_SENTINEL_PASSWORD: "sentinel-secret",
        REDIS_DB: "2",
      },
      "26379",
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
    expect(options.sentinelClientOptions.password).to.equal("sentinel-secret");
    const status = redisConfig.redisUtils.getStatus();
    expect(status.mode).to.equal("sentinel");
    expect(status.server).to.equal("redis-sentinel:26379");
  });

  it("does not send the Redis node password to Sentinel", () => {
    const { createSentinelClient } = loadRedisConfig(
      {
        REDIS_USE_SENTINEL: true,
        REDIS_HOST: "redis-sentinel",
        REDIS_PASSWORD: "secret",
      },
      "26379",
    );

    const options = createSentinelClient.firstCall.args[0];
    expect(options.nodeClientOptions.password).to.equal("secret");
    expect(options.sentinelClientOptions.password).to.equal(undefined);
  });

  it("falls back to REDIS_SERVER and the default Sentinel settings", () => {
    const { createSentinelClient } = loadRedisConfig({
      REDIS_USE_SENTINEL: true,
      REDIS_SERVER: "redis-server",
      REDIS_PORT: 6379,
    });

    const options = createSentinelClient.firstCall.args[0];
    expect(options.name).to.equal("mymaster");
    expect(options.sentinelRootNodes).to.deep.equal([
      { host: "redis-server", port: 26379 },
    ]);
    expect(options.nodeClientOptions.password).to.equal(undefined);
    expect(options.nodeClientOptions.database).to.equal(undefined);
  });
});

describe("Rate limit store script loading", () => {
  it("does not leave an unhandled rejection when Redis fails during creation", async () => {
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    try {
      const { __internal } = proxyquire("@middleware/rate-limiter", {
        "@config/redis": {
          redis: {
            sendCommand: sinon.stub().rejects(new Error("Redis unavailable")),
          },
          redisUtils: { isAvailable: () => true },
        },
      });

      __internal.createRedisStore({ prefix: "test:" });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(unhandled).to.deep.equal([]);
    } finally {
      process.removeListener("unhandledRejection", onUnhandled);
    }
  });
});
