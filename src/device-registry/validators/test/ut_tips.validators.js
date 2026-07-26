require("module-alias/register");
process.env.NODE_ENV = "development";
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

const constants = require("@config/constants");

const mockRequest = (body = {}, query = {}) => ({ body, query, params: {} });

// Mirrors validators/test/ut_aqi.validators.js's runChain helper — express-
// validator's array-style chains are themselves (req, res, next) middleware.
const runChain = (chain, req) =>
  new Promise((resolve) => {
    const res = {};
    let index = 0;
    const runNext = (err) => {
      if (err || index >= chain.length) {
        resolve(err);
        return;
      }
      const middleware = chain[index++];
      Promise.resolve(middleware(req, res, runNext)).catch(runNext);
    };
    runNext();
  });

const customResolved = {
  source: "custom",
  AQI_RANGES: {
    good: { min: 0, max: 5 },
    moderate: { min: 5, max: 20 },
    u4sg: { min: 20, max: 40 },
    unhealthy: { min: 40, max: 80 },
    very_unhealthy: { min: 80, max: 150 },
    hazardous: { min: 150, max: null },
  },
};

const defaultResolved = { source: "default", AQI_RANGES: constants.AQI_RANGES };

// One update entry, valid other than aqi_category, so the chain reaches the
// aqi_category custom validator under test.
const updateWithCategory = (aqi_category) => ({
  aqi_category,
  tips: [{ tag_line: "Some tag line" }],
});

describe("tipsValidations.bulkUpdateTips — aqi_category range check", () => {
  const proxyValidators = (resolveActiveAqiRangesStub) =>
    proxyquire("../tips.validators", {
      "@utils/aqi.util": {
        resolveActiveAqiRanges: resolveActiveAqiRangesStub,
      },
    });

  afterEach(() => {
    sinon.restore();
  });

  it("accepts an aqi_category matching the default config when no custom override exists", async () => {
    const resolveStub = sinon.stub().resolves(defaultResolved);
    const { bulkUpdateTips } = proxyValidators(resolveStub);

    const req = mockRequest({
      updates: [updateWithCategory({ min: 0, max: 9.1 })],
    });
    const err = await runChain(bulkUpdateTips, req);

    expect(err).to.be.undefined;
    expect(resolveStub.called).to.equal(true);
  });

  it("rejects a range that only matches the hardcoded default once a custom override is active", async () => {
    const resolveStub = sinon.stub().resolves(customResolved);
    const { bulkUpdateTips } = proxyValidators(resolveStub);

    // 0-9.1 is a valid "good" range under the hardcoded default, but the
    // active (custom) config's "good" range is 0-5 — this must now fail,
    // proving the validator follows the active config, not the constant.
    const req = mockRequest({
      updates: [updateWithCategory({ min: 0, max: 9.1 })],
    });
    const err = await runChain(bulkUpdateTips, req);

    expect(err).to.exist;
    expect(err.statusCode).to.equal(400);
  });

  it("accepts a range matching the active custom override's boundaries", async () => {
    const resolveStub = sinon.stub().resolves(customResolved);
    const { bulkUpdateTips } = proxyValidators(resolveStub);

    const req = mockRequest({
      updates: [updateWithCategory({ min: 0, max: 5 })],
    });
    const err = await runChain(bulkUpdateTips, req);

    expect(err).to.be.undefined;
  });

  it("accepts the unbounded (null max) hazardous range under a custom override", async () => {
    const resolveStub = sinon.stub().resolves(customResolved);
    const { bulkUpdateTips } = proxyValidators(resolveStub);

    const req = mockRequest({
      updates: [updateWithCategory({ min: 150, max: null })],
    });
    const err = await runChain(bulkUpdateTips, req);

    expect(err).to.be.undefined;
  });

  it("resolves against the default tenant when none is provided on the request", async () => {
    const resolveStub = sinon.stub().resolves(customResolved);
    const { bulkUpdateTips } = proxyValidators(resolveStub);

    const req = mockRequest({
      updates: [updateWithCategory({ min: 0, max: 5 })],
    });
    await runChain(bulkUpdateTips, req);

    expect(resolveStub.calledWith(constants.DEFAULT_TENANT || "airqo")).to.equal(
      true
    );
  });

  it("defers to the dedicated min/max validators on non-numeric input instead of resolving a config and throwing a generic range error", async () => {
    const resolveStub = sinon.stub().resolves(customResolved);
    const { bulkUpdateTips } = proxyValidators(resolveStub);

    const req = mockRequest({
      updates: [updateWithCategory({ min: "not-a-number", max: 5 })],
    });
    const err = await runChain(bulkUpdateTips, req);

    // Still rejected overall (aqi_category.min's own isNumeric check catches
    // it), but the range-match custom validator must not be the one that
    // fired — it should have skipped rather than resolving a config for
    // input it can't meaningfully compare.
    expect(err).to.exist;
    expect(err.statusCode).to.equal(400);
    expect(resolveStub.called).to.equal(false);
  });
});
