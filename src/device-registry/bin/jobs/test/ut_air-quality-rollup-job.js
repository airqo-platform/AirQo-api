require("module-alias/register");
process.env.NODE_ENV = "development";
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
const proxyquire = require("proxyquire");
const os = require("os");

// Mirrors the job's own POD_ID derivation exactly, so the mocked lock
// document's acquiredBy can be made to match (or intentionally not match).
const POD_ID = process.env.HOSTNAME || os.hostname();

describe("air-quality-rollup-job", () => {
  let aggregateStub;
  let bulkWriteStub;
  let jobStateGetStub;
  let jobStateSetStub;
  let lockFindOneAndUpdateStub;
  let lockFindOneAndDeleteStub;
  let proxiedJob;

  const mockAggregateChain = (groups) => ({
    option: () => Promise.resolve(groups),
  });

  beforeEach(() => {
    aggregateStub = sinon.stub();
    bulkWriteStub = sinon.stub().resolves({});
    jobStateGetStub = sinon.stub();
    jobStateSetStub = sinon.stub().resolves();
    lockFindOneAndUpdateStub = sinon.stub().resolves({ acquiredBy: POD_ID });
    lockFindOneAndDeleteStub = sinon.stub().resolves();

    proxiedJob = proxyquire("../air-quality-rollup-job", {
      "@models/Reading": () => ({ aggregate: aggregateStub }),
      "@models/AirQualitySummary": () => ({ bulkWrite: bulkWriteStub }),
      "@models/JobState": () => ({
        get: jobStateGetStub,
        set: jobStateSetStub,
      }),
      "@models/JobLock": () => ({
        findOneAndUpdate: lockFindOneAndUpdateStub,
        findOneAndDelete: lockFindOneAndDeleteStub,
      }),
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("aggregates both country and city levels, upserts running totals via $inc/$addToSet, and advances the watermark", async () => {
    jobStateGetStub.resolves(new Date(Date.now() - 2 * 60 * 60 * 1000)); // 2h ago
    aggregateStub
      .onCall(0) // country pass
      .returns(
        mockAggregateChain([
          {
            _id: { entity: "Kenya", year: 2024 },
            sum_pm2_5: 100,
            reading_count: 10,
            siteIds: ["s1", "s2"],
          },
        ])
      )
      .onCall(1) // city pass
      .returns(
        mockAggregateChain([
          {
            _id: { entity: "Nairobi", year: 2024 },
            sum_pm2_5: 50,
            reading_count: 5,
            siteIds: ["s1"],
          },
        ])
      );

    await proxiedJob.runAirQualityRollupJob();

    expect(aggregateStub.calledTwice).to.equal(true);
    expect(bulkWriteStub.calledTwice).to.equal(true);

    const countryOps = bulkWriteStub.getCall(0).args[0];
    expect(countryOps).to.have.lengthOf(1);
    expect(countryOps[0].updateOne.filter).to.deep.equal({
      tenant: "airqo",
      level: "country",
      entity: "Kenya",
      year: 2024,
    });
    expect(countryOps[0].updateOne.update.$inc).to.deep.equal({
      sum_pm2_5: 100,
      reading_count: 10,
    });
    expect(countryOps[0].updateOne.update.$addToSet).to.deep.equal({
      contributing_sites: { $each: ["s1", "s2"] },
    });
    expect(countryOps[0].updateOne.upsert).to.equal(true);

    const cityOps = bulkWriteStub.getCall(1).args[0];
    expect(cityOps[0].updateOne.filter.level).to.equal("city");
    expect(cityOps[0].updateOne.filter.entity).to.equal("Nairobi");

    expect(jobStateSetStub.calledOnce).to.equal(true);
    expect(jobStateSetStub.getCall(0).args[0]).to.equal("air-quality-rollup-job");

    expect(lockFindOneAndDeleteStub.calledOnce).to.equal(true);
  });

  it("skips the run entirely when another instance already holds the lock", async () => {
    lockFindOneAndUpdateStub.resolves({ acquiredBy: "some-other-pod" });
    jobStateGetStub.resolves(new Date());

    await proxiedJob.runAirQualityRollupJob();

    expect(aggregateStub.called).to.equal(false);
    expect(bulkWriteStub.called).to.equal(false);
    expect(jobStateSetStub.called).to.equal(false);
    // Never acquired the lock, so must not attempt to release someone else's.
    expect(lockFindOneAndDeleteStub.called).to.equal(false);
  });

  it("defaults to a 24h lookback window on the first run (no prior watermark)", async () => {
    jobStateGetStub.resolves(null);
    aggregateStub.returns(mockAggregateChain([]));

    const before = Date.now();
    await proxiedJob.runAirQualityRollupJob();

    const pipeline = aggregateStub.getCall(0).args[0];
    const windowStart = pipeline[0].$match.time.$gte.getTime();
    const expected24hAgo = before - 24 * 60 * 60 * 1000;

    // Allow a small tolerance for test execution time.
    expect(Math.abs(windowStart - expected24hAgo)).to.be.below(5000);
  });

  it("floors the window at the 14-day retention boundary when the watermark has drifted further behind than that", async () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    jobStateGetStub.resolves(twentyDaysAgo);
    aggregateStub.returns(mockAggregateChain([]));

    const before = Date.now();
    await proxiedJob.runAirQualityRollupJob();

    const pipeline = aggregateStub.getCall(0).args[0];
    const windowStart = pipeline[0].$match.time.$gte.getTime();
    const expected14DaysAgo = before - 14 * 24 * 60 * 60 * 1000;

    expect(windowStart).to.be.above(twentyDaysAgo.getTime());
    expect(Math.abs(windowStart - expected14DaysAgo)).to.be.below(5000);
  });

  it("does not advance the watermark when the aggregation fails", async () => {
    jobStateGetStub.resolves(new Date(Date.now() - 2 * 60 * 60 * 1000));
    aggregateStub.returns({
      option: () => Promise.reject(new Error("Mongo error")),
    });

    await proxiedJob.runAirQualityRollupJob();

    expect(jobStateSetStub.called).to.equal(false);
    // Lock must still be released even though the run failed.
    expect(lockFindOneAndDeleteStub.calledOnce).to.equal(true);
  });
});
