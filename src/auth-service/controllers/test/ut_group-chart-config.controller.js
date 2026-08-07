require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const httpStatus = require("http-status");
const rewire = require("rewire");
const groupChartConfigUtil = require("@utils/group-chart-config.util");

const controller = rewire("@controllers/group-chart-config.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("group-chart-config controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: { tenant: "airqo" },
      body: {},
      params: { grp_id: "grp1", deviceId: "device1", chartId: "chart1" },
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    controller.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create()", () => {
    it("forwards grp_id/deviceId from params into the util call's body", async () => {
      const createStub = sinon.stub(groupChartConfigUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "created",
        data: { fieldId: 1 },
      });

      await controller.create(req, res, next);

      expect(createStub.calledOnce).to.equal(true);
      const forwardedRequest = createStub.getCall(0).args[0];
      expect(forwardedRequest.body.groupId).to.equal("grp1");
      expect(forwardedRequest.body.deviceId).to.equal("device1");
      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
    });

    it("forwards bad request errors to next()", async () => {
      controller.__set__("extractErrorsFromRequest", mockBadRequest);

      await controller.create(req, res, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.BAD_REQUEST
      );
    });

    it("catches an unexpected throw from the util layer", async () => {
      sinon.stub(groupChartConfigUtil, "create").rejects(new Error("boom"));

      await controller.create(req, res, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("update()", () => {
    it("forwards grp_id from params as groupId", async () => {
      const updateStub = sinon.stub(groupChartConfigUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "updated",
        data: {},
      });

      await controller.update(req, res, next);

      const forwardedRequest = updateStub.getCall(0).args[0];
      expect(forwardedRequest.params.groupId).to.equal("grp1");
    });
  });

  describe("delete()", () => {
    it("returns the util layer's status/message on success", async () => {
      sinon.stub(groupChartConfigUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "deleted",
      });

      await controller.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      expect(
        res.json.calledWithMatch({ success: true, message: "deleted" })
      ).to.equal(true);
    });
  });

  describe("list()", () => {
    it("returns data from the util layer", async () => {
      sinon.stub(groupChartConfigUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "ok",
        data: [{ fieldId: 1 }],
      });

      await controller.list(req, res, next);

      expect(
        res.json.calledWithMatch({ data: [{ fieldId: 1 }] })
      ).to.equal(true);
    });
  });

  describe("getById()", () => {
    it("returns 404 when the util layer reports not found", async () => {
      sinon.stub(groupChartConfigUtil, "getById").resolves({
        success: false,
        status: httpStatus.NOT_FOUND,
        message: "Chart configuration not found",
      });

      await controller.getById(req, res, next);

      expect(res.status.calledWith(httpStatus.NOT_FOUND)).to.equal(true);
    });
  });
});
