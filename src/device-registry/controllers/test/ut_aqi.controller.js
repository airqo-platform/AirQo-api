require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
const httpStatus = require("http-status");

const aqiController = require("@controllers/aqi.controller");
const aqiUtil = require("@utils/aqi.util");

describe("AQI Controller", () => {
  describe("listRanges", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = { query: {}, params: {} };
      res = {
        status: sinon.stub().callsFake(function() { return res; }),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        message: "Successfully retrieved AQI ranges",
        data: {
          standard: "US EPA PM2.5 AQI (2024 NAAQS revision)",
          ranges: [{ key: "good", label: "Good" }],
        },
      };
      sinon.stub(aqiUtil, "listRanges").returns(mockResult);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("returns 200 with the ranges from the util layer", async () => {
      await aqiController.listRanges(req, res, next);

      expect(aqiUtil.listRanges).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        data: mockResult.data,
      });
    });

    it("forwards unexpected errors to next() as an HttpError", async () => {
      aqiUtil.listRanges.throws(new Error("unexpected failure"));

      await aqiController.listRanges(req, res, next);

      expect(next.calledOnce).to.equal(true);
      const err = next.getCall(0).args[0];
      expect(err.message).to.equal("Internal Server Error");
    });
  });
});
