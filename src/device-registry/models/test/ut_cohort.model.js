require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const mongoose = require("mongoose");
const cohortSchema = require("@models/Cohort");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const httpStatus = require("http-status");

describe("Cohort Model", () => {
  let Cohort;
  let createStub;
  let findOneAndUpdateStub;
  let findOneAndRemoveStub;

  beforeEach(() => {
    // Create a mock Cohort model
    Cohort = mongoose.model("Cohort", cohortSchema);

    // Stub the model methods
    createStub = sinon.stub(Cohort, "create");
    findOneAndUpdateStub = sinon.stub(Cohort, "findOneAndUpdate");
    findOneAndRemoveStub = sinon.stub(Cohort, "findOneAndRemove");
  });

  afterEach(() => {
    // Restore the original model methods
    createStub.restore();
    findOneAndUpdateStub.restore();
    findOneAndRemoveStub.restore();
  });

  describe("statics.register", () => {
    it("should create a cohort and return success", async () => {
      const args = {
        name: "cohortName",
        long_name: "Cohort Long Name",
        network: "Cohort Network",
      };

      const mockCreate = sinon.stub(Cohort, "create");
      const mockCreatedCohort = {
        _doc: {
          _id: "cohortId",
          name: "cohortName",
          long_name: "Cohort Long Name",
          network: "Cohort Network",
        },
      };

      mockCreate.resolves(mockCreatedCohort);

      const result = await Cohort.register(args);

      expect(result).to.deep.equal({
        success: true,
        data: {
          _id: "cohortId",
          name: "cohortName",
          long_name: "Cohort Long Name",
          network: "Cohort Network",
        },
        message: "cohort created",
        status: httpStatus.OK,
      });

      mockCreate.restore();
    });

    it("should handle errors during cohort creation", async () => {
      const args = {
        name: "cohortName",
        long_name: "Cohort Long Name",
      };

      const mockCreate = sinon.stub(Cohort, "create");

      mockCreate.rejects(new Error("Validation Error"));

      const result = await Cohort.register(args);

      expect(result).to.deep.equal({
        message: "validation errors for some of the provided fields",
        success: false,
        status: httpStatus.CONFLICT,
        errors: {
          message: "Validation Error",
        },
      });

      mockCreate.restore();
    });
  });

  describe("statics.list()", () => {
    it("should return list of cohorts with devices and sites", async () => {
      const filter = {}; // You can set filter if needed
      const limit = 10;
      const skip = 0;

      const mockAggregate = sinon.stub(Cohort, "aggregate");
      const mockExec = sinon.stub();

      // Mock aggregation stages
      mockAggregate.returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate
        .withArgs({
          $sort: { createdAt: -1 },
        })
        .returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate
        .withArgs({
          $group: {
            _id: "$_id",
            visibility: { $first: "$visibility" },
            cohort_tags: { $first: "$cohort_tags" },
            cohort_codes: { $first: "$cohort_codes" },
            name: { $first: "$name" },
            network: { $first: "$network" },
            numberOfDevices: { $sum: 1 },
            devices: { $push: "$devices" },
          },
        })
        .returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate.withArgs({ $skip: skip }).returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate.withArgs({ $limit: limit }).returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate.withArgs({ $allowDiskUse: true }).returnsThis();

      mockAggregate.withArgs().returnsThis();
      mockAggregate
        .withArgs({
          $lookup: {
            from: "devices",
            localField: "_id",
            foreignField: "cohorts",
            as: "devices",
          },
        })
        .returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate
        .withArgs({
          $unwind: "$devices",
        })
        .returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();
      mockAggregate.withArgs().returnsThis();
      mockAggregate
        .withArgs({
          $lookup: {
            from: "sites",
            localField: "devices.site_id",
            foreignField: "_id",
            as: "devices.site",
          },
        })
        .returnsThis();
      mockAggregate.withArgs(sinon.match.any).returnsThis();

      mockExec.resolves([
        // Mock your result data here
      ]);

      mockAggregate.withArgs().returns({
        exec: mockExec,
      });

      const result = await Cohort.list({ filter, limit, skip });

      expect(result).to.deep.equal({
        success: true,
        message: "Successful Operation",
        data: [
          // Mock expected output here
        ],
        status: httpStatus.OK,
      });

      mockAggregate.restore();
    });

    it("should handle errors", async () => {
      const filter = {}; // You can set filter if needed
      const limit = 10;
      const skip = 0;

      const mockAggregate = sinon.stub(Cohort, "aggregate");
      const mockExec = sinon.stub();

      // Mock aggregation stages
      // ... (similar to above)

      mockExec.rejects(new Error("Internal Server Error"));

      mockAggregate.withArgs().returns({
        exec: mockExec,
      });

      const result = await Cohort.list({ filter, limit, skip });

      expect(result).to.deep.equal({
        errors: { message: "Internal Server Error" },
        message: "Internal Server Error",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      mockAggregate.restore();
    });
  });

  describe("statics.modify", () => {
    it("should modify and return the updated cohort", async () => {
      const filter = { _id: "cohortId" };
      const update = {
        visibility: true,
        cohort_tags: ["tag1", "tag2"],
      };

      const mockFindOneAndUpdate = sinon.stub(Cohort, "findOneAndUpdate");
      const mockExec = sinon.stub();

      mockExec.resolves({
        _doc: {
          _id: "cohortId",
          visibility: true,
          cohort_tags: ["tag1", "tag2"],
        },
      });

      mockFindOneAndUpdate
        .withArgs(filter, sinon.match.any, sinon.match.any)
        .returns({ exec: mockExec });

      const result = await Cohort.modify({ filter, update });

      expect(result).to.deep.equal({
        success: true,
        message: "successfully modified the cohort",
        data: {
          _id: "cohortId",
          visibility: true,
          cohort_tags: ["tag1", "tag2"],
        },
        status: httpStatus.OK,
      });

      mockFindOneAndUpdate.restore();
    });

    it("should handle cohort not found", async () => {
      const filter = { _id: "nonExistentCohortId" };
      const update = { visibility: true };

      const mockFindOneAndUpdate = sinon.stub(Cohort, "findOneAndUpdate");
      const mockExec = sinon.stub();

      mockExec.resolves(null);

      mockFindOneAndUpdate
        .withArgs(filter, sinon.match.any, sinon.match.any)
        .returns({ exec: mockExec });

      const result = await Cohort.modify({ filter, update });

      expect(result).to.deep.equal({
        success: false,
        message: "cohort does not exist, please crosscheck",
        status: httpStatus.BAD_REQUEST,
        errors: filter,
      });

      mockFindOneAndUpdate.restore();
    });

    it("should handle errors", async () => {
      const filter = { _id: "cohortId" };
      const update = { visibility: true };

      const mockFindOneAndUpdate = sinon.stub(Cohort, "findOneAndUpdate");
      const mockExec = sinon.stub();

      mockExec.rejects(new Error("Internal Server Error"));

      mockFindOneAndUpdate
        .withArgs(filter, sinon.match.any, sinon.match.any)
        .returns({ exec: mockExec });

      const result = await Cohort.modify({ filter, update });

      expect(result).to.deep.equal({
        errors: { message: "Internal Server Error" },
        message: "Internal Server Error",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      mockFindOneAndUpdate.restore();
    });
  });

  describe("statics.remove", () => {
    it("should remove the cohort and return success", async () => {
      const filter = { _id: "cohortId" };

      const mockFindOneAndRemove = sinon.stub(Cohort, "findOneAndRemove");
      const mockExec = sinon.stub();

      mockExec.resolves({
        _doc: {
          _id: "cohortId",
          name: "Cohort Name",
        },
      });

      mockFindOneAndRemove
        .withArgs(filter, sinon.match.any)
        .returns({ exec: mockExec });

      const result = await Cohort.remove({ filter });

      expect(result).to.deep.equal({
        success: true,
        message: "successfully removed the cohort",
        data: {
          _id: "cohortId",
          name: "Cohort Name",
        },
        status: httpStatus.OK,
      });

      mockFindOneAndRemove.restore();
    });

    it("should handle cohort not found", async () => {
      const filter = { _id: "nonExistentCohortId" };

      const mockFindOneAndRemove = sinon.stub(Cohort, "findOneAndRemove");
      const mockExec = sinon.stub();

      mockExec.resolves(null);

      mockFindOneAndRemove
        .withArgs(filter, sinon.match.any)
        .returns({ exec: mockExec });

      const result = await Cohort.remove({ filter });

      expect(result).to.deep.equal({
        success: false,
        message: "cohort does not exist, please crosscheck",
        status: httpStatus.BAD_REQUEST,
        errors: filter,
      });

      mockFindOneAndRemove.restore();
    });

    it("should handle errors", async () => {
      const filter = { _id: "cohortId" };

      const mockFindOneAndRemove = sinon.stub(Cohort, "findOneAndRemove");
      const mockExec = sinon.stub();

      mockExec.rejects(new Error("Internal Server Error"));

      mockFindOneAndRemove
        .withArgs(filter, sinon.match.any)
        .returns({ exec: mockExec });

      const result = await Cohort.remove({ filter });

      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      mockFindOneAndRemove.restore();
    });
  });
});
