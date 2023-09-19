require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const NetworkModel = require("@models/Network");

describe("NetworkSchema statics", () => {
  describe("register method", () => {
    it("should create a new Network and return success message", async () => {
      // Mock input data for the Network to be created
      const args = {
        net_email: "test@example.com",
        net_name: "Test Network",
        net_description: "Test description",
        net_acronym: "TN",
      };

      // Mock the Network.create method to return a successful result
      const createStub = sinon.stub(NetworkModel, "create").resolves(args);

      // Call the register method
      const result = await NetworkModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("network created");
      expect(result.data).to.deep.equal(args);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return success message with empty data if the Network is not created", async () => {
      // Mock input data for the Network (this time we'll return an empty data array)
      const args = {
        net_email: "test@example.com",
        net_name: "Test Network",
        net_description: "Test description",
        net_acronym: "TN",
      };

      // Mock the Network.create method to return an empty data array
      const createStub = sinon.stub(NetworkModel, "create").resolves([]);

      // Call the register method
      const result = await NetworkModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "network NOT successfully created but operation successful"
      );
      expect(result.data).to.be.an("array").that.is.empty;

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Network creation encounters duplicate keys", async () => {
      // Mock input data for the Network with duplicate keys (net_name and net_acronym)
      const args = {
        net_email: "test@example.com",
        net_name: "Test Network",
        net_description: "Test description",
        net_acronym: "TN",
      };

      // Mock the Network.create method to throw a duplicate key error
      const createStub = sinon.stub(NetworkModel, "create").throws({
        code: 11000,
        keyValue: { net_name: "Test Network" },
      });

      // Call the register method
      const result = await NetworkModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        net_name: "Test Network should be unique!",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Network creation encounters other validation errors", async () => {
      // Mock input data for the Network with invalid values
      const args = {
        net_email: "invalid_email", // Invalid email
        net_name: "", // Empty net_name (invalid)
        net_description: "Test description",
        net_acronym: "TN",
      };

      // Mock the Network.create method to throw a validation error
      const createStub = sinon.stub(NetworkModel, "create").throws({
        errors: {
          net_email: {
            message: "invalid_email is not a valid email!",
          },
          net_name: {
            message: "net_name is required",
          },
        },
      });

      // Call the register method
      const result = await NetworkModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        net_email: "invalid_email is not a valid email!",
        net_name: "net_name is required",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      createStub.restore();
    });

    // Add more test cases to cover additional scenarios
  });

  describe("list method", () => {
    it("should return a list of network details with successful response", async () => {
      // Mock input data for the filter
      const filter = { category: "test_category" };
      const skip = 0;
      const limit = 10;
      const responseMock = [
        // Add mock data here for the expected response
        {
          _id: "id1",
          net_email: "test1@example.com",
          // other properties...
        },
        {
          _id: "id2",
          net_email: "test2@example.com",
          // other properties...
        },
      ];

      // Mock the aggregate method of the NetworkModel to return the responseMock
      const aggregateStub = sinon
        .stub(NetworkModel, "aggregate")
        .resolves(responseMock);

      // Call the list method
      const result = await NetworkModel.list({ skip, limit, filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved the network details"
      );
      expect(result.data).to.deep.equal(responseMock);
      expect(result.status).to.equal(200);

      // Restore the stubbed method
      aggregateStub.restore();
    });

    it("should return an empty list with successful response if no network details found", async () => {
      // Mock input data for the filter
      const filter = { category: "non_existent_category" };
      const skip = 0;
      const limit = 10;

      // Mock the aggregate method of the NetworkModel to return an empty array
      const aggregateStub = sinon.stub(NetworkModel, "aggregate").resolves([]);

      // Call the list method
      const result = await NetworkModel.list({ skip, limit, filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "No network details exist for this operation, please crosscheck"
      );
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(200);

      // Restore the stubbed method
      aggregateStub.restore();
    });

    it("should return an error response if there are validation errors", async () => {
      // Mock input data for the filter
      const filter = { category: "test_category" };
      const skip = 0;
      const limit = 10;

      // Mock the aggregate method of the NetworkModel to throw a validation error
      const aggregateStub = sinon
        .stub(NetworkModel, "aggregate")
        .throws(new Error("Validation error"));

      // Call the list method
      const result = await NetworkModel.list({ skip, limit, filter });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "validation errors for some of the provided fields",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      aggregateStub.restore();
    });

    // Add more test cases to cover other scenarios

    it("should handle the filter with empty category properly", async () => {
      // Mock input data for the filter
      const filter = { category: "" };
      const skip = 0;
      const limit = 10;
      const responseMock = [
        // Add mock data here for the expected response
        {
          _id: "id1",
          net_email: "test1@example.com",
          // other properties...
        },
        {
          _id: "id2",
          net_email: "test2@example.com",
          // other properties...
        },
      ];

      // Mock the aggregate method of the NetworkModel to return the responseMock
      const aggregateStub = sinon
        .stub(NetworkModel, "aggregate")
        .resolves(responseMock);

      // Call the list method
      const result = await NetworkModel.list({ skip, limit, filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved the network details"
      );
      expect(result.data).to.deep.equal(responseMock);
      expect(result.status).to.equal(200);

      // Ensure that the category filter is properly handled
      expect(aggregateStub.calledOnce).to.be.true;
      expect(aggregateStub.firstCall.args[0].$match).to.deep.equal({}); // Check that category filter is not included in the $match pipeline

      // Restore the stubbed method
      aggregateStub.restore();
    });
  });

  describe("modify method", () => {
    it("should modify the network and return the updated network details", async () => {
      // Mock input data for the filter and update
      const filter = { _id: "network_id" };
      const update = { net_name: "Updated Network" };
      const options = { new: true };
      const modifiedUpdate = {
        $set: {
          net_name: "Updated Network",
        },
      };

      // Mock the findOneAndUpdate method of the NetworkModel to return the updated network
      const findOneAndUpdateStub = sinon
        .stub(NetworkModel, "findOneAndUpdate")
        .resolves({
          _id: "network_id",
          net_name: "Updated Network",
          // other properties...
        });

      // Call the modify method
      const result = await NetworkModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the network");
      expect(result.data).to.deep.equal({
        _id: "network_id",
        net_name: "Updated Network",
        // other properties...
      });
      expect(result.status).to.equal(200);

      // Ensure that the findOneAndUpdate method is called with the correct arguments
      expect(
        findOneAndUpdateStub.calledOnceWith(filter, modifiedUpdate, options)
      ).to.be.true;

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });

    it("should return an error response if network does not exist", async () => {
      // Mock input data for the filter and update
      const filter = { _id: "non_existent_network_id" };
      const update = { net_name: "Updated Network" };

      // Mock the findOneAndUpdate method of the NetworkModel to return null (network not found)
      const findOneAndUpdateStub = sinon
        .stub(NetworkModel, "findOneAndUpdate")
        .resolves(null);

      // Call the modify method
      const result = await NetworkModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("No networks exist for this operation");
      expect(result.data).to.be.undefined;
      expect(result.status).to.equal(200);
      expect(result.errors.message).to.equal(
        "No networks exist for this operation"
      );

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });

    it("should handle validation errors properly and return an error response", async () => {
      // Mock input data for the filter and update
      const filter = { _id: "network_id" };
      const update = { net_name: "Updated Network" };

      // Mock the findOneAndUpdate method of the NetworkModel to throw a validation error
      const findOneAndUpdateStub = sinon
        .stub(NetworkModel, "findOneAndUpdate")
        .throws(new Error("Validation error"));

      // Call the modify method
      const result = await NetworkModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "validation errors for some of the provided fields",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });

    // Add more test cases to cover other scenarios

    it("should handle unauthorized access properly and return an error response", async () => {
      // Mock input data for the filter and update
      const filter = { _id: "network_id" };
      const update = { net_name: "Updated Network" };

      // Mock the findOneAndUpdate method of the NetworkModel to throw an unauthorized error
      const findOneAndUpdateStub = sinon
        .stub(NetworkModel, "findOneAndUpdate")
        .throws(new Error("Unauthorized"));

      // Call the modify method
      const result = await NetworkModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors.message).to.equal(
        "Unauthorized to carry out this operation"
      );
      expect(result.message).to.equal(
        "Unauthorized to carry out this operation"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove the network and return the removed network details", async () => {
      // Mock input data for the filter
      const filter = { _id: "network_id" };
      const options = {
        projection: {
          _id: 1,
          net_email: 1,
          net_website: 1,
          net_name: 1,
          net_manager: 1,
        },
      };

      // Mock the findOneAndRemove method of the NetworkModel to return the removed network
      const findOneAndRemoveStub = sinon
        .stub(NetworkModel, "findOneAndRemove")
        .resolves({
          _id: "network_id",
          net_name: "Removed Network",
          // other properties...
        });

      // Call the remove method
      const result = await NetworkModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the network");
      expect(result.data).to.deep.equal({
        _id: "network_id",
        net_email: "removed_network_email@example.com",
        net_website: "https://www.removed-network-website.com",
        net_name: "Removed Network",
        net_manager: "network_manager_id",
        // other properties...
      });
      expect(result.status).to.equal(200);

      // Ensure that the findOneAndRemove method is called with the correct arguments
      expect(findOneAndRemoveStub.calledOnceWith(filter, options)).to.be.true;

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });

    it("should return an error response if network does not exist", async () => {
      // Mock input data for the filter
      const filter = { _id: "non_existent_network_id" };

      // Mock the findOneAndRemove method of the NetworkModel to return null (network not found)
      const findOneAndRemoveStub = sinon
        .stub(NetworkModel, "findOneAndRemove")
        .resolves(null);

      // Call the remove method
      const result = await NetworkModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "Network does not exist for this operation"
      );
      expect(result.data).to.be.undefined;
      expect(result.status).to.equal(200);
      expect(result.errors.message).to.equal(
        "Network does not exist for this operation"
      );

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });

    it("should handle validation errors properly and return an error response", async () => {
      // Mock input data for the filter
      const filter = { _id: "network_id" };

      // Mock the findOneAndRemove method of the NetworkModel to throw a validation error
      const findOneAndRemoveStub = sinon
        .stub(NetworkModel, "findOneAndRemove")
        .throws(new Error("Validation error"));

      // Call the remove method
      const result = await NetworkModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "validation errors for some of the provided fields",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });

    // Add more test cases to cover other scenarios

    it("should handle unauthorized access properly and return an error response", async () => {
      // Mock input data for the filter
      const filter = { _id: "network_id" };

      // Mock the findOneAndRemove method of the NetworkModel to throw an unauthorized error
      const findOneAndRemoveStub = sinon
        .stub(NetworkModel, "findOneAndRemove")
        .throws(new Error("Unauthorized"));

      // Call the remove method
      const result = await NetworkModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors.message).to.equal(
        "Unauthorized to carry out this operation"
      );
      expect(result.message).to.equal(
        "Unauthorized to carry out this operation"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });
  });

  // Add more tests for other static methods if applicable
});

describe("NetworkSchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      // Create a new instance of NetworkSchema with mock data
      const network = new NetworkModel({
        _id: "some_id",
        net_email: "test@example.com",
        net_website: "www.example.com",
        net_category: "category",
        net_status: "active",
        net_phoneNumber: "1234567890",
        net_name: "Test Network",
        net_manager: "manager_id",
        net_departments: ["department_id"],
        net_permissions: ["permission_id"],
        net_roles: ["role_id"],
        net_groups: ["group_id"],
        net_description: "Test description",
        net_acronym: "TN",
        net_createdAt: new Date(),
        net_data_source: "data_source",
        net_api_key: "api_key",
      });

      // Call the toJSON method on the network instance
      const result = network.toJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "some_id");
      expect(result).to.have.property("net_email", "test@example.com");
      expect(result).to.have.property("net_website", "www.example.com");
      expect(result).to.have.property("net_category", "category");
      expect(result).to.have.property("net_status", "active");
      expect(result).to.have.property("net_phoneNumber", "1234567890");
      expect(result).to.have.property("net_name", "Test Network");
      expect(result).to.have.property("net_manager", "manager_id");
      expect(result)
        .to.have.property("net_departments")
        .that.deep.equal(["department_id"]);
      expect(result)
        .to.have.property("net_permissions")
        .that.deep.equal(["permission_id"]);
      expect(result).to.have.property("net_roles").that.deep.equal(["role_id"]);
      expect(result)
        .to.have.property("net_groups")
        .that.deep.equal(["group_id"]);
      expect(result).to.have.property("net_description", "Test description");
      expect(result).to.have.property("net_acronym", "TN");
      expect(result).to.have.property("net_createdAt");
      expect(result).to.have.property("net_data_source", "data_source");
      expect(result).to.have.property("net_api_key", "api_key");
      // Add more assertions to verify the result
    });

    // Add more unit tests for other methods if applicable
  });
});
