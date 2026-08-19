require("module-alias/register");
const { expect } = require("chai");
const rewire = require("rewire");
const sinon = require("sinon");

const redisConfig = rewire("@config/redis");

describe("redis wrapper functions", () => {
  let mockRedis;

  beforeEach(() => {
    mockRedis = {
      isOpen: false,
      isReady: false,
      get: sinon.stub().resolves("value"),
      set: sinon.stub().resolves("OK"),
      setEx: sinon.stub().resolves("OK"),
      incr: sinon.stub().resolves(1),
      expire: sinon.stub().resolves(1),
      del: sinon.stub().resolves(1),
      mGet: sinon.stub().resolves(["value1", "value2"]),
      ping: sinon.stub().resolves("PONG"),
    };
    redisConfig.__set__("redis", mockRedis);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("when Redis is not available (isOpen=false, isReady=false)", () => {
    it("redisGetAsync returns null", async () => {
      const result = await redisConfig.redisGetAsync("test-key");
      expect(result).to.be.null;
    });

    it("redisSetAsync returns null", async () => {
      const result = await redisConfig.redisSetAsync("key", "value");
      expect(result).to.be.null;
    });

    it("redisIncrAsync returns null", async () => {
      const result = await redisConfig.redisIncrAsync("counter");
      expect(result).to.be.null;
    });

    it("redisExpireAsync returns 0", async () => {
      const result = await redisConfig.redisExpireAsync("key", 60);
      expect(result).to.equal(0);
    });

    it("redisDelAsync returns 0", async () => {
      const result = await redisConfig.redisDelAsync("key");
      expect(result).to.equal(0);
    });

    it("redisMgetAsync returns array of nulls", async () => {
      const result = await redisConfig.redisMgetAsync(["key1", "key2"]);
      expect(result).to.deep.equal([null, null]);
    });

    it("redisMgetAsync returns empty array for empty input", async () => {
      const result = await redisConfig.redisMgetAsync([]);
      expect(result).to.deep.equal([]);
    });

    it("redisPingAsync throws when Redis not ready", async () => {
      try {
        await redisConfig.redisPingAsync();
        throw new Error("Should have thrown");
      } catch (err) {
        expect(err.message).to.equal("Redis not available");
      }
    });

    it("redisSetWithTTLAsync returns null", async () => {
      const result = await redisConfig.redisSetWithTTLAsync("key", "value", 60);
      expect(result).to.be.null;
    });

    it("redisSetNXAsync throws when Redis not ready", async () => {
      try {
        await redisConfig.redisSetNXAsync("key", "value", 60);
        throw new Error("Should have thrown");
      } catch (err) {
        expect(err.message).to.equal("Redis not available for distributed lock");
      }
    });

    it("redisUtils.isAvailable returns false", () => {
      expect(redisConfig.redisUtils.isAvailable()).to.be.false;
    });

    it("redisUtils.getStatus returns disconnected state", () => {
      const status = redisConfig.redisUtils.getStatus();
      expect(status.connected).to.be.false;
      expect(status.ready).to.be.false;
    });

    it("redisUtils.ping returns false", async () => {
      const result = await redisConfig.redisUtils.ping();
      expect(result).to.be.false;
    });
  });

  describe("when Redis is available (isOpen=true, isReady=true)", () => {
    beforeEach(() => {
      mockRedis.isOpen = true;
      mockRedis.isReady = true;
    });

    it("redisGetAsync calls redis.get and returns value", async () => {
      const result = await redisConfig.redisGetAsync("test-key");
      expect(result).to.equal("value");
      expect(mockRedis.get.calledWith("test-key")).to.be.true;
    });

    it("redisSetAsync calls redis.set and returns OK", async () => {
      const result = await redisConfig.redisSetAsync("key", "value");
      expect(result).to.equal("OK");
      expect(mockRedis.set.calledWith("key", "value")).to.be.true;
    });

    it("redisSetAsync with TTL calls redis.setEx", async () => {
      const result = await redisConfig.redisSetAsync("key", "value", 60);
      expect(result).to.equal("OK");
      expect(mockRedis.setEx.calledWith("key", 60, "value")).to.be.true;
    });

    it("redisIncrAsync calls redis.incr and returns count", async () => {
      const result = await redisConfig.redisIncrAsync("counter");
      expect(result).to.equal(1);
      expect(mockRedis.incr.calledWith("counter")).to.be.true;
    });

    it("redisExpireAsync calls redis.expire and returns 1", async () => {
      const result = await redisConfig.redisExpireAsync("key", 60);
      expect(result).to.equal(1);
      expect(mockRedis.expire.calledWith("key", 60)).to.be.true;
    });

    it("redisDelAsync calls redis.del and returns count", async () => {
      const result = await redisConfig.redisDelAsync("key");
      expect(result).to.equal(1);
      expect(mockRedis.del.calledWith("key")).to.be.true;
    });

    it("redisMgetAsync calls redis.mGet and returns values", async () => {
      const result = await redisConfig.redisMgetAsync(["key1", "key2"]);
      expect(result).to.deep.equal(["value1", "value2"]);
      expect(mockRedis.mGet.calledWith(["key1", "key2"])).to.be.true;
    });

    it("redisSetWithTTLAsync calls redis.setEx", async () => {
      const result = await redisConfig.redisSetWithTTLAsync("key", "value", 60);
      expect(result).to.equal("OK");
      expect(mockRedis.setEx.calledWith("key", 60, "value")).to.be.true;
    });

    it("redisUtils.isAvailable returns true", () => {
      expect(redisConfig.redisUtils.isAvailable()).to.be.true;
    });

    it("redisUtils.getStatus returns connected state", () => {
      const status = redisConfig.redisUtils.getStatus();
      expect(status.connected).to.be.true;
      expect(status.ready).to.be.true;
    });

    it("redisUtils.ping returns true on PONG", async () => {
      const result = await redisConfig.redisUtils.ping();
      expect(result).to.be.true;
    });
  });
});
