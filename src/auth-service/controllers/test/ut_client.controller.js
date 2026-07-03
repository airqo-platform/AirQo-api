require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const clientUtil = require("@utils/client.util");

const createClient = rewire("@controllers/client.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createClient", () => {
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
    createClient.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create()", () => {
    it("should create a client successfully", async () => {
      sinon.stub(clientUtil, "createClient").resolves({
        success: true,
        status: httpStatus.CREATED,
        message: "Client created successfully",
        data: { clientId: "client123" },
      });

      await createClient.create(req, res, next);

      expect(res.status.calledWith(httpStatus.CREATED)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_client: sinon.match.object })).to.be.true;
    });

    it("should handle client creation failure", async () => {
      sinon.stub(clientUtil, "createClient").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to create client",
        errors: { message: "Client creation error" },
      });

      await createClient.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createClient.__set__("extractErrorsFromRequest", mockBadRequest);

      await createClient.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(clientUtil, "createClient").rejects(new Error("Unexpected error"));

      await createClient.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list()", () => {
    it("should list clients successfully", async () => {
      sinon.stub(clientUtil, "listClients").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Clients listed successfully",
        data: [{ clientId: "client123" }],
      });

      await createClient.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, clients: sinon.match.array })).to.be.true;
    });

    it("should handle client listing failure", async () => {
      sinon.stub(clientUtil, "listClients").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to list clients",
        errors: { message: "Error" },
      });

      await createClient.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createClient.__set__("extractErrorsFromRequest", mockBadRequest);

      await createClient.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(clientUtil, "listClients").rejects(new Error("Unexpected error"));

      await createClient.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    it("should delete client successfully", async () => {
      sinon.stub(clientUtil, "deleteClient").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Client deleted successfully",
        data: { clientId: "client123" },
      });

      await createClient.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_client: sinon.match.object })).to.be.true;
    });

    it("should handle client deletion failure", async () => {
      sinon.stub(clientUtil, "deleteClient").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to delete client",
        errors: { message: "Error" },
      });

      await createClient.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createClient.__set__("extractErrorsFromRequest", mockBadRequest);

      await createClient.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(clientUtil, "deleteClient").rejects(new Error("Unexpected error"));

      await createClient.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update()", () => {
    it("should update client successfully", async () => {
      sinon.stub(clientUtil, "updateClient").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Client updated successfully",
        data: { clientId: "client123" },
      });

      await createClient.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_client: sinon.match.object })).to.be.true;
    });

    it("should handle client update failure", async () => {
      sinon.stub(clientUtil, "updateClient").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to update client",
        errors: { message: "Error" },
      });

      await createClient.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createClient.__set__("extractErrorsFromRequest", mockBadRequest);

      await createClient.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(clientUtil, "updateClient").rejects(new Error("Unexpected error"));

      await createClient.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
