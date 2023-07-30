require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");

const locationHistories = require("@models/locationHistory");
const LocationHistoryModel = require("@models/LocationHistory");

describe("locationHistories", () => {
  describe("sample method", () => {
    it("should do something", async () => {
      // Implement test case for the sample method
      // Mock any dependencies or request objects if needed
    });

    // Add more test cases if needed
  });

  describe("list method", () => {
    it("should return a list of location histories", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the filter generation function
      sinon.stub(generateFilter, "location_histories").returns({
        success: true,
        filter: {
          /* mocked filter data */
        },
      });

      // Mock the LocationHistoryModel.list method
      const responseFromListLocationHistoriesPromise = Promise.resolve({
        success: true,
        data: [
          /* mocked location histories */
        ],
      });
      sinon
        .stub(LocationHistoryModel("test_tenant"), "list")
        .returns(responseFromListLocationHistoriesPromise);

      // Call the method
      const result = await locationHistories.list(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result).to.have.property("data").that.is.an("array");
      // Add more assertions for the response data if needed

      // Restore the stubs
      generateFilter.location_histories.restore();
      LocationHistoryModel("test_tenant").list.restore();
    });

    it("should return the filter error if generateFilter.location_histories returns success as false", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the filter generation function to return an error
      sinon.stub(generateFilter, "location_histories").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });

      // Call the method
      const result = await locationHistories.list(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal("Invalid filter");

      // Restore the stubs
      generateFilter.location_histories.restore();
    });

    it("should handle internal server error and return appropriate response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the filter generation function
      sinon.stub(generateFilter, "location_histories").returns({
        success: true,
        filter: {
          /* mocked filter data */
        },
      });

      // Mock the LocationHistoryModel.list method to throw an error
      const errorMessage = "Database connection error";
      sinon
        .stub(LocationHistoryModel("test_tenant"), "list")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await locationHistories.list(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Internal Server Error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal(errorMessage);

      // Restore the stubs
      generateFilter.location_histories.restore();
      LocationHistoryModel("test_tenant").list.restore();
    });
  });

  describe("delete method", () => {
    it("should delete location histories and return success response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the filter generation function
      sinon.stub(generateFilter, "location_histories").returns({
        success: true,
        filter: {
          /* mocked filter data */
        },
      });

      // Mock the LocationHistoryModel.remove method
      const responseFromDeleteLocationHistoriesPromise = Promise.resolve({
        success: true,
        message: "Location histories deleted successfully",
        data: [
          /* mocked deleted location histories */
        ],
      });
      sinon
        .stub(LocationHistoryModel("test_tenant"), "remove")
        .returns(responseFromDeleteLocationHistoriesPromise);

      // Call the method
      const result = await locationHistories.delete(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("message")
        .that.is.a("string")
        .that.equals("Location histories deleted successfully");
      expect(result).to.have.property("data").that.is.an("array");
      // Add more assertions for the response data if needed

      // Restore the stubs
      generateFilter.location_histories.restore();
      LocationHistoryModel("test_tenant").remove.restore();
    });

    it("should return the filter error if generateFilter.location_histories returns success as false", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the filter generation function to return an error
      sinon.stub(generateFilter, "location_histories").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });

      // Call the method
      const result = await locationHistories.delete(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal("Invalid filter");

      // Restore the stubs
      generateFilter.location_histories.restore();
    });

    it("should handle internal server error and return appropriate response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
      };

      // Mock the filter generation function
      sinon.stub(generateFilter, "location_histories").returns({
        success: true,
        filter: {
          /* mocked filter data */
        },
      });

      // Mock the LocationHistoryModel.remove method to throw an error
      const errorMessage = "Database connection error";
      sinon
        .stub(LocationHistoryModel("test_tenant"), "remove")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await locationHistories.delete(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Internal Server Error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal(errorMessage);

      // Restore the stubs
      generateFilter.location_histories.restore();
      LocationHistoryModel("test_tenant").remove.restore();
    });
  });

  describe("update method", () => {
    it("should update location histories and return success response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        body: {
          /* mocked update data */
        },
      };

      // Mock the filter generation function
      sinon.stub(generateFilter, "location_histories").returns({
        success: true,
        filter: {
          /* mocked filter data */
        },
      });

      // Mock the LocationHistoryModel.modify method
      const responseFromUpdateLocationHistoriesPromise = Promise.resolve({
        success: true,
        message: "Location histories updated successfully",
        data: {
          /* mocked updated location histories */
        },
      });
      sinon
        .stub(LocationHistoryModel("test_tenant"), "modify")
        .returns(responseFromUpdateLocationHistoriesPromise);

      // Call the method
      const result = await locationHistories.update(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("message")
        .that.is.a("string")
        .that.equals("Location histories updated successfully");
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions for the response data if needed

      // Restore the stubs
      generateFilter.location_histories.restore();
      LocationHistoryModel("test_tenant").modify.restore();
    });

    it("should return the filter error if generateFilter.location_histories returns success as false", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        body: {
          /* mocked update data */
        },
      };

      // Mock the filter generation function to return an error
      sinon.stub(generateFilter, "location_histories").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });

      // Call the method
      const result = await locationHistories.update(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal("Invalid filter");

      // Restore the stubs
      generateFilter.location_histories.restore();
    });

    it("should handle internal server error and return appropriate response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        body: {
          /* mocked update data */
        },
      };

      // Mock the filter generation function
      sinon.stub(generateFilter, "location_histories").returns({
        success: true,
        filter: {
          /* mocked filter data */
        },
      });

      // Mock the LocationHistoryModel.modify method to throw an error
      const errorMessage = "Database connection error";
      sinon
        .stub(LocationHistoryModel("test_tenant"), "modify")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await locationHistories.update(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Internal Server Error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal(errorMessage);

      // Restore the stubs
      generateFilter.location_histories.restore();
      LocationHistoryModel("test_tenant").modify.restore();
    });
  });

  describe("create method", () => {
    it("should create a new location history and return success response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        body: {
          /* mocked location history data */
        },
      };

      // Mock the LocationHistoryModel.register method
      const responseFromCreateLocationHistoryPromise = Promise.resolve({
        success: true,
        message: "Location history created successfully",
        data: {
          /* mocked new location history */
        },
      });
      sinon
        .stub(LocationHistoryModel("test_tenant"), "register")
        .returns(responseFromCreateLocationHistoryPromise);

      // Call the method
      const result = await locationHistories.create(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("message")
        .that.is.a("string")
        .that.equals("Location history created successfully");
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions for the response data if needed

      // Restore the stubs
      LocationHistoryModel("test_tenant").register.restore();
    });

    it("should handle internal server error and return appropriate response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        body: {
          /* mocked location history data */
        },
      };

      // Mock the LocationHistoryModel.register method to throw an error
      const errorMessage = "Database connection error";
      sinon
        .stub(LocationHistoryModel("test_tenant"), "register")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await locationHistories.create(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Internal Server Error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal(errorMessage);

      // Restore the stubs
      LocationHistoryModel("test_tenant").register.restore();
    });
  });
  describe("syncLocationHistories method", () => {
    it("should synchronize location histories and return success response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        body: {
          location_histories: [
            /* mocked location history data */
          ],
        },
        params: {
          firebase_user_id: "test_user_id",
        },
      };

      // Mock the LocationHistoryModel.list and LocationHistoryModel.register methods
      const unsyncedLocationHistories = [
        /* mocked unsynced location history data */
      ];
      const synchronizedLocationHistories = [
        /* mocked synchronized location history data */
      ];
      const responseFromListLocationHistoriesPromise = Promise.resolve({
        success: true,
        data: unsyncedLocationHistories,
      });
      const responseFromRegisterLocationHistoryPromise = Promise.resolve({
        success: true,
        message: "Location history created successfully",
        data: [] /* mocked new location history */,
      });

      sinon
        .stub(LocationHistoryModel("test_tenant"), "list")
        .returns(responseFromListLocationHistoriesPromise);
      sinon
        .stub(LocationHistoryModel("test_tenant"), "register")
        .returns(responseFromRegisterLocationHistoryPromise);

      // Call the method
      const result = await locationHistories.syncLocationHistories(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("message")
        .that.is.a("string")
        .that.equals("Location Histories Synchronized");
      expect(result).to.have.property("data").that.is.an("array");
      // Add more assertions for the response data if needed

      // Restore the stubs
      LocationHistoryModel("test_tenant").list.restore();
      LocationHistoryModel("test_tenant").register.restore();
    });

    it("should handle internal server error and return appropriate response", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        body: {
          location_histories: [
            /* mocked location history data */
          ],
        },
        params: {
          firebase_user_id: "test_user_id",
        },
      };

      // Mock the LocationHistoryModel.list method to throw an error
      const errorMessage = "Database connection error";
      sinon
        .stub(LocationHistoryModel("test_tenant"), "list")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await locationHistories.syncLocationHistories(request);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Internal Server Error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors.message).to.equal(errorMessage);

      // Restore the stubs
      LocationHistoryModel("test_tenant").list.restore();
    });
  });
});
