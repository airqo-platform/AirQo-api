require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const mongoose = require("mongoose");

const SelectedSiteModel = require("@models/SelectedSite");

describe("SelectedSiteModel", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("static methods", () => {
    describe("register", () => {
      it("should create a new selected site", async () => {
        const args = { site_id: "test-site", name: "Test Site" };
        const next = sinon.spy();

        sandbox
          .stub(SelectedSiteModel("airqo"), "create")
          .resolves({ site_id: "test-site", name: "Test Site" });

        const result = await SelectedSiteModel("airqo").register(args, next);

        expect(result.success).to.be.true;
        expect(result.message).to.equal("selected site created");
        expect(result.status).to.equal(200);
      });

      it("should handle validation errors", async () => {
        const args = { site_id: "test-site" };
        const next = sinon.spy();

        sandbox
          .stub(SelectedSiteModel("airqo"), "create")
          .rejects(new mongoose.Error.ValidationError());

        const result = await SelectedSiteModel("airqo").register(args, next);

        expect(result).to.have.property("success", false);
      });

      it("should handle duplicate key errors", async () => {
        const args = { site_id: "existing-site" };
        const next = sinon.spy();

        const dupError = new Error("duplicate key");
        dupError.code = 11000;
        dupError.keyValue = { site_id: "existing-site" };
        sandbox.stub(SelectedSiteModel("airqo"), "create").rejects(dupError);

        const result = await SelectedSiteModel("airqo").register(args, next);

        expect(result).to.have.property("success", false);
      });
    });

    describe("list", () => {
      it("should return selected sites successfully", async () => {
        const filter = {};
        const skip = 0;
        const limit = 100;

        const mockResponse = [
          { id: "site1", name: "Site 1" },
          { id: "site2", name: "Site 2" },
        ];

        const mockAggregation = {
          match: sandbox.stub().returnsThis(),
          sort: sandbox.stub().returnsThis(),
          skip: sandbox.stub().returnsThis(),
          limit: sandbox.stub().returnsThis(),
          allowDiskUse: sandbox.stub().resolves(mockResponse),
        };
        sandbox.stub(SelectedSiteModel("airqo"), "aggregate").returns(mockAggregation);
        sandbox.stub(SelectedSiteModel("airqo"), "countDocuments").resolves(2);

        const result = await SelectedSiteModel("airqo").list({ filter, skip, limit }, null);

        expect(result).to.have.property("success", true);
        expect(result.data).to.deep.equal(mockResponse);
      });

      it("should return empty array when no sites exist", async () => {
        const filter = {};
        const skip = 0;
        const limit = 100;

        const mockAggregation = {
          match: sandbox.stub().returnsThis(),
          sort: sandbox.stub().returnsThis(),
          skip: sandbox.stub().returnsThis(),
          limit: sandbox.stub().returnsThis(),
          allowDiskUse: sandbox.stub().resolves([]),
        };
        sandbox.stub(SelectedSiteModel("airqo"), "aggregate").returns(mockAggregation);
        sandbox.stub(SelectedSiteModel("airqo"), "countDocuments").resolves(0);

        const result = await SelectedSiteModel("airqo").list({ filter, skip, limit }, null);

        expect(result).to.have.property("success", true);
      });
    });

    describe("modify", () => {
      it("should modify a selected site successfully", async () => {
        const filter = { site_id: "test-site" };
        const update = { name: "Updated Test Site" };

        const mockDoc = { name: "Updated Test Site", site_id: "test-site" };
        const mockResponse = { _doc: mockDoc };
        sandbox
          .stub(SelectedSiteModel("airqo"), "findOneAndUpdate")
          .returns({ select: sandbox.stub().resolves(mockResponse) });

        const result = await SelectedSiteModel("airqo").modify({ filter, update }, null);

        expect(result).to.have.property("success", true);
      });

      it("should handle missing document error", async () => {
        const filter = { site_id: "non-existent-site" };
        const update = { name: "Non-existent Site" };

        sandbox
          .stub(SelectedSiteModel("airqo"), "findOneAndUpdate")
          .returns({ select: sandbox.stub().rejects(new Error("Document not found")) });

        const result = await SelectedSiteModel("airqo").modify({ filter, update }, null);

        expect(result).to.have.property("success", false);
      });
    });

    describe("remove", () => {
      it("should remove a selected site successfully", async () => {
        const filter = { site_id: "test-site" };

        const mockRemovedSite = {
          _doc: { site_id: "test-site", name: "Test Site" },
        };

        sandbox
          .stub(SelectedSiteModel("airqo"), "findOneAndRemove")
          .returns({ exec: sandbox.stub().resolves(mockRemovedSite) });

        const result = await SelectedSiteModel("airqo").remove({ filter }, null);

        expect(result).to.have.property("success", true);
      });

      it("should handle missing document error", async () => {
        const filter = { site_id: "non-existent-site" };

        sandbox
          .stub(SelectedSiteModel("airqo"), "findOneAndRemove")
          .returns({ exec: sandbox.stub().rejects(new Error("Document not found")) });

        const result = await SelectedSiteModel("airqo").remove({ filter }, null);

        expect(result).to.have.property("success", false);
      });
    });
  });

  describe("instance methods", () => {
    describe("toJSON", () => {
      it("should return a formatted object", () => {
        const Model = SelectedSiteModel("airqo");
        const instance = new Model({
          site_id: "test-site",
          latitude: 1.2345,
          longitude: 2.3456,
          name: "Test Site",
        });

        const result = instance.toJSON();

        expect(result).to.be.an("object");
        expect(result).to.have.property("site_id", "test-site");
        expect(result).to.have.property("latitude", 1.2345);
        expect(result).to.have.property("longitude", 2.3456);
        expect(result).to.have.property("name", "Test Site");
      });
    });
  });
});
