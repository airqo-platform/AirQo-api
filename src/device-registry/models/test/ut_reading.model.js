require("module-alias/register");
const { expect } = require("chai");
const proxyquire = require("proxyquire");
const constants = require("@config/constants");
const ReadingModel = require("@models/Reading");

// Pure, DB-free logic exposed by Reading.js specifically for unit testing —
// see the `ReadingModel.clampMapTimeWindow` / `ReadingModel.resolveRecentLookbackDays`
// assignments at the bottom of models/Reading.js.
const { clampMapTimeWindow, resolveRecentLookbackDays } = ReadingModel;

// Allow a few seconds of slack for Date.now() drift between the function
// call and the assertion.
const ASSERTION_SLACK_MS = 5000;

describe("ReadingModel time-window helpers", () => {
  describe("clampMapTimeWindow", () => {
    it("defaults to MAP_DEFAULT_LOOKBACK_HOURS when no caller time is given", () => {
      const { effectiveGte } = clampMapTimeWindow(undefined);
      const expected =
        Date.now() - constants.MAP_DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000;
      expect(effectiveGte.getTime()).to.be.closeTo(
        expected,
        ASSERTION_SLACK_MS,
      );
    });

    it("defaults the same way when callerTime is null", () => {
      const { effectiveGte } = clampMapTimeWindow(null);
      const expected =
        Date.now() - constants.MAP_DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000;
      expect(effectiveGte.getTime()).to.be.closeTo(
        expected,
        ASSERTION_SLACK_MS,
      );
    });

    it("honours an explicit bare-Date caller time within the last 48h", () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const { effectiveGte } = clampMapTimeWindow(sixHoursAgo);
      expect(effectiveGte.getTime()).to.equal(sixHoursAgo.getTime());
    });

    it("honours an explicit { $gte } caller time within the last 48h", () => {
      const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
      const { effectiveGte } = clampMapTimeWindow({ $gte: twentyHoursAgo });
      expect(effectiveGte.getTime()).to.equal(twentyHoursAgo.getTime());
    });

    it("honours an explicit caller time between 48h and 14d old", () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const { effectiveGte } = clampMapTimeWindow({ $gte: fiveDaysAgo });
      expect(effectiveGte.getTime()).to.equal(fiveDaysAgo.getTime());
    });

    it("clamps a caller time older than 14d up to fourteenDaysAgo (TTL floor)", () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { effectiveGte, fourteenDaysAgo } = clampMapTimeWindow({
        $gte: thirtyDaysAgo,
      });
      expect(effectiveGte.getTime()).to.equal(fourteenDaysAgo.getTime());
    });

    it("clamps a misconfigured (oversized) MAP_DEFAULT_LOOKBACK_HOURS to the 14d TTL floor", () => {
      // Simulates MAP_DEFAULT_LOOKBACK_HOURS being set far too large (e.g. a
      // typo'd env var) — proxyquire falls through to the real @config/constants
      // for every field except the one overridden here.
      const ReadingModelWithHugeDefault = proxyquire("@models/Reading", {
        "@config/constants": { MAP_DEFAULT_LOOKBACK_HOURS: 24 * 365 },
      });

      const { effectiveGte, fourteenDaysAgo } =
        ReadingModelWithHugeDefault.clampMapTimeWindow(undefined);

      expect(effectiveGte.getTime()).to.equal(fourteenDaysAgo.getTime());
    });
  });

  describe("resolveRecentLookbackDays", () => {
    it("uses the caller-supplied override when it is a positive number", () => {
      expect(resolveRecentLookbackDays(0.25, 1)).to.equal(0.25);
      expect(resolveRecentLookbackDays(3, 1)).to.equal(3);
    });

    it("falls back to the shared default when no override is given", () => {
      expect(resolveRecentLookbackDays(undefined, 1)).to.equal(1);
    });

    it("falls back to the shared default for a zero or negative override", () => {
      expect(resolveRecentLookbackDays(0, 1)).to.equal(1);
      expect(resolveRecentLookbackDays(-2, 1)).to.equal(1);
    });

    it("falls back to the shared default for Infinity, -Infinity, and NaN", () => {
      // Infinity previously slipped through the old `typeof x === "number"`
      // check (Infinity > 0 is true), producing new Date(-Infinity) —
      // an Invalid Date fed straight into the Mongo $gte query.
      expect(resolveRecentLookbackDays(Infinity, 1)).to.equal(1);
      expect(resolveRecentLookbackDays(-Infinity, 1)).to.equal(1);
      expect(resolveRecentLookbackDays(NaN, 1)).to.equal(1);
    });

    it("falls back to the shared default for a non-numeric override", () => {
      expect(resolveRecentLookbackDays("1", 1)).to.equal(1);
      expect(resolveRecentLookbackDays(null, 1)).to.equal(1);
    });
  });

  describe("map_time_pm25_active_idx", () => {
    // listForMap()'s $match always combines time + pm2_5.value>0 +
    // deviceDetails.isActive — this index must cover all three together so
    // Mongo doesn't fall back to filtering one of them in memory.
    it("covers time, pm2_5.value, and deviceDetails.isActive together", () => {
      const [keys, options] = ReadingModel.schema
        .indexes()
        .find(([, opts]) => opts.name === "map_time_pm25_active_idx");

      expect(keys).to.deep.equal({
        time: -1,
        "pm2_5.value": 1,
        "deviceDetails.isActive": 1,
      });
      expect(options.partialFilterExpression).to.deep.equal({
        "pm2_5.value": { $gt: 0 },
      });
      expect(options.background).to.equal(true);
    });
  });

  describe("recent() covering indexes", () => {
    // recent()'s single $match stage combines site_id/device_id + time +
    // deviceDetails.isActive. site_time_latest_idx/device_time_latest_idx don't
    // cover isActive, and time_device_active_idx doesn't cover site_id/device_id,
    // so without a fully-covering index the planner alternates between two
    // partial indexes — causing intermittent maxTimeMS timeouts under load.
    it("site_time_active_recent_idx covers site_id, time, and deviceDetails.isActive together", () => {
      const [keys, options] = ReadingModel.schema
        .indexes()
        .find(([, opts]) => opts.name === "site_time_active_recent_idx");

      expect(keys).to.deep.equal({
        site_id: 1,
        time: -1,
        "deviceDetails.isActive": 1,
      });
      expect(options.background).to.equal(true);
    });

    it("device_time_active_recent_idx covers device_id, time, and deviceDetails.isActive together", () => {
      const [keys, options] = ReadingModel.schema
        .indexes()
        .find(([, opts]) => opts.name === "device_time_active_recent_idx");

      expect(keys).to.deep.equal({
        device_id: 1,
        time: -1,
        "deviceDetails.isActive": 1,
      });
      expect(options.background).to.equal(true);
    });
  });
});
