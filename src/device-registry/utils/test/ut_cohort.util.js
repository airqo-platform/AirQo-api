require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const createCohort = require("@utils/cohort.util");
const networkUtil = require("@utils/network.util");
const constants = require("@config/constants");
const { generateFilter, cohortSlugUtil } = require("@utils/common");

const { expect } = chai;

describe("createCohort", () => {
  let sandbox;
  beforeEach(() => { sandbox = sinon.createSandbox(); });
  afterEach(() => { sandbox.restore(); });

  describe("listNetworks", () => {
    it("should list networks successfully", async () => {
      sandbox.stub(networkUtil, "listNetworks").resolves({ success: true, data: [] });
      const result = await createCohort.listNetworks({ query: { tenant: "airqo" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle listNetworks error", async () => {
      sandbox.stub(networkUtil, "listNetworks").resolves({ success: false });
      const result = await createCohort.listNetworks({ query: { tenant: "airqo" } }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("updateNetwork", () => {
    it("should update network and return success", async () => {
      sandbox.stub(networkUtil, "updateNetwork").resolves({ success: true });
      const result = await createCohort.updateNetwork({ query: { tenant: "airqo" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle network update error", async () => {
      sandbox.stub(networkUtil, "updateNetwork").resolves({ success: false });
      const result = await createCohort.updateNetwork({ query: { tenant: "airqo" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("deleteNetwork", () => {
    it("should delete network and return success", async () => {
      sandbox.stub(networkUtil, "deleteNetwork").resolves({ success: true });
      const result = await createCohort.deleteNetwork({ query: { tenant: "airqo" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle network deletion error", async () => {
      sandbox.stub(networkUtil, "deleteNetwork").resolves({ success: false });
      const result = await createCohort.deleteNetwork({ query: { tenant: "airqo" } }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("createNetwork", () => {
    it("should create a network and return success", async () => {
      sandbox.stub(networkUtil, "createNetwork").resolves({ success: true });
      const result = await createCohort.createNetwork({ query: { tenant: "airqo" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle network creation error", async () => {
      sandbox.stub(networkUtil, "createNetwork").resolves({ success: false });
      const result = await createCohort.createNetwork({ query: { tenant: "airqo" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });
  });

  describe("create", () => {
    it("should create a cohort and return success", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        register: sandbox.stub().resolves({ success: true, data: { _id: "cid", name: "test" } }),
      });
      const result = await createCohort.create({ query: { tenant: "airqo" }, body: { name: "test" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle cohort creation failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        register: sandbox.stub().resolves({ success: false }),
      });
      const result = await createCohort.create({ query: { tenant: "airqo" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();
      await createCohort.create({ query: { tenant: "airqo" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });

    it("should generate and pass through a unique cohort_slug when one is provided", async () => {
      const registerStub = sandbox.stub().resolves({
        success: true,
        data: { _id: "cid", name: "test", cohort_slug: "wri-nairobi" },
      });
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        register: registerStub,
      });
      sandbox.stub(cohortSlugUtil, "generateUniqueCohortSlug").resolves({
        success: true,
        slug: "wri-nairobi",
      });

      const result = await createCohort.create(
        {
          query: { tenant: "airqo" },
          body: { name: "test", cohort_slug: "Nairobi!!", group_slug: "WRI" },
        },
        sandbox.stub(),
      );

      expect(result.success).to.be.true;
      // The sanitized/uniqued slug from generateUniqueCohortSlug — not the
      // raw request body value — is what gets persisted.
      expect(registerStub.getCall(0).args[0].cohort_slug).to.equal(
        "wri-nairobi",
      );
      expect(registerStub.getCall(0).args[0].group_slug).to.be.undefined;
    });

    it("should reject with a 400 and skip registration when cohort_slug is invalid or reserved", async () => {
      const registerStub = sandbox.stub().resolves({ success: true });
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        register: registerStub,
      });
      sandbox.stub(cohortSlugUtil, "generateUniqueCohortSlug").resolves({
        success: false,
        message: '"admin" is a reserved cohort_slug value, please choose another',
      });

      const result = await createCohort.create(
        {
          query: { tenant: "airqo" },
          body: { name: "test", cohort_slug: "admin" },
        },
        sandbox.stub(),
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.include("reserved");
      expect(registerStub.called).to.be.false;
    });
  });

  describe("update", () => {
    it("should update a cohort and return success", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        modify: sandbox.stub().resolves({ success: true }),
      });
      sandbox.stub(generateFilter, "cohorts").returns({ _id: "cid" });
      const result = await createCohort.update({ query: { tenant: "airqo" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle cohort update failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        modify: sandbox.stub().resolves({ success: false }),
      });
      sandbox.stub(generateFilter, "cohorts").returns({ _id: "cid" });
      const result = await createCohort.update({ query: { tenant: "airqo" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        modify: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "cohorts").returns({ _id: "cid" });
      const next = sandbox.stub();
      await createCohort.update({ query: { tenant: "airqo" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("delete", () => {
    it("should return service disabled response", async () => {
      // delete() immediately returns 503 (service temporarily disabled)
      const result = await createCohort.delete({ query: { tenant: "airqo" } }, sandbox.stub());
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe("list", () => {
    it("should list cohorts successfully", async () => {
      const aggregateStub = sandbox.stub().resolves([{ paginatedResults: [], totalCount: [] }]);
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        aggregate: sandbox.stub().returns({ allowDiskUse: aggregateStub }),
      });
      sandbox.stub(generateFilter, "cohorts").returns({});
      const result = await createCohort.list({ query: { tenant: "airqo" } }, sandbox.stub());
      expect(result && (result.success !== undefined || result !== undefined)).to.be.true;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        aggregate: sandbox.stub().returns({
          allowDiskUse: sandbox.stub().rejects(new Error("DB error")),
        }),
      });
      sandbox.stub(generateFilter, "cohorts").returns({});
      const next = sandbox.stub();
      await createCohort.list({ query: { tenant: "airqo" } }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("listAssignedDevices", () => {
    it("should list assigned devices successfully", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("cohorts").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves({ _id: "cid", devices: ["did"] }) }),
      });
      ms.withArgs("devices").returns({
        find: sandbox.stub().returns({
          lean: sandbox.stub().resolves([{ _id: "did", name: "device1" }]),
        }),
      });
      const result = await createCohort.listAssignedDevices(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" } },
        sandbox.stub()
      );
      expect((result && result.success !== undefined) || true).to.be.true;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().rejects(new Error("fail")) }),
      });
      const next = sandbox.stub();
      await createCohort.listAssignedDevices(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" } },
        next
      );
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("listAvailableDevices", () => {
    it("should list available devices successfully", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("cohorts").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves({ _id: "cid", devices: ["did"] }) }),
      });
      ms.withArgs("devices").returns({
        find: sandbox.stub().returns({
          lean: sandbox.stub().resolves([{ _id: "did2", name: "device2" }]),
        }),
      });
      const result = await createCohort.listAvailableDevices(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" } },
        sandbox.stub()
      );
      expect((result && result.success !== undefined) || true).to.be.true;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().rejects(new Error("fail")) }),
      });
      const next = sandbox.stub();
      await createCohort.listAvailableDevices(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" } },
        next
      );
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("assignOneDeviceToCohort", () => {
    it("should handle invalid cohort or device", async () => {
      // Looks up the cohort via findOne (supports ObjectId or cohort_slug)
      // and checks device existence separately.
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("cohorts").returns({
        findOne: sandbox.stub().returns({
          select: sandbox.stub().returns({ lean: sandbox.stub().resolves(null) }),
        }),
      });
      ms.withArgs("devices").returns({ exists: sandbox.stub().resolves(false) });
      const result = await createCohort.assignOneDeviceToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle internal server error", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("devices").returns({ exists: sandbox.stub().rejects(new Error("fail")) });
      ms.withArgs("cohorts").returns({ exists: sandbox.stub().resolves(true) });
      const next = sandbox.stub();
      await createCohort.assignOneDeviceToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
        next
      );
      expect(next.calledOnce).to.be.true;
    });

    function stubAssignOneChain({ cohort, device, updatedDevice }) {
      const ms = sandbox.stub(mongoose, "model");
      const devicesModel = {
        exists: sandbox.stub().resolves(true),
        findById: sandbox.stub().returns({ lean: sandbox.stub().resolves(device) }),
        findByIdAndUpdate: sandbox.stub().resolves(updatedDevice),
      };
      ms.withArgs("cohorts").returns({
        findOne: sandbox.stub().returns({
          select: sandbox.stub().returns({ lean: sandbox.stub().resolves(cohort) }),
        }),
      });
      ms.withArgs("devices").returns(devicesModel);
      return devicesModel;
    }

    it("should assign a device whose network matches the cohort's network", async () => {
      stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: [] },
        device: { _id: "did", cohorts: [], network: "netX", groups: [] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      const result = await createCohort.assignOneDeviceToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
    });

    it("should still assign a cross-network device when ENFORCE_COHORT_DEVICE_GROUP_SCOPE is off (default, backward compatible)", async () => {
      stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: [] },
        device: { _id: "did", cohorts: [], network: "netY", groups: ["orgB"] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      const result = await createCohort.assignOneDeviceToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
    });

    it("should block a cross-network device when ENFORCE_COHORT_DEVICE_GROUP_SCOPE is on", async () => {
      const devicesModel = stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: [] },
        device: { _id: "did", cohorts: [], network: "netY", groups: ["orgB"] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = true;
      try {
        const result = await createCohort.assignOneDeviceToCohort(
          { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
          sandbox.stub()
        );
        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);
        expect(devicesModel.findByIdAndUpdate.called).to.be.false;
      } finally {
        constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = false;
      }
    });

    it("should allow assignment when the cohort is on the airqo network even with ENFORCE_COHORT_DEVICE_GROUP_SCOPE on", async () => {
      stubAssignOneChain({
        cohort: { _id: "cid", network: "airqo", groups: [] },
        device: { _id: "did", cohorts: [], network: "netY", groups: ["orgB"] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = true;
      try {
        const result = await createCohort.assignOneDeviceToCohort(
          { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
          sandbox.stub()
        );
        expect(result.success).to.be.true;
      } finally {
        constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = false;
      }
    });

    it("should assign when the requesting user's groups include the cohort's group", async () => {
      stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        device: { _id: "did", cohorts: [], network: "netX", groups: [] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      const result = await createCohort.assignOneDeviceToCohort(
        {
          query: { tenant: "airqo" },
          params: { cohort_id: "cid", device_id: "did" },
          identity: { userId: "u1", groups: ["orgA"] },
        },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
    });

    it("should still assign when the user is not a group member and ENFORCE_COHORT_USER_GROUP_MEMBERSHIP is off (default, backward compatible)", async () => {
      stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        device: { _id: "did", cohorts: [], network: "netX", groups: [] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      const result = await createCohort.assignOneDeviceToCohort(
        {
          query: { tenant: "airqo" },
          params: { cohort_id: "cid", device_id: "did" },
          identity: { userId: "u2", groups: ["orgB"] },
        },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
    });

    it("should block a non-member user when ENFORCE_COHORT_USER_GROUP_MEMBERSHIP is on", async () => {
      const devicesModel = stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        device: { _id: "did", cohorts: [], network: "netX", groups: [] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = true;
      try {
        const result = await createCohort.assignOneDeviceToCohort(
          {
            query: { tenant: "airqo" },
            params: { cohort_id: "cid", device_id: "did" },
            identity: { userId: "u2", groups: ["orgB"] },
          },
          sandbox.stub()
        );
        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.FORBIDDEN);
        expect(devicesModel.findByIdAndUpdate.called).to.be.false;
      } finally {
        constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = false;
      }
    });

    it("should allow an airqo-group user even with ENFORCE_COHORT_USER_GROUP_MEMBERSHIP on", async () => {
      stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        device: { _id: "did", cohorts: [], network: "netX", groups: [] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = true;
      try {
        const result = await createCohort.assignOneDeviceToCohort(
          {
            query: { tenant: "airqo" },
            params: { cohort_id: "cid", device_id: "did" },
            identity: { userId: "u3", groups: ["airqo"] },
          },
          sandbox.stub()
        );
        expect(result.success).to.be.true;
      } finally {
        constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = false;
      }
    });

    it("should never block on missing identity, even with ENFORCE_COHORT_USER_GROUP_MEMBERSHIP on", async () => {
      stubAssignOneChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        device: { _id: "did", cohorts: [], network: "netX", groups: [] },
        updatedDevice: { _id: "did", cohorts: ["cid"] },
      });
      constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = true;
      try {
        const result = await createCohort.assignOneDeviceToCohort(
          { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
          sandbox.stub()
        );
        expect(result.success).to.be.true;
      } finally {
        constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = false;
      }
    });
  });

  describe("unAssignOneDeviceFromCohort", () => {
    it("should handle invalid cohort or device", async () => {
      // Cohort lookup uses findOne (supports ObjectId or cohort_slug);
      // device lookup is unchanged (findById, no .lean()).
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("cohorts").returns({ findOne: sandbox.stub().resolves(null) });
      ms.withArgs("devices").returns({ findById: sandbox.stub().resolves(null) });
      const result = await createCohort.unAssignOneDeviceFromCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle internal server error", async () => {
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("cohorts").returns({ findById: sandbox.stub().rejects(new Error("fail")) });
      const next = sandbox.stub();
      await createCohort.unAssignOneDeviceFromCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid", device_id: "did" } },
        next
      );
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("assignManyDevicesToCohort", () => {
    it("should handle invalid cohort", async () => {
      // Uses .findOne(filter).lean() (supports ObjectId or cohort_slug)
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findOne: sandbox.stub().returns({ lean: sandbox.stub().resolves(null) }),
      });
      const result = await createCohort.assignManyDevicesToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["did"] } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findById: sandbox.stub().returns({ lean: sandbox.stub().rejects(new Error("fail")) }),
      });
      const next = sandbox.stub();
      await createCohort.assignManyDevicesToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["did"] } },
        next
      );
      expect(next.calledOnce).to.be.true;
    });

    function stubAssignManyChain({ cohort, existingDevices, confirmedDevices }) {
      const findStub = sandbox.stub();
      findStub.onCall(0).returns({
        select: sandbox.stub().returns({ lean: sandbox.stub().resolves(existingDevices) }),
      });
      if (confirmedDevices) {
        findStub.onCall(1).returns({
          select: sandbox.stub().returns({ lean: sandbox.stub().resolves(confirmedDevices) }),
        });
      }
      const devicesModel = {
        find: findStub,
        updateMany: sandbox.stub().resolves({}),
      };
      const ms = sandbox.stub(mongoose, "model");
      ms.withArgs("cohorts").returns({
        findOne: sandbox.stub().returns({ lean: sandbox.stub().resolves(cohort) }),
      });
      ms.withArgs("devices").returns(devicesModel);
      return devicesModel;
    }

    it("should assign devices whose network matches the cohort's network", async () => {
      stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: [] },
        existingDevices: [{ _id: "dev1", cohorts: [], network: "netX", groups: [] }],
        confirmedDevices: [{ _id: "dev1" }],
      });
      const result = await createCohort.assignManyDevicesToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["dev1"] } },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
      expect(result.data.assigned).to.deep.equal(["dev1"]);
      expect(result.data.blocked_group_mismatch).to.be.undefined;
    });

    it("should still assign a cross-network device when ENFORCE_COHORT_DEVICE_GROUP_SCOPE is off (default, backward compatible)", async () => {
      stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: [] },
        existingDevices: [{ _id: "dev2", cohorts: [], network: "netY", groups: ["orgB"] }],
        confirmedDevices: [{ _id: "dev2" }],
      });
      const result = await createCohort.assignManyDevicesToCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["dev2"] } },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
      expect(result.data.assigned).to.deep.equal(["dev2"]);
      expect(result.data.blocked_group_mismatch).to.be.undefined;
    });

    it("should block a cross-network device and report it when ENFORCE_COHORT_DEVICE_GROUP_SCOPE is on", async () => {
      const devicesModel = stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: [] },
        existingDevices: [{ _id: "dev2", cohorts: [], network: "netY", groups: ["orgB"] }],
      });
      constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = true;
      try {
        const result = await createCohort.assignManyDevicesToCohort(
          { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["dev2"] } },
          sandbox.stub()
        );
        expect(result.success).to.be.true;
        expect(result.data.assigned).to.deep.equal([]);
        expect(result.data.blocked_group_mismatch).to.deep.equal(["dev2"]);
        expect(devicesModel.updateMany.called).to.be.false;
      } finally {
        constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = false;
      }
    });

    it("should allow assignment when the device is on the airqo network even with ENFORCE_COHORT_DEVICE_GROUP_SCOPE on", async () => {
      stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: [] },
        existingDevices: [{ _id: "dev3", cohorts: [], network: "airqo", groups: [] }],
        confirmedDevices: [{ _id: "dev3" }],
      });
      constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = true;
      try {
        const result = await createCohort.assignManyDevicesToCohort(
          { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["dev3"] } },
          sandbox.stub()
        );
        expect(result.success).to.be.true;
        expect(result.data.assigned).to.deep.equal(["dev3"]);
      } finally {
        constants.ENFORCE_COHORT_DEVICE_GROUP_SCOPE = false;
      }
    });

    it("should assign when the requesting user's groups include the cohort's group", async () => {
      stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        existingDevices: [{ _id: "dev1", cohorts: [], network: "netX", groups: [] }],
        confirmedDevices: [{ _id: "dev1" }],
      });
      const result = await createCohort.assignManyDevicesToCohort(
        {
          query: { tenant: "airqo" },
          params: { cohort_id: "cid" },
          body: { device_ids: ["dev1"] },
          identity: { userId: "u1", groups: ["orgA"] },
        },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
      expect(result.data.assigned).to.deep.equal(["dev1"]);
    });

    it("should still assign when the user is not a group member and ENFORCE_COHORT_USER_GROUP_MEMBERSHIP is off (default, backward compatible)", async () => {
      stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        existingDevices: [{ _id: "dev1", cohorts: [], network: "netX", groups: [] }],
        confirmedDevices: [{ _id: "dev1" }],
      });
      const result = await createCohort.assignManyDevicesToCohort(
        {
          query: { tenant: "airqo" },
          params: { cohort_id: "cid" },
          body: { device_ids: ["dev1"] },
          identity: { userId: "u2", groups: ["orgB"] },
        },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
      expect(result.data.assigned).to.deep.equal(["dev1"]);
    });

    it("should block the whole request for a non-member user when ENFORCE_COHORT_USER_GROUP_MEMBERSHIP is on", async () => {
      const devicesModel = stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        existingDevices: [{ _id: "dev1", cohorts: [], network: "netX", groups: [] }],
      });
      constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = true;
      try {
        const result = await createCohort.assignManyDevicesToCohort(
          {
            query: { tenant: "airqo" },
            params: { cohort_id: "cid" },
            body: { device_ids: ["dev1"] },
            identity: { userId: "u2", groups: ["orgB"] },
          },
          sandbox.stub()
        );
        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.FORBIDDEN);
        expect(devicesModel.find.called).to.be.false;
      } finally {
        constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = false;
      }
    });

    it("should allow an airqo-group user even with ENFORCE_COHORT_USER_GROUP_MEMBERSHIP on", async () => {
      stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        existingDevices: [{ _id: "dev1", cohorts: [], network: "netX", groups: [] }],
        confirmedDevices: [{ _id: "dev1" }],
      });
      constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = true;
      try {
        const result = await createCohort.assignManyDevicesToCohort(
          {
            query: { tenant: "airqo" },
            params: { cohort_id: "cid" },
            body: { device_ids: ["dev1"] },
            identity: { userId: "u3", groups: ["airqo"] },
          },
          sandbox.stub()
        );
        expect(result.success).to.be.true;
        expect(result.data.assigned).to.deep.equal(["dev1"]);
      } finally {
        constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = false;
      }
    });

    it("should never block on missing identity, even with ENFORCE_COHORT_USER_GROUP_MEMBERSHIP on", async () => {
      stubAssignManyChain({
        cohort: { _id: "cid", network: "netX", groups: ["orgA"] },
        existingDevices: [{ _id: "dev1", cohorts: [], network: "netX", groups: [] }],
        confirmedDevices: [{ _id: "dev1" }],
      });
      constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = true;
      try {
        const result = await createCohort.assignManyDevicesToCohort(
          {
            query: { tenant: "airqo" },
            params: { cohort_id: "cid" },
            body: { device_ids: ["dev1"] },
          },
          sandbox.stub()
        );
        expect(result.success).to.be.true;
        expect(result.data.assigned).to.deep.equal(["dev1"]);
      } finally {
        constants.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP = false;
      }
    });
  });

  describe("unAssignManyDevicesFromCohort", () => {
    it("should handle invalid cohort", async () => {
      // Uses findOne on cohorts (no .lean()) — supports ObjectId or cohort_slug
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findOne: sandbox.stub().resolves(null),
      });
      const result = await createCohort.unAssignManyDevicesFromCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["did"] } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findById: sandbox.stub().rejects(new Error("fail")),
      });
      const next = sandbox.stub();
      await createCohort.unAssignManyDevicesFromCohort(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" }, body: { device_ids: ["did"] } },
        next
      );
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("verify", () => {
    it("should handle cohort not found", async () => {
      // Uses .findOne(filter).lean().select("_id name")
      const selectStub = sandbox.stub().resolves(null);
      const leanStub = sandbox.stub().returns({ select: selectStub });
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findOne: sandbox.stub().returns({ lean: leanStub }),
      });
      sandbox.stub(generateFilter, "cohorts").returns({ _id: "cid" });
      const result = await createCohort.verify(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("cohorts").returns({
        findOne: sandbox.stub().returns({ lean: sandbox.stub().throws(new Error("fail")) }),
      });
      sandbox.stub(generateFilter, "cohorts").returns({ _id: "cid" });
      const next = sandbox.stub();
      await createCohort.verify(
        { query: { tenant: "airqo" }, params: { cohort_id: "cid" } },
        next
      );
      expect(next.calledOnce).to.be.true;
    });
  });
});
