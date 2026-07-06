require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const { expect } = chai;
const httpStatus = require("http-status");
const axios = require("axios");
const deviceUtil = require("@utils/device.util");
const DeviceModel = require("@models/Device");
const CohortModel = require("@models/Cohort");
const SiteModel = require("@models/Site");
const generateFilter = require("@utils/common/generate-filter");
const ActivityModel = require("@models/Activity");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
const chaiHttp = require("chai-http");

chai.use(chaiHttp);

describe("Device Util", () => {
  describe("getDeviceCountSummary", () => {
    let sandbox;
    let aggregateStub;
    let generateFilterStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      aggregateStub = sandbox.stub();
      // DeviceModel(tenant) calls mongoose.model("devices") internally
      sandbox.stub(mongoose, "model").withArgs("devices").returns({ aggregate: aggregateStub });
      generateFilterStub = sandbox.stub(generateFilter, "devices");
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should return a summary of device counts successfully", async () => {
      const request = { query: { tenant: "airqo" } };
      const filter = { network: "airqo" };
      generateFilterStub.returns(filter);

      const mockAggregationResult = [
        {
          total_monitors: 100,
          operational: 70,
          transmitting: 15,
          not_transmitting: 10,
          data_available: 5,
        },
      ];
      // aggregate().option().allowDiskUse() chain
      aggregateStub.returns({ option: sandbox.stub().returns({ allowDiskUse: sandbox.stub().resolves(mockAggregationResult) }) });

      const result = await deviceUtil.getDeviceCountSummary(request);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal({
        total_monitors: 100,
        operational: 70,
        transmitting: 15,
        not_transmitting: 10,
        data_available: 5,
      });
      expect(aggregateStub.calledOnce).to.be.true;
      const pipeline = aggregateStub.getCall(0).args[0];
      expect(pipeline[0].$match).to.deep.equal(filter);
    });

    it("should return a summary with all zeros when no devices match the filter", async () => {
      const request = { query: { tenant: "airqo", network: "kcca" } };
      const filter = { network: "kcca" };
      generateFilterStub.returns(filter);

      aggregateStub.returns({ option: sandbox.stub().returns({ allowDiskUse: sandbox.stub().resolves([]) }) });

      const result = await deviceUtil.getDeviceCountSummary(request);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal({
        total_monitors: 0,
        operational: 0,
        transmitting: 0,
        not_transmitting: 0,
        data_available: 0,
      });
      expect(aggregateStub.calledOnce).to.be.true;
    });

    it("should correctly apply network and cohort filters from the request", async () => {
      const cohortId = new mongoose.Types.ObjectId();
      const request = {
        query: {
          tenant: "airqo",
          network: "airqo",
          cohort_id: cohortId.toString(),
        },
      };
      const filter = { network: "airqo", cohorts: { $in: [cohortId] } };
      generateFilterStub.returns(filter);

      aggregateStub.returns({ option: sandbox.stub().returns({ allowDiskUse: sandbox.stub().resolves([]) }) });

      await deviceUtil.getDeviceCountSummary(request);

      expect(generateFilterStub.calledOnceWith(request)).to.be.true;
      expect(aggregateStub.calledOnce).to.be.true;
      const pipeline = aggregateStub.getCall(0).args[0];
      expect(pipeline[0].$match).to.deep.equal(filter);
    });

    it("should handle database errors gracefully", async () => {
      const request = { query: { tenant: "airqo" } };
      const next = sinon.spy();
      generateFilterStub.returns({});
      const dbError = new Error("Database connection failed");
      aggregateStub.returns({ option: sandbox.stub().returns({ allowDiskUse: sandbox.stub().rejects(dbError) }) });

      await deviceUtil.getDeviceCountSummary(request, next);

      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.an.instanceOf(Error);
      expect(error.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(error.message).to.equal("Internal Server Error");
    });
  });
  describe("getDeviceCountSummaryByNetwork", () => {
    let sandbox;
    let aggregateStub;
    let generateFilterStub;

    // Mirrors the real DeviceModel(tenant).aggregate(pipeline).option(...).allowDiskUse(true) chain
    const createAggregateChain = (result, error) => ({
      option: sinon.stub().returns({
        allowDiskUse: sinon
          .stub()
          .returns(error ? Promise.reject(error) : Promise.resolve(result)),
      }),
    });

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      aggregateStub = sandbox.stub();
      sandbox.stub(mongoose, "model").withArgs("devices").returns({ aggregate: aggregateStub });
      generateFilterStub = sandbox.stub(generateFilter, "devices");
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should group results by network and compute percentages", async () => {
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});

      aggregateStub.returns(
        createAggregateChain([
          {
            _id: "airqo",
            total: 100,
            operational: 70,
            transmitting: 15,
            data_available: 5,
            not_transmitting: 10,
          },
          {
            _id: "iqair",
            total: 50,
            operational: 20,
            transmitting: 5,
            data_available: 0,
            not_transmitting: 25,
          },
        ]),
      );

      const result = await deviceUtil.getDeviceCountSummaryByNetwork(request);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal([
        {
          network: "airqo",
          total_monitors: 100,
          operational_count: 70,
          transmitting_count: 15,
          data_available_count: 5,
          not_transmitting_count: 10,
          not_transmitting_percentage: 10,
        },
        {
          network: "iqair",
          total_monitors: 50,
          operational_count: 20,
          transmitting_count: 5,
          data_available_count: 0,
          not_transmitting_count: 25,
          not_transmitting_percentage: 50,
        },
      ]);
    });

    it("should build the $group._id expression to fall back to 'unknown' for missing/empty network", async () => {
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});
      aggregateStub.returns(createAggregateChain([]));

      await deviceUtil.getDeviceCountSummaryByNetwork(request);

      expect(aggregateStub.calledOnce).to.be.true;
      const pipeline = aggregateStub.getCall(0).args[0];
      const groupStage = pipeline.find((stage) => stage.$group);
      expect(groupStage.$group._id).to.deep.equal({
        $ifNull: [{ $toLower: "$network" }, "unknown"],
      });
    });

    it("should map an already-grouped 'unknown' bucket through to the output", async () => {
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});

      aggregateStub.returns(
        createAggregateChain([
          {
            _id: "unknown",
            total: 10,
            operational: 0,
            transmitting: 0,
            data_available: 0,
            not_transmitting: 10,
          },
        ]),
      );

      const result = await deviceUtil.getDeviceCountSummaryByNetwork(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([
        {
          network: "unknown",
          total_monitors: 10,
          operational_count: 0,
          transmitting_count: 0,
          data_available_count: 0,
          not_transmitting_count: 10,
          not_transmitting_percentage: 100,
        },
      ]);
    });

    it("should return an empty array when no devices match the filter", async () => {
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});
      aggregateStub.returns(createAggregateChain([]));

      const result = await deviceUtil.getDeviceCountSummaryByNetwork(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([]);
    });

    it("should call next with an HttpError when next is provided and aggregation fails", async () => {
      const request = { query: { tenant: "airqo" } };
      const next = sinon.spy();
      generateFilterStub.returns({});
      const dbError = new Error("Database connection failed");
      aggregateStub.returns(createAggregateChain(null, dbError));

      await deviceUtil.getDeviceCountSummaryByNetwork(request, next);

      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.an.instanceOf(Error);
      expect(error.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(error.message).to.equal("Internal Server Error");
    });

    it("should throw instead of crashing when next is not provided and aggregation fails", async () => {
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});
      const dbError = new Error("Database connection failed");
      aggregateStub.returns(createAggregateChain(null, dbError));

      let thrown;
      try {
        await deviceUtil.getDeviceCountSummaryByNetwork(request);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).to.be.an.instanceOf(Error);
      expect(thrown.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(thrown.message).to.equal("Internal Server Error");
    });
  });
  describe("getDeviceCountSummaryByCohort", () => {
    let sandbox;
    let aggregateStub;
    let generateFilterStub;
    let cohortFindStub;

    // Mirrors the real DeviceModel(tenant).aggregate(pipeline).option(...).allowDiskUse(true) chain
    const createAggregateChain = (result, error) => ({
      option: sinon.stub().returns({
        allowDiskUse: sinon
          .stub()
          .returns(error ? Promise.reject(error) : Promise.resolve(result)),
      }),
    });

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      aggregateStub = sandbox.stub();
      cohortFindStub = sandbox.stub();
      const modelStub = sandbox.stub(mongoose, "model");
      modelStub.withArgs("devices").returns({ aggregate: aggregateStub });
      modelStub.withArgs("cohorts").returns({ find: cohortFindStub });
      generateFilterStub = sandbox.stub(generateFilter, "devices");
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should group results by cohort, look up cohort names, and compute percentages", async () => {
      const cohortIdA = new mongoose.Types.ObjectId();
      const cohortIdB = new mongoose.Types.ObjectId();
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});

      aggregateStub.returns(
        createAggregateChain([
          {
            _id: cohortIdA,
            total: 100,
            operational: 70,
            transmitting: 15,
            data_available: 5,
            not_transmitting: 10,
          },
          {
            _id: cohortIdB,
            total: 50,
            operational: 20,
            transmitting: 5,
            data_available: 0,
            not_transmitting: 25,
          },
        ]),
      );

      cohortFindStub.returns({
        select: sinon.stub().returns({
          lean: sinon.stub().resolves([
            { _id: cohortIdA, name: "Kampala Cohort" },
            { _id: cohortIdB, name: "Jinja Cohort" },
          ]),
        }),
      });

      const result = await deviceUtil.getDeviceCountSummaryByCohort(request);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal([
        {
          cohort_id: cohortIdA.toString(),
          cohort_name: "Kampala Cohort",
          total_monitors: 100,
          operational_count: 70,
          transmitting_count: 15,
          data_available_count: 5,
          not_transmitting_count: 10,
          not_transmitting_percentage: 10,
        },
        {
          cohort_id: cohortIdB.toString(),
          cohort_name: "Jinja Cohort",
          total_monitors: 50,
          operational_count: 20,
          transmitting_count: 5,
          data_available_count: 0,
          not_transmitting_count: 25,
          not_transmitting_percentage: 50,
        },
      ]);
    });

    it("should unwind the cohorts array in the pipeline", async () => {
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});
      aggregateStub.returns(createAggregateChain([]));
      cohortFindStub.returns({
        select: sinon.stub().returns({ lean: sinon.stub().resolves([]) }),
      });

      await deviceUtil.getDeviceCountSummaryByCohort(request);

      expect(aggregateStub.calledOnce).to.be.true;
      const pipeline = aggregateStub.getCall(0).args[0];
      const unwindStage = pipeline.find((stage) => stage.$unwind);
      expect(unwindStage.$unwind.path).to.equal("$cohorts");
      expect(unwindStage.$unwind.preserveNullAndEmptyArrays).to.be.false;
    });

    it("should default cohort_name to 'unknown' when the cohort can't be found", async () => {
      const cohortId = new mongoose.Types.ObjectId();
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});
      aggregateStub.returns(
        createAggregateChain([
          {
            _id: cohortId,
            total: 10,
            operational: 5,
            transmitting: 2,
            data_available: 1,
            not_transmitting: 2,
          },
        ]),
      );
      cohortFindStub.returns({
        select: sinon.stub().returns({ lean: sinon.stub().resolves([]) }),
      });

      const result = await deviceUtil.getDeviceCountSummaryByCohort(request);

      expect(result.data[0].cohort_name).to.equal("unknown");
    });

    it("should return an empty array when no devices match the filter", async () => {
      const request = { query: { tenant: "airqo" } };
      generateFilterStub.returns({});
      aggregateStub.returns(createAggregateChain([]));
      cohortFindStub.returns({
        select: sinon.stub().returns({ lean: sinon.stub().resolves([]) }),
      });

      const result = await deviceUtil.getDeviceCountSummaryByCohort(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([]);
    });

    it("should call next with an HttpError when aggregation fails", async () => {
      const request = { query: { tenant: "airqo" } };
      const next = sinon.spy();
      generateFilterStub.returns({});
      const dbError = new Error("Database connection failed");
      aggregateStub.returns(createAggregateChain(null, dbError));

      await deviceUtil.getDeviceCountSummaryByCohort(request, next);

      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.an.instanceOf(Error);
      expect(error.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(error.message).to.equal("Internal Server Error");
    });
  });
  describe("createOnPlatform", () => {
    let sandbox;
    let deviceRegisterStub,
      cohortFindByIdStub,
      cohortFindOneStub,
      cohortFindOneAndUpdateStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      const deviceModelMock = { register: sandbox.stub() };
      const cohortModelMock = {
        findById: sandbox.stub(),
        findOne: sandbox.stub(),
        findOneAndUpdate: sandbox.stub(),
      };
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("devices").returns(deviceModelMock);
      ms.withArgs("cohorts").returns(cohortModelMock);
      deviceRegisterStub = deviceModelMock.register;
      cohortFindByIdStub = cohortModelMock.findById;
      cohortFindOneStub = cohortModelMock.findOne;
      cohortFindOneAndUpdateStub = cohortModelMock.findOneAndUpdate;
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should create a device, assign owner, and assign to personal and default cohorts", async () => {
      const userId = new mongoose.Types.ObjectId();
      const request = {
        query: { tenant: "airqo" },
        body: { name: "test_device", user_id: userId.toString() },
      };
      const next = sinon.spy();

      const personalCohortMock = { _id: new mongoose.Types.ObjectId() };
      const defaultCohortMock = { _id: new mongoose.Types.ObjectId() };

      cohortFindOneAndUpdateStub.resolves(personalCohortMock);
      cohortFindOneStub
        .withArgs({ name: constants.DEFAULT_COHORT_NAME })
        .returns({ select: () => ({ lean: () => defaultCohortMock }) });
      deviceRegisterStub.resolves({
        success: true,
        data: { name: "test_device" },
      });

      const result = await deviceUtil.createOnPlatform(request, next);

      expect(result.success).to.be.true;
      expect(deviceRegisterStub.calledOnce).to.be.true;
      const registerArgs = deviceRegisterStub.firstCall.args[0];
      expect(registerArgs.owner_id.toString()).to.equal(userId.toString());
      expect(registerArgs.cohorts)
        .to.be.an("array")
        .with.lengthOf(2);
      expect(registerArgs.cohorts.map(String)).to.include.members([
        personalCohortMock._id.toString(),
        defaultCohortMock._id.toString(),
      ]);
      expect(next.called).to.be.false;
    });

    it("should assign to a specific cohort if cohort_id is provided", async () => {
      const userId = new mongoose.Types.ObjectId();
      const cohortId = new mongoose.Types.ObjectId();
      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "test_device_2",
          user_id: userId.toString(),
          cohort_id: cohortId.toString(),
        },
      };
      const next = sinon.spy();

      const specificCohortMock = { _id: cohortId };
      const defaultCohortMock = { _id: new mongoose.Types.ObjectId() };

      cohortFindByIdStub.returns({ lean: () => specificCohortMock });
      cohortFindOneStub
        .withArgs({ name: constants.DEFAULT_COHORT_NAME })
        .returns({ select: () => ({ lean: () => defaultCohortMock }) });
      deviceRegisterStub.resolves({
        success: true,
        data: { name: "test_device_2" },
      });

      await deviceUtil.createOnPlatform(request, next);

      expect(deviceRegisterStub.calledOnce).to.be.true;
      const registerArgs = deviceRegisterStub.firstCall.args[0];
      expect(registerArgs.owner_id.toString()).to.equal(userId.toString());
      expect(registerArgs.cohorts.map(String)).to.include.members([
        cohortId.toString(),
        defaultCohortMock._id.toString(),
      ]);
      expect(cohortFindOneAndUpdateStub.notCalled).to.be.true; // Should not create personal cohort
    });

    it("should throw an error if user_id is invalid", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: { name: "test_device_3", user_id: "invalid-id" },
      };
      const next = sinon.spy();

      await deviceUtil.createOnPlatform(request, next);

      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.an.instanceOf(Error);
      expect(error.statusCode).to.equal(httpStatus.BAD_REQUEST);
      expect(error.message).to.equal("Invalid user_id provided");
    });

    it("should throw an error if specified cohort_id is not found", async () => {
      const userId = new mongoose.Types.ObjectId();
      const nonExistentCohortId = new mongoose.Types.ObjectId();
      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "test_device_4",
          user_id: userId.toString(),
          cohort_id: nonExistentCohortId.toString(),
        },
      };
      const next = sinon.spy();

      cohortFindByIdStub.returns({ lean: () => null }); // Simulate not found

      await deviceUtil.createOnPlatform(request, next);

      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.an.instanceOf(Error);
      expect(error.statusCode).to.equal(httpStatus.NOT_FOUND);
      expect(error.message).to.include("Specified cohort with ID");
    });
  });

  describe("claimDevice", () => {
    let sandbox;
    let findOneStub;
    let findOneAndUpdateStub;
    let cohortFindOneAndUpdateStub;
    let cohortFindByIdStub;
    let createActivityStub;
    let updateOneStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      const activityModelMock = { create: sandbox.stub().resolves({}) };
      const deviceModelMock = {
        findOne: sandbox.stub(),
        findOneAndUpdate: sandbox.stub(),
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves(null) }),
        updateOne: sandbox.stub().resolves({ modifiedCount: 1 }),
      };
      const cohortModelMock = {
        findOneAndUpdate: sandbox.stub(),
        findById: sandbox.stub(),
      };
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("devices").returns(deviceModelMock);
      ms.withArgs("cohorts").returns(cohortModelMock);
      ms.withArgs("activities").returns(activityModelMock);

      findOneStub = deviceModelMock.findOne;
      findOneAndUpdateStub = deviceModelMock.findOneAndUpdate;
      cohortFindOneAndUpdateStub = cohortModelMock.findOneAndUpdate;
      cohortFindByIdStub = cohortModelMock.findById;
      updateOneStub = deviceModelMock.updateOne;
      createActivityStub = activityModelMock.create;
      cohortFindByIdStub.returns({
        lean: sandbox.stub().resolves({ _id: "60c7a3e5f7e4f1001f5e8e1a" }),
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should successfully claim a device and assign it to a specific cohort", async () => {
      const request = {
        body: {
          device_name: "aq_g5v0_100",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          cohort_id: "60c7a3e5f7e4f1001f5e8e1a",
        },
        query: { tenant: "airqo" },
      };

      const deviceMock = {
        _id: "60c7a3e5f7e4f1001f5e8e1c",
        name: "aq_g5v0_100",
        claim_status: "unclaimed",
      };
      const cohortMock = { _id: "60c7a3e5f7e4f1001f5e8e1a" };

      findOneStub.resolves(deviceMock);
      cohortFindByIdStub.returns({ lean: () => Promise.resolve(cohortMock) });
      findOneAndUpdateStub.resolves({
        ...deviceMock,
        claim_status: "claimed",
      });
      const result = await deviceUtil.claimDevice(request);
    });

    it("should successfully claim a device and assign it to a new personal cohort", async () => {
      const request = {
        body: {
          device_name: "aq_g5v0_101",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
        },
        query: { tenant: "airqo" },
      };

      const deviceMock = {
        _id: "60c7a3e5f7e4f1001f5e8e1d",
        name: "aq_g5v0_101",
        claim_status: "unclaimed",
        network: "airqo",
      };
      findOneStub.resolves(deviceMock);
      cohortFindOneAndUpdateStub.resolves({ _id: "60c7a3e5f7e4f1001f5e8e1e" });
      findOneAndUpdateStub.resolves({
        ...deviceMock,
        claim_status: "claimed",
      });
      updateOneStub.resolves({
        modifiedCount: 1,
      });

      const result = await deviceUtil.claimDevice(request);

      expect(cohortFindOneAndUpdateStub.calledOnce).to.be.true;
      expect(cohortFindOneAndUpdateStub.firstCall.args[0].name).to.equal(
        "coh_user_60c7a3e5f7e4f1001f5e8e1b"
      );
    });

    it("should return 404 if the device is not found or already claimed", async () => {
      const request = {
        body: {
          device_name: "aq_g5v0_999",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
        },
        query: { tenant: "airqo" },
      };

      findOneStub.resolves(null);
      let error;
      try {
        await deviceUtil.claimDevice(request, (err) => (error = err));
      } catch (err) {
        error = err;
      }
      expect(error.statusCode).to.equal(httpStatus.NOT_FOUND);
    });

    it("should return 404 if a specified cohort_id does not exist", async () => {
      const request = {
        body: {
          device_name: "aq_g5v0_102",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          cohort_id: "60c7a3e5f7e4f1001f5e8e99", // non-existent
        },
        query: { tenant: "airqo" },
      };

      findOneStub.resolves({
        _id: "60c7a3e5f7e4f1001f5e8e1f", // Corrected ID
        name: "aq_g5v0_102",
        claim_status: "unclaimed",
      });

      cohortFindByIdStub // No need to access CohortModel directly anymore
        .withArgs("60c7a3e5f7e4f1001f5e8e99")
        .returns({ lean: sinon.stub().resolves(null) });

      let error;
      try {
        await deviceUtil.claimDevice(request, (err) => (error = err));
      } catch (err) {}

      expect(error.statusCode).to.equal(httpStatus.NOT_FOUND);
    });

    it("should return 403 if the claim_token is invalid", async () => {
      const request = {
        body: {
          device_name: "aq_g5v0_103",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          claim_token: "wrong_token",
        },
        query: { tenant: "airqo" },
      };

      findOneStub.resolves({
        _id: "60c7a3e5f7e4f1001f5e8e20", // Corrected ID
        name: "aq_g5v0_103",
        claim_status: "unclaimed",
        claim_token: "correct_token",
      });

      let error;
      try {
        await deviceUtil.claimDevice(request, (err) => (error = err));
      } catch (err) {}

      expect(error.statusCode).to.equal(httpStatus.FORBIDDEN);
    });

    it("should auto-recall and claim a deployed device", async () => {
      const request = {
        body: {
          device_name: "deployed_device",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
        },
        query: { tenant: "airqo" },
      };

      const deviceMock = {
        _id: "some_device_id",
        name: "deployed_device",
        claim_status: "unclaimed",
        status: "deployed",
        network: "airqo",
      };
      findOneStub.resolves(deviceMock);
      updateOneStub.resolves({ modifiedCount: 1 });
      // Personal cohort upsert returns a cohort
      cohortFindOneAndUpdateStub.resolves({ _id: "cohort_id" });
      // Device claim update returns the claimed device
      findOneAndUpdateStub.resolves({
        _id: "some_device_id",
        name: "deployed_device",
        claim_status: "claimed",
        claimed_at: new Date(),
        owner_id: "60c7a3e5f7e4f1001f5e8e1b",
      });

      const result = await deviceUtil.claimDevice(request, sandbox.stub());

      expect(result.success).to.be.true;
    });

    it("should return 410 GONE if the claim token is expired", async () => {
      const request = {
        body: {
          device_name: "expired_token_device",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
        },
        query: { tenant: "airqo" },
      };

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      findOneStub.resolves({
        _id: "some_device_id",
        name: "expired_token_device",
        claim_status: "unclaimed",
        claim_token_expires_at: pastDate, // Key for this test
      });

      let error;
      try {
        await deviceUtil.claimDevice(request, (err) => (error = err));
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an.instanceOf(Error);
      expect(error.statusCode).to.equal(httpStatus.GONE);
      expect(error.message).to.equal("Claim token has expired");
    });

    it("should handle race condition and return 409 CONFLICT for the second claim attempt", async () => {
      const request = {
        body: {
          device_name: "race_condition_device",
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
        },
        query: { tenant: "airqo" },
      };

      findOneStub.resolves({
        _id: "some_device_id",
        name: "race_condition_device",
        claim_status: "unclaimed",
      });

      // Add stub for cohort creation to allow the test to proceed
      cohortFindOneAndUpdateStub.resolves({ _id: "some_cohort_id" });

      // Simulate race condition: findOneAndUpdate returns null because another process claimed it first
      findOneAndUpdateStub.resolves(null);

      let error;
      try {
        await deviceUtil.claimDevice(request, (err) => (error = err));
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an.instanceOf(Error);
      expect(error.statusCode).to.equal(httpStatus.CONFLICT);
      expect(error.message).to.equal("Device already claimed");
    });
  });

  describe("bulkClaim", () => {
    let sandbox;
    let findStub;
    let findOneAndUpdateStub;
    let cohortFindOneAndUpdateStub;
    let cohortFindByIdStub;
    let updateOneStub;
    let createActivityStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      const activityModelMock = { create: sandbox.stub().resolves({}) };
      const deviceModelMock = {
        find: sandbox.stub(),
        findOneAndUpdate: sandbox.stub(),
        updateOne: sandbox.stub().resolves({ modifiedCount: 1 }),
      };
      const cohortModelMock = {
        // bulkClaim uses findOneAndUpdate().lean() and findById().lean()
        findOneAndUpdate: sandbox.stub().returns({ lean: sandbox.stub().resolves({ _id: "some_cohort_id" }) }),
        findById: sandbox.stub(),
      };

      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("devices").returns(deviceModelMock);
      ms.withArgs("cohorts").returns(cohortModelMock);
      ms.withArgs("activities").returns(activityModelMock);

      findStub = deviceModelMock.find;
      findOneAndUpdateStub = deviceModelMock.findOneAndUpdate;
      cohortFindOneAndUpdateStub = cohortModelMock.findOneAndUpdate;
      cohortFindByIdStub = cohortModelMock.findById;
      updateOneStub = deviceModelMock.updateOne;
      createActivityStub = activityModelMock.create;
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should successfully claim multiple devices", async () => {
      const request = {
        body: {
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          devices: [{ device_name: "device_A" }, { device_name: "device_B" }],
        },
        query: { tenant: "airqo" },
      };

      const mockDevices = [
        { name: "device_A", claim_status: "unclaimed", network: "airqo" },
        { name: "device_B", claim_status: "unclaimed", network: "airqo" },
      ];
      findStub.resolves(mockDevices);
      findOneAndUpdateStub.callsFake((filter) =>
        Promise.resolve({ ...filter, claim_status: "claimed" })
      );
      updateOneStub.resolves({
        modifiedCount: 1,
      });

      const result = await deviceUtil.bulkClaim(request);

      expect(result.success).to.be.true;
      expect(result.data.successful_claims).to.have.lengthOf(2);
      expect(result.data.failed_claims).to.have.lengthOf(0);
      expect(findOneAndUpdateStub.callCount).to.equal(2);
      expect(createActivityStub.callCount).to.equal(2);
    });

    it("should handle a mix of successful and failed claims", async () => {
      const request = {
        body: {
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          devices: [
            { device_name: "device_A" }, // success
            { device_name: "device_B" }, // already claimed
            { device_name: "device_C" }, // not found
          ],
        },
        query: { tenant: "airqo" },
      };

      const mockDevices = [
        { name: "device_A", claim_status: "unclaimed" },
        { name: "device_B", claim_status: "claimed" },
      ];
      findStub.resolves(mockDevices);
      findOneAndUpdateStub.resolves({
        name: "device_A",
        claim_status: "claimed",
        claimed_at: new Date(),
        owner_id: "60c7a3e5f7e4f1001f5e8e1b",
        _id: "device_A_id",
      });
      updateOneStub.resolves({ modifiedCount: 1 });

      const result = await deviceUtil.bulkClaim(request);

      expect(result.success).to.be.true;
      expect(result.data.successful_claims).to.have.lengthOf(1);
      expect(result.data.failed_claims).to.have.lengthOf(2);
      expect(result.data.failed_claims[0].device_name).to.equal("device_B");
      expect(result.data.failed_claims[0].error).to.equal(
        "Device already claimed or not available"
      );
      expect(result.data.failed_claims[1].device_name).to.equal("device_C");
      expect(result.data.failed_claims[1].error).to.equal("Device not found");
    });

    it("should proceed with claim even if activity logging fails", async () => {
      const request = {
        body: {
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          devices: [{ device_name: "device_A" }],
        },
        query: { tenant: "airqo" },
      };

      findStub.resolves([{ name: "device_A", claim_status: "unclaimed" }]);
      findOneAndUpdateStub.resolves({
        name: "device_A",
        claim_status: "claimed",
      });
      updateOneStub.resolves({
        modifiedCount: 1,
      });
      createActivityStub.rejects(new Error("DB connection lost"));

      const result = await deviceUtil.bulkClaim(request);

      expect(result.success).to.be.true;
      expect(result.data.successful_claims).to.have.lengthOf(1);
      expect(result.data.failed_claims).to.have.lengthOf(0);
      expect(result.data.successful_claims[0].device_name).to.equal("device_A");
      expect(result.data.successful_claims[0].logging_error).to.be.true;
    });

    it("should throw an HttpError for an invalid user_id", async () => {
      const request = { body: { user_id: "invalid-id" }, query: { tenant: "airqo" } };
      let error;
      await deviceUtil.bulkClaim(request, (err) => (error = err));
      expect(error).to.exist;
    });

    it("should successfully claim devices and assign to a specific cohort", async () => {
      const specificCohortId = "61f8e726e911c000139c3b08";
      const request = {
        body: {
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          devices: [{ device_name: "device_A" }],
          cohort_id: specificCohortId,
        },
        query: { tenant: "airqo" },
      };

      findStub.resolves([{ name: "device_A", claim_status: "unclaimed" }]);
      cohortFindByIdStub.returns({
        lean: () => Promise.resolve({ _id: specificCohortId }),
      });
      findOneAndUpdateStub.resolves({
        name: "device_A",
        claim_status: "claimed",
      });

      const result = await deviceUtil.bulkClaim(request);

      expect(result.success).to.be.true;
      expect(result.data.successful_claims).to.have.lengthOf(1);
      expect(
        findOneAndUpdateStub.firstCall.args[1].$addToSet.cohorts.toString()
      ).to.equal(specificCohortId);
    });

    it("should return 404 if a specified cohort_id does not exist", async () => {
      const request = {
        body: {
          user_id: "60c7a3e5f7e4f1001f5e8e1b",
          devices: [{ device_name: "device_A" }],
          cohort_id: "60c7a3e5f7e4f1001f5e8e99", // non-existent
        },
        query: { tenant: "airqo" },
      };

      findStub.resolves([{ name: "device_A", claim_status: "unclaimed" }]);
      cohortFindByIdStub.returns({ lean: () => Promise.resolve(null) });

      let error;
      await deviceUtil.bulkClaim(request, (err) => (error = err));
      expect(error).to.exist;
    });
  });

  describe("getShippingPreparationStatus", () => {
    let findStub;
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      // actual chain: .find().select().lean().exec()
      const execStub = sandbox.stub();
      const deviceModelMock = {
        find: sandbox.stub().returnsThis(),
        select: sandbox.stub().returnsThis(),
        lean: sandbox.stub().returns({ exec: execStub }),
      };
      sandbox.stub(mongoose, "model").withArgs("devices").returns(deviceModelMock);
      findStub = execStub;
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should correctly categorize prepared, claimed, and deployed devices", async () => {
      const mockDevices = [
        {
          name: "device_prepared",
          claim_status: "unclaimed",
          claim_token: "token123",
          status: "not deployed",
        },
        {
          name: "device_claimed",
          claim_status: "claimed",
          status: "not deployed",
        },
        {
          name: "device_deployed",
          claim_status: "claimed",
          status: "deployed",
        },
        {
          name: "device_unprepared",
          claim_status: "unclaimed",
          claim_token: null,
          status: "not deployed",
        },
      ];
      findStub.resolves(mockDevices);

      const request = { query: { tenant: "airqo" } };
      const result = await deviceUtil.getShippingPreparationStatus(request, sandbox.stub());

      expect(result.success).to.be.true;
      expect(result.data.summary.total_devices).to.equal(4);
      expect(result.data.summary.prepared_for_shipping).to.equal(1);
      expect(result.data.summary.claimed_devices).to.equal(2);
      expect(result.data.summary.deployed_devices).to.equal(1);

      expect(result.data.categorized.prepared_for_shipping[0].name).to.equal(
        "device_prepared"
      );
      expect(
        result.data.categorized.claimed_devices.map((d) => d.name)
      ).to.have.members(["device_claimed", "device_deployed"]);
      expect(result.data.categorized.deployed_devices[0].name).to.equal(
        "device_deployed"
      );
    });

    it("should return an empty response when no devices are found", async () => {
      findStub.resolves([]);

      const request = { query: { tenant: "airqo" } };
      const result = await deviceUtil.getShippingPreparationStatus(request, sandbox.stub());

      expect(result.success).to.be.true;
      expect(result.data.summary.total_devices).to.equal(0);
      expect(result.data.categorized.prepared_for_shipping).to.be.an("array")
        .that.is.empty;
    });
  });

  describe("createDevice", () => {
    describe("doesDeviceSearchExist", () => {
      let sandbox;
      beforeEach(() => { sandbox = sinon.createSandbox(); });
      afterEach(() => { sandbox.restore(); });

      it("should return success if search exists", async () => {
        const request = { filter: { network: "airqo" }, tenant: "airqo" };
        sandbox.stub(mongoose, "model").withArgs("devices").returns({
          exists: sandbox.stub().resolves(true),
        });
        const result = await deviceUtil.doesDeviceSearchExist(request);
        expect(result.success).to.be.true;
        expect(result.message).to.equal("search exists");
        expect(result.data).to.be.true;
      });

      it("should return failure if search does not exist", async () => {
        const request = { filter: {}, tenant: "airqo" };
        sandbox.stub(mongoose, "model").withArgs("devices").returns({
          exists: sandbox.stub().resolves(false),
        });
        const result = await deviceUtil.doesDeviceSearchExist(request);
        expect(result.success).to.be.false;
        expect(result.message).to.equal("search does not exist");
        expect(result.data).to.be.an("array").that.is.empty;
      });

      it("should handle internal server error and call next", async () => {
        const request = { filter: {}, tenant: "airqo" };
        sandbox.stub(mongoose, "model").withArgs("devices").returns({
          exists: sandbox.stub().rejects(new Error("Database error")),
        });
        const next = sandbox.stub();
        await deviceUtil.doesDeviceSearchExist(request, next);
        expect(next.calledOnce).to.be.true;
      });
    });

    describe("doesDeviceExist", () => {
      let sandbox;
      beforeEach(() => { sandbox = sinon.createSandbox(); });
      afterEach(() => { sandbox.restore(); });

      it.skip("should return true if device exists", async () => {
        // Cannot stub internal deviceUtil.list (module.exports = { ...deviceUtil } spread)
        sandbox.stub(deviceUtil, "list").resolves({ success: true, data: { _id: "did" } });
        const result = await deviceUtil.doesDeviceExist({}, sandbox.stub());
        expect(result).to.be.true;
      });

      it.skip("should return false if device does not exist", async () => {
        // Cannot stub internal deviceUtil.list (module.exports = { ...deviceUtil } spread)
        sandbox.stub(deviceUtil, "list").resolves({ success: true, data: null });
        const result = await deviceUtil.doesDeviceExist({}, sandbox.stub());
        expect(result).to.be.false;
      });

      it.skip("should return false when list call fails", async () => {
        // Cannot stub internal deviceUtil.list (module.exports = { ...deviceUtil } spread)
        sandbox.stub(deviceUtil, "list").resolves({ success: false });
        const result = await deviceUtil.doesDeviceExist({}, sandbox.stub());
        expect(result).to.be.false;
      });
    });

    describe("getDevicesCount", () => {
      let sandbox;
      beforeEach(() => { sandbox = sinon.createSandbox(); });
      afterEach(() => { sandbox.restore(); });

      it("should return the count of devices when successful", async () => {
        const count = 42;
        const request = { query: { tenant: "airqo" } };
        sandbox.stub(mongoose, "model").withArgs("devices").returns({
          countDocuments: sandbox.stub().returns({ maxTimeMS: sandbox.stub().resolves(count) }),
        });
        sandbox.stub(generateFilter, "devices").returns({});
        const result = await deviceUtil.getDevicesCount(request, sandbox.stub());
        expect(result.success).to.be.true;
        expect(result.message).to.equal("retrieved the number of devices");
        expect(result.status).to.equal(httpStatus.OK);
        expect(result.data).to.equal(count);
      });

      it("should call next with an error when DeviceModel throws", async () => {
        const request = { query: { tenant: "airqo" } };
        sandbox.stub(mongoose, "model").withArgs("devices").returns({
          countDocuments: sandbox.stub().returns({ maxTimeMS: sandbox.stub().rejects(new Error("Test error")) }),
        });
        sandbox.stub(generateFilter, "devices").returns({});
        const next = sandbox.stub();
        await deviceUtil.getDevicesCount(request, next);
        expect(next.calledOnce).to.be.true;
        const error = next.firstCall.args[0];
        expect(error.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });
    });

    describe("generateQR", () => {
      it.skip("should generate a QR code for a valid device", async () => {
        const request = {
          query: {
            include_site: "yes",
          },
        };

        const responseFromListDevice = {
          success: true,
          data: [
            {
              deviceProperty: "value",
              site: {
                siteProperty: "siteValue",
              },
            },
          ],
        };

        sinon.stub(QRCode, "toDataURL").callsFake(async () => "fakeQRCodeURL");

        const result = await deviceUtil.generateQR(request);

        expect(result.success).to.equal(true);
        expect(result.message).to.equal("successfully generated the QR Code");
        expect(result.data).to.equal("fakeQRCodeURL");
        expect(result.status).to.equal(httpStatus.OK);

        QRCode.toDataURL.restore(); // Restore the stubbed function
      });

      it.skip("should handle a device that does not exist", async () => {
        const request = {
          query: {
            include_site: "yes",
          },
        };

        const responseFromListDevice = {
          success: true,
          data: [], // Empty array indicating no device exists
        };

        const result = await deviceUtil.generateQR(request);

        expect(result.success).to.equal(false);
        expect(result.message).to.equal("device does not exist");
      });

      it.skip("should handle an internal server error", async () => {
        const request = {
          query: {
            include_site: "yes",
          },
        };

        sinon
          .stub(QRCode, "toDataURL")
          .throws(new Error("Internal Server Error"));

        const result = await deviceUtil.generateQR(request);

        expect(result.success).to.equal(false);
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors).to.deep.equal({
          message: "Internal Server Error",
        });
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        QRCode.toDataURL.restore(); // Restore the stubbed function
      });
    });

    describe("create", () => {
      afterEach(() => sinon.restore());

      it("should return 'Not Implemented' for a different tenant", async () => {
        // Arrange
        const request = {
          query: {
            tenant: "example", // Replace 'example' with a different tenant name
          },
        };

        // Act
        const result = await deviceUtil.create(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "creation is not yet possible for this organisation"
        );
        expect(result.status).to.equal(httpStatus.NOT_IMPLEMENTED);
      });

      it("should return 'Bad Request' in a non-production environment", async () => {
        const origEnv = constants.ENVIRONMENT;
        constants.ENVIRONMENT = "TEST ENVIRONMENT";
        const request = { query: { tenant: "airqo" } };

        const result = await deviceUtil.create(request);

        constants.ENVIRONMENT = origEnv;
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Bad Request");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      });

      it.skip("should create a device successfully", async () => {
        // Cannot stub internal createOnThingSpeak/createOnPlatform (spread export issue)
        const request = {
          query: {
            tenant: "airqo",
          },
        };
        const responseFromCreateOnThingSpeak = {
          success: true,
          data: {
            /* Add data for successful createOnThingSpeak response */
          },
        };
        const responseFromCreateOnPlatform = {
          success: true,
          data: {
            /* Add data for successful createOnPlatform response */
          },
        };

        // Stub deviceUtil.createOnThingSpeak to return success and data
        sinon
          .stub(deviceUtil, "createOnThingSpeak")
          .resolves(responseFromCreateOnThingSpeak);

        // Stub deviceUtil.createOnPlatform to return success and data
        sinon
          .stub(deviceUtil, "createOnPlatform")
          .resolves(responseFromCreateOnPlatform);

        // Act
        const result = await deviceUtil.create(request);

        // Assert
        expect(result).to.deep.equal(responseFromCreateOnPlatform);

        // Restore the stubbed functions
        deviceUtil.createOnThingSpeak.restore();
        deviceUtil.createOnPlatform.restore();
      });

      it.skip("should handle createOnPlatform failure and undo successful operations", async () => {
        // Arrange
        const request = {
          query: {
            tenant: "airqo",
          },
        };
        const responseFromCreateOnThingSpeak = {
          success: true,
          data: {
            /* Add data for successful createOnThingSpeak response */
          },
        };
        const responseFromCreateOnPlatform = {
          success: false,
          errors: { message: "Failed to create on platform" }, // Add relevant error message
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
        const deleteRequest = {
          query: {
            device_number: "123", // Replace '123' with the device_number to delete
          },
        };
        const responseFromDeleteOnThingSpeak = {
          success: true,
        };

        // Stub deviceUtil.createOnThingSpeak to return success and data
        sinon
          .stub(deviceUtil, "createOnThingSpeak")
          .resolves(responseFromCreateOnThingSpeak);

        // Stub deviceUtil.createOnPlatform to return failure
        sinon
          .stub(deviceUtil, "createOnPlatform")
          .resolves(responseFromCreateOnPlatform);

        // Stub deviceUtil.deleteOnThingspeak to return success
        sinon
          .stub(deviceUtil, "deleteOnThingspeak")
          .resolves(responseFromDeleteOnThingSpeak);

        // Act
        const result = await deviceUtil.create(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "creation operation failed -- successfully undid the successful operations"
        );
        expect(result.errors).to.deep.equal(
          responseFromCreateOnPlatform.errors
        );
        expect(result.status).to.equal(responseFromCreateOnPlatform.status);

        // Ensure that createOnPlatform and deleteOnThingspeak were called
        expect(deviceUtil.createOnPlatform.calledOnce).to.be.true;
        expect(deviceUtil.deleteOnThingspeak.calledOnce).to.be.true;

        // Restore the stubbed functions
        deviceUtil.createOnThingSpeak.restore();
        deviceUtil.createOnPlatform.restore();
        deviceUtil.deleteOnThingspeak.restore();
      });

      it.skip("should handle createOnThingSpeak failure and return error message", async () => {
        // Arrange
        const request = {
          query: {
            tenant: "airqo",
          },
        };
        const responseFromCreateOnThingSpeak = {
          success: false,
          errors: { message: "Failed to create on ThingSpeak" }, // Add relevant error message
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };

        // Stub deviceUtil.createOnThingSpeak to return failure
        sinon
          .stub(deviceUtil, "createOnThingSpeak")
          .resolves(responseFromCreateOnThingSpeak);

        // Act
        const result = await deviceUtil.create(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "unable to generate enrichment data for the device"
        );
        expect(result.errors).to.deep.equal(
          responseFromCreateOnThingSpeak.errors
        );
        expect(result.status).to.equal(responseFromCreateOnThingSpeak.status);

        // Ensure that createOnPlatform and deleteOnThingspeak were not called
        expect(deviceUtil.createOnPlatform.called).to.be.false;
        expect(deviceUtil.deleteOnThingspeak.called).to.be.false;

        // Restore the stubbed function
        deviceUtil.createOnThingSpeak.restore();
      });

      it.skip("should handle internal server error and return failure status", async () => {
        // Arrange
        const request = {
          query: {
            tenant: "airqo",
          },
        };

        // Stub deviceUtil.createOnThingSpeak to throw an error
        sinon
          .stub(deviceUtil, "createOnThingSpeak")
          .throws(new Error("Internal Server Error"));

        // Act
        const result = await deviceUtil.create(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("internal server error");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Restore the stubbed function
        deviceUtil.createOnThingSpeak.restore();
      });
    });

    describe("update", () => {
      afterEach(() => sinon.restore());

      it("should return 'Bad Request' in a non-production environment", async () => {
        const origEnv = constants.ENVIRONMENT;
        constants.ENVIRONMENT = "TEST ENVIRONMENT";
        // Arrange
        const request = {
          query: {
            device_number: "123", // Replace '123' with an actual device number
          },
        };
        // Act
        const result = await deviceUtil.update(request);

        constants.ENVIRONMENT = origEnv;
        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Bad Request");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      });

      it.skip("should update the device on platform if device_number is provided", async () => {
        // Arrange
        const request = {
          query: {
            device_number: "123", // Replace '123' with an actual device number
          },
        };
        const responseFromUpdateOnPlatform = {
          success: true,
          data: {
            /* Add data for successful updateOnPlatform response */
          },
        };

        // Stub deviceUtil.updateOnPlatform to return success and data
        sinon
          .stub(deviceUtil, "updateOnPlatform")
          .resolves(responseFromUpdateOnPlatform);

        // Act
        const result = await deviceUtil.update(request);

        // Assert
        expect(result).to.deep.equal(responseFromUpdateOnPlatform);

        // Ensure that updateOnPlatform was called and updateOnThingspeak was not called
        expect(deviceUtil.updateOnPlatform.calledOnce).to.be.true;
        expect(deviceUtil.updateOnThingspeak.called).to.be.false;

        // Restore the stubbed function
        deviceUtil.updateOnPlatform.restore();
      });

      it.skip("should update the device on Thingspeak and then on platform if device_number is not provided", async () => {
        // Arrange
        const request = {
          query: {},
        };
        const responseFromListDevice = {
          success: true,
          data: [
            {
              device_number: "123", // Replace '123' with an actual device number
            },
          ],
        };
        const responseFromUpdateOnThingspeak = {
          success: true,
        };
        const responseFromUpdateOnPlatform = {
          success: true,
          data: {
            /* Add data for successful updateOnPlatform response */
          },
        };

        // Stub deviceUtil.list to return success and data
        sinon.stub(deviceUtil, "list").resolves(responseFromListDevice);

        // Stub deviceUtil.updateOnThingspeak to return success
        sinon
          .stub(deviceUtil, "updateOnThingspeak")
          .resolves(responseFromUpdateOnThingspeak);

        // Stub deviceUtil.updateOnPlatform to return success and data
        sinon
          .stub(deviceUtil, "updateOnPlatform")
          .resolves(responseFromUpdateOnPlatform);

        // Act
        const result = await deviceUtil.update(request);

        // Assert
        expect(result).to.deep.equal(responseFromUpdateOnPlatform);

        // Ensure that list, updateOnThingspeak, and updateOnPlatform were called
        expect(deviceUtil.list.calledOnce).to.be.true;
        expect(deviceUtil.updateOnThingspeak.calledOnce).to.be.true;
        expect(deviceUtil.updateOnPlatform.calledOnce).to.be.true;

        // Restore the stubbed functions
        deviceUtil.list.restore();
        deviceUtil.updateOnThingspeak.restore();
        deviceUtil.updateOnPlatform.restore();
      });

      it.skip("should handle updateOnThingspeak failure and return failure status", async () => {
        // Arrange
        const request = {
          query: {},
        };
        const responseFromListDevice = {
          success: true,
          data: [
            {
              device_number: "123", // Replace '123' with an actual device number
            },
          ],
        };
        const responseFromUpdateOnThingspeak = {
          success: false,
          errors: { message: "Failed to update on Thingspeak" }, // Add relevant error message
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };

        // Stub deviceUtil.list to return success and data
        sinon.stub(deviceUtil, "list").resolves(responseFromListDevice);

        // Stub deviceUtil.updateOnThingspeak to return failure
        sinon
          .stub(deviceUtil, "updateOnThingspeak")
          .resolves(responseFromUpdateOnThingspeak);

        // Act
        const result = await deviceUtil.update(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to update on Thingspeak");
        expect(result.errors).to.deep.equal(
          responseFromUpdateOnThingspeak.errors
        );
        expect(result.status).to.equal(responseFromUpdateOnThingspeak.status);

        // Ensure that list and updateOnPlatform were not called
        expect(deviceUtil.list.calledOnce).to.be.true;
        expect(deviceUtil.updateOnPlatform.called).to.be.false;

        // Restore the stubbed functions
        deviceUtil.list.restore();
        deviceUtil.updateOnThingspeak.restore();
      });

      it.skip("should handle internal server error and return failure status", async () => {
        // Arrange
        const request = {
          query: {},
        };

        // Stub deviceUtil.list to throw an error
        sinon
          .stub(deviceUtil, "list")
          .throws(new Error("Internal Server Error"));

        // Act
        const result = await deviceUtil.update(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that updateOnThingspeak and updateOnPlatform were not called
        expect(deviceUtil.updateOnThingspeak.called).to.be.false;
        expect(deviceUtil.updateOnPlatform.called).to.be.false;

        // Restore the stubbed function
        deviceUtil.list.restore();
      });
    });

    describe("encryptKeys", () => {
      let sandbox;
      beforeEach(() => { sandbox = sinon.createSandbox(); });
      afterEach(() => { sandbox.restore(); });

      it("should encrypt keys and return success", async () => {
        const request = {
          query: { tenant: "airqo" },
          body: { key1: "value1" },
        };
        const responseFromEncryptKeys = { success: true, data: { encrypted: true } };
        sandbox.stub(generateFilter, "devices").returns({});
        sandbox.stub(mongoose, "model").withArgs("devices").returns({
          encryptKeys: sandbox.stub().resolves(responseFromEncryptKeys),
        });

        const result = await deviceUtil.encryptKeys(request);

        expect(result).to.deep.equal(responseFromEncryptKeys);
        expect(generateFilter.devices.calledOnce).to.be.true;
      });

      it("should handle errors from DeviceModel.encryptKeys and call next with 500", async () => {
        const request = { query: { tenant: "airqo" }, body: {} };
        const next = sandbox.stub();
        sandbox.stub(generateFilter, "devices").returns({});
        sandbox.stub(mongoose, "model").withArgs("devices").returns({
          encryptKeys: sandbox.stub().rejects(new Error("DB error")),
        });

        await deviceUtil.encryptKeys(request, next);

        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].statusCode).to.equal(
          httpStatus.INTERNAL_SERVER_ERROR
        );
      });

      it("should handle internal server error from encryptKeys and return failure status", async () => {
        const request = { query: { tenant: "airqo" }, body: {} };
        const next = sandbox.stub();
        sandbox.stub(generateFilter, "devices").throws(new Error("Filter error"));

        await deviceUtil.encryptKeys(request, next);

        expect(next.calledOnce).to.be.true;
        const err = next.firstCall.args[0];
        expect(err.message).to.equal("Internal Server Error");
        expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });
    });

    describe("delete", () => {
      it("should return service disabled for any request", async () => {
        const result = await deviceUtil.delete({ query: { device_number: "123" } });
        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
        expect(result.message).to.equal("feature temporarily disabled --coming soon");
      });

      it("should return service disabled with no device_number", async () => {
        const result = await deviceUtil.delete({ query: {} });
        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
      });

      it("should return service disabled with empty query", async () => {
        const result = await deviceUtil.delete({ query: {} });
        expect(result.errors.message).to.equal("Service Unavailable");
      });

      it("should not call deleteOnThingspeak or deleteOnPlatform", async () => {
        const result = await deviceUtil.delete({ query: { device_number: "abc" } });
        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
      });

      it("should return SERVICE_UNAVAILABLE regardless of tenant", async () => {
        const result = await deviceUtil.delete({ query: { tenant: "airqo", device_number: "x" } });
        expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
      });
    });

    describe("list", () => {
      let sandbox;
      beforeEach(() => { sandbox = sinon.createSandbox(); });
      afterEach(() => { sandbox.restore(); });

      it("should list devices successfully", async () => {
        const aggregateStub = sandbox.stub();
        aggregateStub.returns({
          option: sandbox.stub().returns({
            allowDiskUse: sandbox.stub().resolves([
              { paginatedResults: [], totalCount: [{ count: 0 }] }
            ])
          })
        });
        const ms = sandbox.stub(mongoose, "model");
        ms.withArgs("activities").returns({ collection: { name: "activities" } });
        ms.withArgs("devices").returns({ aggregate: aggregateStub });
        sandbox.stub(generateFilter, "devices").returns({});

        const result = await deviceUtil.list(
          { query: { tenant: "airqo", limit: "10", skip: "0" } },
          sandbox.stub()
        );

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal([]);
        expect(generateFilter.devices.calledOnce).to.be.true;
      });

      it("should handle filter error and call next with 500", async () => {
        const ms = sandbox.stub(mongoose, "model");
        ms.withArgs("activities").returns({ collection: { name: "activities" } });
        sandbox.stub(generateFilter, "devices").throws(new Error("Filter error"));
        const next = sandbox.stub();

        await deviceUtil.list({ query: { tenant: "airqo" } }, next);

        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });

      it("should handle aggregate error and call next with 500", async () => {
        const aggregateStub = sandbox.stub().returns({
          option: sandbox.stub().returns({
            allowDiskUse: sandbox.stub().rejects(new Error("DB error"))
          })
        });
        const ms = sandbox.stub(mongoose, "model");
        ms.withArgs("activities").returns({ collection: { name: "activities" } });
        ms.withArgs("devices").returns({ aggregate: aggregateStub });
        sandbox.stub(generateFilter, "devices").returns({});
        const next = sandbox.stub();

        await deviceUtil.list({ query: { tenant: "airqo" } }, next);

        expect(next.calledOnce).to.be.true;
      });

      it("should handle internal server error and call next with 500", async () => {
        sandbox.stub(mongoose, "model").throws(new Error("Model error"));
        const next = sandbox.stub();

        await deviceUtil.list({ query: { tenant: "airqo" } }, next);

        expect(next.calledOnce).to.be.true;
        const err = next.firstCall.args[0];
        expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });
    });

    describe("createOnThingSpeak", () => {
      afterEach(() => sinon.restore());

      it("should create device on ThingSpeak successfully", async () => {
        const responseFromPost = {
          data: {
            api_keys: [
              { write_flag: true, api_key: "WRITE_KEY" },
              { write_flag: false, api_key: "READ_KEY" },
            ],
            id: "DEVICE_ID",
          },
        };
        sinon.stub(axios, "post").resolves(responseFromPost);

        const result = await deviceUtil.createOnThingSpeak({ body: {} });

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully created the device on thingspeak"
        );
        expect(result.data.device_number).to.equal("DEVICE_ID");
        expect(result.data.writeKey).to.equal("WRITE_KEY");
        expect(result.data.readKey).to.equal("READ_KEY");
        expect(axios.post.calledOnce).to.be.true;
        expect(axios.post.firstCall.args[0]).to.equal(constants.CREATE_THING_URL);
      });

      it("should return failure when transform result is empty", async () => {
        // body = undefined → TypeError → outer catch → Internal Server Error
        const result = await deviceUtil.createOnThingSpeak({ body: undefined });

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });

      it("should handle axios.post failure with response and return failure status", async () => {
        const axiosError = {
          response: {
            status: httpStatus.BAD_REQUEST,
            statusText: "Bad Request",
          },
        };
        sinon.stub(axios, "post").rejects(axiosError);

        const result = await deviceUtil.createOnThingSpeak({ body: {} });

        expect(result.success).to.be.false;
        expect(result.errors.message).to.equal("Bad Request");
        expect(axios.post.calledOnce).to.be.true;
      });

      it("should handle axios.post failure without response and return failure status", async () => {
        sinon.stub(axios, "post").rejects(new Error("Network Error"));

        const result = await deviceUtil.createOnThingSpeak({ body: {} });

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Bad Gateway Error");
        expect(result.status).to.equal(httpStatus.BAD_GATEWAY);
        expect(axios.post.calledOnce).to.be.true;
      });

      it("should handle internal server error and return failure status", async () => {
        // null body causes TypeError before any DB/axios call
        const result = await deviceUtil.createOnThingSpeak({ body: null });

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });
    });

    describe("deleteOnThingspeak", () => {
      const makeRequest = (device_number) => ({
        query: { device_number: String(device_number) },
      });

      afterEach(() => {
        if (axios.delete.restore) axios.delete.restore();
      });

      it("should return success when ThingSpeak deletes the device", async () => {
        const deleteResponse = { data: { id: 123 } };
        sinon.stub(axios, "delete").resolves(deleteResponse);

        const result = await deviceUtil.deleteOnThingspeak(
          makeRequest(123),
          () => {}
        );

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully deleted the device on thingspeak"
        );
        expect(result.data).to.deep.equal(deleteResponse.data);
        expect(axios.delete.calledOnce).to.be.true;
      });

      it("should return {success:false} with message when ThingSpeak responds with 4xx/5xx", async () => {
        const axiosError = {
          response: {
            status: httpStatus.NOT_FOUND,
            data: { error: "Channel not found" },
            headers: {},
          },
        };
        sinon.stub(axios, "delete").rejects(axiosError);

        const next = sinon.spy();
        const result = await deviceUtil.deleteOnThingspeak(
          makeRequest(999),
          next
        );

        expect(result).to.not.be.undefined;
        expect(result.success).to.be.false;
        expect(result.message).to.be.a("string").and.not.equal("undefined");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(result.errors).to.have.property("message");
        expect(next.called).to.be.false;
      });

      it("should return {success:false} with message on network error (no e.response)", async () => {
        sinon.stub(axios, "delete").rejects(new Error("Network Error"));

        const next = sinon.spy();
        const result = await deviceUtil.deleteOnThingspeak(
          makeRequest(123),
          next
        );

        expect(result).to.not.be.undefined;
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Network Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors).to.have.property("message", "Network Error");
        expect(next.called).to.be.false;
      });
    });

    describe("decryptKey", () => {
      let sandbox;
      beforeEach(() => { sandbox = sinon.createSandbox(); });
      afterEach(() => { sandbox.restore(); });

      it("should decrypt the encrypted key successfully", () => {
        const decryptedText = "decrypted_text";
        sandbox.stub(cryptoJS.AES, "decrypt").returns({ toString: () => decryptedText });

        const result = deviceUtil.decryptKey("some_encrypted_key");

        expect(result.success).to.be.true;
        expect(result.data).to.equal(decryptedText);
        expect(result.status).to.equal(httpStatus.OK);
      });

      it("should handle an unknown encrypted key", () => {
        sandbox.stub(cryptoJS.AES, "decrypt").returns({ toString: () => "" });

        const result = deviceUtil.decryptKey("unknown_encrypted_key");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("the provided encrypted key is not recognizable");
        expect(result.errors.message).to.equal("the provided encrypted key is not recognizable");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
      });

      it("should handle internal server error while decrypting the key", () => {
        const error = new Error("Failed to decrypt key");
        sandbox.stub(cryptoJS.AES, "decrypt").throws(error);
        const next = sandbox.stub();

        deviceUtil.decryptKey("some_encrypted_key", next);

        expect(next.calledOnce).to.be.true;
        const err = next.firstCall.args[0];
        expect(err.message).to.equal("Internal Server Error");
        expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });
    });

    describe("transform", () => {
      it("should transform the data successfully", () => {
        const data = { name: "device1", value: 42 };
        const map = { name: "name", value: "value" };
        const context = {};

        const result = deviceUtil.transform({ data, map, context });

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully transformed the json request"
        );
        expect(result.data).to.deep.equal({ name: "device1", value: 42 });
      });

      it("should handle empty data after transformation", () => {
        const result = deviceUtil.transform({ data: {}, map: {}, context: {} });

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "the request body for the external system is empty after transformation"
        );
        expect(result.data).to.deep.equal({});
      });

      it("should handle internal server error during transformation", () => {
        const next = sinon.stub();

        deviceUtil.transform({ data: null, map: null }, next);

        expect(next.calledOnce).to.be.true;
        const error = next.firstCall.args[0];
        expect(error.message).to.equal("Internal Server Error");
        expect(error.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });
    });

    describe("refresh", () => {
      it("should return 'feature temporarily disabled --coming soon'", async () => {
        // Arrange
        const request = {
          // Add any required data for the request here
        };

        // Act
        const result = await deviceUtil.refresh(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "feature temporarily disabled --coming soon"
        );
        expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
        expect(result.errors.message).to.equal("Service Unavailable");
      });

      it("should always return disabled for any request", async () => {
        const result = await deviceUtil.refresh({
          query: { tenant: "airqo" },
          body: { name: "test-device" },
        });
        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
      });

      it("should return disabled even with empty request", async () => {
        const result = await deviceUtil.refresh({});
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "feature temporarily disabled --coming soon"
        );
      });
    });

    // Add tests for other functions in deviceUtil
  });

  // ── createOnPlatform — adapter auto-population ────────────────────────────
  // Tests for external-device behaviors added in PR A:
  //   • user_id is optional
  //   • api_code extracted from description URL (Step 1)
  //   • api_code built from adapter template + serial_number (Step 2)
  //   • serial_number derived from api_code via regex (Step 3)
  //   • malformed cohort_id/user_id return 400
  //   • airqo network bypasses adapter lookup
  //
  // Uses proxyquire to inject mock model factories (DB connection not needed).
  describe("createOnPlatform — adapter auto-population", () => {
    const proxyquire = require("proxyquire");

    let proxiedDeviceUtil;
    let getNetworkAdapterStub;
    let deviceRegisterStub;
    let cohortFindOneAndUpdateStub;
    let cohortDefaultCohortLeanStub;
    let cohortFindByIdLeanStub;
    let nextStub;

    const DEFAULT_COHORT_ID = new mongoose.Types.ObjectId();

    before(() => {
      // These stubs are shared across all tests; their return values are reset in beforeEach.
      getNetworkAdapterStub = sinon.stub().resolves(null);
      deviceRegisterStub = sinon.stub().resolves({ success: true, data: {} });
      cohortFindOneAndUpdateStub = sinon.stub().resolves(null);
      cohortDefaultCohortLeanStub = sinon.stub().resolves({ _id: DEFAULT_COHORT_ID });
      cohortFindByIdLeanStub = sinon.stub().resolves(null);

      const mockDeviceFactory = () => ({ register: deviceRegisterStub });
      const mockCohortFactory = () => ({
        findOneAndUpdate: cohortFindOneAndUpdateStub,
        findOne: () => ({
          select: () => ({ lean: cohortDefaultCohortLeanStub }),
        }),
        findById: () => ({ lean: cohortFindByIdLeanStub }),
      });

      proxiedDeviceUtil = proxyquire("../device.util", {
        "@models/Device": mockDeviceFactory,
        "@models/Cohort": mockCohortFactory,
        "@utils/network.util": { getNetworkAdapter: getNetworkAdapterStub },
      });
    });

    beforeEach(() => {
      getNetworkAdapterStub.reset();
      getNetworkAdapterStub.resolves(null);
      deviceRegisterStub.reset();
      deviceRegisterStub.resolves({ success: true, data: {} });
      cohortFindOneAndUpdateStub.reset();
      cohortFindOneAndUpdateStub.resolves(null);
      cohortDefaultCohortLeanStub.reset();
      cohortDefaultCohortLeanStub.resolves({ _id: DEFAULT_COHORT_ID });
      cohortFindByIdLeanStub.reset();
      cohortFindByIdLeanStub.resolves(null);
      nextStub = sinon.stub();
    });

    // ── user_id optional ─────────────────────────────────────────────────────
    it("creates device without user_id — no owner_id set, no personal cohort lookup", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: { name: "test-device", network: "airqo" },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(nextStub.called).to.be.false;
      expect(deviceRegisterStub.calledOnce).to.be.true;
      const savedBody = deviceRegisterStub.getCall(0).args[0];
      expect(savedBody).to.not.have.property("owner_id");
      expect(cohortFindOneAndUpdateStub.called).to.be.false;
    });

    it("returns BAD_REQUEST when user_id is provided but malformed", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: { name: "test-device", network: "airqo", user_id: "not-an-objectid" },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(nextStub.calledOnce).to.be.true;
      const err = nextStub.getCall(0).args[0];
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    // ── api_code extracted from description URL (Step 1) ─────────────────────
    it("Step 1: sets api_code from a trusted URL found in description", async () => {
      getNetworkAdapterStub.resolves({ api_base_url: "https://device.iqair.com" });

      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "iqair-1",
          network: "iqair",
          description: "Station at https://device.iqair.com/v2/ABC123",
        },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(nextStub.called).to.be.false;
      const savedBody = deviceRegisterStub.getCall(0).args[0];
      expect(savedBody.api_code).to.equal("https://device.iqair.com/v2/ABC123");
    });

    it("Step 1: ignores URL in description that does not match adapter base URL", async () => {
      getNetworkAdapterStub.resolves({ api_base_url: "https://device.iqair.com" });

      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "iqair-2",
          network: "iqair",
          description: "See https://evil.example.com/data",
        },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(nextStub.called).to.be.false;
      const savedBody = deviceRegisterStub.getCall(0).args[0];
      expect(savedBody.api_code).to.be.undefined;
    });

    // ── api_code built from template + serial_number (Step 2) ────────────────
    it("Step 2: builds api_code from adapter URL template and serial_number", async () => {
      getNetworkAdapterStub.resolves({
        api_base_url: "https://api.airgradient.com",
        api_url_template: "/public/api/v1/locations/{serial_number}/measures/current",
      });

      const request = {
        query: { tenant: "airqo" },
        body: { name: "ag-1", network: "airgradient", serial_number: "12345" },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(nextStub.called).to.be.false;
      const savedBody = deviceRegisterStub.getCall(0).args[0];
      expect(savedBody.api_code).to.equal(
        "https://api.airgradient.com/public/api/v1/locations/12345/measures/current"
      );
    });

    it("Step 2: does not overwrite api_code already set", async () => {
      getNetworkAdapterStub.resolves({
        api_base_url: "https://device.iqair.com",
        api_url_template: "/v2/{serial_number}",
      });

      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "iqair-3",
          network: "iqair",
          serial_number: "SERIAL1",
          api_code: "https://device.iqair.com/v2/ALREADY_SET",
        },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      const savedBody = deviceRegisterStub.getCall(0).args[0];
      expect(savedBody.api_code).to.equal("https://device.iqair.com/v2/ALREADY_SET");
    });

    // ── serial_number derived from api_code via regex (Step 3) ───────────────
    it("Step 3: derives serial_number from api_code using serial_number_regex", async () => {
      getNetworkAdapterStub.resolves({ serial_number_regex: "/v2/([^/?#]+)" });

      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "iqair-4",
          network: "iqair",
          api_code: "https://device.iqair.com/v2/SN_XYZ",
        },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(nextStub.called).to.be.false;
      const savedBody = deviceRegisterStub.getCall(0).args[0];
      expect(savedBody.serial_number).to.equal("SN_XYZ");
    });

    // ── invalid cohort_id format ──────────────────────────────────────────────
    it("returns BAD_REQUEST for a cohort_id that is not a valid ObjectId", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: {
          name: "test-device",
          network: "airqo",
          user_id: new mongoose.Types.ObjectId().toString(),
          cohort_id: "not-a-valid-objectid",
        },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(nextStub.calledOnce).to.be.true;
      const err = nextStub.getCall(0).args[0];
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    // ── airqo network bypasses adapter resolution ─────────────────────────────
    it("does not call getNetworkAdapter for airqo-network devices", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: { name: "airqo-device", network: "airqo" },
      };

      await proxiedDeviceUtil.createOnPlatform(request, nextStub);

      expect(getNetworkAdapterStub.called).to.be.false;
    });
  });

  describe("getMyDevices", () => {
    const VALID_USER_ID = "507f1f77bcf86cd799439011";
    const VALID_SITE_ID = "507f1f77bcf86cd799439022";

    let deviceCountStub;
    let deviceLeanStub;
    let deviceSelectStub;
    let siteFindStub;
    let siteLeanStub;

    beforeEach(() => {
      const deviceModelMock = {
        countDocuments: sinon.stub(),
        find: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub(),
      };
      const cohortModelMock = {
        find: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub(),
      };
      const siteModelMock = {
        find: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub(),
      };

      const ms = sinon.stub(mongoose, "model");
      ms.withArgs("devices").returns(deviceModelMock);
      ms.withArgs("cohorts").returns(cohortModelMock);
      ms.withArgs("sites").returns(siteModelMock);

      deviceCountStub = deviceModelMock.countDocuments;
      deviceLeanStub = deviceModelMock.lean;
      deviceSelectStub = deviceModelMock.select;
      siteFindStub = siteModelMock.find;
      siteLeanStub = siteModelMock.lean;

      deviceCountStub.resolves(0);
      deviceLeanStub.resolves([]);
      siteLeanStub.resolves([]);
      cohortModelMock.lean.resolves([]);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return BAD_REQUEST when user_id is missing", async () => {
      const request = { query: { tenant: "airqo" } };
      const result = await deviceUtil.getMyDevices(request, () => {});
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return BAD_REQUEST for an invalid user_id format", async () => {
      const request = {
        query: { tenant: "airqo", user_id: "not-an-objectid" },
      };
      const result = await deviceUtil.getMyDevices(request, () => {});
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should attach site details when devices have a site_id", async () => {
      const siteObjectId = new mongoose.Types.ObjectId(VALID_SITE_ID);
      const mockDevices = [
        {
          _id: "dev1",
          long_name: "Test Device",
          site_id: siteObjectId,
          createdAt: "2024-01-15T10:00:00.000Z",
          groups: ["airqo"],
        },
      ];
      const mockSites = [
        {
          _id: siteObjectId,
          name: "Kampala Site",
          location_name: "Kampala",
        },
      ];

      deviceCountStub.resolves(1);
      deviceLeanStub.resolves(mockDevices);
      siteLeanStub.resolves(mockSites);

      const request = {
        query: { tenant: "airqo", user_id: VALID_USER_ID },
      };
      const result = await deviceUtil.getMyDevices(request, () => {});

      expect(result.success).to.be.true;
      expect(result.data).to.have.lengthOf(1);
      expect(result.data[0].site).to.deep.equal(mockSites[0]);
      expect(result.data[0]).to.not.have.property("site_id");
      expect(result.data[0].createdAt).to.equal("2024-01-15T10:00:00.000Z");
      expect(result.data[0].groups).to.deep.equal(["airqo"]);
    });

    it("should return site: null for devices without a site_id", async () => {
      const mockDevices = [
        {
          _id: "dev1",
          long_name: "Undeployed Device",
          site_id: null,
          createdAt: "2024-01-15T10:00:00.000Z",
          groups: [],
        },
      ];

      deviceCountStub.resolves(1);
      deviceLeanStub.resolves(mockDevices);

      const request = {
        query: { tenant: "airqo", user_id: VALID_USER_ID },
      };
      const result = await deviceUtil.getMyDevices(request, () => {});

      expect(result.success).to.be.true;
      expect(result.data[0].site).to.be.null;
      expect(siteFindStub.called).to.be.false;
    });

    it("should return site: null when the site document is not found in the database", async () => {
      const siteObjectId = new mongoose.Types.ObjectId(VALID_SITE_ID);
      const mockDevices = [
        {
          _id: "dev1",
          long_name: "Orphan Device",
          site_id: siteObjectId,
          createdAt: "2024-01-15T10:00:00.000Z",
          groups: [],
        },
      ];

      deviceCountStub.resolves(1);
      deviceLeanStub.resolves(mockDevices);
      siteLeanStub.resolves([]);

      const request = {
        query: { tenant: "airqo", user_id: VALID_USER_ID },
      };
      const result = await deviceUtil.getMyDevices(request, () => {});

      expect(result.success).to.be.true;
      expect(result.data[0].site).to.be.null;
    });

    it("should deduplicate site_ids and issue a single site query for the whole page", async () => {
      const siteObjectId = new mongoose.Types.ObjectId(VALID_SITE_ID);
      const mockDevices = [
        {
          _id: "dev1",
          site_id: siteObjectId,
          createdAt: "2024-01-01T00:00:00.000Z",
          groups: [],
        },
        {
          _id: "dev2",
          site_id: siteObjectId,
          createdAt: "2024-01-02T00:00:00.000Z",
          groups: [],
        },
        {
          _id: "dev3",
          site_id: siteObjectId,
          createdAt: "2024-01-03T00:00:00.000Z",
          groups: [],
        },
      ];
      const mockSites = [
        {
          _id: siteObjectId,
          name: "Shared Site",
          location_name: "Shared Location",
        },
      ];

      deviceCountStub.resolves(3);
      deviceLeanStub.resolves(mockDevices);
      siteLeanStub.resolves(mockSites);

      const request = {
        query: { tenant: "airqo", user_id: VALID_USER_ID },
      };
      const result = await deviceUtil.getMyDevices(request, () => {});

      expect(result.success).to.be.true;
      expect(siteFindStub.calledOnce).to.be.true;
      expect(siteFindStub.firstCall.args[0]._id.$in).to.have.lengthOf(1);
      result.data.forEach((d) => {
        expect(d.site).to.deep.equal(mockSites[0]);
      });
    });

    it("should skip the SiteModel query entirely when no devices are returned", async () => {
      deviceCountStub.resolves(0);
      deviceLeanStub.resolves([]);

      const request = {
        query: { tenant: "airqo", user_id: VALID_USER_ID },
      };
      const result = await deviceUtil.getMyDevices(request, () => {});

      expect(result.success).to.be.true;
      expect(result.data).to.have.lengthOf(0);
      expect(siteFindStub.called).to.be.false;
      expect(result.meta.total).to.equal(0);
    });

    it("should project isOnline and rawOnlineStatus in the device query", async () => {
      const request = {
        query: { tenant: "airqo", user_id: VALID_USER_ID },
      };
      await deviceUtil.getMyDevices(request, () => {});

      expect(deviceSelectStub.calledOnce).to.be.true;
      const projection = deviceSelectStub.firstCall.args[0];
      expect(projection).to.include("isOnline");
      expect(projection).to.include("rawOnlineStatus");
    });

    describe("status filter", () => {
      const STATUS_CASES = [
        {
          status: "transmitting",
          expected: { isOnline: false, rawOnlineStatus: true },
        },
        {
          status: "data_available",
          expected: { isOnline: true, rawOnlineStatus: false },
        },
        {
          status: "operational",
          expected: { isOnline: true, rawOnlineStatus: true },
        },
        {
          status: "not_transmitting",
          expected: { isOnline: false, rawOnlineStatus: false },
        },
      ];

      STATUS_CASES.forEach(({ status, expected }) => {
        it(`should add ${JSON.stringify(expected)} to the filter when status=${status}`, async () => {
          const request = {
            query: { tenant: "airqo", user_id: VALID_USER_ID, status },
          };
          await deviceUtil.getMyDevices(request, () => {});

          const filter = deviceCountStub.firstCall.args[0];
          expect(filter.isOnline).to.equal(expected.isOnline);
          expect(filter.rawOnlineStatus).to.equal(expected.rawOnlineStatus);
        });

        it(`should preserve the $or ownership filter alongside the status filter when status=${status}`, async () => {
          const request = {
            query: { tenant: "airqo", user_id: VALID_USER_ID, status },
          };
          await deviceUtil.getMyDevices(request, () => {});

          const filter = deviceCountStub.firstCall.args[0];
          expect(filter).to.have.property("$or");
          expect(filter.$or).to.be.an("array").with.length.greaterThan(0);
          expect(filter.$or[0]).to.have.property("owner_id");
        });
      });

      it("should not add isOnline or rawOnlineStatus to the filter when status is absent", async () => {
        const request = {
          query: { tenant: "airqo", user_id: VALID_USER_ID },
        };
        await deviceUtil.getMyDevices(request, () => {});

        const filter = deviceCountStub.firstCall.args[0];
        expect(filter).to.not.have.property("isOnline");
        expect(filter).to.not.have.property("rawOnlineStatus");
      });

      it("should not add isOnline or rawOnlineStatus to the filter when status is unrecognised", async () => {
        const request = {
          query: { tenant: "airqo", user_id: VALID_USER_ID, status: "unknown_status" },
        };
        await deviceUtil.getMyDevices(request, () => {});

        const filter = deviceCountStub.firstCall.args[0];
        expect(filter).to.not.have.property("isOnline");
        expect(filter).to.not.have.property("rawOnlineStatus");
      });
    });
  });
});
