require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const checklistUtil = require("@utils/checklist.util");

const checklistController = rewire("@controllers/checklist.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("checklist controller", () => {
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
    checklistController.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("update()", () => {
    it("should update a checklist and return a success response", async () => {
      sinon.stub(checklistUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Update successful",
        data: { checklist: {} },
      });

      await checklistController.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, checklist: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      checklistController.__set__("extractErrorsFromRequest", mockBadRequest);

      await checklistController.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createChecklistUtil.update", async () => {
      sinon.stub(checklistUtil, "update").rejects(new Error("Unexpected error"));

      await checklistController.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create()", () => {
    it("should create a checklist and return a success response", async () => {
      sinon.stub(checklistUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Create successful",
        data: { item: "checklist" },
      });

      await checklistController.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, checklist: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      checklistController.__set__("extractErrorsFromRequest", mockBadRequest);

      await checklistController.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createChecklistUtil.create", async () => {
      sinon.stub(checklistUtil, "create").rejects(new Error("Unexpected error"));

      await checklistController.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("upsert()", () => {
    it("should upsert a checklist and return a success response", async () => {
      sinon.stub(checklistUtil, "upsert").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Upsert successful",
        data: { item: "checklist" },
      });

      await checklistController.upsert(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, checklist: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      checklistController.__set__("extractErrorsFromRequest", mockBadRequest);

      await checklistController.upsert(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createChecklistUtil.upsert", async () => {
      sinon.stub(checklistUtil, "upsert").rejects(new Error("Unexpected error"));

      await checklistController.upsert(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list()", () => {
    it("should list all checklists and return a success response", async () => {
      sinon.stub(checklistUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "List successful",
        data: [{ item: "checklist1" }],
      });

      await checklistController.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, checklists: sinon.match.array })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      checklistController.__set__("extractErrorsFromRequest", mockBadRequest);

      await checklistController.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createChecklistUtil.list", async () => {
      sinon.stub(checklistUtil, "list").rejects(new Error("Unexpected error"));

      await checklistController.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    it("should delete a checklist and return a success response", async () => {
      sinon.stub(checklistUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Delete successful",
        data: { item: "checklist" },
      });

      await checklistController.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, checklist: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      checklistController.__set__("extractErrorsFromRequest", mockBadRequest);

      await checklistController.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createChecklistUtil.delete", async () => {
      sinon.stub(checklistUtil, "delete").rejects(new Error("Unexpected error"));

      await checklistController.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
