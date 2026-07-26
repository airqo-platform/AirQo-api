require("module-alias/register");
process.env.NODE_ENV = "development";
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const mongoose = require("mongoose");

// Covers HealthTips.js's private `_removeInvalidTips` helper, reached only
// through the `removeInvalidTips`/`bulkModify` statics — there is no prior
// working test coverage for this file (models/test/ut_health-tips.model.js
// is entirely `describe.skip`'d and imports the wrong export shape).
//
// `TipsModel(tenant)` tries `mongoose.model("healthtips")` first and only
// falls back to `getModelByTenant` if that throws. Since the mongoose model
// registry is a global singleton, another test file requiring the real,
// non-proxied HealthTips module earlier in the same run could register
// "healthtips" first and make that branch succeed instead — so `mongoose`
// itself is proxied here to force the fallback branch deterministically,
// regardless of run order.
const proxyHealthTips = (fakeModel, resolveActiveAqiRangesStub) =>
  proxyquire("../HealthTips", {
    mongoose: Object.assign({}, mongoose, {
      model: () => {
        throw new Error("not registered");
      },
    }),
    "@config/database": {
      // The real getModelByTenant compiles a Mongoose Model class that
      // inherits the schema's statics (removeInvalidTips, bulkModify, ...).
      // Mimic that here by binding the real statics — pulled off the schema
      // instance passed in at call time — onto our duck-typed fake model,
      // instead of standing up a real Mongoose connection.
      getModelByTenant: (tenantId, modelName, schema) => {
        Object.entries(schema.statics).forEach(([key, fn]) => {
          fakeModel[key] = fn.bind(fakeModel);
        });
        return fakeModel;
      },
    },
    "@utils/aqi.util": { resolveActiveAqiRanges: resolveActiveAqiRangesStub },
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

const makeFakeModel = ({ tips = [], countByFilter = () => 1 } = {}) => {
  const execify = (value) => ({ exec: () => Promise.resolve(value) });
  return {
    find: sinon.stub().returns(execify(tips)),
    deleteMany: sinon.stub().returns(execify({ deletedCount: tips.length })),
    countDocuments: sinon.stub().callsFake((filter) =>
      execify(countByFilter(filter))
    ),
  };
};

describe("HealthTips — _removeInvalidTips (via removeInvalidTips/bulkModify statics)", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("removes tips whose stored aqi_category matches none of the active config's ranges", async () => {
    const staleTip = {
      title: "Stale",
      aqi_category: { min: 999, max: 1000 }, // valid under neither default nor custom
    };
    const fakeModel = makeFakeModel({ tips: [staleTip], countByFilter: () => 1 });
    const resolveStub = sinon.stub().resolves(customResolved);
    const TipsModel = proxyHealthTips(fakeModel, resolveStub);

    const next = sinon.spy();
    const result = await TipsModel("airqo").removeInvalidTips(next);

    expect(resolveStub.calledOnce).to.equal(true);
    expect(fakeModel.deleteMany.calledOnce).to.equal(true);
    expect(result.success).to.equal(true);
    expect(result.data.removedCount).to.equal(1);
    expect(result.data.invalidTipsRemoved).to.deep.equal([
      { title: "Stale", aqi_category: staleTip.aqi_category },
    ]);
  });

  it("does not delete anything when every stored tip matches an active range", async () => {
    const fakeModel = makeFakeModel({ tips: [], countByFilter: () => 1 });
    const resolveStub = sinon.stub().resolves(customResolved);
    const TipsModel = proxyHealthTips(fakeModel, resolveStub);

    const next = sinon.spy();
    const result = await TipsModel("airqo").removeInvalidTips(next);

    expect(fakeModel.deleteMany.called).to.equal(false);
    expect(result.data.removedCount).to.equal(0);
  });

  it("reports categories from the active config that have no tips at all", async () => {
    const fakeModel = makeFakeModel({ tips: [], countByFilter: () => 0 });
    const resolveStub = sinon.stub().resolves(customResolved);
    const TipsModel = proxyHealthTips(fakeModel, resolveStub);

    const next = sinon.spy();
    const result = await TipsModel("airqo").removeInvalidTips(next);

    expect(result.data.categoriesWithoutTips).to.have.lengthOf(6);
    expect(result.data.categoriesWithoutTips).to.deep.include({
      min: 0,
      max: 5,
    });
  });

  it("validates against the custom config's ranges, not the hardcoded defaults, once an override is active", async () => {
    // Valid under the hardcoded default ("good" = 0-9.1) but not under the
    // active custom config ("good" = 0-5) — must be treated as invalid.
    const tipValidOnlyUnderDefault = {
      title: "Old boundary",
      aqi_category: { min: 0, max: 9.1 },
    };
    const fakeModel = makeFakeModel({
      tips: [tipValidOnlyUnderDefault],
      countByFilter: () => 1,
    });
    const resolveStub = sinon.stub().resolves(customResolved);
    const TipsModel = proxyHealthTips(fakeModel, resolveStub);

    const next = sinon.spy();
    const result = await TipsModel("airqo").removeInvalidTips(next);

    expect(result.data.removedCount).to.equal(1);
  });

  it("bulkModify also invokes the same cleanup after applying updates", async () => {
    const fakeModel = Object.assign(makeFakeModel({ tips: [], countByFilter: () => 1 }), {
      bulkWrite: sinon.stub().resolves({ modifiedCount: 1, upsertedCount: 0 }),
    });
    const resolveStub = sinon.stub().resolves(customResolved);
    const TipsModel = proxyHealthTips(fakeModel, resolveStub);

    const next = sinon.spy();
    const updates = [
      {
        aqi_category: { min: 0, max: 5 },
        tips: [{ title: "T1", tag_line: "line" }],
      },
    ];
    const result = await TipsModel("airqo").bulkModify(updates, next);

    expect(fakeModel.bulkWrite.calledOnce).to.equal(true);
    expect(resolveStub.calledOnce).to.equal(true);
    expect(result.success).to.equal(true);
  });
});
