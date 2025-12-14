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
      sandbox.stub(GridModel, "default").returns({ register: registerStub });

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
      sandbox.stub(GridModel, "default").returns({
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
      sandbox.stub(GridModel, "default").returns({ aggregate: aggregateStub });
      sandbox.stub(generateFilter, "grids").returns({});
    });

    it("should list grids and filter out private sites by default", async () => {
      const request = { query: { tenant: "airqo" } };
      const privateSiteIds = [new mongoose.Types.ObjectId()];
      const cohortAggregateStub = sandbox
        .stub()
        .resolves([{ site_ids: privateSiteIds }]);
      sandbox
        .stub(CohortModel, "default")
        .returns({ aggregate: cohortAggregateStub });

      await gridUtil.list(request);

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

      sandbox
        .stub(CohortModel, "default")
        .returns({ aggregate: sandbox.stub().resolves([]) });
      const deviceFindStub = sandbox.stub().returns({
        distinct: sandbox.stub().resolves(cohortSiteIds),
      });
      sandbox.stub(DeviceModel, "default").returns({ find: deviceFindStub });

      await gridUtil.list(request);

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
      sandbox.stub(DeviceModel, "default").returns({ find: deviceFindStub });

      const result = await gridUtil.list(request);

      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.message).to.equal(
        "No grids found for the specified cohort(s)."
      );
    });
  });

  describe("listCountries", () => {
    it("should list countries with site counts, filtering private sites", async () => {
      const request = { query: { tenant: "airqo" } };
      const privateSiteIds = [new mongoose.Types.ObjectId()];
      const cohortAggregateStub = sandbox
        .stub()
        .resolves([{ site_ids: privateSiteIds }]);
      sandbox
        .stub(CohortModel, "default")
        .returns({ aggregate: cohortAggregateStub });
      const gridAggregateStub = sandbox
        .stub()
        .resolves([{ country: "uganda", sites: 10 }]);
      sandbox
        .stub(GridModel, "default")
        .returns({ aggregate: gridAggregateStub });

      const result = await gridUtil.listCountries(request);

      expect(result.success).to.be.true;
      expect(result.data[0].country).to.equal("uganda");
      const filterStage = gridAggregateStub
        .getCall(0)
        .args[0].find(
          (stage) => stage.$addFields && stage.$addFields.sites.$filter
        );
      expect(filterStage).to.exist;
      expect(
        filterStage.$addFields.sites.$filter.cond.$not.$in[1]
      ).to.deep.equal(privateSiteIds);
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
      sandbox.stub(GridModel, "default").returns({
        findOne: sandbox.stub().returns({
          lean: sandbox.stub().resolves({ _id: gridId, shape: gridShape }),
        }),
      });
      sandbox.stub(DeviceModel, "default").returns({
        distinct: sandbox.stub().resolves([siteIn._id, siteOut._id]),
      });
      sandbox.stub(SiteModel, "default").returns({
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

      sandbox
        .stub(GridModel, "default")
        .returns({ findById: sandbox.stub().resolves(grid) });
      sandbox
        .stub(gridUtil, "findSites")
        .resolves({ success: true, data: siteIds.map((_id) => ({ _id })) });
      const bulkWriteStub = sandbox.stub().resolves({ ok: 1, nModified: 2 });
      const updateManyStub = sandbox.stub().resolves({ ok: 1 });
      sandbox
        .stub(SiteModel, "default")
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
      sandbox.stub(GridModel, "default").returns({
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

      sandbox.stub(GridModel, "default").returns({
        find: sandbox.stub().returns({
          select: sandbox.stub().returns({
            lean: sandbox.stub().resolves([{ _id: privateGridId }]),
          }),
        }),
      });
      sandbox
        .stub(SiteModel, "default")
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

      sandbox.stub(GridModel, "default").returns({
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
});
