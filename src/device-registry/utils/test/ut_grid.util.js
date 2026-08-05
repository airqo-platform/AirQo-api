require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const gridUtil = require("@utils/grid.util");
const GridModel = require("@models/Grid");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const ComputedCacheModel = require("@models/ComputedCache");
const DeviceModel = require("@models/Device");
const AdminLevelModel = require("@models/AdminLevel");
const { generateFilter } = require("@utils/common");
const geolib = require("geolib");
const { Kafka } = require("kafkajs");

describe("Grid Util", () => {
  let sandbox;
  let kafkaProducerStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    kafkaProducerStub = {
      connect: sandbox.stub().resolves(),
      send: sandbox.stub().resolves(),
      disconnect: sandbox.stub().resolves(),
    };
    sandbox.stub(Kafka.prototype, "producer").returns(kafkaProducerStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("create", () => {
    it("should create a grid successfully", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "Test Grid",
          admin_level: "country",
          shape: {
            type: "Polygon",
            coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]],
          },
        },
      };
      const createdGrid = { _id: "grid1", name: "Test Grid", ...request.body };

      sandbox.stub(gridUtil, "calculateGeographicalCenter").resolves({
        success: true,
        data: [{ latitude: 0, longitude: 0 }],
      });
      const registerStub = sandbox
        .stub()
        .resolves({ success: true, data: createdGrid });
      sandbox.stub(mongoose, "model").withArgs("grids").returns({ register: registerStub });

      const result = await gridUtil.create(request);

      expect(result.success).to.be.true;
      expect(result.data.name).to.equal("Test Grid");
      expect(registerStub.calledOnce).to.be.true;
      expect(kafkaProducerStub.connect.calledOnce).to.be.true;
      expect(kafkaProducerStub.send.calledOnce).to.be.true;
    });

    it("should handle failure in geographical center calculation", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "Test Grid",
          shape: { type: "Polygon", coordinates: [] },
        },
      };
      sandbox.stub(gridUtil, "calculateGeographicalCenter").resolves({
        success: false,
        message: "Center calculation failed",
      });

      const result = await gridUtil.create(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Center calculation failed");
    });

    it("should handle failure in grid registration", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "Test Grid",
          shape: {
            type: "Polygon",
            coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]],
          },
        },
      };
      sandbox.stub(gridUtil, "calculateGeographicalCenter").resolves({
        success: true,
        data: [{ latitude: 0, longitude: 0 }],
      });
      sandbox.stub(mongoose, "model").withArgs("grids").returns({
        register: sandbox
          .stub()
          .resolves({ success: false, message: "DB error" }),
      });

      const result = await gridUtil.create(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("DB error");
    });
  });

  describe("list", () => {
    let aggregateStub;
    let listModelStub;

    beforeEach(() => {
      aggregateStub = sandbox.stub().returns({
        allowDiskUse: sandbox.stub().resolves([
          {
            paginatedResults: [
              { _id: "grid1", name: "Grid 1", sites: [{ _id: "site1" }] },
            ],
            totalCount: [{ count: 1 }],
          },
        ]),
      });
      listModelStub = sandbox.stub(mongoose, "model");
      listModelStub.withArgs("grids").returns({ aggregate: aggregateStub });
      // getPrivateSiteIds (called internally by list) needs ComputedCacheModel
      listModelStub.withArgs("computedcaches").returns({
        findOne: sandbox.stub().returns({ lean: sandbox.stub().resolves(null) }),
        findOneAndUpdate: sandbox.stub().resolves(),
        create: sandbox.stub().resolves(),
        deleteOne: sandbox.stub().resolves(),
      });
      sandbox.stub(generateFilter, "grids").returns({});
    });

    it("should list grids and filter out private sites by default", async () => {
      const request = { query: { tenant: "airqo" } };
      const privateSiteIds = [new mongoose.Types.ObjectId()];
      const cohortAggregateStub = sandbox
        .stub()
        .resolves([{ site_ids: privateSiteIds }]);
      listModelStub.withArgs("cohorts").returns({ aggregate: cohortAggregateStub });

      await gridUtil.list(request, sandbox.stub());

      const addFieldsStage = aggregateStub
        .getCall(0)
        .args[0].find(
          (stage) => stage.$addFields && stage.$addFields.sites.$filter
        );
      expect(addFieldsStage).to.exist;
      expect(
        addFieldsStage.$addFields.sites.$filter.cond.$not.$in[1]
      ).to.deep.equal(privateSiteIds);
    });

    it("should filter by cohort_id if provided", async () => {
      const cohortId = new mongoose.Types.ObjectId().toString();
      const request = { query: { tenant: "airqo", cohort_id: cohortId } };
      const cohortSiteIds = [new mongoose.Types.ObjectId()];

      listModelStub.withArgs("cohorts").returns({ aggregate: sandbox.stub().resolves([]) });
      const deviceFindStub = sandbox.stub().returns({
        distinct: sandbox.stub().resolves(cohortSiteIds),
      });
      listModelStub.withArgs("devices").returns({ find: deviceFindStub });

      await gridUtil.list(request, sandbox.stub());

      const cohortFilterStage = aggregateStub
        .getCall(0)
        .args[0].find(
          (stage) =>
            stage.$addFields &&
            stage.$addFields.sites &&
            stage.$addFields.sites.$filter &&
            stage.$addFields.sites.$filter.cond.$in
        );
      expect(cohortFilterStage).to.exist;
      expect(
        cohortFilterStage.$addFields.sites.$filter.cond.$in[1]
      ).to.deep.equal(cohortSiteIds);
    });

    it("should return empty if cohort has no sites", async () => {
      const cohortId = new mongoose.Types.ObjectId().toString();
      const request = { query: { tenant: "airqo", cohort_id: cohortId } };

      const deviceFindStub = sandbox.stub().returns({
        distinct: sandbox.stub().resolves([]),
      });
      listModelStub.withArgs("devices").returns({ find: deviceFindStub });

      const result = await gridUtil.list(request, sandbox.stub());

      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.message).to.equal(
        "No grids found for the specified cohort(s)."
      );
    });
  });

  describe("listCountries", () => {
    beforeEach(() => {
      gridUtil._clearPrivateSiteIdsCache();
      gridUtil._clearCountriesCache();
    });

    it("should list countries with site counts, filtering private sites", async () => {
      const request = { query: { tenant: "airqo" } };
      const privateSiteIds = [new mongoose.Types.ObjectId()];
      const cohortAggregateStub = sandbox
        .stub()
        .resolves([{ site_ids: privateSiteIds }]);
      const listCountriesModelStub = sandbox.stub(mongoose, "model");
      listCountriesModelStub.withArgs("cohorts").returns({ aggregate: cohortAggregateStub });

      // Return a chainable aggregate mock so .option().allowDiskUse() don't
      // throw — Mongoose Aggregate is not a plain Promise.
      const countryData = [{ country: "uganda", sites: 10 }];
      const aggregateChain = {
        option: sandbox.stub().returnsThis(),
        allowDiskUse: sandbox.stub().returnsThis(),
        then: (res, rej) => Promise.resolve(countryData).then(res, rej),
        catch: (fn) => Promise.resolve(countryData).catch(fn),
      };
      const gridAggregateStub = sandbox.stub().returns(aggregateChain);
      listCountriesModelStub.withArgs("grids").returns({ aggregate: gridAggregateStub });

      // listCountries needs ComputedCacheModel for getPrivateSiteIds
      listCountriesModelStub.withArgs("computedcaches").returns({
        findOne: sandbox.stub().returns({ lean: sandbox.stub().resolves(null) }),
        findOneAndUpdate: sandbox.stub().resolves(),
        create: sandbox.stub().resolves(),
        deleteOne: sandbox.stub().resolves(),
      });

      const result = await gridUtil.listCountries(request, sandbox.stub());

      expect(result.success).to.be.true;
      expect(result.data[0].country).to.equal("uganda");

      // Assert the new correlated sub-pipeline shape
      const pipelineArg = gridAggregateStub.getCall(0).args[0];
      const lookupStage = pipelineArg.find(
        (s) => s.$lookup && s.$lookup.as === "siteCount"
      );
      expect(lookupStage).to.exist;
      expect(lookupStage.$lookup.let).to.deep.equal({ gridId: "$_id" });
      const subMatch = lookupStage.$lookup.pipeline.find((s) => s.$match);
      expect(subMatch.$match.$expr).to.deep.equal({
        $in: ["$$gridId", { $ifNull: ["$grids", []] }],
      });
      expect(subMatch.$match._id.$nin).to.deep.equal(privateSiteIds);
    });
  });

  describe("findSites", () => {
    it("should find sites within a grid's shape", async () => {
      const gridId = new mongoose.Types.ObjectId();
      const request = { query: { tenant: "airqo", id: gridId.toString() } };
      const next = sinon.spy();
      const gridShape = {
        type: "Polygon",
        coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]],
      };
      const siteIn = {
        _id: new mongoose.Types.ObjectId(),
        latitude: 0.5,
        longitude: 0.5,
      };
      const siteOut = {
        _id: new mongoose.Types.ObjectId(),
        latitude: 2,
        longitude: 2,
      };

      sandbox.stub(generateFilter, "grids").returns({ _id: gridId });
      const findSitesModelStub = sandbox.stub(mongoose, "model");
      findSitesModelStub.withArgs("grids").returns({
        findOne: sandbox.stub().returns({
          lean: sandbox.stub().resolves({ _id: gridId, shape: gridShape }),
        }),
      });
      findSitesModelStub.withArgs("devices").returns({
        distinct: sandbox.stub().resolves([siteIn._id, siteOut._id]),
      });
      findSitesModelStub.withArgs("sites").returns({
        find: sandbox
          .stub()
          .returns({ lean: sandbox.stub().resolves([siteIn, siteOut]) }),
      });
      sandbox
        .stub(geolib, "isPointInPolygon")
        .callsFake((point) => point.latitude === 0.5);

      const result = await gridUtil.findSites(request, gridShape, next);

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.lengthOf(1);
      expect(result.data[0].toString()).to.equal(siteIn._id.toString());
    });
  });

  describe("refresh", () => {
    it("should successfully refresh a grid by updating site associations", async () => {
      const gridId = new mongoose.Types.ObjectId();
      const request = {
        query: { tenant: "airqo" },
        params: { grid_id: gridId.toString() },
      };
      const grid = { _id: gridId, shape: { type: "Polygon", coordinates: [] } };
      const siteIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ];

      const refreshModelStub = sandbox.stub(mongoose, "model");
      refreshModelStub.withArgs("grids").returns({ findById: sandbox.stub().resolves(grid) });
      sandbox
        .stub(gridUtil, "findSites")
        .resolves({ success: true, data: siteIds.map((_id) => ({ _id })) });
      const bulkWriteStub = sandbox.stub().resolves({ ok: 1, nModified: 2 });
      const updateManyStub = sandbox.stub().resolves({ ok: 1 });
      refreshModelStub
        .withArgs("sites")
        .returns({ bulkWrite: bulkWriteStub, updateMany: updateManyStub });

      const result = await gridUtil.refresh(request);

      expect(result.success).to.be.true;
      expect(result.message).to.include("Refresh for Grid");
      expect(bulkWriteStub.calledOnce).to.be.true;
      expect(updateManyStub.calledOnce).to.be.true;
    });
  });

  describe("updateShape", () => {
    it("should update a grid's shape and recalculate centers", async () => {
      const gridId = new mongoose.Types.ObjectId();
      const request = {
        query: { tenant: "airqo" },
        params: { grid_id: gridId.toString() },
        body: {
          shape: {
            type: "Polygon",
            coordinates: [[[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]]],
          },
          update_reason: "Testing update",
        },
      };
      const existingGrid = {
        _id: gridId,
        shape: { type: "Polygon", coordinates: [] },
        centers: [],
      };
      const updatedGrid = { ...existingGrid, ...request.body };

      sandbox.stub(generateFilter, "grids").returns({ _id: gridId });
      sandbox.stub(mongoose, "model").withArgs("grids").returns({
        findOne: sandbox
          .stub()
          .returns({ lean: sandbox.stub().resolves(existingGrid) }),
        modifyShape: sandbox.stub().resolves({
          success: true,
          data: updatedGrid,
          message:
            "Successfully updated the grid shape and recalculated centers",
        }),
      });
      sandbox
        .stub(gridUtil, "calculateGeographicalCenter")
        .resolves({ success: true, data: [{ lat: 0, lon: 0 }] });
      sandbox.stub(gridUtil, "refresh").resolves({ success: true });

      const result = await gridUtil.updateShape(request);

      expect(result.success).to.be.true;
      expect(result.message).to.include("Successfully updated the grid shape");
    });
  });

  describe("filterOutPrivateSites", () => {
    it("should filter out private site IDs from a given list", async () => {
      const publicSiteId = new mongoose.Types.ObjectId();
      const privateSiteId = new mongoose.Types.ObjectId();
      const request = {
        body: {
          tenant: "airqo",
          site_ids: [publicSiteId.toString(), privateSiteId.toString()],
        },
      };
      const privateGridId = new mongoose.Types.ObjectId();

      const filterPrivateModelStub = sandbox.stub(mongoose, "model");
      filterPrivateModelStub.withArgs("grids").returns({
        find: sandbox.stub().returns({
          select: sandbox.stub().returns({
            lean: sandbox.stub().resolves([{ _id: privateGridId }]),
          }),
        }),
      });
      filterPrivateModelStub
        .withArgs("sites")
        .returns({ find: sandbox.stub().resolves([{ _id: privateSiteId }]) });

      const result = await gridUtil.filterOutPrivateSites(request);

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.lengthOf(1);
      expect(result.data[0]).to.equal(publicSiteId.toString());
    });
  });

  describe("findNearestCountry", () => {
    it("should find the nearest country based on GPS coordinates", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: { latitude: 1, longitude: 32 },
      };
      const ugandaGrid = {
        name: "Uganda",
        centers: [{ latitude: 1.3733, longitude: 32.2903 }],
      };
      const kenyaGrid = {
        name: "Kenya",
        centers: [{ latitude: -0.0236, longitude: 37.9062 }],
      };

      sandbox.stub(mongoose, "model").withArgs("grids").returns({
        find: sandbox.stub().returns({
          lean: sandbox.stub().resolves([ugandaGrid, kenyaGrid]),
        }),
      });
      sandbox.stub(geolib, "getDistance").callsFake((p1, p2) => {
        if (p2.latitude === ugandaGrid.centers[0].latitude) return 100; // Mock distance
        if (p2.latitude === kenyaGrid.centers[0].latitude) return 500;
        return 1000;
      });

      const result = await gridUtil.findNearestCountry(request);

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.lengthOf(1);
      expect(result.data[0].name).to.equal("Uganda");
    });
  });

  // Placeholder for other function tests
  describe("Other Functions", () => {
    it("delete should be temporarily disabled", async () => {
      const result = await gridUtil.delete({});
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
    });

    it("deleteAdminLevel should be temporarily disabled", async () => {
      const result = await gridUtil.deleteAdminLevel({});
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
    });
  });

  // ---------------------------------------------------------------------------
  // createAdminLevel
  // ---------------------------------------------------------------------------
  describe("createAdminLevel", () => {
    let adminLevelModelStub;
    let findOneStub;
    let registerStub;
    let nextSpy;

    beforeEach(() => {
      findOneStub = { lean: sandbox.stub() };
      registerStub = sandbox.stub();
      adminLevelModelStub = {
        findOne: sandbox.stub().returns(findOneStub),
        register: registerStub,
      };
      sandbox.stub(mongoose, "model").withArgs("adminlevels").returns(adminLevelModelStub);
      nextSpy = sandbox.spy();
    });

    it("returns 409 and calls next(HttpError) when name already exists", async () => {
      findOneStub.lean.resolves({ _id: "existing-id" });

      const request = {
        query: { tenant: "airqo" },
        body: { name: "town" },
      };

      await gridUtil.createAdminLevel(request, nextSpy);

      expect(nextSpy.calledOnce).to.be.true;
      const err = nextSpy.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.CONFLICT);
      expect(registerStub.called).to.be.false;
    });

    it("calls register() and returns its result when name is unique", async () => {
      findOneStub.lean.resolves(null);
      const mockResponse = { success: true, status: httpStatus.OK };
      registerStub.resolves(mockResponse);

      const request = {
        query: { tenant: "airqo" },
        body: { name: "district" },
      };

      const result = await gridUtil.createAdminLevel(request, nextSpy);

      expect(registerStub.calledOnce).to.be.true;
      expect(result).to.deep.equal(mockResponse);
      expect(nextSpy.called).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // getPrivateSiteIds — two-level cache (L1 in-memory + L2 MongoDB)
  // ---------------------------------------------------------------------------
  describe("getPrivateSiteIds", () => {
    const SITE_IDS = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
    ];
    const FUTURE_EXPIRES = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
    const PAST_EXPIRES = new Date(Date.now() - 1000); // already expired

    let cohortAggregateStub;
    let computedCacheFindOneStub;
    let computedCacheFindOneAndUpdateStub;
    let gridPrivateModelStub;

    beforeEach(() => {
      // Reset the module-level L1 cache and any in-flight promises before
      // every test so no state leaks between cases.
      gridUtil._clearPrivateSiteIdsCache();

      // Stub CohortModel aggregate (the full recompute path)
      cohortAggregateStub = sandbox.stub().resolves([{ site_ids: SITE_IDS }]);

      // Stub ComputedCacheModel — all methods used by the two-level cache:
      //   findOne            : L2 read
      //   findOneAndUpdate   : L2 upsert (write)
      //   create             : acquireComputeLease (insert lock document)
      //   deleteOne          : releaseComputeLease (delete lock document)
      computedCacheFindOneStub = sandbox.stub();
      computedCacheFindOneAndUpdateStub = sandbox.stub().resolves();

      gridPrivateModelStub = sandbox.stub(mongoose, "model");
      gridPrivateModelStub.withArgs("cohorts").returns({
        aggregate: cohortAggregateStub,
      });
      gridPrivateModelStub.withArgs("computedcaches").returns({
        findOne: computedCacheFindOneStub,
        findOneAndUpdate: computedCacheFindOneAndUpdateStub,
        create: sandbox.stub().resolves(), // lease acquired by default
        deleteOne: sandbox.stub().resolves(), // lease released by default
      });
    });

    it("L2 hit: warms L1 and returns cached data without triggering recompute", async () => {
      // L2 returns a fresh cached document
      computedCacheFindOneStub.returns({
        lean: sandbox.stub().resolves({
          data: SITE_IDS,
          expiresAt: FUTURE_EXPIRES,
        }),
      });

      const result = await gridUtil._getPrivateSiteIds("airqo");

      expect(result).to.deep.equal(SITE_IDS);
      // Full recompute (CohortModel aggregate) must NOT have been called
      expect(cohortAggregateStub.called).to.be.false;
      // L2 findOne must have been called with normalised tenant
      expect(
        computedCacheFindOneStub.calledWith({
          key: "private_site_ids",
          tenant: "airqo",
        })
      ).to.be.true;
    });

    it("L2 miss (expired document): triggers recompute and attempts upsert", async () => {
      // L2 returns an expired document
      computedCacheFindOneStub.returns({
        lean: sandbox.stub().resolves({
          data: SITE_IDS,
          expiresAt: PAST_EXPIRES,
        }),
      });
      computedCacheFindOneAndUpdateStub.resolves();

      const result = await gridUtil._getPrivateSiteIds("airqo");

      expect(result).to.deep.equal(SITE_IDS);
      // Full recompute must have run
      expect(cohortAggregateStub.calledOnce).to.be.true;
      // Upsert must have been attempted with correct key and tenant
      expect(computedCacheFindOneAndUpdateStub.calledOnce).to.be.true;
      const [filter, update] = computedCacheFindOneAndUpdateStub.firstCall.args;
      expect(filter).to.deep.equal({ key: "private_site_ids", tenant: "airqo" });
      expect(update.$set.data).to.deep.equal(SITE_IDS);
      expect(update.$setOnInsert.tenant).to.equal("airqo");
      expect(update.$setOnInsert.key).to.equal("private_site_ids");
    });

    it("L2 miss (no document): triggers recompute and attempts upsert", async () => {
      computedCacheFindOneStub.returns({
        lean: sandbox.stub().resolves(null),
      });
      computedCacheFindOneAndUpdateStub.resolves();

      const result = await gridUtil._getPrivateSiteIds("airqo");

      expect(result).to.deep.equal(SITE_IDS);
      expect(cohortAggregateStub.calledOnce).to.be.true;
      expect(computedCacheFindOneAndUpdateStub.calledOnce).to.be.true;
    });

    it("missing tenant falls back to default and uses it consistently for L1 key, L2 filter, and upsert", async () => {
      computedCacheFindOneStub.returns({
        lean: sandbox.stub().resolves(null),
      });
      computedCacheFindOneAndUpdateStub.resolves();

      // Clear L1 between calls so both are forced through L2, allowing us to
      // verify that undefined and "" normalise to the same canonical tenant.
      await gridUtil._getPrivateSiteIds(undefined);
      gridUtil._clearPrivateSiteIdsCache();
      await gridUtil._getPrivateSiteIds("");

      // Both calls must have hit L2 (findOne called twice)
      expect(computedCacheFindOneStub.callCount).to.equal(2);
      expect(computedCacheFindOneAndUpdateStub.callCount).to.equal(2);

      // For each invocation, the read tenant must be a valid non-empty string
      // and must exactly match the tenant written in the upsert — ensuring
      // the normalisation is applied consistently end-to-end.
      computedCacheFindOneStub.args.forEach(([readFilter], i) => {
        const [writeFilter, writeUpdate] =
          computedCacheFindOneAndUpdateStub.args[i];

        expect(readFilter.tenant).to.be.a("string").and.not.be.empty;
        expect(readFilter.tenant).to.not.equal("undefined");
        expect(readFilter.tenant).to.equal(writeFilter.tenant);
        expect(writeUpdate.$setOnInsert.tenant).to.equal(readFilter.tenant);
      });
    });

    it("L2 read failure is non-fatal: falls through to recompute and still returns data", async () => {
      // L2 findOne throws
      computedCacheFindOneStub.returns({
        lean: sandbox.stub().rejects(new Error("MongoDB connection lost")),
      });
      computedCacheFindOneAndUpdateStub.resolves();

      const result = await gridUtil._getPrivateSiteIds("airqo");

      // Must still return freshly computed data
      expect(result).to.deep.equal(SITE_IDS);
      expect(cohortAggregateStub.calledOnce).to.be.true;
    });

    it("L2 write failure is non-fatal: result is still returned correctly", async () => {
      computedCacheFindOneStub.returns({
        lean: sandbox.stub().resolves(null),
      });
      // Upsert rejects
      computedCacheFindOneAndUpdateStub.rejects(new Error("write timeout"));

      // Should not throw
      const result = await gridUtil._getPrivateSiteIds("airqo");
      expect(result).to.deep.equal(SITE_IDS);
    });
  });
});
