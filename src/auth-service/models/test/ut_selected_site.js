require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const constants = require("@config/constants");

describe("SelectedSiteModel", () => {
  let SelectedSiteModel;

  beforeEach(() => {
    // Mock the SelectedSiteModel
    SelectedSiteModel = sinon.mock(mongoose.Model);
  });

  afterEach(() => {
    // Restore the original SelectedSiteModel
    SelectedSiteModel.restore();
  });

  describe("static methods", () => {
    describe("register", () => {
      it("should create a new selected site", async () => {
        const args = { site_id: "test-site", name: "Test Site" };
        const next = sinon.spy();

        SelectedSiteModel.prototype.create.resolves({});

        const result = await SelectedSiteModel.register(args, next);

        expect(result).to.deep.equal({
          success: true,
          data: {},
          message: "selected site created",
          status: 200,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle validation errors", async () => {
        const args = { site_id: "test-site" };
        const next = sinon.spy();

        SelectedSiteModel.prototype.create.rejects(
          new mongoose.Error.ValidationError()
        );

        const result = await SelectedSiteModel.register(args, next);

        expect(result).to.deep.equal({
          success: false,
          message: "validation errors for some of the provided fields",
          status: 409,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle duplicate key errors", async () => {
        const args = { site_id: "existing-site" };
        const next = sinon.spy();

        SelectedSiteModel.prototype.create.rejects(
          new mongoose.Error.ValidatorFailure({
            keyValue: { site_id: "existing-site" },
          })
        );

        const result = await SelectedSiteModel.register(args, next);

        expect(result).to.deep.equal({
          success: false,
          message: "the site_id must be unique",
          status: 409,
        });
        expect(next).not.to.have.been.called;
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

        SelectedSiteModel.aggregate.resolves(mockResponse);

        const result = await SelectedSiteModel.list(
          { filter, skip, limit },
          null
        );

        expect(result).to.deep.equal({
          success: true,
          message: "successfully retrieved the selected site details",
          data: mockResponse,
          status: 200,
        });
      });

      it("should return empty array when no sites exist", async () => {
        const filter = {};
        const skip = 0;
        const limit = 100;

        const mockResponse = [];

        SelectedSiteModel.aggregate.resolves(mockResponse);

        const result = await SelectedSiteModel.list(
          { filter, skip, limit },
          null
        );

        expect(result).to.deep.equal({
          success: true,
          message: "no selected sites exist",
          data: [],
          status: 200,
        });
      });
    });

    describe("modify", () => {
      it("should modify a selected site successfully", async () => {
        const filter = { site_id: "test-site" };
        const update = { name: "Updated Test Site" };

        const mockResponse = { _doc: { ...update, site_id: "test-site" } };

        SelectedSiteModel.findOneAndUpdate.resolves(mockResponse);

        const result = await SelectedSiteModel.modify({ filter, update }, null);

        expect(result).to.deep.equal({
          success: true,
          message: "successfully modified the selected site",
          data: { ...update, site_id: "test-site" },
          status: 200,
        });
      });

      it("should handle missing document error", async () => {
        const filter = { site_id: "non-existent-site" };
        const update = { name: "Non-existent Site" };

        SelectedSiteModel.findOneAndUpdate.rejects(
          new Error("Document not found")
        );

        const result = await SelectedSiteModel.modify({ filter, update }, null);

        expect(result).to.deep.equal({
          success: false,
          message: "selected site does not exist, please crosscheck",
          status: 400,
        });
      });
    });

    describe("remove", () => {
      it("should remove a selected site successfully", async () => {
        const filter = { site_id: "test-site" };

        const mockRemovedSite = {
          _doc: { site_id: "test-site", name: "Test Site" },
        };

        SelectedSiteModel.findOneAndRemove.resolves(mockRemovedSite);

        const result = await SelectedSiteModel.remove(filter, null);

        expect(result).to.deep.equal({
          success: true,
          message: "Successfully removed the selected site",
          data: { site_id: "test-site", name: "Test Site" },
          status: 200,
        });
      });

      it("should handle missing document error", async () => {
        const filter = { site_id: "non-existent-site" };

        SelectedSiteModel.findOneAndRemove.rejects(
          new Error("Document not found")
        );

        const result = await SelectedSiteModel.remove(filter, null);

        expect(result).to.deep.equal({
          success: false,
          message: "Provided User does not exist, please crosscheck",
          status: 400,
        });
      });
    });
  });

  describe("instance methods", () => {
    describe("toJSON", () => {
      it("should return a formatted object", () => {
        const instance = new SelectedSiteModel();
        instance.site_id = "test-site";
        instance.latitude = 1.2345;
        instance.longitude = 2.3456;
        instance.name = "Test Site";

        const result = instance.toJSON();

        expect(result).to.deep.equal({
          _id: undefined,
          site_id: "test-site",
          latitude: 1.2345,
          longitude: 2.3456,
          site_tags: undefined,
          country: undefined,
          district: undefined,
          sub_county: undefined,
          parish: undefined,
          county: undefined,
          generated_name: undefined,
          name: "Test Site",
          lat_long: undefined,
          city: undefined,
          formatted_name: undefined,
          region: undefined,
          search_name: undefined,
          approximate_latitude: undefined,
          approximate_longitude: undefined,
          isFeatured: undefined,
        });
      });
    });
  });
});
