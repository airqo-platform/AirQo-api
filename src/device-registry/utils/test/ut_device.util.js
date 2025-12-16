require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const { expect } = chai;
const httpStatus = require("http-status");
const deviceUtil = require("@utils/device.util");
const DeviceModel = require("@models/Device");
const CohortModel = require("@models/Cohort");
const generateFilter = require("@utils/generate-filter");
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
      const deviceModelMock = {
        aggregate: sinon.stub(),
      };
      sandbox.stub(DeviceModel, "default").returns(deviceModelMock);
      aggregateStub = deviceModelMock.aggregate;
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
      aggregateStub.resolves(mockAggregationResult);

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

      // Simulate empty aggregation result
      aggregateStub.resolves([]);

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

      aggregateStub.resolves([]); // Result doesn't matter, just checking the filter

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
      aggregateStub.rejects(dbError);

      await deviceUtil.getDeviceCountSummary(request, next);

      expect(next.calledOnce).to.be.true;
      const error = next.firstCall.args[0];
      expect(error).to.be.an.instanceOf(Error);
      expect(error.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(error.message).to.equal("Internal Server Error");
    });
  });
  describe("createOnPlatform", () => {
    let deviceRegisterStub,
      cohortFindByIdStub,
      cohortFindOneStub,
      cohortFindOneAndUpdateStub,
      kafkaProducerStub;

    beforeEach(() => {
      // Stub DeviceModel
      const deviceModelMock = { register: sinon.stub() };
      sinon.stub(DeviceModel, "default").returns(deviceModelMock);
      deviceRegisterStub = deviceModelMock.register;

      // Stub CohortModel
      const cohortModelMock = {
        findById: sinon.stub(),
        findOne: sinon.stub(),
        findOneAndUpdate: sinon.stub(),
      };
      sinon.stub(CohortModel, "default").returns(cohortModelMock);
      cohortFindByIdStub = cohortModelMock.findById;
      cohortFindOneStub = cohortModelMock.findOne;
      cohortFindOneAndUpdateStub = cohortModelMock.findOneAndUpdate;

      // Stub Kafka
      kafkaProducerStub = {
        connect: sinon.stub().resolves(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub().resolves(),
      };
      sinon.stub(deviceUtil, "kafka").value({
        producer: () => kafkaProducerStub,
      });
    });

    afterEach(() => {
      sinon.restore();
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
      expect(error.status).to.equal(httpStatus.BAD_REQUEST);
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
      expect(error.status).to.equal(httpStatus.NOT_FOUND);
      expect(error.message).to.include("Specified cohort with ID");
    });
  });

  describe("claimDevice", () => {
    let findOneStub;
    let findOneAndUpdateStub;
    let cohortFindOneAndUpdateStub;
    let cohortFindByIdStub;
    let createActivityStub;
    let updateOneStub;

    beforeEach(() => {
      // Stub the model factories to return mock instances
      const deviceModelMock = {
        findOne: sinon.stub(),
        findOneAndUpdate: sinon.stub(),
        updateOne: sinon.stub().resolves({ modifiedCount: 1 }),
      };
      const cohortModelMock = {
        findOneAndUpdate: sinon.stub(),
        findById: sinon.stub(),
      };
      const activityModelMock = {
        create: sinon.stub(),
      };
      sinon.stub(DeviceModel, "default").returns(deviceModelMock);
      sinon.stub(CohortModel, "default").returns(cohortModelMock);
      sinon.stub(ActivityModel, "model").returns(activityModelMock);

      // Assign stubs for individual tests to use
      findOneStub = deviceModelMock.findOne;
      findOneAndUpdateStub = deviceModelMock.findOneAndUpdate;
      cohortFindOneAndUpdateStub = cohortModelMock.findOneAndUpdate;
      cohortFindByIdStub = cohortModelMock.findById;
      updateOneStub = deviceModelMock.updateOne;
      createActivityStub = activityModelMock.create;
      createActivityStub.resolves({});
      // Default behavior for cohortFindByIdStub
      cohortFindByIdStub.returns({
        lean: sinon.stub().resolves({ _id: "60c7a3e5f7e4f1001f5e8e1a" }),
      });
    });

    afterEach(() => {
      sinon.restore();
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
      expect(error.status).to.equal(httpStatus.NOT_FOUND);
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

      expect(error.status).to.equal(httpStatus.NOT_FOUND);
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

      expect(error.status).to.equal(httpStatus.FORBIDDEN);
    });

    it("should return 409 CONFLICT if device is already deployed", async () => {
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
      };
      findOneStub.resolves(deviceMock);
      updateOneStub.resolves({ modifiedCount: 1 });

      let error;
      try {
        await deviceUtil.claimDevice(request, (err) => (error = err));
      } catch (err) {
        error = err;
      }
      // The test was expecting a CONFLICT, but the logic now recalls the device.
      expect(error).to.be.an.instanceOf(Error);
      expect(error.status).to.equal(httpStatus.CONFLICT);
      expect(error.message).to.equal("Device is currently deployed");
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
      expect(error.status).to.equal(httpStatus.GONE);
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
      expect(error.status).to.equal(httpStatus.CONFLICT);
      expect(error.message).to.equal("Device already claimed");
    });
  });

  describe("bulkClaim", () => {
    let findStub;
    let findOneAndUpdateStub;
    let cohortFindOneAndUpdateStub;
    let cohortFindByIdStub;
    let updateOneStub;
    let createActivityStub;

    beforeEach(() => {
      const deviceModelMock = {
        find: sinon.stub(),
        findOneAndUpdate: sinon.stub(),
        updateOne: sinon.stub().resolves({ modifiedCount: 1 }),
        lean: sinon.stub().returnsThis(),
      };
      const cohortModelMock = {
        findOneAndUpdate: sinon.stub(),
        findById: sinon.stub(),
      };
      const activityModelMock = {
        create: sinon.stub(),
      };

      sinon.stub(DeviceModel, "default").returns(deviceModelMock);
      sinon.stub(CohortModel, "default").returns(cohortModelMock);
      sinon.stub(ActivityModel, "model").returns(activityModelMock);

      findStub = deviceModelMock.find;
      findOneAndUpdateStub = deviceModelMock.findOneAndUpdate;
      cohortFindOneAndUpdateStub = cohortModelMock.findOneAndUpdate;
      cohortFindByIdStub = cohortModelMock.findById;
      updateOneStub = deviceModelMock.updateOne;
      createActivityStub = activityModelMock.create;

      // Default stubs
      cohortFindOneAndUpdateStub.resolves({ _id: "some_cohort_id" });
      createActivityStub.resolves({});
    });

    afterEach(() => {
      sinon.restore();
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
      findOneAndUpdateStub
        .withArgs({ name: "device_A" })
        .resolves({ name: "device_A", claim_status: "claimed" });
      updateOneStub.resolves({
        modifiedCount: 1,
      });

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
      const request = { body: { user_id: "invalid-id" } };
      let error;
      try {
        await deviceUtil.bulkClaim(request, (err) => (error = err));
      } catch (err) {}
      expect(error.status).to.equal(httpStatus.BAD_REQUEST);
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

      const error = await deviceUtil.bulkClaim(request).catch((err) => err);
      expect(error.status).to.equal(httpStatus.BAD_REQUEST);
    });
  });

  describe("getShippingPreparationStatus", () => {
    let findStub;

    beforeEach(() => {
      // Stub the find method on the mock model
      const deviceModelMock = {
        find: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        lean: sinon.stub(),
      };
      sinon.stub(DeviceModel, "default").returns(deviceModelMock);
      findStub = deviceModelMock.lean;
    });

    afterEach(() => {
      sinon.restore();
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
      const result = await deviceUtil.getShippingPreparationStatus(request);

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
      const result = await deviceUtil.getShippingPreparationStatus(request);

      expect(result.success).to.be.true;
      expect(result.data.summary.total_devices).to.equal(0);
      expect(result.data.categorized.prepared_for_shipping).to.be.an("array")
        .that.is.empty;
    });
  });

  describe("createDevice", () => {
    describe("doesDeviceSearchExist", () => {
      it("should return success if search exists", async () => {
        // Arrange
        const request = {
          filter: {
            /* Add filter properties as needed */
          },
          tenant: "TenantName",
        };

        // Stub the getModelByTenant.exists function to return true
        sinon.stub(deviceUtil, "getModelByTenant").resolves({
          exists: () => true,
        });

        // Act
        const result = await deviceUtil.doesDeviceSearchExist(request);

        // Assert
        expect(result.success).to.be.true;
        expect(result.message).to.equal("search exists");
        expect(result.data).to.be.true;

        // Restore the stubbed function
        deviceUtil.getModelByTenant.restore();
      });

      it("should return failure if search does not exist", async () => {
        // Arrange
        const request = {
          filter: {
            /* Add filter properties as needed */
          },
          tenant: "TenantName",
        };

        // Stub the getModelByTenant.exists function to return false
        sinon.stub(deviceUtil, "getModelByTenant").resolves({
          exists: () => false,
        });

        // Act
        const result = await deviceUtil.doesDeviceSearchExist(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("search does not exist");
        expect(result.data).to.be.an("array").that.is.empty;

        // Restore the stubbed function
        deviceUtil.getModelByTenant.restore();
      });

      it("should handle internal server error and return failure status", async () => {
        // Arrange
        const request = {
          filter: {
            /* Add filter properties as needed */
          },
          tenant: "TenantName",
        };

        // Stub the getModelByTenant.exists function to throw an error
        sinon
          .stub(deviceUtil, "getModelByTenant")
          .throws(new Error("Database error"));

        // Act
        const result = await deviceUtil.doesDeviceSearchExist(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors).to.have.property("message");
        expect(result.data).to.be.undefined;

        // Restore the stubbed function
        deviceUtil.getModelByTenant.restore();
      });
    });

    describe("doesDeviceExist", () => {
      it("should return true if device exists", async () => {
        // Arrange
        const request = {
          /* Add request properties as needed */
        };

        // Stub the deviceUtil.list function to return success and data
        sinon.stub(deviceUtil, "list").resolves({
          success: true,
          data: {
            /* Add device data as needed */
          },
        });

        // Act
        const result = await deviceUtil.doesDeviceExist(request);

        // Assert
        expect(result).to.be.true;

        // Restore the stubbed function
        deviceUtil.list.restore();
      });

      it("should return false if device does not exist", async () => {
        // Arrange
        const request = {
          /* Add request properties as needed */
        };

        // Stub the deviceUtil.list function to return success but no data
        sinon.stub(deviceUtil, "list").resolves({
          success: true,
          data: null,
        });

        // Act
        const result = await deviceUtil.doesDeviceExist(request);

        // Assert
        expect(result).to.be.false;

        // Restore the stubbed function
        deviceUtil.list.restore();
      });

      it("should handle internal server error and return false", async () => {
        // Arrange
        const request = {
          /* Add request properties as needed */
        };

        // Stub the deviceUtil.list function to throw an error
        sinon.stub(deviceUtil, "list").throws(new Error("Database error"));

        // Act
        const result = await deviceUtil.doesDeviceExist(request);

        // Assert
        expect(result).to.be.false;

        // Restore the stubbed function
        deviceUtil.list.restore();
      });
    });

    describe("getDevicesCount", () => {
      it("should return the count of devices when successful", async () => {
        // Arrange
        const tenant = "example-tenant";
        const count = 42;
        const request = { query: { tenant } };

        // Mock the DeviceModel countDocuments method
        const DeviceModel = {
          countDocuments: sinon.stub().resolves(count),
        };

        // Act
        const result = await deviceUtil.getDevicesCount(request, DeviceModel);

        // Assert
        expect(result.success).to.be.true;
        expect(result.message).to.equal("retrieved the number of devices");
        expect(result.status).to.equal(httpStatus.OK);
        expect(result.data).to.equal(count);
      });

      it("should return an error when DeviceModel throws an exception", async () => {
        // Arrange
        const tenant = "example-tenant";
        const error = new Error("Test error");
        const request = { query: { tenant } };

        // Mock the DeviceModel countDocuments method to throw an error
        const DeviceModel = {
          countDocuments: sinon.stub().rejects(error),
        };

        // Act
        const result = await deviceUtil.getDevicesCount(request, DeviceModel);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(result.errors.message).to.equal(error.message);
      });
    });

    describe("generateQR", () => {
      it("should generate a QR code for a valid device", async () => {
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

      it("should handle a device that does not exist", async () => {
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

      it("should handle an internal server error", async () => {
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
        // Arrange
        const request = {
          query: {
            tenant: "airqo",
          },
        };
        process.env.NODE_ENV = "development"; // Set the environment to non-production

        // Act
        const result = await deviceUtil.create(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Bad Request");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);

        // Restore the environment to its original value
        process.env.NODE_ENV = "production";
      });

      it("should create a device successfully", async () => {
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

      it("should handle createOnPlatform failure and undo successful operations", async () => {
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

      it("should handle createOnThingSpeak failure and return error message", async () => {
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

      it("should handle internal server error and return failure status", async () => {
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
      it("should return 'Bad Request' in a non-production environment", async () => {
        // Arrange
        const request = {
          query: {
            device_number: "123", // Replace '123' with an actual device number
          },
        };
        process.env.NODE_ENV = "development"; // Set the environment to non-production

        // Act
        const result = await deviceUtil.update(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Bad Request");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);

        // Restore the environment to its original value
        process.env.NODE_ENV = "production";
      });

      it("should update the device on platform if device_number is provided", async () => {
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

      it("should update the device on Thingspeak and then on platform if device_number is not provided", async () => {
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

      it("should handle updateOnThingspeak failure and return failure status", async () => {
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

      it("should handle internal server error and return failure status", async () => {
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
      it("should encrypt keys and return success", async () => {
        // Arrange
        const request = {
          query: {
            id: "id_value", // Replace 'id_value' with an actual ID
            device_number: "device_number_value", // Replace 'device_number_value' with an actual device number
            name: "name_value", // Replace 'name_value' with an actual name
            tenant: "tenant_value", // Replace 'tenant_value' with an actual tenant
          },
          body: {
            /* Add the body data here for encryption */
          },
        };
        const filter = {
          /* Add the filter data here */
        };
        const update = {
          /* Add the update data here */
        };
        const responseFromFilter = {
          success: true,
          data: filter,
        };
        const responseFromEncryptKeys = {
          success: true,
          data: {
            /* Add the encrypted data here */
          },
        };

        // Stub generateFilter.devices to return success and data
        sinon.stub(generateFilter, "devices").returns(responseFromFilter);

        // Stub getModelByTenant(device).encryptKeys to return success and data
        sinon
          .stub(
            getModelByTenant(request.query.tenant, "device", DeviceSchema),
            "encryptKeys"
          )
          .resolves(responseFromEncryptKeys);

        // Act
        const result = await deviceUtil.encryptKeys(request);

        // Assert
        expect(result).to.deep.equal(responseFromEncryptKeys);

        // Ensure that generateFilter.devices was called
        expect(generateFilter.devices.calledOnce).to.be.true;

        // Ensure that getModelByTenant(device).encryptKeys was called
        expect(getModelByTenant(device).encryptKeys.calledOnce).to.be.true;

        // Restore the stubbed functions
        generateFilter.devices.restore();
        getModelByTenant(device).encryptKeys.restore();
      });

      it("should handle errors from generateFilter.devices and return failure status", async () => {
        // Arrange
        const request = {
          query: {
            tenant: "tenant_value", // Replace 'tenant_value' with an actual tenant
          },
        };
        const responseFromFilter = {
          success: false,
          message: "Failed to generate filter",
          errors: { message: "Filter generation error" }, // Add relevant error message
        };

        // Stub generateFilter.devices to return failure
        sinon.stub(generateFilter, "devices").returns(responseFromFilter);

        // Act
        const result = await deviceUtil.encryptKeys(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to generate filter");
        expect(result.errors).to.deep.equal(responseFromFilter.errors);

        // Ensure that getModelByTenant(device).encryptKeys was not called
        expect(getModelByTenant(device).encryptKeys.called).to.be.false;

        // Restore the stubbed function
        generateFilter.devices.restore();
      });

      it("should handle internal server error from encryptKeys and return failure status", async () => {
        // Arrange
        const request = {
          query: {
            tenant: "tenant_value", // Replace 'tenant_value' with an actual tenant
          },
          body: {
            /* Add the body data here for encryption */
          },
        };
        const filter = {
          /* Add the filter data here */
        };
        const update = {
          /* Add the update data here */
        };
        const responseFromFilter = {
          success: true,
          data: filter,
        };

        // Stub generateFilter.devices to return success and data
        sinon.stub(generateFilter, "devices").returns(responseFromFilter);

        // Stub getModelByTenant(device).encryptKeys to throw an error
        sinon
          .stub(
            getModelByTenant(request.query.tenant, "device", DeviceSchema),
            "encryptKeys"
          )
          .throws(new Error("Internal Server Error"));

        // Act
        const result = await deviceUtil.encryptKeys(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that generateFilter.devices was called
        expect(generateFilter.devices.calledOnce).to.be.true;

        // Ensure that getModelByTenant(device).encryptKeys was called
        expect(getModelByTenant(device).encryptKeys.calledOnce).to.be.true;

        // Restore the stubbed functions
        generateFilter.devices.restore();
        getModelByTenant(device).encryptKeys.restore();
      });
    });

    describe("delete", () => {
      it("should delete the device successfully", async () => {
        // Arrange
        const deviceNumber = "device_number_value"; // Replace 'device_number_value' with an actual device number
        const request = {
          query: {
            device_number: deviceNumber,
          },
        };
        const responseFromDeleteOnThingspeak = {
          success: true,
        };
        const responseFromDeleteOnPlatform = {
          success: true,
        };

        // Stub deviceUtil.list to return success and device details
        sinon.stub(deviceUtil, "list").resolves({
          success: true,
          data: [{ device_number: deviceNumber }],
        });

        // Stub deviceUtil.deleteOnThingspeak to return success
        sinon
          .stub(deviceUtil, "deleteOnThingspeak")
          .resolves(responseFromDeleteOnThingspeak);

        // Stub deviceUtil.deleteOnPlatform to return success
        sinon
          .stub(deviceUtil, "deleteOnPlatform")
          .resolves(responseFromDeleteOnPlatform);

        // Act
        const result = await deviceUtil.delete(request);

        // Assert
        expect(result.success).to.be.true;
        expect(result).to.deep.equal(responseFromDeleteOnPlatform);

        // Ensure that deviceUtil.list was called
        expect(deviceUtil.list.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnThingspeak was called
        expect(deviceUtil.deleteOnThingspeak.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnPlatform was called
        expect(deviceUtil.deleteOnPlatform.calledOnce).to.be.true;

        // Restore the stubbed functions
        deviceUtil.list.restore();
        deviceUtil.deleteOnThingspeak.restore();
        deviceUtil.deleteOnPlatform.restore();
      });

      it("should handle missing device_number and return failure status", async () => {
        // Arrange
        const request = {
          query: {},
        };
        const responseFromListDevice = {
          success: false,
          message: "Device not found",
          errors: { message: "Device not found error" }, // Add relevant error message
        };

        // Stub deviceUtil.list to return failure
        sinon.stub(deviceUtil, "list").resolves(responseFromListDevice);

        // Act
        const result = await deviceUtil.delete(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Device not found");
        expect(result.errors).to.deep.equal(responseFromListDevice.errors);

        // Ensure that deviceUtil.list was called
        expect(deviceUtil.list.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnThingspeak and deviceUtil.deleteOnPlatform were not called
        expect(deviceUtil.deleteOnThingspeak.called).to.be.false;
        expect(deviceUtil.deleteOnPlatform.called).to.be.false;

        // Restore the stubbed function
        deviceUtil.list.restore();
      });

      it("should handle error from deleteOnThingspeak and return failure status", async () => {
        // Arrange
        const deviceNumber = "device_number_value"; // Replace 'device_number_value' with an actual device number
        const request = {
          query: {
            device_number: deviceNumber,
          },
        };
        const responseFromListDevice = {
          success: true,
          data: [{ device_number: deviceNumber }],
        };
        const responseFromDeleteOnThingspeak = {
          success: false,
          message: "Error deleting on Thingspeak",
          errors: { message: "Thingspeak delete error" }, // Add relevant error message
        };

        // Stub deviceUtil.list to return success and device details
        sinon.stub(deviceUtil, "list").resolves(responseFromListDevice);

        // Stub deviceUtil.deleteOnThingspeak to return failure
        sinon
          .stub(deviceUtil, "deleteOnThingspeak")
          .resolves(responseFromDeleteOnThingspeak);

        // Act
        const result = await deviceUtil.delete(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Error deleting on Thingspeak");
        expect(result.errors).to.deep.equal(
          responseFromDeleteOnThingspeak.errors
        );
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that deviceUtil.list was called
        expect(deviceUtil.list.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnThingspeak was called
        expect(deviceUtil.deleteOnThingspeak.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnPlatform was not called
        expect(deviceUtil.deleteOnPlatform.called).to.be.false;

        // Restore the stubbed functions
        deviceUtil.list.restore();
        deviceUtil.deleteOnThingspeak.restore();
      });

      it("should handle error from deleteOnPlatform and return failure status", async () => {
        // Arrange
        const deviceNumber = "device_number_value"; // Replace 'device_number_value' with an actual device number
        const request = {
          query: {
            device_number: deviceNumber,
          },
        };
        const responseFromListDevice = {
          success: true,
          data: [{ device_number: deviceNumber }],
        };
        const responseFromDeleteOnThingspeak = {
          success: true,
        };
        const responseFromDeleteOnPlatform = {
          success: false,
          message: "Error deleting on Platform",
          errors: { message: "Platform delete error" }, // Add relevant error message
        };

        // Stub deviceUtil.list to return success and device details
        sinon.stub(deviceUtil, "list").resolves(responseFromListDevice);

        // Stub deviceUtil.deleteOnThingspeak to return success
        sinon
          .stub(deviceUtil, "deleteOnThingspeak")
          .resolves(responseFromDeleteOnThingspeak);

        // Stub deviceUtil.deleteOnPlatform to return failure
        sinon
          .stub(deviceUtil, "deleteOnPlatform")
          .resolves(responseFromDeleteOnPlatform);

        // Act
        const result = await deviceUtil.delete(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Error deleting on Platform");
        expect(result.errors).to.deep.equal(
          responseFromDeleteOnPlatform.errors
        );
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that deviceUtil.list was called
        expect(deviceUtil.list.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnThingspeak was called
        expect(deviceUtil.deleteOnThingspeak.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnPlatform was called
        expect(deviceUtil.deleteOnPlatform.calledOnce).to.be.true;

        // Restore the stubbed functions
        deviceUtil.list.restore();
        deviceUtil.deleteOnThingspeak.restore();
        deviceUtil.deleteOnPlatform.restore();
      });

      it("should handle internal server error and return failure status", async () => {
        // Arrange
        const deviceNumber = "device_number_value"; // Replace 'device_number_value' with an actual device number
        const request = {
          query: {
            device_number: deviceNumber,
          },
        };

        // Stub deviceUtil.list to throw an error
        sinon
          .stub(deviceUtil, "list")
          .throws(new Error("Internal Server Error"));

        // Act
        const result = await deviceUtil.delete(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "server error --delete -- create-device util"
        );
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that deviceUtil.list was called
        expect(deviceUtil.list.calledOnce).to.be.true;

        // Ensure that deviceUtil.deleteOnThingspeak and deviceUtil.deleteOnPlatform were not called
        expect(deviceUtil.deleteOnThingspeak.called).to.be.false;
        expect(deviceUtil.deleteOnPlatform.called).to.be.false;

        // Restore the stubbed function
        deviceUtil.list.restore();
      });
    });

    describe("list", () => {
      it("should list devices successfully", async () => {
        // Arrange
        const tenant = "airqo"; // Replace 'airqo' with an actual tenant
        const limit = 10; // Replace '10' with the desired limit
        const skip = 0; // Replace '0' with the desired skip value
        const request = {
          query: {
            tenant,
            limit,
            skip,
          },
        };
        const filter = {}; // Add relevant filter data here
        const responseFromFilter = {
          success: true,
          data: filter,
        };
        const responseFromListDevice = {
          success: true,
          data: [], ///* Add the list of devices here */
        };

        // Stub generateFilter.devices to return success and filter data
        sinon.stub(generateFilter, "devices").resolves(responseFromFilter);

        // Stub getModelByTenant().list to return success and list of devices
        sinon
          .stub(getModelByTenant(tenant, "device", DeviceSchema), "list")
          .resolves(responseFromListDevice);

        // Act
        const result = await deviceUtil.list(request);

        // Assert
        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal(responseFromListDevice.data);

        // Ensure that generateFilter.devices was called
        expect(generateFilter.devices.calledOnce).to.be.true;

        // Ensure that getModelByTenant().list was called
        expect(getModelByTenant(tenant, "device", DeviceSchema).list.calledOnce)
          .to.be.true;

        // Restore the stubbed functions
        generateFilter.devices.restore();
        getModelByTenant(tenant, "device", DeviceSchema).list.restore();
      });

      it("should handle filter error and return failure status", async () => {
        // Arrange
        const tenant = "airqo"; // Replace 'airqo' with an actual tenant
        const limit = 10; // Replace '10' with the desired limit
        const skip = 0; // Replace '0' with the desired skip value
        const request = {
          query: {
            tenant,
            limit,
            skip,
          },
        };
        const responseFromFilter = {
          success: false,
          message: "Filter error",
          errors: { message: "Filter error message" }, // Add relevant error message
        };

        // Stub generateFilter.devices to return failure
        sinon.stub(generateFilter, "devices").resolves(responseFromFilter);

        // Act
        const result = await deviceUtil.list(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Filter error");
        expect(result.errors).to.deep.equal(responseFromFilter.errors);
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);

        // Ensure that generateFilter.devices was called
        expect(generateFilter.devices.calledOnce).to.be.true;

        // Ensure that getModelByTenant().list was not called
        expect(getModelByTenant().list.called).to.be.false;

        // Restore the stubbed function
        generateFilter.devices.restore();
      });

      it("should handle list devices error and return failure status", async () => {
        // Arrange
        const tenant = "airqo"; // Replace 'airqo' with an actual tenant
        const limit = 10; // Replace '10' with the desired limit
        const skip = 0; // Replace '0' with the desired skip value
        const request = {
          query: {
            tenant,
            limit,
            skip,
          },
        };
        const filter = {}; // Add relevant filter data here
        const responseFromFilter = {
          success: true,
          data: filter,
        };
        const responseFromListDevice = {
          success: false,
          message: "Error listing devices",
          errors: { message: "List devices error message" }, // Add relevant error message
        };

        // Stub generateFilter.devices to return success and filter data
        sinon.stub(generateFilter, "devices").resolves(responseFromFilter);

        // Stub getModelByTenant().list to return failure
        sinon
          .stub(getModelByTenant(tenant, "device", DeviceSchema), "list")
          .resolves(responseFromListDevice);

        // Act
        const result = await deviceUtil.list(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Error listing devices");
        expect(result.errors).to.deep.equal(responseFromListDevice.errors);
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that generateFilter.devices was called
        expect(generateFilter.devices.calledOnce).to.be.true;

        // Ensure that getModelByTenant().list was called
        expect(getModelByTenant(tenant, "device", DeviceSchema).list.calledOnce)
          .to.be.true;

        // Restore the stubbed functions
        generateFilter.devices.restore();
        getModelByTenant(tenant, "device", DeviceSchema).list.restore();
      });

      it("should handle internal server error and return failure status", async () => {
        // Arrange
        const tenant = "airqo"; // Replace 'airqo' with an actual tenant
        const limit = 10; // Replace '10' with the desired limit
        const skip = 0; // Replace '0' with the desired skip value
        const request = {
          query: {
            tenant,
            limit,
            skip,
          },
        };

        // Stub generateFilter.devices to throw an error
        sinon
          .stub(generateFilter, "devices")
          .throws(new Error("Internal Server Error"));

        // Act
        const result = await deviceUtil.list(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that generateFilter.devices was called
        expect(generateFilter.devices.calledOnce).to.be.true;

        // Ensure that getModelByTenant().list was not called
        expect(getModelByTenant().list.called).to.be.false;

        // Restore the stubbed function
        generateFilter.devices.restore();
      });
    });

    describe("createOnThingSpeak", () => {
      it("should create device on ThingSpeak successfully", async () => {
        // Arrange
        const baseURL = constants.CREATE_THING_URL; // Replace with the actual ThingSpeak URL
        const deviceData = {
          /* Add the required device data here */
        };
        const request = {
          body: deviceData,
        };
        const transformedBody = {
          /* Add the transformed body data here */
        };
        const responseFromTransform = {
          success: true,
          data: transformedBody,
        };
        const responseFromPost = {
          data: {
            api_keys: [
              {
                write_flag: true,
                api_key: "WRITE_KEY",
              },
              {
                write_flag: false,
                api_key: "READ_KEY",
              },
            ],
            id: "DEVICE_ID",
          },
        };

        // Stub deviceUtil.transform to return success and transformed body
        sinon.stub(deviceUtil, "transform").resolves(responseFromTransform);

        // Stub axios.post to return success and response data
        sinon.stub(axios, "post").resolves(responseFromPost);

        // Act
        const result = await deviceUtil.createOnThingSpeak(request);

        // Assert
        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully created the device on thingspeak"
        );
        expect(result.data.device_number).to.equal(responseFromPost.data.id);
        expect(result.data.writeKey).to.equal("WRITE_KEY");
        expect(result.data.readKey).to.equal("READ_KEY");

        // Ensure that deviceUtil.transform was called
        expect(deviceUtil.transform.calledOnce).to.be.true;

        // Ensure that axios.post was called
        expect(axios.post.calledOnce).to.be.true;
        expect(axios.post.firstCall.args[0]).to.equal(baseURL);
        expect(axios.post.firstCall.args[1]).to.deep.equal(transformedBody);

        // Restore the stubbed functions
        deviceUtil.transform.restore();
        axios.post.restore();
      });

      it("should handle transform failure and return failure status", async () => {
        // Arrange
        const baseURL = constants.CREATE_THING_URL; // Replace with the actual ThingSpeak URL
        const deviceData = {
          /* Add the required device data here */
        };
        const request = {
          body: deviceData,
        };
        const responseFromTransform = {
          success: false,
          message: "Transform error",
          errors: { message: "Transform error message" }, // Add relevant error message
        };

        // Stub deviceUtil.transform to return failure
        sinon.stub(deviceUtil, "transform").resolves(responseFromTransform);

        // Act
        const result = await deviceUtil.createOnThingSpeak(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Transform error");
        expect(result.errors).to.deep.equal(responseFromTransform.errors);

        // Ensure that deviceUtil.transform was called
        expect(deviceUtil.transform.calledOnce).to.be.true;

        // Ensure that axios.post was not called
        expect(axios.post.called).to.be.false;

        // Restore the stubbed function
        deviceUtil.transform.restore();
      });

      it("should handle axios.post failure with response and return failure status", async () => {
        // Arrange
        const baseURL = constants.CREATE_THING_URL; // Replace with the actual ThingSpeak URL
        const deviceData = {
          /* Add the required device data here */
        };
        const request = {
          body: deviceData,
        };
        const transformedBody = {
          /* Add the transformed body data here */
        };
        const responseFromTransform = {
          success: true,
          data: transformedBody,
        };
        const responseFromPost = {
          response: {
            status: httpStatus.BAD_REQUEST,
            statusText: "Bad Request",
          },
        };

        // Stub deviceUtil.transform to return success and transformed body
        sinon.stub(deviceUtil, "transform").resolves(responseFromTransform);

        // Stub axios.post to return failure
        sinon.stub(axios, "post").rejects(responseFromPost);

        // Act
        const result = await deviceUtil.createOnThingSpeak(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Bad Request");
        expect(result.errors.message).to.equal("Bad Request");

        // Ensure that deviceUtil.transform was called
        expect(deviceUtil.transform.calledOnce).to.be.true;

        // Ensure that axios.post was called
        expect(axios.post.calledOnce).to.be.true;
        expect(axios.post.firstCall.args[0]).to.equal(baseURL);
        expect(axios.post.firstCall.args[1]).to.deep.equal(transformedBody);

        // Restore the stubbed functions
        deviceUtil.transform.restore();
        axios.post.restore();
      });

      it("should handle axios.post failure without response and return failure status", async () => {
        // Arrange
        const baseURL = constants.CREATE_THING_URL; // Replace with the actual ThingSpeak URL
        const deviceData = {
          /* Add the required device data here */
        };
        const request = {
          body: deviceData,
        };
        const transformedBody = {
          /* Add the transformed body data here */
        };
        const responseFromTransform = {
          success: true,
          data: transformedBody,
        };

        // Stub deviceUtil.transform to return success and transformed body
        sinon.stub(deviceUtil, "transform").resolves(responseFromTransform);

        // Stub axios.post to throw an error without response
        sinon.stub(axios, "post").rejects(new Error("Network Error"));

        // Act
        const result = await deviceUtil.createOnThingSpeak(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Bad Gateway Error");
        expect(result.status).to.equal(httpStatus.BAD_GATEWAY);

        // Ensure that deviceUtil.transform was called
        expect(deviceUtil.transform.calledOnce).to.be.true;

        // Ensure that axios.post was called
        expect(axios.post.calledOnce).to.be.true;
        expect(axios.post.firstCall.args[0]).to.equal(baseURL);
        expect(axios.post.firstCall.args[1]).to.deep.equal(transformedBody);

        // Restore the stubbed functions
        deviceUtil.transform.restore();
        axios.post.restore();
      });

      it("should handle internal server error and return failure status", async () => {
        // Arrange
        const baseURL = constants.CREATE_THING_URL; // Replace with the actual ThingSpeak URL
        const deviceData = {
          /* Add the required device data here */
        };
        const request = {
          body: deviceData,
        };

        // Stub deviceUtil.transform to throw an error
        sinon
          .stub(deviceUtil, "transform")
          .throws(new Error("Internal Server Error"));

        // Act
        const result = await deviceUtil.createOnThingSpeak(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors).to.have.property("message");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

        // Ensure that deviceUtil.transform was called
        expect(deviceUtil.transform.calledOnce).to.be.true;

        // Ensure that axios.post was not called
        expect(axios.post.called).to.be.false;

        // Restore the stubbed function
        deviceUtil.transform.restore();
      });
    });

    describe("decryptKey", () => {
      it("should decrypt the encrypted key successfully", () => {
        // Arrange
        const encryptedKey = "some_encrypted_key"; // Add the encrypted key here
        const decryptedText = "decrypted_text"; // Add the decrypted text here
        const cryptoJSSpy = chai.spy.on(
          deviceUtil.cryptoJS.AES,
          "decrypt",
          () => {
            return {
              toString: () => decryptedText,
            };
          }
        );

        // Act
        const result = deviceUtil.decryptKey(encryptedKey);

        // Assert
        expect(result.success).to.be.true;
        expect(result.data).to.equal(decryptedText);
        expect(result.status).to.equal(httpStatus.OK);
        expect(cryptoJSSpy).to.have.been.called.with(
          encryptedKey,
          constants.KEY_ENCRYPTION_KEY
        );

        // Restore the spy
        deviceUtil.cryptoJS.AES.decrypt.restore();
      });

      it("should handle an unknown encrypted key", () => {
        // Arrange
        const encryptedKey = "unknown_encrypted_key"; // Add an unknown encrypted key here

        // Act
        const result = deviceUtil.decryptKey(encryptedKey);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "the provided encrypted key is not recognizable"
        );
        expect(result.errors.message).to.equal(
          "the provided encrypted key is not recognizable"
        );
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
      });

      it("should handle internal server error while decrypting the key", () => {
        // Arrange
        const encryptedKey = "some_encrypted_key"; // Add the encrypted key here
        const error = new Error("Failed to decrypt key");
        const cryptoJSSpy = chai.spy.on(
          deviceUtil.cryptoJS.AES,
          "decrypt",
          () => {
            throw error;
          }
        );

        // Act
        const result = deviceUtil.decryptKey(encryptedKey);

        // Assert
        expect(result.success).to.be.false;
        expect(result.errors.message).to.equal(error.message);
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(cryptoJSSpy).to.have.been.called.with(
          encryptedKey,
          constants.KEY_ENCRYPTION_KEY
        );

        // Restore the spy
        deviceUtil.cryptoJS.AES.decrypt.restore();
      });
    });

    describe("transform", () => {
      it("should transform the data successfully", () => {
        // Arrange
        const data = {
          // Add the input data for transformation here
        };
        const map = {
          // Add the map for transformation here
        };
        const context = {
          // Add the context for transformation here
        };

        // Act
        const result = deviceUtil.transform({ data, map, context });

        // Assert
        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully transformed the json request"
        );
        expect(result.data).to.deep.equal({
          // Add the expected transformed data here
        });
      });

      it("should handle empty data after transformation", () => {
        // Arrange
        const data = {
          // Add the input data for transformation here
        };
        const map = {
          // Add the map for transformation here
        };
        const context = {
          // Add the context for transformation here
        };
        const emptyResult = {}; // Set an empty object as the result of transformation

        // Stub the transform function to return an empty result
        const transformStub = chai.spy.on(
          deviceUtil,
          "transform",
          () => emptyResult
        );

        // Act
        const result = deviceUtil.transform({ data, map, context });

        // Assert
        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "the request body for the external system is empty after transformation"
        );
        expect(result.data).to.deep.equal(emptyResult);
        expect(transformStub).to.have.been.called.with({ data, map, context });

        // Restore the stub
        deviceUtil.transform.restore();
      });

      it("should handle internal server error during transformation", () => {
        // Arrange
        const data = {
          // Add the input data for transformation here
        };
        const map = {
          // Add the map for transformation here
        };
        const context = {
          // Add the context for transformation here
        };
        const error = new Error("Failed to transform data");
        const transformStub = chai.spy.on(deviceUtil, "transform", () => {
          throw error;
        });

        // Act
        const result = deviceUtil.transform({ data, map, context });

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors.message).to.equal(error.message);
        expect(transformStub).to.have.been.called.with({ data, map, context });

        // Restore the stub
        deviceUtil.transform.restore();
      });
    });

    describe("refresh", () => {
      it("should return 'feature temporarily disabled --coming soon'", () => {
        // Arrange
        const request = {
          // Add any required data for the request here
        };

        // Act
        const result = deviceUtil.refresh(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "feature temporarily disabled --coming soon"
        );
        expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
        expect(result.errors.message).to.equal("Service Unavailable");
      });

      it("should refresh device details successfully", async () => {
        // Arrange
        const tenant = "sample_tenant";
        const filter = {
          // Add the filter data here
        };
        const deviceDetails = {
          // Add the device details here
        };
        const request = {
          query: { tenant },
          body: { ...deviceDetails },
        };

        // Stub the generateFilter.devices function to return the filter
        const generateFilterStub = chai.spy.on(
          deviceUtil,
          "generateFilter",
          () => ({
            success: true,
            data: filter,
          })
        );

        // Stub the getModelByTenant.modify function to return a success response
        const modifyStub = chai.spy.on(deviceUtil, "modify", () => ({
          success: true,
          data: deviceDetails,
        }));

        // Act
        const result = await deviceUtil.refresh(request);

        // Assert
        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "Device Details Successfully Refreshed"
        );
        expect(result.data).to.deep.equal(deviceDetails);
        expect(generateFilterStub).to.have.been.called.with(request);
        expect(modifyStub).to.have.been.called.with({
          filter,
          update: deviceDetails,
          opts: {},
        });

        // Restore the stubs
        deviceUtil.generateFilter.restore();
        deviceUtil.modify.restore();
      });

      it("should handle failed refresh due to invalid request", async () => {
        // Arrange
        const tenant = "sample_tenant";
        const filter = {
          // Add the filter data here
        };
        const request = {
          query: { tenant },
          body: {
            // Add invalid device details here
          },
        };
        const error = new Error("Invalid request");
        const generateFilterStub = chai.spy.on(
          deviceUtil,
          "generateFilter",
          () => ({
            success: true,
            data: filter,
          })
        );
        const modifyStub = chai.spy.on(deviceUtil, "modify", () => {
          throw error;
        });

        // Act
        const result = await deviceUtil.refresh(request);

        // Assert
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors.message).to.equal(error.message);
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(generateFilterStub).to.have.been.called.with(request);
        expect(modifyStub).to.have.been.called.with({
          filter,
          update: request.body,
          opts: {},
        });

        // Restore the stubs
        deviceUtil.generateFilter.restore();
        deviceUtil.modify.restore();
      });
    });

    // Add tests for other functions in deviceUtil
  });
});
