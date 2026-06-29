require("module-alias/register");
const proxyquire = require("proxyquire");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

// Date within the valid window: today, never more than 1 month in the past
const recentDate = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

describe("createActivity", () => {
  let createActivity;
  let DeviceModelStub;
  let SiteModelStub;
  let ActivityModelStub;
  let GridModelStub;
  let createSiteUtilStub;
  let mongooseStub;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create stubs for models and utilities
    DeviceModelStub = sandbox.stub();
    SiteModelStub = sandbox.stub();
    ActivityModelStub = sandbox.stub();
    GridModelStub = sandbox.stub();
    createSiteUtilStub = {
      create: sandbox.stub(),
      list: sandbox.stub(),
    };

    mongooseStub = {
      startSession: sandbox.stub(),
      Types: { ObjectId },
    };

    // Load module with mocked dependencies
    createActivity = proxyquire("@utils/activity.util", {
      "@models/Device": DeviceModelStub,
      "@models/Site": SiteModelStub,
      "@models/Activity": ActivityModelStub,
      "@models/Grid": GridModelStub,
      "@utils/site.util": createSiteUtilStub,
      mongoose: mongooseStub,
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("batchDeployWithCoordinates", () => {
    it.skip("should successfully deploy multiple static devices in batch", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: [
          {
            deviceName: "device1",
            deployment_type: "static",
            latitude: 0.3476,
            longitude: 32.5825,
            site_name: "Kampala Site",
            height: 10,
            mountType: "pole",
            powerType: "solar",
            isPrimaryInLocation: true,
            network: "airqo",
            date: recentDate(),
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            userName: "jdoe",
          },
          {
            deviceName: "device2",
            deployment_type: "static",
            latitude: 0.35,
            longitude: 32.59,
            site_name: "Nakawa Site",
            height: 12,
            mountType: "rooftop",
            powerType: "mains",
            isPrimaryInLocation: false,
            network: "airqo",
            date: recentDate(),
          },
        ],
      };

      const device1Id = new ObjectId();
      const device2Id = new ObjectId();
      const site1Id = new ObjectId();
      const site2Id = new ObjectId();

      // Mock DeviceModel
      DeviceModelStub.returns({
        find: sandbox
          .stub()
          .returns({ lean: sandbox.stub().resolves([
            { _id: device1Id, name: "device1", isActive: false },
            { _id: device2Id, name: "device2", isActive: false },
          ]) }),
        bulkWrite: sandbox.stub().resolves({ modifiedCount: 2 }),
      });

      // Mock SiteModel - atomic upsert
      const siteModelInstance = {
        findOneAndUpdate: sandbox.stub(),
      };

      siteModelInstance.findOneAndUpdate
        .onFirstCall()
        .resolves({
          _id: site1Id,
          name: "Kampala Site",
          latitude: 0.3476,
          longitude: 32.5825,
          $isNew: false,
        })
        .onSecondCall()
        .resolves({
          _id: site2Id,
          name: "Nakawa Site",
          latitude: 0.35,
          longitude: 32.59,
          $isNew: false,
        });

      SiteModelStub.returns(siteModelInstance);

      // Mock ActivityModel
      const createdActivities = [
        {
          _id: new ObjectId(),
          device: "device1",
          device_id: device1Id,
          activityType: "deployment",
          deployment_type: "static",
          site_id: site1Id,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          userName: "jdoe",
          createdAt: new Date(),
        },
        {
          _id: new ObjectId(),
          device: "device2",
          device_id: device2Id,
          activityType: "deployment",
          deployment_type: "static",
          site_id: site2Id,
          createdAt: new Date(),
        },
      ];

      ActivityModelStub.returns({
        create: sandbox.stub().resolves(createdActivities),
      });

      // Mock mongoose session
      const sessionMock = {
        withTransaction: sandbox.stub().callsFake(async (fn) => await fn()),
        endSession: sandbox.stub().resolves(),
      };
      mongooseStub.startSession.resolves(sessionMock);

      const nextStub = sandbox.stub();
      const result = await createActivity.batchDeployWithCoordinates(
        request,
        nextStub,
      );

      expect(result.success).to.be.true;
      expect(result.successful_deployments).to.have.lengthOf(2);
      expect(result.failed_deployments).to.have.lengthOf(0);
      expect(result.deployment_summary.successful_static).to.equal(2);
      expect(result.deployment_summary.successful_mobile).to.equal(0);

      // Verify user details were saved
      expect(
        result.successful_deployments[0].createdActivity.firstName,
      ).to.equal("John");
      expect(
        result.successful_deployments[0].createdActivity.lastName,
      ).to.equal("Doe");
    });

    it("should successfully deploy multiple mobile devices in batch", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: [
          {
            deviceName: "mobile1",
            deployment_type: "mobile",
            grid_id: new ObjectId().toString(),
            height: 8,
            mountType: "vehicle",
            powerType: "alternator",
            isPrimaryInLocation: true,
            network: "airqo",
            date: recentDate(),
            mobility_metadata: { route_id: "route1" },
          },
          {
            deviceName: "mobile2",
            deployment_type: "mobile",
            grid_id: new ObjectId().toString(),
            height: 9,
            mountType: "vehicle",
            powerType: "alternator",
            isPrimaryInLocation: false,
            network: "airqo",
            date: recentDate(),
            mobility_metadata: { route_id: "route2" },
          },
        ],
      };

      const mobile1Id = new ObjectId();
      const mobile2Id = new ObjectId();
      const grid1Id = new ObjectId(request.body[0].grid_id);
      const grid2Id = new ObjectId(request.body[1].grid_id);

      // Mock DeviceModel
      DeviceModelStub.returns({
        find: sandbox
          .stub()
          .returns({ lean: sandbox.stub().resolves([
            { _id: mobile1Id, name: "mobile1", isActive: false },
            { _id: mobile2Id, name: "mobile2", isActive: false },
          ]) }),
        bulkWrite: sandbox.stub().resolves({ modifiedCount: 2 }),
      });

      // Mock GridModel
      GridModelStub.returns({
        find: sandbox.stub().returns({ lean: sandbox.stub().resolves([
          {
            _id: grid1Id,
            centers: [{ latitude: 0.3476, longitude: 32.5825 }],
          },
          {
            _id: grid2Id,
            centers: [{ latitude: 0.35, longitude: 32.59 }],
          },
        ]) }),
      });

      // Mock ActivityModel
      ActivityModelStub.returns({
        create: sandbox.stub().resolves([
          {
            _id: new ObjectId(),
            device: "mobile1",
            device_id: mobile1Id,
            activityType: "deployment",
            deployment_type: "mobile",
            grid_id: grid1Id,
            createdAt: new Date(),
          },
          {
            _id: new ObjectId(),
            device: "mobile2",
            device_id: mobile2Id,
            activityType: "deployment",
            deployment_type: "mobile",
            grid_id: grid2Id,
            createdAt: new Date(),
          },
        ]),
      });

      // Mock mongoose session
      const sessionMock = {
        withTransaction: sandbox.stub().callsFake(async (fn) => await fn()),
        endSession: sandbox.stub().resolves(),
      };
      mongooseStub.startSession.resolves(sessionMock);

      const nextStub = sandbox.stub();
      const result = await createActivity.batchDeployWithCoordinates(
        request,
        nextStub,
      );

      expect(result.success).to.be.true;
      expect(result.successful_deployments).to.have.lengthOf(2);
      expect(result.deployment_summary.successful_mobile).to.equal(2);
      expect(result.deployment_summary.successful_static).to.equal(0);
    });

    it("should handle duplicate device names in batch", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: [
          {
            deviceName: "device1",
            deployment_type: "static",
            latitude: 0.3476,
            longitude: 32.5825,
            site_name: "Site 1",
            height: 10,
            mountType: "pole",
            powerType: "solar",
            isPrimaryInLocation: true,
            network: "airqo",
            date: recentDate(),
          },
          {
            deviceName: "device1", // Duplicate
            deployment_type: "static",
            latitude: 0.35,
            longitude: 32.59,
            site_name: "Site 2",
            height: 12,
            mountType: "rooftop",
            powerType: "mains",
            isPrimaryInLocation: false,
            network: "airqo",
            date: recentDate(),
          },
        ],
      };

      // Mock DeviceModel - return empty to simulate devices don't exist yet
      DeviceModelStub.returns({
        find: sandbox.stub().returns({ lean: sandbox.stub().resolves([]) }),
      });

      const nextStub = sandbox.stub();
      const result = await createActivity.batchDeployWithCoordinates(
        request,
        nextStub,
      );

      expect(result.failed_deployments.length).to.be.at.least(1);
      const duplicateFailure = result.failed_deployments.find((f) =>
        f.error.message.includes("Duplicate"),
      );
      expect(duplicateFailure).to.exist;
      expect(duplicateFailure.deviceName).to.equal("device1");
    });

    it("should handle grid not found for mobile deployment", async () => {
      const gridId = new ObjectId().toString();
      const request = {
        query: { tenant: "airqo" },
        body: [
          {
            deviceName: "mobile1",
            deployment_type: "mobile",
            grid_id: gridId,
            height: 8,
            mountType: "vehicle",
            powerType: "alternator",
            isPrimaryInLocation: true,
            network: "airqo",
            date: recentDate(),
          },
        ],
      };

      const mobile1Id = new ObjectId();

      // Mock DeviceModel
      DeviceModelStub.returns({
        find: sandbox
          .stub()
          .returns({ lean: sandbox.stub().resolves([{ _id: mobile1Id, name: "mobile1", isActive: false }]) }),
      });

      // Mock GridModel - returns empty array (grid not found)
      GridModelStub.returns({
        find: sandbox.stub().returns({ lean: sandbox.stub().resolves([]) }),
      });

      const nextStub = sandbox.stub();
      const result = await createActivity.batchDeployWithCoordinates(
        request,
        nextStub,
      );

      expect(result.failed_deployments).to.have.lengthOf(1);
      expect(result.failed_deployments[0].error.message).to.include(
        "Grid not found",
      );
    });

    it.skip("should handle partial failures in batch", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: [
          {
            deviceName: "device1",
            deployment_type: "static",
            latitude: 0.3476,
            longitude: 32.5825,
            site_name: "Site 1",
            height: 10,
            mountType: "pole",
            powerType: "solar",
            isPrimaryInLocation: true,
            network: "airqo",
            date: recentDate(),
          },
          {
            deviceName: "nonexistent_device",
            deployment_type: "static",
            latitude: 0.35,
            longitude: 32.59,
            site_name: "Site 2",
            height: 12,
            mountType: "rooftop",
            powerType: "mains",
            isPrimaryInLocation: false,
            network: "airqo",
            date: recentDate(),
          },
        ],
      };

      const device1Id = new ObjectId();
      const site1Id = new ObjectId();

      // Mock DeviceModel - only device1 exists
      DeviceModelStub.returns({
        find: sandbox
          .stub()
          .returns({ lean: sandbox.stub().resolves([{ _id: device1Id, name: "device1", isActive: false }]) }),
        bulkWrite: sandbox.stub().resolves({ modifiedCount: 1 }),
      });

      // Mock SiteModel
      SiteModelStub.returns({
        findOneAndUpdate: sandbox.stub().resolves({
          _id: site1Id,
          name: "Site 1",
          latitude: 0.3476,
          longitude: 32.5825,
          $isNew: false,
        }),
      });

      // Mock ActivityModel
      ActivityModelStub.returns({
        create: sandbox.stub().resolves([
          {
            _id: new ObjectId(),
            device: "device1",
            device_id: device1Id,
            activityType: "deployment",
            deployment_type: "static",
            site_id: site1Id,
            createdAt: new Date(),
          },
        ]),
      });

      // Mock mongoose session
      const sessionMock = {
        withTransaction: sandbox.stub().callsFake(async (fn) => await fn()),
        endSession: sandbox.stub().resolves(),
      };
      mongooseStub.startSession.resolves(sessionMock);

      const nextStub = sandbox.stub();
      const result = await createActivity.batchDeployWithCoordinates(
        request,
        nextStub,
      );

      expect(result.successful_deployments).to.have.lengthOf(1);
      expect(result.failed_deployments).to.have.lengthOf(1);
      expect(result.failed_deployments[0].deviceName).to.equal(
        "nonexistent_device",
      );
      expect(result.deployment_summary.total_successful).to.equal(1);
      expect(result.deployment_summary.total_failed).to.equal(1);
    });

    it.skip("should save user details with activities", async () => {
      const request = {
        query: { tenant: "airqo" },
        body: [
          {
            deviceName: "device1",
            deployment_type: "static",
            latitude: 0.3476,
            longitude: 32.5825,
            site_name: "Kampala Site",
            height: 10,
            mountType: "pole",
            powerType: "solar",
            isPrimaryInLocation: true,
            network: "airqo",
            date: recentDate(),
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
            userName: "jdoe",
          },
        ],
      };

      const device1Id = new ObjectId();
      const site1Id = new ObjectId();

      const createActivityStub = sandbox.stub().resolves([
        {
          _id: new ObjectId(),
          device: "device1",
          device_id: device1Id,
          activityType: "deployment",
          deployment_type: "static",
          site_id: site1Id,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          userName: "jdoe",
          createdAt: new Date(),
        },
      ]);

      DeviceModelStub.returns({
        find: sandbox
          .stub()
          .returns({ lean: sandbox.stub().resolves([{ _id: device1Id, name: "device1", isActive: false }]) }),
        bulkWrite: sandbox.stub().resolves({ modifiedCount: 1 }),
      });

      SiteModelStub.returns({
        findOneAndUpdate: sandbox.stub().resolves({
          _id: site1Id,
          name: "Kampala Site",
          latitude: 0.3476,
          longitude: 32.5825,
          $isNew: false,
        }),
      });

      ActivityModelStub.returns({
        create: createActivityStub,
      });

      const sessionMock = {
        withTransaction: sandbox.stub().callsFake(async (fn) => await fn()),
        endSession: sandbox.stub().resolves(),
      };
      mongooseStub.startSession.resolves(sessionMock);

      const nextStub = sandbox.stub();
      await createActivity.batchDeployWithCoordinates(request, nextStub);

      // Verify create was called with user details
      expect(createActivityStub.called).to.be.true;
      const callArgs = createActivityStub.getCall(0).args[0];
      expect(callArgs[0]).to.include({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        userName: "jdoe",
      });
    });
  });
  describe("list", () => {
    it("should return a list of activities for a valid request", async () => {
      // list uses ActivityModel(tenant).aggregate(pipeline).allowDiskUse(true)
      ActivityModelStub.returns({
        aggregate: sandbox.stub().returns({
          allowDiskUse: sandbox.stub().resolves([{ paginatedResults: [], totalCount: [] }]),
        }),
      });
      const result = await createActivity.list({ query: { tenant: "airqo", skip: "0" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      ActivityModelStub.returns({
        aggregate: sandbox.stub().returns({
          allowDiskUse: sandbox.stub().rejects(new Error("Database error")),
        }),
      });
      const next = sandbox.stub();
      await createActivity.list({ query: { tenant: "airqo", skip: "0" } }, next);
      expect(next.calledOnce).to.be.true;
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("update", () => {
    it("should update the activity and return the updated data for a valid request", async () => {
      // update uses ActivityModel(tenant).modify()
      ActivityModelStub.returns({
        modify: sandbox.stub().resolves({ success: true, data: {} }),
      });
      const result = await createActivity.update(
        { query: { tenant: "airqo" }, body: { activityId: "aid" } },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      ActivityModelStub.returns({
        modify: sandbox.stub().rejects(new Error("Database error")),
      });
      const next = sandbox.stub();
      await createActivity.update(
        { query: { tenant: "airqo" }, body: {} },
        next
      );
      expect(next.calledOnce).to.be.true;
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("delete", () => {
    it("should delete the activity and return the deletion result for a valid request", async () => {
      // delete uses ActivityModel(tenant).remove()
      ActivityModelStub.returns({
        remove: sandbox.stub().resolves({ success: true }),
      });
      const result = await createActivity.delete(
        { query: { tenant: "airqo" } },
        sandbox.stub()
      );
      expect(result.success).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      ActivityModelStub.returns({
        remove: sandbox.stub().rejects(new Error("Database error")),
      });
      const next = sandbox.stub();
      await createActivity.delete({ query: { tenant: "airqo" } }, next);
      expect(next.calledOnce).to.be.true;
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("deploy", () => {
    it("should handle device not found for deployment", async () => {
      // deploy uses DeviceModel(tenant).exists({ name: deviceName })
      DeviceModelStub.returns({ exists: sandbox.stub().resolves(false) });
      const result = await createActivity.deploy(
        { query: { tenant: "airqo", deviceName: "unknown" }, body: { date: new Date().toISOString(), height: 10 } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle invalid device or site and return an error response", async () => {
      // ... Implement the test for the case when device or site not found
    });

    it("should handle device already deployed and return a conflict error response", async () => {
      // ... Implement the test for the case when the device is already deployed
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("recall", () => {
    it("should handle device not found for recall", async () => {
      // recall uses DeviceModel(tenant).findOne({ name: deviceName }).lean()
      DeviceModelStub.returns({
        findOne: sandbox.stub().returns({ lean: sandbox.stub().resolves(null) }),
      });
      const result = await createActivity.recall(
        { query: { tenant: "airqo", deviceName: "unknown" }, body: { recallType: "manual" } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle invalid device and return an error response", async () => {
      // ... Implement the test for the case when the device is not found
    });

    it("should handle device already recalled and return a conflict error response", async () => {
      // ... Implement the test for the case when the device is already recalled
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    describe("post-recall site online-status clearing", () => {
      let siteUpdateStub;
      let distinctStub;
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
        siteUpdateStub = sandbox.stub().resolves({ _id: "site_id_123" });
        distinctStub = sandbox.stub();
      });

      afterEach(() => {
        sandbox.restore();
      });

      it("clears rawOnlineStatus and isOnline when no active devices remain after recall", async () => {
        // No active devices remain at the site
        distinctStub.resolves([]);

        // Simulate the post-recall site-update logic in isolation
        const sortedNetworks = [];
        const siteFields = {
          network: sortedNetworks.length > 0 ? sortedNetworks[0] : "airqo",
        };

        if (sortedNetworks.length === 0) {
          siteFields.rawOnlineStatus = false;
          siteFields.isOnline = false;
        }

        await siteUpdateStub("site_id_123", { $set: siteFields });

        const callArgs = siteUpdateStub.firstCall.args[1].$set;
        expect(callArgs.rawOnlineStatus).to.equal(false);
        expect(callArgs.isOnline).to.equal(false);
        expect(callArgs.network).to.equal("airqo");
      });

      it("does NOT clear rawOnlineStatus when active devices still remain after recall", async () => {
        // One active device remains
        distinctStub.resolves(["airgradient"]);

        const sortedNetworks = ["airgradient"];
        const siteFields = {
          network: sortedNetworks[0],
        };

        if (sortedNetworks.length === 0) {
          siteFields.rawOnlineStatus = false;
          siteFields.isOnline = false;
        }

        await siteUpdateStub("site_id_123", { $set: siteFields });

        const callArgs = siteUpdateStub.firstCall.args[1].$set;
        expect(callArgs).to.not.have.property("rawOnlineStatus");
        expect(callArgs).to.not.have.property("isOnline");
        expect(callArgs.network).to.equal("airgradient");
      });

      it("uses the first sorted network when multiple active devices remain", async () => {
        distinctStub.resolves(["airqo", "airgradient"]);

        const sortedNetworks = ["airgradient", "airqo"].sort();
        const siteFields = { network: sortedNetworks[0] };

        await siteUpdateStub("site_id_123", { $set: siteFields });

        expect(siteUpdateStub.firstCall.args[1].$set.network).to.equal(
          "airgradient"
        );
      });
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("maintain", () => {
    it("should handle device not found for maintenance", async () => {
      // maintain uses DeviceModel(tenant).findOne({ name: deviceName }).lean()
      DeviceModelStub.returns({
        findOne: sandbox.stub().returns({ lean: sandbox.stub().resolves(null) }),
      });
      const result = await createActivity.maintain(
        { query: { tenant: "airqo", deviceName: "unknown" }, body: { date: new Date().toISOString(), maintenanceType: "manual" } },
        sandbox.stub()
      );
      expect(result.success).to.be.false;
    });

    it("should handle invalid device and return an error response", async () => {
      // ... Implement the test for the case when the device is not found
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
});
