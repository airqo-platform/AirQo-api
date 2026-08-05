require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const httpStatus = require("http-status");
const rewire = require("rewire");
const preferenceUtil = require("@utils/preference.util");

const preferences = rewire("@controllers/preference.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("preferences controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: {}, params: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    preferences.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("update()", () => {
    it("should update preference successfully", async () => {
      sinon.stub(preferenceUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Update successful",
        data: { theme: "dark" },
      });

      await preferences.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, preference: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle update failure", async () => {
      sinon.stub(preferenceUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Update failed",
        errors: { message: "Error" },
      });

      await preferences.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "update").rejects(new Error("Unexpected error"));

      await preferences.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create()", () => {
    it("should create preference successfully", async () => {
      sinon.stub(preferenceUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Create successful",
        data: { theme: "light" },
      });

      await preferences.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, preference: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle creation failure", async () => {
      sinon.stub(preferenceUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Creation failed",
        errors: { message: "Error" },
      });

      await preferences.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "create").rejects(new Error("Unexpected error"));

      await preferences.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("upsert()", () => {
    it("should upsert preference successfully", async () => {
      sinon.stub(preferenceUtil, "upsert").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Upsert successful",
        data: { theme: "dark" },
      });

      await preferences.upsert(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, preference: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.upsert(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle upsert failure", async () => {
      sinon.stub(preferenceUtil, "upsert").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Upsert failed",
        errors: { message: "Error" },
      });

      await preferences.upsert(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "upsert").rejects(new Error("Unexpected error"));

      await preferences.upsert(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("replace()", () => {
    it("should replace preference successfully", async () => {
      sinon.stub(preferenceUtil, "replace").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Replace successful",
        data: { theme: "auto" },
      });

      await preferences.replace(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, preference: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.replace(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle replace failure", async () => {
      sinon.stub(preferenceUtil, "replace").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Replace failed",
        errors: { message: "Error" },
      });

      await preferences.replace(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "replace").rejects(new Error("Unexpected error"));

      await preferences.replace(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list()", () => {
    it("should list preferences successfully", async () => {
      sinon.stub(preferenceUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "List successful",
        data: [{ theme: "dark" }],
      });

      await preferences.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, preferences: sinon.match.array })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle listing failure", async () => {
      sinon.stub(preferenceUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Listing failed",
        errors: { message: "Error" },
      });

      await preferences.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "list").rejects(new Error("Unexpected error"));

      await preferences.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    it("should delete preference successfully", async () => {
      sinon.stub(preferenceUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Delete successful",
        data: { theme: "dark" },
      });

      await preferences.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, preference: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle deletion failure", async () => {
      sinon.stub(preferenceUtil, "delete").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Delete failed",
        errors: { message: "Error" },
      });

      await preferences.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "delete").rejects(new Error("Unexpected error"));

      await preferences.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("addSelectedSites()", () => {
    it("should add selected sites successfully", async () => {
      sinon.stub(preferenceUtil, "addSelectedSites").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Sites added successfully",
        data: [{ siteId: "site1" }],
      });

      await preferences.addSelectedSites(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, selected_sites: sinon.match.array })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.addSelectedSites(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure", async () => {
      sinon.stub(preferenceUtil, "addSelectedSites").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });

      await preferences.addSelectedSites(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "addSelectedSites").rejects(new Error("Unexpected error"));

      await preferences.addSelectedSites(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("updateSelectedSite()", () => {
    it("should update selected site successfully", async () => {
      sinon.stub(preferenceUtil, "updateSelectedSite").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Site updated successfully",
        data: { siteId: "site1" },
      });

      await preferences.updateSelectedSite(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, selected_site: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.updateSelectedSite(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure", async () => {
      sinon.stub(preferenceUtil, "updateSelectedSite").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });

      await preferences.updateSelectedSite(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "updateSelectedSite").rejects(new Error("Unexpected error"));

      await preferences.updateSelectedSite(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("deleteSelectedSite()", () => {
    it("should delete selected site successfully", async () => {
      sinon.stub(preferenceUtil, "deleteSelectedSite").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Site deleted successfully",
        data: { siteId: "site1" },
      });

      await preferences.deleteSelectedSite(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, selected_site: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      preferences.__set__("extractErrorsFromRequest", mockBadRequest);

      await preferences.deleteSelectedSite(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure", async () => {
      sinon.stub(preferenceUtil, "deleteSelectedSite").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });

      await preferences.deleteSelectedSite(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(preferenceUtil, "deleteSelectedSite").rejects(new Error("Unexpected error"));

      await preferences.deleteSelectedSite(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
