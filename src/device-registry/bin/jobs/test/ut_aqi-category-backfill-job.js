require("module-alias/register");
process.env.NODE_ENV = "development";
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
const proxyquire = require("proxyquire");
const os = require("os");

const POD_ID = process.env.HOSTNAME || os.hostname();

describe("aqi-category-backfill-job", () => {
  let bulkWriteStub;
  let lockFindOneAndUpdateStub;
  let lockFindOneAndDeleteStub;
  let resolveActiveAqiRangesStub;
  let proxiedJob;

  // Mirrors ReadingModel(tenant).find(filter).select(...).batchSize(...).lean().cursor()
  const mockModelFactory = (docs, findSpy, tenantSpy) => (tenant) => {
    if (tenantSpy) tenantSpy(tenant);
    return {
      find: (filter) => {
        if (findSpy) findSpy(filter);
        return {
          select: () => ({
            batchSize: () => ({
              lean: () => ({
                cursor: () => (async function*() {
                  for (const doc of docs) yield doc;
                })(),
              }),
            }),
          }),
        };
      },
      bulkWrite: bulkWriteStub,
    };
  };

  const defaultResolved = {
    source: "default",
    AQI_RANGES: {
      good: { min: 0, max: 9.1 },
      moderate: { min: 9.101, max: 35.49 },
      u4sg: { min: 35.491, max: 55.49 },
      unhealthy: { min: 55.491, max: 125.49 },
      very_unhealthy: { min: 125.491, max: 225.49 },
      hazardous: { min: 225.491, max: null },
    },
    AQI_CATEGORIES: {
      good: "Good",
      moderate: "Moderate",
      u4sg: "Unhealthy for Sensitive Groups",
      unhealthy: "Unhealthy",
      very_unhealthy: "Very Unhealthy",
      hazardous: "Hazardous",
    },
    AQI_COLORS: {
      good: "34C759",
      moderate: "ECAA06",
      u4sg: "FF851F",
      unhealthy: "F7453C",
      very_unhealthy: "AC5CD9",
      hazardous: "D95BA3",
    },
    AQI_COLOR_NAMES: {
      good: "Green",
      moderate: "Yellow",
      u4sg: "Orange",
      unhealthy: "Red",
      very_unhealthy: "Purple",
      hazardous: "Maroon",
    },
    AQI_CATEGORY_KEYS: [
      "good",
      "moderate",
      "u4sg",
      "unhealthy",
      "very_unhealthy",
      "hazardous",
    ],
  };

  const proxyJob = (readingDocs, signalDocs = [], findSpy, tenantSpy) => {
    lockFindOneAndUpdateStub = sinon
      .stub()
      .resolves({ acquiredBy: POD_ID });
    lockFindOneAndDeleteStub = sinon.stub().resolves();
    resolveActiveAqiRangesStub = sinon.stub().resolves(defaultResolved);

    return proxyquire("../aqi-category-backfill-job", {
      "@models/Reading": mockModelFactory(readingDocs, findSpy, tenantSpy),
      "@models/Signal": mockModelFactory(signalDocs, findSpy, tenantSpy),
      "@models/JobLock": () => ({
        findOneAndUpdate: lockFindOneAndUpdateStub,
        findOneAndDelete: lockFindOneAndDeleteStub,
      }),
      "@utils/aqi.util": {
        resolveActiveAqiRanges: resolveActiveAqiRangesStub,
        categoryFromConcentration: require("@utils/aqi.util")
          .categoryFromConcentration,
        calculatePm25Aqi: require("@utils/aqi.util").calculatePm25Aqi,
      },
    });
  };

  beforeEach(() => {
    bulkWriteStub = sinon.stub().resolves({ modifiedCount: 0 });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("does not queue an update for a document whose stored fields already match the active config", async () => {
    proxiedJob = proxyJob([
      {
        _id: "r1",
        pm2_5: { value: 5 },
        aqi_color: "34C759",
        aqi_category: "Good",
        aqi_color_name: "Green",
        aqi_index: 28,
      },
    ]);

    await proxiedJob.runAqiCategoryBackfillJob();

    // Reading pass runs; Signal pass has no docs. bulkWrite should never be
    // called since the one document is already correct.
    expect(bulkWriteStub.called).to.equal(false);
  });

  it("queues an update for a document whose stored category is stale", async () => {
    proxiedJob = proxyJob([
      {
        _id: "r1",
        pm2_5: { value: 5 },
        aqi_color: "OLDCOLOR",
        aqi_category: "Stale",
        aqi_color_name: "OldName",
        aqi_index: 999,
      },
    ]);

    await proxiedJob.runAqiCategoryBackfillJob();

    expect(bulkWriteStub.calledOnce).to.equal(true);
    const ops = bulkWriteStub.getCall(0).args[0];
    expect(ops).to.have.lengthOf(1);
    expect(ops[0].updateOne.filter).to.deep.equal({
      _id: "r1",
      aqi_category: "Stale", // optimistic-concurrency: matches what was read
    });
    expect(ops[0].updateOne.update.$set).to.deep.equal({
      aqi_color: "34C759",
      aqi_category: "Good",
      aqi_color_name: "Green",
      aqi_index: 28,
    });
  });

  it("skips a document with no numeric pm2_5.value", async () => {
    proxiedJob = proxyJob([
      { _id: "r1", pm2_5: { value: null }, aqi_category: "Good" },
      { _id: "r2", aqi_category: "Good" }, // pm2_5 missing entirely
    ]);

    await proxiedJob.runAqiCategoryBackfillJob();

    expect(bulkWriteStub.called).to.equal(false);
  });

  it("reconciles both Reading and Signal collections in one run", async () => {
    proxiedJob = proxyJob(
      [{ _id: "r1", pm2_5: { value: 5 }, aqi_category: "Stale" }],
      [{ _id: "s1", pm2_5: { value: 5 }, aqi_category: "Stale" }]
    );

    await proxiedJob.runAqiCategoryBackfillJob();

    expect(bulkWriteStub.calledTwice).to.equal(true);
  });

  it("skips the run entirely when another instance already holds the lock", async () => {
    proxiedJob = proxyJob([
      { _id: "r1", pm2_5: { value: 5 }, aqi_category: "Stale" },
    ]);
    lockFindOneAndUpdateStub.resolves({ acquiredBy: "some-other-pod" });

    await proxiedJob.runAqiCategoryBackfillJob();

    expect(bulkWriteStub.called).to.equal(false);
    expect(resolveActiveAqiRangesStub.called).to.equal(false);
    expect(lockFindOneAndDeleteStub.called).to.equal(false);
  });

  it("releases the lock even when a bulkWrite fails", async () => {
    proxiedJob = proxyJob([
      { _id: "r1", pm2_5: { value: 5 }, aqi_category: "Stale" },
    ]);
    bulkWriteStub.rejects(new Error("Mongo error"));

    await proxiedJob.runAqiCategoryBackfillJob();

    expect(lockFindOneAndDeleteStub.calledOnce).to.equal(true);
  });

  it("queries with a filter shape that can use the existing time+pm2_5 partial index, not a full collection scan", async () => {
    const findSpy = sinon.stub();
    proxiedJob = proxyJob([], [], findSpy);

    await proxiedJob.runAqiCategoryBackfillJob();

    // Regression guard: {$ne: null, $type: "number"} with no time bound
    // cannot use the { time: -1, "pm2_5.value": 1 } partial index on either
    // Reading or Signal and forces a COLLSCAN on every admin PUT/DELETE —
    // confirmed via .explain() against a real collection. {$gt: 0} satisfies
    // both collections' partial filter expression, and the time lower bound
    // lets the planner use the index's leading field.
    expect(findSpy.called).to.equal(true);
    findSpy.getCalls().forEach((call) => {
      const filter = call.args[0];
      expect(filter["pm2_5.value"]).to.deep.equal({ $gt: 0 });
      expect(filter.time).to.have.property("$gte");
      expect(filter.time.$gte).to.be.instanceOf(Date);
    });
  });

  it("reconciles the tenant it's given, not always the hardcoded default — a PUT/DELETE for a non-default tenant must not silently reconcile the wrong one", async () => {
    const tenantSpy = sinon.stub();
    proxiedJob = proxyJob([], [], undefined, tenantSpy);

    await proxiedJob.runAqiCategoryBackfillJob("kcca");

    expect(lockFindOneAndUpdateStub.calledOnce).to.equal(true);
    expect(resolveActiveAqiRangesStub.calledOnceWith("kcca")).to.equal(true);
    // Called once for ReadingModel(tenant), once for SignalModel(tenant) —
    // every call must use the tenant that was actually passed in, never the
    // hardcoded default.
    expect(tenantSpy.callCount).to.equal(2);
    tenantSpy.getCalls().forEach((call) => {
      expect(call.args[0]).to.equal("kcca");
    });
  });

  it("defaults to the standard tenant when called with no argument (cron safety-net path)", async () => {
    const tenantSpy = sinon.stub();
    proxiedJob = proxyJob([], [], undefined, tenantSpy);

    await proxiedJob.runAqiCategoryBackfillJob();

    expect(tenantSpy.calledWith("airqo")).to.equal(true);
  });
});
