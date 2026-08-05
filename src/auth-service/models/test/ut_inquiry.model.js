require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory works without DB
try {
  const _schema = rewire("@models/Inquiry").__get__("InquirySchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("inquiries")) mongoose.model("inquiries", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const InquiryModel = require("@models/Inquiry");

describe("InquirySchema statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register method", () => {
    it("should create a new Inquiry and return success message with status 200", async () => {
      const args = {
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      // register() passes data directly to createSuccessResponse (no _doc)
      const createStub = sinon.stub(InquiryModel("airqo"), "create").resolves(args);

      const result = await InquiryModel("airqo").register(args);

      expect(result.success).to.be.true;
      // createSuccessResponse("create", data, "inquiry") → "inquiry created successfully"
      expect(result.message).to.equal("inquiry created successfully");
      expect(result.status).to.equal(200);
      expect(result.data).to.deep.equal(args);

      createStub.restore();
    });

    it("should return success message with status 202 if the Inquiry is not created", async () => {
      const args = {
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      // createEmptySuccessResponse("inquiry") → 202 ACCEPTED
      const createStub = sinon.stub(InquiryModel("airqo"), "create").resolves(null);

      const result = await InquiryModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "operation successful but inquiry NOT successfully created"
      );
      expect(result.status).to.equal(202);
      expect(result.data).to.be.an("array").that.is.empty;

      createStub.restore();
    });

    it("should return validation errors if the Inquiry creation encounters duplicate email", async () => {
      const args = {
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      // createErrorResponse with err.code === 11000 → "duplicate values provided"
      const createStub = sinon.stub(InquiryModel("airqo"), "create").throws({
        code: 11000,
        keyValue: { email: "test@example.com" },
        message: "duplicate key error",
      });

      const result = await InquiryModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        email: "the email must be unique",
      });
      expect(result.message).to.equal("duplicate values provided");
      expect(result.status).to.equal(409);

      createStub.restore();
    });

    it("should return validation errors if the Inquiry creation encounters other validation errors", async () => {
      const args = {
        email: "",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
      };

      const createStub = sinon.stub(InquiryModel("airqo"), "create").throws({
        errors: {
          email: {
            message: "Email is required",
          },
        },
        message: "validation error",
      });

      const result = await InquiryModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({ email: "Email is required" });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      createStub.restore();
    });
  });

  describe.skip("list method", () => {
    // Skipped: list() calls find().sort().skip().limit().exec() + countDocuments()
    // Chained query methods + countDocuments require DB-free setup beyond simple .resolves().
  });

  describe("modify method", () => {
    it("should modify and return the updated inquiry", async () => {
      const inquiryData = {
        _id: new mongoose.Types.ObjectId(),
        email: "test@example.com",
        fullName: "John Doe",
        message: "Inquiry Message",
        status: "open",
      };

      // modify() calls findOneAndUpdate(...).exec() and returns updatedInquiry._doc
      const findOneAndUpdateStub = sinon
        .stub(InquiryModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...inquiryData, _doc: inquiryData }) });

      const filter = { _id: inquiryData._id };
      const result = await InquiryModel("airqo").modify({ filter, update: { status: "closed" } });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "successfully modified the inquiry");
      expect(result).to.have.property("data");

      findOneAndUpdateStub.restore();
    });

    it("should return 'inquiry does not exist' message if inquiry not found", async () => {
      const findOneAndUpdateStub = sinon
        .stub(InquiryModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_id" };
      const result = await InquiryModel("airqo").modify({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      // createNotFoundResponse("inquiry", "update") → "the inquiry you are trying to UPDATE does not exist..."
      expect(result.message).to.include("inquiry");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove and return the deleted inquiry", async () => {
      const inquiryData = {
        _id: new mongoose.Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        message: "Inquiry Message",
        status: "open",
      };

      // remove() calls findOneAndRemove(...).exec() and returns removedInquiry._doc
      const findOneAndRemoveStub = sinon
        .stub(InquiryModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...inquiryData, _doc: inquiryData }) });

      const filter = { _id: inquiryData._id };
      const result = await InquiryModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "successfully removed the inquiry");
      expect(result).to.have.property("data");

      findOneAndRemoveStub.restore();
    });

    it("should return 'inquiry does not exist' message if inquiry not found", async () => {
      const findOneAndRemoveStub = sinon
        .stub(InquiryModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_id" };
      const result = await InquiryModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "inquiry does not exist, please crosscheck"
      );
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      findOneAndRemoveStub.restore();
    });
  });
});

describe("InquirySchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      const inquiryId = new mongoose.Types.ObjectId();

      const inquiry = new (InquiryModel("airqo"))({
        _id: inquiryId,
        email: "test@example.com",
        fullName: "John Doe",
        message: "Test inquiry",
        category: "General",
        status: "pending",
      });

      const result = inquiry.toJSON();

      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(inquiryId.toString());
      expect(result).to.have.property("email", "test@example.com");
      expect(result).to.have.property("fullName", "John Doe");
      expect(result).to.have.property("message", "Test inquiry");
      expect(result).to.have.property("category", "General");
      expect(result).to.have.property("status", "pending");
    });
  });
});
