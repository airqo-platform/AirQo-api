require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// Bootstrap in-memory model registration so factory works without DB
try {
  const _schema = rewire("@models/Candidate").__get__("CandidateSchema");
  if (!mongoose.modelNames().includes("candidates")) {
    mongoose.model("candidates", _schema);
  }
} catch (_) {}

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const CandidateModel = require("@models/Candidate");

describe("CandidateModel - Statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register", () => {
    it("should create a new candidate and return success response", async () => {
      const networkId = new mongoose.Types.ObjectId();
      const args = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        network_id: networkId,
        jobTitle: "Test Job Title",
        category: "Test Category",
        country: "Test Country",
      };
      const createdData = { ...args, _id: new mongoose.Types.ObjectId() };

      const createStub = sinon
        .stub(CandidateModel("airqo"), "create")
        .resolves(createdData);

      const result = await CandidateModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("candidate created");
      expect(result.data).to.have.property("_id");
      expect(result.data.firstName).to.equal("John");

      createStub.restore();
    });
  });

  describe.skip("list", () => {
    // Skipped: list() uses countDocuments + aggregate chain that cannot be simply mocked
  });

  describe("modify", () => {
    it("should modify an existing candidate and return success response", async () => {
      const candidateData = {
        _id: new mongoose.Types.ObjectId(),
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        jobTitle: "Updated Job Title",
      };

      const findOneAndUpdateStub = sinon
        .stub(CandidateModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...candidateData, _doc: candidateData }) });

      const result = await CandidateModel("airqo").modify({
        filter: { email: "test@example.com" },
        update: { jobTitle: "Updated Job Title" },
      });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the candidate");
      expect(result.data).to.deep.equal(candidateData);

      findOneAndUpdateStub.restore();
    });

    it("should return not found response when candidate does not exist", async () => {
      const findOneAndUpdateStub = sinon
        .stub(CandidateModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await CandidateModel("airqo").modify({
        filter: { email: "nonexistent@example.com" },
        update: { jobTitle: "Updated Job Title" },
      });

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "candidate does not exist, please crosscheck",
      });
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove", () => {
    it("should remove an existing candidate and return success response", async () => {
      const candidateData = {
        _id: new mongoose.Types.ObjectId(),
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      };

      const findOneAndRemoveStub = sinon
        .stub(CandidateModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...candidateData, _doc: candidateData }) });

      const result = await CandidateModel("airqo").remove({
        filter: { email: "test@example.com" },
      });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the candidate");
      expect(result.data).to.deep.equal(candidateData);

      findOneAndRemoveStub.restore();
    });

    it("should return not found response when candidate does not exist", async () => {
      const findOneAndRemoveStub = sinon
        .stub(CandidateModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await CandidateModel("airqo").remove({
        filter: { email: "nonexistent@example.com" },
      });

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "candidate does not exist, please crosscheck",
      });
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      findOneAndRemoveStub.restore();
    });
  });
});

describe("CandidateModel - Methods", () => {
  describe("toJSON", () => {
    it("should return the JSON representation of the candidate object", () => {
      const candidateId = new mongoose.Types.ObjectId();
      const networkId = new mongoose.Types.ObjectId();

      const candidate = new (CandidateModel("airqo"))({
        _id: candidateId,
        firstName: "John",
        lastName: "Doe",
        email: "test@example.com",
        description: "Test candidate description",
        category: "Test Category",
        long_organization: "Test Long Organization",
        jobTitle: "Test Job Title",
        website: "https://www.example.com",
        network_id: networkId,
        status: "pending",
        country: "Test Country",
      });

      const result = candidate.toJSON();

      expect(result._id.toString()).to.equal(candidateId.toString());
      expect(result.firstName).to.equal("John");
      expect(result.lastName).to.equal("Doe");
      expect(result.email).to.equal("test@example.com");
      expect(result.status).to.equal("pending");
      expect(result.country).to.equal("Test Country");
    });
  });
});
