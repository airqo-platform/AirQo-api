require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const networkUtil = require("@utils/network.util");

const createNetwork = rewire("@controllers/network.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createNetwork", () => {
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
    createNetwork.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("list()", () => {
    it("should list networks successfully", async () => {
      sinon.stub(networkUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Networks listed successfully",
        data: [{ name: "network1" }],
      });

      await createNetwork.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, networks: sinon.match.array })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createNetwork.__set__("extractErrorsFromRequest", mockBadRequest);

      await createNetwork.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle listing failure", async () => {
      sinon.stub(networkUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Listing failed",
        errors: { message: "Error" },
      });

      await createNetwork.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(networkUtil, "list").rejects(new Error("Unexpected error"));

      await createNetwork.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create()", () => {
    it("should create network successfully", async () => {
      sinon.stub(networkUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network created successfully",
        data: { name: "network1" },
      });

      await createNetwork.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_network: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createNetwork.__set__("extractErrorsFromRequest", mockBadRequest);

      await createNetwork.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle creation failure", async () => {
      sinon.stub(networkUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Creation failed",
        errors: { message: "Error" },
      });

      await createNetwork.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(networkUtil, "create").rejects(new Error("Unexpected error"));

      await createNetwork.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
