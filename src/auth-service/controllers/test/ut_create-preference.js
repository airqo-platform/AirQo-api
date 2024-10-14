require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require("sinon-chai");

describe("preferences", () => {
  let createPreferenceUtil;

  beforeEach(() => {
    // Set up mocks
    createPreferenceUtil = sinon.mock();

    sinon
      .stub(createPreferenceUtil, "update")
      .resolves({
        success: true,
        status: 200,
        message: "Update successful",
        data: {},
      });
    sinon
      .stub(createPreferenceUtil, "create")
      .resolves({
        success: true,
        status: 201,
        message: "Create successful",
        data: {},
      });
    sinon
      .stub(createPreferenceUtil, "upsert")
      .resolves({
        success: true,
        status: 200,
        message: "Upsert successful",
        data: {},
      });
    sinon
      .stub(createPreferenceUtil, "replace")
      .resolves({
        success: true,
        status: 200,
        message: "Replace successful",
        data: {},
      });
    sinon
      .stub(createPreferenceUtil, "list")
      .resolves({
        success: true,
        status: 200,
        message: "List successful",
        data: [],
      });
    sinon
      .stub(createPreferenceUtil, "delete")
      .resolves({ success: true, status: 204, message: "Delete successful" });
    sinon
      .stub(createPreferenceUtil, "addSelectedSites")
      .resolves({
        success: true,
        status: 200,
        message: "Add selected sites successful",
        data: {},
      });
    sinon
      .stub(createPreferenceUtil, "updateSelectedSite")
      .resolves({
        success: true,
        status: 200,
        message: "Update selected site successful",
        data: {},
      });
    sinon
      .stub(createPreferenceUtil, "deleteSelectedSite")
      .resolves({
        success: true,
        status: 204,
        message: "Delete selected site successful",
      });

    sinon.stub(extractErrorsFromRequest).returns(null);
    sinon.stub(HttpError, "default").throws(new Error("HttpError"));
  });

  afterEach(() => {
    // Restore mocks
    createPreferenceUtil.restore();
    extractErrorsFromRequest.restore();
    HttpError.restore();
  });

  describe("update", () => {
    it("should update preference successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.update(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Update successful",
        preference: {},
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon.stub(createPreferenceUtil.update).rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.update(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        preference: {},
        errors: { message: "Test error" },
      });
    });
  });

  describe("create", () => {
    it("should create preference successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.create(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Create successful",
        preference: {},
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon.stub(createPreferenceUtil.create).rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.create(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        preference: {},
        errors: { message: "Test error" },
      });
    });
  });

  describe("upsert", () => {
    it("should upsert preference successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.upsert(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Upsert successful",
        preference: {},
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon.stub(createPreferenceUtil.upsert).rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.upsert(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        preference: {},
        errors: { message: "Test error" },
      });
    });
  });

  describe("replace", () => {
    it("should replace preference successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.replace(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Replace successful",
        preference: {},
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon.stub(createPreferenceUtil.replace).rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.replace(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        preference: {},
        errors: { message: "Test error" },
      });
    });
  });

  describe("list", () => {
    it("should list preferences successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.list(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "List successful",
        preferences: [],
      });
    });
  });

  describe("delete", () => {
    it("should delete preference successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.delete(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Delete successful",
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon.stub(createPreferenceUtil.delete).rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.delete(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        preference: {},
        errors: { message: "Test error" },
      });
    });
  });

  describe("addSelectedSites", () => {
    it("should add selected sites successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.addSelectedSites(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Add selected sites successful",
        seletected_sites: {},
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon
        .stub(createPreferenceUtil.addSelectedSites)
        .rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.addSelectedSites(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        seletected_sites: {},
        errors: { message: "Test error" },
      });
    });
  });

  describe("updateSelectedSite", () => {
    it("should update selected site successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.updateSelectedSite(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Update selected site successful",
        selected_site: {},
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon
        .stub(createPreferenceUtil.updateSelectedSite)
        .rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.updateSelectedSite(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        selected_site: {},
        errors: { message: "Test error" },
      });
    });
  });

  describe("deleteSelectedSite", () => {
    it("should delete selected site successfully", async () => {
      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.deleteSelectedSite(req, res);

      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Delete selected site successful",
      });
    });

    it("should handle errors from createPreferenceUtil", async () => {
      sinon
        .stub(createPreferenceUtil.deleteSelectedSite)
        .rejects(new Error("Test error"));

      const req = { query: {}, body: {} };
      const res = { json: sinon.spy() };

      await preferences.deleteSelectedSite(req, res);

      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        selected_site: {},
        errors: { message: "Test error" },
      });
    });
  });
});

// Helper functions
function extractErrorsFromRequest(req) {
  // Mock implementation
  return null;
}

class HttpError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details || {};
  }
}
