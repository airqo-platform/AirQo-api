require("module-alias/register");
const proxyquire = require("proxyquire");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

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
    it("should successfully deploy multiple static devices in batch", async () => {
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
            date: "2024-01-15T10:00:00.000Z",
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
            date: "2024-01-15T11:00:00.000Z",
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
          .resolves([
            { _id: device1Id, name: "device1", isActive: false },
            { _id: device2Id, name: "device2", isActive: false },
          ]),
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
            date: "2024-01-15T10:00:00.000Z",
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
            date: "2024-01-15T11:00:00.000Z",
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
          .resolves([
            { _id: mobile1Id, name: "mobile1", isActive: false },
            { _id: mobile2Id, name: "mobile2", isActive: false },
          ]),
        bulkWrite: sandbox.stub().resolves({ modifiedCount: 2 }),
      });

      // Mock GridModel
      GridModelStub.returns({
        find: sandbox.stub().resolves([
          {
            _id: grid1Id,
            centers: [{ latitude: 0.3476, longitude: 32.5825 }],
          },
          {
            _id: grid2Id,
            centers: [{ latitude: 0.35, longitude: 32.59 }],
          },
        ]),
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
            date: "2024-01-15T10:00:00.000Z",
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
            date: "2024-01-15T11:00:00.000Z",
          },
        ],
      };

      // Mock DeviceModel - return empty to simulate devices don't exist yet
      DeviceModelStub.returns({
        find: sandbox.stub().resolves([]),
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
            date: "2024-01-15T10:00:00.000Z",
          },
        ],
      };

      const mobile1Id = new ObjectId();

      // Mock DeviceModel
      DeviceModelStub.returns({
        find: sandbox
          .stub()
          .resolves([{ _id: mobile1Id, name: "mobile1", isActive: false }]),
      });

      // Mock GridModel - returns empty array (grid not found)
      GridModelStub.returns({
        find: sandbox.stub().resolves([]),
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

    it("should handle partial failures in batch", async () => {
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
            date: "2024-01-15T10:00:00.000Z",
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
            date: "2024-01-15T11:00:00.000Z",
          },
        ],
      };

      const device1Id = new ObjectId();
      const site1Id = new ObjectId();

      // Mock DeviceModel - only device1 exists
      DeviceModelStub.returns({
        find: sandbox
          .stub()
          .resolves([{ _id: device1Id, name: "device1", isActive: false }]),
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

    it("should save user details with activities", async () => {
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
            date: "2024-01-15T10:00:00.000Z",
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
          .resolves([{ _id: device1Id, name: "device1", isActive: false }]),
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
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          skip: "0",
          // Add other required properties for the request object as needed
        },
      };

      // Create a fake response object for testing
      const fakeResponse = {
        success: true,
        data: [
          { id: 1, description: "Activity 1" },
          { id: 2, description: "Activity 2" },
        ],
      };

      // Stub the getModelByTenant function to return the fake response
      const getModelByTenantStub = sinon.stub().resolves(fakeResponse);

      // Replace the real getModelByTenant function with the stub in the createActivity module
      createActivity.getModelByTenant = getModelByTenantStub;

      // Call the list function with the fake request
      const result = await createActivity.list(request);

      // Assertions
      expect(result).to.deep.equal(fakeResponse);
      expect(getModelByTenantStub.calledOnce).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "example_tenant",
          "activity",
          sinon.match.any,
        ),
      ).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          skip: "0",
          // Add other required properties for the request object as needed
        },
      };

      // Stub the getModelByTenant function to throw an error
      const getModelByTenantStub = sinon
        .stub()
        .throws(new Error("Database error"));

      // Replace the real getModelByTenant function with the stub in the createActivity module
      createActivity.getModelByTenant = getModelByTenantStub;

      // Call the list function with the fake request
      const result = await createActivity.list(request);

      // Assertions
      expect(result).to.deep.equal({
        message: "Internal Server Error",
        errors: { message: "Database error" },
        status: 500, // You can also use HTTPStatus.INTERNAL_SERVER_ERROR
      });
      expect(getModelByTenantStub.calledOnce).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "example_tenant",
          "activity",
          sinon.match.any, // You can further customize this match
        ),
      ).to.be.true;
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("update", () => {
    it("should update the activity and return the updated data for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          // Add other required properties for the query object as needed
        },
        body: {
          // Add properties for the update object as needed
          activityId: "activity_id",
          fieldToUpdate: "updated_value",
        },
      };

      // Create a fake response object for testing
      const fakeResponse = {
        success: true,
        data: { id: "activity_id", fieldToUpdate: "updated_value" },
      };

      // Stub the getModelByTenant function to return the fake response
      const getModelByTenantStub = sinon.stub().resolves({
        modify: sinon.stub().resolves(fakeResponse),
      });

      // Replace the real getModelByTenant function with the stub in the createActivity module
      createActivity.getModelByTenant = getModelByTenantStub;

      // Call the update function with the fake request
      const result = await createActivity.update(request);

      // Assertions
      expect(result).to.deep.equal(fakeResponse);
      expect(getModelByTenantStub.calledOnce).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "example_tenant",
          "activity",
          sinon.match.any, // You can further customize this match
        ),
      ).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          // Add other required properties for the query object as needed
        },
        body: {
          // Add properties for the update object as needed
          activityId: "activity_id",
          fieldToUpdate: "updated_value",
        },
      };

      // Stub the getModelByTenant function to throw an error
      const getModelByTenantStub = sinon
        .stub()
        .throws(new Error("Database error"));

      // Replace the real getModelByTenant function with the stub in the createActivity module
      createActivity.getModelByTenant = getModelByTenantStub;

      // Call the update function with the fake request
      const result = await createActivity.update(request);

      // Assertions
      expect(result).to.deep.equal({
        message: "Internal Server Error",
        errors: { message: "Database error" },
        status: 500, // You can also use HTTPStatus.INTERNAL_SERVER_ERROR
        success: false,
      });
      expect(getModelByTenantStub.calledOnce).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "example_tenant",
          "activity",
          sinon.match.any, // You can further customize this match
        ),
      ).to.be.true;
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("delete", () => {
    it("should delete the activity and return the deletion result for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          // Add other required properties for the query object as needed
        },
        // Add properties for the request object as needed
      };

      // Create a fake response object for testing
      const fakeResponse = {
        success: true,
        data: { deletedCount: 1 }, // Sample deletion result
      };

      // Stub the getModelByTenant function to return the fake response
      const getModelByTenantStub = sinon.stub().resolves({
        remove: sinon.stub().resolves(fakeResponse),
      });

      // Replace the real getModelByTenant function with the stub in the createActivity module
      createActivity.getModelByTenant = getModelByTenantStub;

      // Call the delete function with the fake request
      const result = await createActivity.delete(request);

      // Assertions
      expect(result).to.deep.equal(fakeResponse);
      expect(getModelByTenantStub.calledOnce).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "example_tenant",
          "activity",
          sinon.match.any, // You can further customize this match
        ),
      ).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          // Add other required properties for the query object as needed
        },
        // Add properties for the request object as needed
      };

      // Stub the getModelByTenant function to throw an error
      const getModelByTenantStub = sinon
        .stub()
        .throws(new Error("Database error"));

      // Replace the real getModelByTenant function with the stub in the createActivity module
      createActivity.getModelByTenant = getModelByTenantStub;

      // Call the delete function with the fake request
      const result = await createActivity.delete(request);

      // Assertions
      expect(result).to.deep.equal({
        message: "Internal Server Error",
        errors: { message: "Database error" },
        status: 500, // You can also use HTTPStatus.INTERNAL_SERVER_ERROR
      });
      expect(getModelByTenantStub.calledOnce).to.be.true;
      expect(
        getModelByTenantStub.calledWithExactly(
          "example_tenant",
          "activity",
          sinon.match.any, // You can further customize this match
        ),
      ).to.be.true;
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("deploy", () => {
    it("should deploy the device and return the deployment result for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          deviceName: "example_device",
          // Add other required properties for the query object as needed
        },
        body: {
          date: "2023-07-04", // Provide the date in the desired format
          height: 10, // Provide other required properties for the body object
          // ...
        },
        // Add properties for the request object as needed
      };

      // Sample fake responses from the database
      const fakeDeviceExistsResponse = true;
      const fakeSiteExistsResponse = true;
      const fakeDeviceSearchExistResponse = {
        success: false,
        // Add other properties as needed
      };
      const fakeListSiteResponse = {
        success: true,
        data: [{ latitude: 40.7128, longitude: -74.006 }], // Sample site data
      };
      const fakeRegisterActivityResponse = {
        success: true,
        data: {
          createdActivity: {
            /* Sample activity data */
          },
        },
      };
      const fakeUpdateDeviceResponse = {
        success: true,
        data: {
          updatedDevice: {
            /* Sample updated device data */
          },
        },
      };

      // Stub the required functions to return the fake responses
      const existsStub = sinon.stub().resolves(fakeDeviceExistsResponse);
      const siteExistsStub = sinon.stub().resolves(fakeSiteExistsResponse);
      const searchDeviceStub = sinon
        .stub()
        .resolves(fakeDeviceSearchExistResponse);
      const listSiteStub = sinon.stub().resolves(fakeListSiteResponse);
      const registerActivityStub = sinon
        .stub()
        .resolves(fakeRegisterActivityResponse);
      const updateDeviceStub = sinon.stub().resolves(fakeUpdateDeviceResponse);

      // Stub the getModelByTenant function to return fake model methods
      const getModelByTenantStub = sinon.stub();
      getModelByTenantStub
        .withArgs("example_tenant", "device")
        .returns({ exists: existsStub });
      getModelByTenantStub
        .withArgs("example_tenant", "site")
        .returns({ exists: siteExistsStub });
      getModelByTenantStub
        .withArgs("example_tenant", "activity")
        .returns({ register: registerActivityStub });

      // Replace the real functions with the stubs in the createActivity module
      createActivity.DeviceModel = getModelByTenantStub;
      createActivity.SiteModel = getModelByTenantStub;
      createActivity.doesDeviceSearchExist = searchDeviceStub;
      createActivity.createSiteUtil.list = listSiteStub;
      createActivity.createDeviceUtil.updateOnPlatform = updateDeviceStub;

      // Call the deploy function with the fake request
      const result = await createActivity.deploy(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully deployed the device");
      expect(result.data.createdActivity).to.exist;
      expect(result.data.updatedDevice).to.exist;

      // Check if the stubbed functions were called with the correct arguments
      expect(existsStub.calledWithExactly({ name: "example_device" })).to.be
        .true;
      expect(siteExistsStub.calledWithExactly({ _id: sinon.match.any })).to.be
        .true;
      expect(searchDeviceStub.calledWithExactly(sinon.match.any)).to.be.true;
      expect(
        listSiteStub.calledWithExactly({
          tenant: "example_tenant",
          filter: sinon.match.any,
        }),
      ).to.be.true;
      expect(registerActivityStub.calledWithExactly(sinon.match.any)).to.be
        .true;
      expect(updateDeviceStub.calledWithExactly(sinon.match.any)).to.be.true;
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
    it("should recall the device and return the recall result for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          deviceName: "example_device",
          // Add other required properties for the query object as needed
        },
        body: {
          recallType: "example_recall_type", // Provide the recallType in the desired format
          // Add other required properties for the body object as needed
        },
        // Add properties for the request object as needed
      };

      // Sample fake responses from the database
      const fakeDeviceExistsResponse = true;
      const fakeDeviceSearchExistResponse = {
        success: false,
        // Add other properties as needed
      };
      const fakeListDeviceResponse = {
        success: true,
        data: [{ site: { _id: "example_site_id" } }], // Sample device data with a site
      };
      const fakeRegisterActivityResponse = {
        success: true,
        data: {
          createdActivity: {
            /* Sample activity data */
          },
        },
      };
      const fakeUpdateDeviceResponse = {
        success: true,
        data: {
          updatedDevice: {
            /* Sample updated device data */
          },
        },
      };

      // Stub the required functions to return the fake responses
      const existsStub = sinon.stub().resolves(fakeDeviceExistsResponse);
      const searchDeviceStub = sinon
        .stub()
        .resolves(fakeDeviceSearchExistResponse);
      const listDeviceStub = sinon.stub().resolves(fakeListDeviceResponse);
      const registerActivityStub = sinon
        .stub()
        .resolves(fakeRegisterActivityResponse);
      const updateDeviceStub = sinon.stub().resolves(fakeUpdateDeviceResponse);

      // Stub the getModelByTenant function to return fake model methods
      const getModelByTenantStub = sinon.stub();
      getModelByTenantStub
        .withArgs("example_tenant", "device")
        .returns({ exists: existsStub });

      // Replace the real functions with the stubs in the createActivity module
      createActivity.DeviceModel = getModelByTenantStub;
      createActivity.doesDeviceSearchExist = searchDeviceStub;
      createActivity.createDeviceUtil.list = listDeviceStub;
      createActivity.createDeviceUtil.updateOnPlatform = updateDeviceStub;

      // Call the recall function with the fake request
      const result = await createActivity.recall(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully recalled the device");
      expect(result.data.createdActivity).to.exist;
      expect(result.data.updatedDevice).to.exist;

      // Check if the stubbed functions were called with the correct arguments
      expect(existsStub.calledWithExactly({ name: "example_device" })).to.be
        .true;
      expect(searchDeviceStub.calledWithExactly(sinon.match.any)).to.be.true;
      expect(listDeviceStub.calledWithExactly(sinon.match.any)).to.be.true;
      expect(registerActivityStub.calledWithExactly(sinon.match.any)).to.be
        .true;
      expect(updateDeviceStub.calledWithExactly(sinon.match.any)).to.be.true;
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

    // Add more test cases as needed to cover different scenarios
  });
  describe("maintain", () => {
    it("should maintain the device and return the maintenance result for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          deviceName: "example_device",
          // Add other required properties for the query object as needed
        },
        body: {
          date: "2023-07-04T00:00:00.000Z", // Provide the date in the desired format
          tags: ["tag1", "tag2"], // Sample tags
          description: "Maintenance description", // Provide the description in the desired format
          site_id: "example_site_id",
          maintenanceType: "example_maintenance_type", // Provide the maintenanceType in the desired format
          network: "example_network", // Provide the network in the desired format
          // Add other required properties for the body object as needed
        },
        // Add properties for the request object as needed
      };

      // Sample fake responses from the database
      const fakeDeviceExistsResponse = true;
      const fakeRegisterActivityResponse = {
        success: true,
        data: {
          createdActivity: {
            /* Sample activity data */
          },
        },
      };
      const fakeUpdateDeviceResponse = {
        success: true,
        data: {
          updatedDevice: {
            /* Sample updated device data */
          },
        },
      };

      // Stub the required functions to return the fake responses
      const existsStub = sinon.stub().resolves(fakeDeviceExistsResponse);
      const registerActivityStub = sinon
        .stub()
        .resolves(fakeRegisterActivityResponse);
      const updateDeviceStub = sinon.stub().resolves(fakeUpdateDeviceResponse);

      // Stub the getModelByTenant function to return fake model methods
      const getModelByTenantStub = sinon.stub();
      getModelByTenantStub
        .withArgs("example_tenant", "device")
        .returns({ exists: existsStub });

      // Replace the real functions with the stubs in the createActivity module
      createActivity.DeviceModel = getModelByTenantStub;
      createActivity.createDeviceUtil.updateOnPlatform = updateDeviceStub;

      // Call the maintain function with the fake request
      const result = await createActivity.maintain(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully maintained the device");
      expect(result.data.createdActivity).to.exist;
      expect(result.data.updatedDevice).to.exist;

      // Check if the stubbed functions were called with the correct arguments
      expect(existsStub.calledWithExactly({ name: "example_device" })).to.be
        .true;
      expect(registerActivityStub.calledWithExactly(sinon.match.any)).to.be
        .true;
      expect(updateDeviceStub.calledWithExactly(sinon.match.any)).to.be.true;
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
