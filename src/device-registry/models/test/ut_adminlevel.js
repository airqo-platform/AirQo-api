require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const adminLevelSchema = require("@models/AdminLevel"); // Replace with the actual path to your adminLevelSchema.js file

describe("AdminLevel Model", () => {
  let AdminLevel;
  let createStub;
  let findOneAndUpdateStub;
  let findOneAndRemoveStub;

  beforeEach(() => {
    // Create a mock AdminLevel model
    AdminLevel = mongoose.model("AdminLevel", adminLevelSchema);

    // Stub the model methods
    createStub = sinon.stub(AdminLevel, "create");
    findOneAndUpdateStub = sinon.stub(AdminLevel, "findOneAndUpdate");
    findOneAndRemoveStub = sinon.stub(AdminLevel, "findOneAndRemove");
  });

  afterEach(() => {
    // Restore the original model methods
    createStub.restore();
    findOneAndUpdateStub.restore();
    findOneAndRemoveStub.restore();
  });

  describe("register", () => {
    it("should register a new admin level", async () => {
      // Set up the test data
      const args = {
        name: "Admin Level 1",
        description: "Description of Admin Level 1",
      };

      // Set up the expected result
      const createdAdminLevel = {
        _id: "admin-level-id-1",
        name: "Admin Level 1",
        description: "Description of Admin Level 1",
      };
      createStub.resolves(createdAdminLevel);

      // Call the register static method of AdminLevel model
      const result = await AdminLevel.register(args);

      // Verify the result
      expect(createStub.calledOnceWith(args)).to.be.true;
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(createdAdminLevel);
      expect(result.message).to.equal("adminLevel created");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle validation errors when registering a new admin level", async () => {
      // Set up the test data with invalid arguments
      const args = {
        // Invalid: name is missing
        description: "Description of Admin Level 2",
      };

      // Set up the expected error response
      const error = new Error("Validation failed: name is required");
      error.errors = {
        name: {
          message: "name is required",
          path: "name",
        },
      };
      createStub.rejects(error);

      // Call the register static method of AdminLevel model
      const result = await AdminLevel.register(args);

      // Verify the result
      expect(createStub.calledOnceWith(args)).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(httpStatus.CONFLICT);
      expect(result.errors).to.deep.equal({ name: "name is required" });
    });

    // Add more tests for the register method as needed
  });

  describe("list", () => {
    it("should list admin levels with filters", async () => {
      // Set up the test data
      const filter = { category: "some-category" };
      const limit = 10;
      const skip = 0;

      // Set up the expected result
      const adminLevels = [
        {
          _id: "admin-level-id-1",
          name: "Admin Level 1",
          description: "Description of Admin Level 1",
        },
        {
          _id: "admin-level-id-2",
          name: "Admin Level 2",
          description: "Description of Admin Level 2",
        },
      ];
      AdminLevel.aggregate.resolves(adminLevels);

      // Call the list static method of AdminLevel model
      const result = await AdminLevel.list({ filter, limit, skip });

      // Verify the result
      expect(AdminLevel.aggregate.calledOnceWithMatch(filter)).to.be.true;
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(adminLevels);
      expect(result.message).to.equal("Successfull Operation");
      expect(result.status).to.equal(httpStatus.OK);
    });

    // Add more tests for the list method as needed
  });

  describe("modify", () => {
    it("should modify an admin level", async () => {
      // Set up the test data
      const filter = { _id: "admin-level-id-1" };
      const update = { description: "Updated description" };

      // Set up the expected result
      const updatedAdminLevel = {
        _id: "admin-level-id-1",
        name: "Admin Level 1",
        description: "Updated description",
      };
      findOneAndUpdateStub.resolves(updatedAdminLevel);

      // Call the modify static method of AdminLevel model
      const result = await AdminLevel.modify({ filter, update });

      // Verify the result
      expect(
        findOneAndUpdateStub.calledOnceWith(filter, {
          $set: { description: "Updated description" },
        })
      ).to.be.true;
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(updatedAdminLevel);
      expect(result.message).to.equal("successfully modified the adminLevel");
      expect(result.status).to.equal(httpStatus.OK);
    });

    // Add more tests for the modify method as needed
  });

  describe("remove", () => {
    it("should remove an admin level", async () => {
      // Set up the test data
      const filter = { _id: "admin-level-id-1" };

      // Set up the expected result
      const removedAdminLevel = {
        _id: "admin-level-id-1",
        name: "Admin Level 1",
        description: "Description of Admin Level 1",
      };
      findOneAndRemoveStub.resolves(removedAdminLevel);

      // Call the remove static method of AdminLevel model
      const result = await AdminLevel.remove({ filter });

      // Verify the result
      expect(findOneAndRemoveStub.calledOnceWith(filter)).to.be.true;
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(removedAdminLevel);
      expect(result.message).to.equal("successfully removed the adminLevel");
      expect(result.status).to.equal(httpStatus.OK);
    });

    // Add more tests for the remove method as needed
  });
});
