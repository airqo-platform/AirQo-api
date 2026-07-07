require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const selfieUtil = require("@utils/selfie.util");

const selfieController = rewire("@controllers/selfie.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "eventId", message: "required" }];

describe("selfie controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: {}, params: {}, body: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    selfieController.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create", () => {
    it("returns 400 and never calls the util layer when validation fails", async () => {
      selfieController.__set__("extractErrorsFromRequest", mockBadRequest);
      const createStub = sinon.stub(selfieUtil, "create");

      await selfieController.create(req, res, next);

      expect(createStub.called).to.be.false;
      expect(next.calledOnce).to.be.true;
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("maps a successful result to created_selfie", async () => {
      sinon.stub(selfieUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "selfie submitted",
        data: { _id: "1", eventId: "e1" },
      });

      await selfieController.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const body = res.json.firstCall.args[0];
      expect(body.success).to.be.true;
      expect(body.created_selfie).to.deep.equal({ _id: "1", eventId: "e1" });
    });

    it("maps a failed result to an error response", async () => {
      sinon.stub(selfieUtil, "create").resolves({
        success: false,
        status: httpStatus.CONFLICT,
        message: "validation errors",
        errors: { message: "bad imageUrl" },
      });

      await selfieController.create(req, res, next);

      expect(res.status.calledWith(httpStatus.CONFLICT)).to.be.true;
      const body = res.json.firstCall.args[0];
      expect(body.success).to.be.false;
      expect(body.errors).to.deep.equal({ message: "bad imageUrl" });
    });
  });

  describe("list", () => {
    it("returns 400 and never calls the util layer when validation fails", async () => {
      selfieController.__set__("extractErrorsFromRequest", mockBadRequest);
      const listStub = sinon.stub(selfieUtil, "list");

      await selfieController.list(req, res, next);

      expect(listStub.called).to.be.false;
      expect(next.calledOnce).to.be.true;
    });

    it("maps a successful result to selfies + total", async () => {
      sinon.stub(selfieUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "ok",
        data: [{ _id: "1" }],
        meta: { total: 1 },
      });

      await selfieController.list(req, res, next);

      const body = res.json.firstCall.args[0];
      expect(body.selfies).to.deep.equal([{ _id: "1" }]);
      expect(body.total).to.equal(1);
    });

    it("maps a failed result to an error response", async () => {
      sinon.stub(selfieUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "boom",
      });

      await selfieController.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      const body = res.json.firstCall.args[0];
      expect(body.success).to.be.false;
    });
  });

  describe("hide", () => {
    it("returns 400 and never calls the util layer when validation fails", async () => {
      selfieController.__set__("extractErrorsFromRequest", mockBadRequest);
      const hideStub = sinon.stub(selfieUtil, "hide");

      await selfieController.hide(req, res, next);

      expect(hideStub.called).to.be.false;
      expect(next.calledOnce).to.be.true;
    });

    it("maps a successful result to updated_selfie", async () => {
      sinon.stub(selfieUtil, "hide").resolves({
        success: true,
        status: httpStatus.OK,
        message: "successfully modified the selfie",
        data: { _id: "1", hidden: true },
      });

      await selfieController.hide(req, res, next);

      const body = res.json.firstCall.args[0];
      expect(body.updated_selfie).to.deep.equal({ _id: "1", hidden: true });
    });

    it("maps a failed result to an error response", async () => {
      sinon.stub(selfieUtil, "hide").resolves({
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "selfie not found",
      });

      await selfieController.hide(req, res, next);

      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      const body = res.json.firstCall.args[0];
      expect(body.success).to.be.false;
    });
  });

  describe("delete", () => {
    it("returns 400 and never calls the util layer when validation fails", async () => {
      selfieController.__set__("extractErrorsFromRequest", mockBadRequest);
      const deleteStub = sinon.stub(selfieUtil, "delete");

      await selfieController.delete(req, res, next);

      expect(deleteStub.called).to.be.false;
      expect(next.calledOnce).to.be.true;
    });

    it("maps a successful result to deleted_selfie", async () => {
      sinon.stub(selfieUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "successfully removed the selfie",
        data: { _id: "1" },
      });

      await selfieController.delete(req, res, next);

      const body = res.json.firstCall.args[0];
      expect(body.deleted_selfie).to.deep.equal({ _id: "1" });
    });

    it("maps a failed result to an error response", async () => {
      sinon.stub(selfieUtil, "delete").resolves({
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "selfie not found",
      });

      await selfieController.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      const body = res.json.firstCall.args[0];
      expect(body.success).to.be.false;
    });
  });
});
