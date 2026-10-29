require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
const httpStatus = require("http-status");
const proxyquire = require("proxyquire");

const aqiController = require("@controllers/aqi.controller");
const aqiUtil = require("@utils/aqi.util");

describe("AQI Controller", () => {
  describe("listRanges", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = { query: {}, params: {} };
      res = {
        status: sinon.stub().callsFake(function() { return res; }),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        message: "Successfully retrieved AQI ranges",
        data: {
          standard: "US EPA PM2.5 AQI (2024 NAAQS revision)",
          source: "default",
          ranges: [{ key: "good", label: "Good" }],
        },
      };
      sinon.stub(aqiUtil, "resolveActiveAqiRanges").resolves(null);
      sinon.stub(aqiUtil, "listRanges").returns(mockResult);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("returns 200 with the ranges from the util layer", async () => {
      await aqiController.listRanges(req, res, next);

      expect(aqiUtil.resolveActiveAqiRanges).to.have.been.calledOnce;
      expect(aqiUtil.listRanges).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        data: mockResult.data,
      });
    });

    it("forwards unexpected errors to next() as an HttpError", async () => {
      aqiUtil.listRanges.throws(new Error("unexpected failure"));

      await aqiController.listRanges(req, res, next);

      expect(next.calledOnce).to.equal(true);
      const err = next.getCall(0).args[0];
      expect(err.message).to.equal("Internal Server Error");
    });

    it("defaults to pm2_5 when pollutant is omitted from the query", async () => {
      await aqiController.listRanges(req, res, next);

      expect(aqiUtil.resolveActiveAqiRanges).to.have.been.calledWith(
        "airqo",
        "pm2_5"
      );
      expect(aqiUtil.listRanges).to.have.been.calledWith(null, "pm2_5");
    });

    it("resolves PM10 ranges independently of PM2.5 when ?pollutant=pm10", async () => {
      req.query.pollutant = "pm10";

      await aqiController.listRanges(req, res, next);

      expect(aqiUtil.resolveActiveAqiRanges).to.have.been.calledWith(
        "airqo",
        "pm10"
      );
      expect(aqiUtil.listRanges).to.have.been.calledWith(null, "pm10");
    });
  });

  describe("updateRanges / deleteRanges", () => {
    let req,
      res,
      next,
      upsertStub,
      deleteOneStub,
      runBackfillStub,
      proxiedController;

    const validRanges = () =>
      require("@config/constants").AQI_CATEGORY_KEYS.map((key, i, arr) => ({
        key,
        label: "Custom " + key,
        max_value: i === arr.length - 1 ? null : (i + 1) * 10,
        color: "#ABCDEF",
      }));

    beforeEach(() => {
      res = {
        status: sinon.stub().callsFake(function() { return res; }),
        json: sinon.spy(),
      };
      next = sinon.spy();

      upsertStub = sinon.stub().resolves({});
      deleteOneStub = sinon.stub().resolves({});
      // Fire-and-forget by design (see triggerAqiCategoryBackfill) — stubbed
      // here so tests don't kick off a real backfill run against Mongoose
      // models with no DB connection.
      runBackfillStub = sinon.stub().resolves();
      proxiedController = proxyquire("../aqi.controller", {
        "@models/SystemConfig": () => ({
          upsert: upsertStub,
          deleteOne: deleteOneStub,
        }),
        "@bin/jobs/aqi-category-backfill-job": {
          runAqiCategoryBackfillJob: runBackfillStub,
        },
      });

      sinon.stub(aqiUtil, "resolveActiveAqiRanges").resolves(null);
      sinon.stub(aqiUtil, "invalidateAqiRangesCache");
      sinon.stub(aqiUtil, "listRanges").returns({
        success: true,
        message: "ok",
        data: { standard: "...", source: "custom", ranges: [] },
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it("updateRanges upserts, invalidates the cache, and returns the freshly-resolved config", async () => {
      req = { query: {}, params: {}, body: { ranges: validRanges(), admin_secret: "x" } };

      await proxiedController.updateRanges(req, res, next);

      expect(upsertStub.calledOnce).to.equal(true);
      expect(upsertStub.getCall(0).args[0]).to.equal(aqiUtil.AQI_RANGES_CONFIG_KEY);
      expect(aqiUtil.invalidateAqiRangesCache.calledOnce).to.equal(true);
      // Cache must be invalidated only after the write succeeds.
      expect(aqiUtil.invalidateAqiRangesCache.calledAfter(upsertStub)).to.equal(true);
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
    });

    it("updateRanges triggers the backfill job (fire-and-forget) after invalidating the cache", async () => {
      req = { query: {}, params: {}, body: { ranges: validRanges(), admin_secret: "x" } };

      await proxiedController.updateRanges(req, res, next);

      expect(runBackfillStub.calledOnce).to.equal(true);
      expect(
        runBackfillStub.calledAfter(aqiUtil.invalidateAqiRangesCache)
      ).to.equal(true);
      // A backfill failure must never surface as a request failure.
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
    });

    it("updateRanges triggers the backfill for the SAME tenant that was actually updated, not always the default", async () => {
      req = {
        query: { tenant: "kcca" },
        params: {},
        body: { ranges: validRanges(), admin_secret: "x" },
      };

      await proxiedController.updateRanges(req, res, next);

      expect(runBackfillStub.calledOnceWith("kcca")).to.equal(true);
    });

    it("updateRanges derives min_value server-side rather than trusting the caller", async () => {
      req = { query: {}, params: {}, body: { ranges: validRanges(), admin_secret: "x" } };

      await proxiedController.updateRanges(req, res, next);

      const storedValue = upsertStub.getCall(0).args[1];
      expect(storedValue.ranges[0].min_value).to.equal(0);
      expect(storedValue.ranges[1].min_value).to.equal(storedValue.ranges[0].max_value);
    });

    it("updateRanges strips the leading # before persisting the color", async () => {
      req = { query: {}, params: {}, body: { ranges: validRanges(), admin_secret: "x" } };

      await proxiedController.updateRanges(req, res, next);

      const storedValue = upsertStub.getCall(0).args[1];
      expect(storedValue.ranges[0].color).to.equal("ABCDEF");
    });

    it("deleteRanges removes the override, invalidates the cache, and returns the default config", async () => {
      req = { query: {}, params: {}, body: {} };

      await proxiedController.deleteRanges(req, res, next);

      expect(deleteOneStub.calledOnce).to.equal(true);
      expect(deleteOneStub.getCall(0).args[0]).to.deep.equal({
        key: aqiUtil.AQI_RANGES_CONFIG_KEY,
      });
      expect(aqiUtil.invalidateAqiRangesCache.calledOnce).to.equal(true);
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
    });

    it("deleteRanges triggers the backfill job (fire-and-forget) after invalidating the cache", async () => {
      req = { query: {}, params: {}, body: {} };

      await proxiedController.deleteRanges(req, res, next);

      expect(runBackfillStub.calledOnce).to.equal(true);
      expect(
        runBackfillStub.calledAfter(aqiUtil.invalidateAqiRangesCache)
      ).to.equal(true);
    });

    it("deleteRanges triggers the backfill for the SAME tenant that was actually reverted, not always the default", async () => {
      req = { query: { tenant: "kcca" }, params: {}, body: {} };

      await proxiedController.deleteRanges(req, res, next);

      expect(runBackfillStub.calledOnceWith("kcca")).to.equal(true);
    });

    it("forwards a Mongo write failure to next() as an HttpError", async () => {
      upsertStub.rejects(new Error("Mongo write failed"));
      req = { query: {}, params: {}, body: { ranges: validRanges(), admin_secret: "x" } };

      await proxiedController.updateRanges(req, res, next);

      expect(next.calledOnce).to.equal(true);
      const err = next.getCall(0).args[0];
      expect(err.message).to.equal("Internal Server Error");
      // A failed write must not invalidate the cache — nothing changed.
      expect(aqiUtil.invalidateAqiRangesCache.called).to.equal(false);
      // ...and therefore must not trigger a backfill either.
      expect(runBackfillStub.called).to.equal(false);
    });

    it("does not let a rejected backfill promise crash or delay the request", async () => {
      runBackfillStub.rejects(new Error("backfill blew up"));
      req = { query: {}, params: {}, body: { ranges: validRanges(), admin_secret: "x" } };

      await proxiedController.updateRanges(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(next.called).to.equal(false);
    });

    it("updateRanges stores PM10 under its own config key, not the PM2.5 one", async () => {
      req = {
        query: { pollutant: "pm10" },
        params: {},
        body: { ranges: validRanges(), admin_secret: "x" },
      };

      await proxiedController.updateRanges(req, res, next);

      const usedKey = upsertStub.getCall(0).args[0];
      expect(usedKey).to.equal(aqiUtil.getAqiRangesConfigKey("pm10"));
      expect(usedKey).to.not.equal(aqiUtil.AQI_RANGES_CONFIG_KEY);
    });

    it("updateRanges invalidates the cache for the specific pollutant written", async () => {
      req = {
        query: { pollutant: "pm10" },
        params: {},
        body: { ranges: validRanges(), admin_secret: "x" },
      };

      await proxiedController.updateRanges(req, res, next);

      expect(
        aqiUtil.invalidateAqiRangesCache.calledOnceWith("airqo", "pm10")
      ).to.equal(true);
    });

    it("updateRanges does NOT trigger the PM2.5 category backfill for a PM10 override", async () => {
      req = {
        query: { pollutant: "pm10" },
        params: {},
        body: { ranges: validRanges(), admin_secret: "x" },
      };

      await proxiedController.updateRanges(req, res, next);

      expect(runBackfillStub.called).to.equal(false);
    });

    it("deleteRanges removes the PM10-specific override, not the PM2.5 one", async () => {
      req = { query: { pollutant: "pm10" }, params: {}, body: {} };

      await proxiedController.deleteRanges(req, res, next);

      expect(deleteOneStub.getCall(0).args[0]).to.deep.equal({
        key: aqiUtil.getAqiRangesConfigKey("pm10"),
      });
      expect(
        aqiUtil.invalidateAqiRangesCache.calledOnceWith("airqo", "pm10")
      ).to.equal(true);
    });

    it("deleteRanges does NOT trigger the PM2.5 category backfill for a PM10 revert", async () => {
      req = { query: { pollutant: "pm10" }, params: {}, body: {} };

      await proxiedController.deleteRanges(req, res, next);

      expect(runBackfillStub.called).to.equal(false);
    });
  });
});
