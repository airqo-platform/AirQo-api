require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const defaults = require("@utils/create-default");
const { getModelByTenant } = require("@config/database");
const DefaultsSchema = require("@models/Defaults");

describe("defaults", () => {
  describe("list method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list defaults and send success response", async () => {
      const tenant = "sample_tenant";
      const filter = {}; // Add any required filter for the list method
      const limit = 10;
      const skip = 0;

      // Mock the response from the DefaultsSchema list method (success)
      const mockListResponse = {
        success: true,
        data: [
          // Sample default objects returned by the DefaultsSchema.list method
        ],
      };
      sinon.stub(DefaultsSchema, "list").resolves(mockListResponse);

      // Mock the getModelByTenant function to return the DefaultsSchema
      sinon
        .stub(getModelByTenant, "call")
        .withArgs(tenant.toLowerCase(), "default", DefaultsSchema)
        .returns(DefaultsSchema);

      // Call the list method
      const result = await defaults.list(tenant, filter, limit, skip);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockListResponse.data);
    });

    it("should handle DefaultsSchema list failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = {}; // Add any required filter for the list method
      const limit = 10;
      const skip = 0;

      // Mock the response from the DefaultsSchema list method (failure)
      sinon.stub(DefaultsSchema, "list").resolves({
        success: false,
        message: "Failed to list defaults",
      });

      // Mock the getModelByTenant function to return the DefaultsSchema
      sinon
        .stub(getModelByTenant, "call")
        .withArgs(tenant.toLowerCase(), "default", DefaultsSchema)
        .returns(DefaultsSchema);

      // Call the list method
      const result = await defaults.list(tenant, filter, limit, skip);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to list defaults");
    });

    it("should handle exceptions and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = {}; // Add any required filter for the list method
      const limit = 10;
      const skip = 0;

      // Mock the getModelByTenant function to throw an exception
      sinon
        .stub(getModelByTenant, "call")
        .throws(new Error("Mocked database error"));

      // Call the list method
      const result = await defaults.list(tenant, filter, limit, skip);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("utils server errors");
      expect(result.errors).to.equal("Mocked database error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("create method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create a new default and send success response", async () => {
      const tenant = "sample_tenant";
      const body = {
        // Add the necessary properties for creating a new default
      };

      // Mock the response from the DefaultsSchema register method (success)
      const mockRegisterResponse = {
        success: true,
        data: {
          // Sample created default object returned by the DefaultsSchema.register method
        },
      };
      sinon.stub(DefaultsSchema, "register").resolves(mockRegisterResponse);

      // Mock the getModelByTenant function to return the DefaultsSchema
      sinon
        .stub(getModelByTenant, "call")
        .withArgs(tenant.toLowerCase(), "default", DefaultsSchema)
        .returns(DefaultsSchema);

      // Call the create method
      const result = await defaults.create({ body, query: { tenant } });

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockRegisterResponse.data);
    });

    it("should handle DefaultsSchema register failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const body = {
        // Add the necessary properties for creating a new default
      };

      // Mock the response from the DefaultsSchema register method (failure)
      sinon.stub(DefaultsSchema, "register").resolves({
        success: false,
        message: "Failed to create default",
      });

      // Mock the getModelByTenant function to return the DefaultsSchema
      sinon
        .stub(getModelByTenant, "call")
        .withArgs(tenant.toLowerCase(), "default", DefaultsSchema)
        .returns(DefaultsSchema);

      // Call the create method
      const result = await defaults.create({ body, query: { tenant } });

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create default");
    });

    it("should handle exceptions and return failure response", async () => {
      const tenant = "sample_tenant";
      const body = {
        // Add the necessary properties for creating a new default
      };

      // Mock the getModelByTenant function to throw an exception
      sinon
        .stub(getModelByTenant, "call")
        .throws(new Error("Mocked database error"));

      // Call the create method
      const result = await defaults.create({ body, query: { tenant } });

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("defaults util server errors");
      expect(result.errors).to.equal("Mocked database error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("update method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update the default and send success response", async () => {
      const tenant = "sample_tenant";
      const filter = {
        // Add the filter properties for identifying the default to update
      };
      const update = {
        // Add the properties to update in the default
      };

      // Mock the response from the DefaultsSchema modify method (success)
      const mockModifyResponse = {
        success: true,
        data: {
          // Sample updated default object returned by the DefaultsSchema.modify method
        },
      };
      sinon.stub(DefaultsSchema, "modify").resolves(mockModifyResponse);

      // Mock the getModelByTenant function to return the DefaultsSchema
      sinon
        .stub(getModelByTenant, "call")
        .withArgs(tenant.toLowerCase(), "default", DefaultsSchema)
        .returns(DefaultsSchema);

      // Call the update method
      const result = await defaults.update(tenant, filter, update);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockModifyResponse.data);
    });

    it("should handle DefaultsSchema modify failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = {
        // Add the filter properties for identifying the default to update
      };
      const update = {
        // Add the properties to update in the default
      };

      // Mock the response from the DefaultsSchema modify method (failure)
      sinon.stub(DefaultsSchema, "modify").resolves({
        success: false,
        message: "Failed to update default",
      });

      // Mock the getModelByTenant function to return the DefaultsSchema
      sinon
        .stub(getModelByTenant, "call")
        .withArgs(tenant.toLowerCase(), "default", DefaultsSchema)
        .returns(DefaultsSchema);

      // Call the update method
      const result = await defaults.update(tenant, filter, update);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update default");
    });

    it("should handle exceptions and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = {
        // Add the filter properties for identifying the default to update
      };
      const update = {
        // Add the properties to update in the default
      };

      // Mock the getModelByTenant function to throw an exception
      sinon
        .stub(getModelByTenant, "call")
        .throws(new Error("Mocked database error"));

      // Call the update method
      const result = await defaults.update(tenant, filter, update);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("defaults util server errors");
      expect(result.errors).to.equal("Mocked database error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("delete method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete the default and send success response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.defaults function (success)
      const mockGenerateFilterResponse = {
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.defaults function
        },
      };
      sinon
        .stub(generateFilter, "defaults")
        .returns(mockGenerateFilterResponse);

      // Mock the response from the DefaultsSchema remove method (success)
      const mockRemoveResponse = {
        success: true,
        data: {
          // Sample data object returned by the DefaultsSchema remove method
        },
      };
      sinon.stub(DefaultsSchema, "remove").resolves(mockRemoveResponse);

      // Call the delete method
      const result = await defaults.delete(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockRemoveResponse.data);
    });

    it("should handle DefaultsSchema remove failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.defaults function (success)
      sinon.stub(generateFilter, "defaults").returns({
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.defaults function
        },
      });

      // Mock the response from the DefaultsSchema remove method (failure)
      sinon.stub(DefaultsSchema, "remove").resolves({
        success: false,
        message: "Failed to delete default",
      });

      // Call the delete method
      const result = await defaults.delete(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to delete default");
    });

    it("should handle generateFilter.defaults failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.defaults function (failure)
      sinon.stub(generateFilter, "defaults").returns({
        success: false,
        message: "Invalid filter",
      });

      // Call the delete method
      const result = await defaults.delete(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter");
    });
  });
});
