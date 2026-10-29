require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const rewire = require("rewire");
const mongoose = require("mongoose");

const recorder = rewire("@utils/api-key-usage-recorder.util");
const usageUtil = rewire("@utils/api-key-usage.util");

describe("api-key-usage-recorder.util", () => {
  let bulkWrite;
  let existingDocs;
  let original;

  beforeEach(() => {
    recorder._reset();
    bulkWrite = sinon.stub().resolves({});
    existingDocs = [];
    original = recorder.__get__("ApiKeyUsageDailyModel");
    recorder.__set__("ApiKeyUsageDailyModel", () => ({
      bulkWrite,
      find: () => ({ lean: async () => existingDocs }),
    }));
  });

  afterEach(() => {
    recorder.__set__("ApiKeyUsageDailyModel", original);
    recorder._reset();
    sinon.restore();
  });

  describe("serviceOf", () => {
    it("reads the service after the /api/vN prefix", () => {
      expect(recorder.serviceOf("/api/v2/analytics/data-download")).to.equal("analytics");
      expect(recorder.serviceOf("/api/v3/devices/readings")).to.equal("devices");
    });

    it("falls back to the first segment, or (other) for id-like/empty paths", () => {
      expect(recorder.serviceOf("/health")).to.equal("health");
      expect(recorder.serviceOf("/:id/x")).to.equal("(other)");
      expect(recorder.serviceOf("")).to.equal("(other)");
    });
  });

  describe("ipKey", () => {
    it("replaces dots so the IP is a safe Mongo key", () => {
      expect(recorder.ipKey("10.0.0.1")).to.equal("10_0_0_1");
      expect(recorder.ipKey("")).to.equal(null);
    });
  });

  describe("recordKeyCall", () => {
    const clientId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    it("rejects calls without a valid client id", () => {
      expect(recorder.recordKeyCall({ clientId: "nope", uri: "/api/v2/analytics" })).to.equal(false);
    });

    it("aggregates calls per key and day into one upsert", async () => {
      for (let i = 0; i < 3; i += 1) {
        recorder.recordKeyCall({
          clientId,
          userId,
          uri: "/api/v2/analytics/data-download?token=secret",
          ip: "41.1.2.3",
        });
      }
      recorder.recordKeyCall({
        clientId,
        userId,
        uri: "/api/v2/devices/measurements/sites/5f8d0d55b54764421b7156c3",
        method: "GET",
        ip: "41.1.2.4",
      });
      await recorder.flush();

      expect(bulkWrite.calledOnce).to.equal(true);
      const [ops] = bulkWrite.firstCall.args;
      expect(ops).to.have.length(1);
      const { filter, update } = ops[0].updateOne;
      expect(String(filter.client_id)).to.equal(String(clientId));
      expect(update.$inc.calls).to.equal(4);
      expect(update.$inc["services.analytics"]).to.equal(3);
      expect(update.$inc["services.devices"]).to.equal(1);
      // Query strings (and so raw tokens) are never stored.
      expect(update.$inc["api.GET /api/v2/analytics/data-download"]).to.equal(3);
      expect(update.$inc["api.GET /api/v2/devices/measurements/sites/:id"]).to.equal(1);
      expect(update.$inc["ips.41_1_2_3"]).to.equal(3);
      expect(update.$set.last_ip).to.equal("41.1.2.4");
      expect(String(update.$set.user_id)).to.equal(String(userId));
    });

    it("drops the batch without throwing when the write fails", async () => {
      bulkWrite.rejects(new Error("boom"));
      recorder.recordKeyCall({ clientId, uri: "/api/v2/analytics" });
      await recorder.flush();
      expect(recorder.getStats().failed_entries).to.equal(1);
    });
  });
});

describe("api-key-usage.util helpers", () => {
  it("defaults to the last 7 UTC days and rejects inverted or oversized ranges", () => {
    const range = usageUtil.resolveRange({ to: "2026-09-27" });
    expect(range).to.deep.equal({ from: "2026-09-21", to: "2026-09-27" });
    expect(usageUtil.resolveRange({ from: "2026-09-28", to: "2026-09-27" }).error.status).to.equal(400);
    expect(usageUtil.resolveRange({ from: "2026-01-01", to: "2026-09-27" }).error.status).to.equal(400);
  });

  it("decodes stored IPv4 keys", () => {
    expect(usageUtil.decodeIp("41_1_2_3")).to.equal("41.1.2.3");
    expect(usageUtil.decodeIp("::ffff:41_1_2_3")).to.equal("::ffff:41.1.2.3");
    expect(usageUtil.decodeIp("(other)")).to.equal("(other)");
  });

  it("labels every UTC hour in the range", () => {
    const labels = usageUtil.hourLabels("2026-09-26", "2026-09-27");
    expect(labels).to.have.length(48);
    expect(labels[0]).to.equal("2026-09-26T00:00:00Z");
    expect(labels[47]).to.equal("2026-09-27T23:00:00Z");
  });
});
