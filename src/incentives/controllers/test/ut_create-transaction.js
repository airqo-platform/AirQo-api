require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const createTransactionUtil = require("@utils/create-transaction");
const createTransaction = require("@controllers/create-transaction");

describe("Create Transaction Controller", () => {
  describe("sendMoneyToHost", () => {
    let req;
    let res;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
    });

    it("should return success response when sendMoneyToHostUtil returns success", async () => {
      sinon.stub(validationResult, "isEmpty").returns(true);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Transaction successful",
        data: { transactionId: "12345" },
      });

      await createTransactionController.sendMoneyToHost(req, res);

      expect(validationResult.isEmpty.calledOnce).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "Transaction successful",
          transaction: { transactionId: "12345" },
        })
      ).to.be.true;

      validationResult.isEmpty.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    it("should return error response when input validation fails", async () => {
      sinon.stub(validationResult, "isEmpty").returns(false);
      const nestedErrors = [{ msg: "Invalid amount" }];
      sinon.stub(validationResult, "errors").value([{ nestedErrors }]);
      sinon.stub(createTransactionUtil, "sendMoneyToHost");

      await createTransactionController.sendMoneyToHost(req, res);

      expect(validationResult.isEmpty.calledOnce).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.called).to.be.false;
      expect(res.status.calledOnceWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: { msg: "Invalid amount" },
        })
      ).to.be.true;

      validationResult.isEmpty.restore();
      validationResult.errors.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    it("should return error response when sendMoneyToHostUtil returns error", async () => {
      sinon.stub(validationResult, "isEmpty").returns(true);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Transaction failed",
      });

      await createTransactionController.sendMoneyToHost(req, res);

      expect(validationResult.isEmpty.calledOnce).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "Transaction failed",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;

      validationResult.isEmpty.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    it("should return error response when sendMoneyToHostUtil throws an error", async () => {
      sinon.stub(validationResult, "isEmpty").returns(true);
      sinon
        .stub(createTransactionUtil, "sendMoneyToHost")
        .throws(new Error("Internal Server Error"));

      await createTransactionController.sendMoneyToHost(req, res);

      expect(validationResult.isEmpty.calledOnce).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWithExactly({
          message: "Internal Server Error",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;

      validationResult.isEmpty.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });
  });

  // Add more tests for other controller functions if needed
});
