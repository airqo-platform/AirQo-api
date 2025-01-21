require("module-alias/register");
const createActivity = require("@utils/create-activity");
const { expect } = require("chai");
const sinon = require("sinon");

describe("createActivity", () => {
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
          sinon.match.any // You can further customize this match
        )
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
          sinon.match.any // You can further customize this match
        )
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
          sinon.match.any // You can further customize this match
        )
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
          sinon.match.any // You can further customize this match
        )
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
          sinon.match.any // You can further customize this match
        )
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
          sinon.match.any // You can further customize this match
        )
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
        })
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
