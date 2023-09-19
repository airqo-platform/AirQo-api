require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const InquiryModel = require("@models/Inquiry");

describe("InquirySchema statics", () => {
  describe("register method", () => {
    it("should create a new Inquiry and return success message with status 200", async () => {
      // Mock input data for the Inquiry to be created
      const args = {
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      // Mock the Inquiry.create method to return a successful result
      const createStub = sinon.stub(InquiryModel, "create").resolves(args);

      // Call the register method
      const result = await InquiryModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("inquiry created");
      expect(result.status).to.equal(200);
      expect(result.data).to.deep.equal(args);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return success message with status 400 if the Inquiry is not created", async () => {
      // Mock input data for the Inquiry (this time we'll return an empty data array)
      const args = {
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      // Mock the Inquiry.create method to return an empty data array
      const createStub = sinon.stub(InquiryModel, "create").resolves([]);

      // Call the register method
      const result = await InquiryModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "operation successful but user NOT successfully created"
      );
      expect(result.status).to.equal(400);
      expect(result.data).to.be.an("array").that.is.empty;

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Inquiry creation encounters duplicate email", async () => {
      // Mock input data for the Inquiry with duplicate email
      const args = {
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      // Mock the Inquiry.create method to throw a duplicate key error
      const createStub = sinon.stub(InquiryModel, "create").throws({
        code: 11000,
        keyValue: { email: "test@example.com" },
      });

      // Call the register method
      const result = await InquiryModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        email: "the email must be unique",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Inquiry creation encounters other validation errors", async () => {
      // Mock input data for the Inquiry with invalid values
      const args = {
        email: "", // Empty email (invalid)
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      // Mock the Inquiry.create method to throw a validation error
      const createStub = sinon.stub(InquiryModel, "create").throws({
        errors: {
          email: {
            message: "Email is required",
          },
        },
      });

      // Call the register method
      const result = await InquiryModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({ email: "Email is required" });
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
    it("should return a list of inquiries", async () => {
      // Sample inquiries data
      const inquiriesData = [
        {
          _id: "inquiry_id_1",
          createdAt: new Date("2023-07-25T12:00:00Z"),
          message: "Inquiry Message 1",
        },
        {
          _id: "inquiry_id_2",
          createdAt: new Date("2023-07-24T12:00:00Z"),
          message: "Inquiry Message 2",
        },
      ];

      // Stub the find method of the model to return the sample inquiries data
      const findStub = sinon.stub(InquiryModel, "find").resolves(inquiriesData);

      // Call the list method with sample filter
      const filter = { status: "open" };
      const result = await InquiryModel.list({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("data").that.deep.equals(inquiriesData);
      expect(result).to.have.property(
        "message",
        "successfully listed the inquiries"
      );
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the find method to its original implementation
      findStub.restore();
    });

    it("should return an empty array if no inquiries found for the search", async () => {
      // Stub the find method of the model to return an empty array
      const findStub = sinon.stub(InquiryModel, "find").resolves([]);

      // Call the list method with sample filter
      const filter = { status: "closed" };
      const result = await InquiryModel.list({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "no inquiries exist for this search"
      );
      expect(result).to.have.property("data").that.deep.equals([]);
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the find method to its original implementation
      findStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("modify method", () => {
    it("should modify and return the updated inquiry", async () => {
      // Sample inquiry data
      const inquiryData = {
        _id: "inquiry_id_1",
        createdAt: new Date("2023-07-25T12:00:00Z"),
        message: "Inquiry Message",
        status: "open",
      };

      // Sample update data
      const updateData = {
        status: "closed",
        resolvedAt: new Date("2023-07-26T12:00:00Z"),
      };

      // Stub the findOneAndUpdate method of the model to return the updated inquiry
      const findOneAndUpdateStub = sinon
        .stub(InquiryModel, "findOneAndUpdate")
        .resolves(inquiryData);

      // Call the modify method with sample filter and update
      const filter = { _id: "inquiry_id_1" };
      const result = await InquiryModel.modify({ filter, update: updateData });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully modified the inquiry"
      );
      expect(result)
        .to.have.property("data")
        .that.deep.equals({
          _id: "inquiry_id_1",
          createdAt: new Date("2023-07-25T12:00:00Z"),
          message: "Inquiry Message",
          status: "closed",
          resolvedAt: new Date("2023-07-26T12:00:00Z"),
        });

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    it("should return 'inquiry does not exist' message if inquiry not found", async () => {
      // Stub the findOneAndUpdate method of the model to return null (inquiry not found)
      const findOneAndUpdateStub = sinon
        .stub(InquiryModel, "findOneAndUpdate")
        .resolves(null);

      // Call the modify method with sample filter and update
      const filter = { _id: "non_existent_id" };
      const result = await InquiryModel.modify({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "inquiry does not exist, please crosscheck"
      );

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("remove method", () => {
    it("should remove and return the deleted inquiry", async () => {
      // Sample inquiry data
      const inquiryData = {
        _id: "inquiry_id_1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        message: "Inquiry Message",
        status: "open",
      };

      // Stub the findOneAndRemove method of the model to return the removed inquiry
      const findOneAndRemoveStub = sinon
        .stub(InquiryModel, "findOneAndRemove")
        .resolves(inquiryData);

      // Call the remove method with sample filter
      const filter = { _id: "inquiry_id_1" };
      const result = await InquiryModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully removed the inquiry"
      );
      expect(result).to.have.property("data").that.deep.equals({
        _id: "inquiry_id_1",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        message: "Inquiry Message",
        status: "open",
      });

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    it("should return 'inquiry does not exist' message if inquiry not found", async () => {
      // Stub the findOneAndRemove method of the model to return null (inquiry not found)
      const findOneAndRemoveStub = sinon
        .stub(InquiryModel, "findOneAndRemove")
        .resolves(null);

      // Call the remove method with sample filter
      const filter = { _id: "non_existent_id" };
      const result = await InquiryModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "inquiry does not exist, please crosscheck"
      );

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  // Add more tests for other static methods if applicable
});

describe("InquirySchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      // Create a new instance of InquirySchema with mock data
      const inquiry = new InquiryModel({
        _id: "some_id",
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
        status: "pending",
        createdAt: "2023-07-25T12:34:56.789Z",
        updatedAt: "2023-07-25T12:34:56.789Z",
      });

      // Call the toJSON method on the inquiry instance
      const result = inquiry.toJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "some_id");
      expect(result).to.have.property("email", "test@example.com");
      expect(result).to.have.property("fullName", "John Doe");
      expect(result).to.have.property("message", "Test inquiry");
      expect(result).to.have.property("category", "General");
      expect(result).to.have.property("status", "pending");
      expect(result).to.have.property("createdAt", "2023-07-25T12:34:56.789Z");
      expect(result).to.have.property("updatedAt", "2023-07-25T12:34:56.789Z");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  // Add more tests for other methods if applicable
});
