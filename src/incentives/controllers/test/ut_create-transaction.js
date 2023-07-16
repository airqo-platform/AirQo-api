require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const createTransactionUtil = require("@utils/create-transaction");
const createTransaction = require("@controllers/create-transaction");

describe("createTransaction", () => {
  describe("sendMoneyToHost", () => {
    it("should send money to host", async () => {
      const req = {
        query: {},
        body: { hostId: "123", amount: 100 },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Money sent to host",
        data: { id: "123", hostId: "123", amount: 100 },
      });

      await createTransaction.sendMoneyToHost(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnceWith(req)).to.be
        .true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Money sent to host",
          transaction: { id: "123", hostId: "123", amount: 100 },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    // Add more test cases for the sendMoneyToHost method if needed
  });

  describe("addMoneyToOrganisationAccount", () => {
    it("should add money to the organisation account", async () => {
      const req = {
        query: {},
        body: { amount: 100 },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Money added to organisation account",
        data: { id: "123", amount: 100 },
      });

      await createTransaction.addMoneyToOrganisationAccount(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnceWith(req)).to.be
        .true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Money added to organisation account",
          transaction: { id: "123", amount: 100 },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    // Add more test cases for the addMoneyToOrganisationAccount method if needed
  });

  describe("receiveMoneyFromHost", () => {
    it("should receive money from host", async () => {
      const req = {
        query: {},
        body: { hostId: "123", amount: 100 },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Money received from host",
        data: { id: "123", hostId: "123", amount: 100 },
      });

      await createTransaction.receiveMoneyFromHost(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnceWith(req)).to.be
        .true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Money received from host",
          transaction: { id: "123", hostId: "123", amount: 100 },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    // Add more test cases for the receiveMoneyFromHost method if needed
  });

  describe("getTransactionDetails", () => {
    it("should get transaction details", async () => {
      const req = {
        query: {},
        body: { transactionId: "123" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Transaction details retrieved",
        data: { id: "123", hostId: "123", amount: 100 },
      });

      await createTransaction.getTransactionDetails(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnceWith(req)).to.be
        .true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Transaction details retrieved",
          transaction: { id: "123", hostId: "123", amount: 100 },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    // Add more test cases for the getTransactionDetails method if needed
  });

  describe("loadDataBundle", () => {
    it("should load data bundle", async () => {
      const req = {
        query: {},
        body: { simCardId: "123", dataAmount: "1GB" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Data bundle loaded",
        data: { id: "123", simCardId: "123", dataAmount: "1GB" },
      });

      await createTransaction.loadDataBundle(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnceWith(req)).to.be
        .true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Data bundle loaded",
          transaction: { id: "123", simCardId: "123", dataAmount: "1GB" },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    // Add more test cases for the loadDataBundle method if needed
  });

  describe("checkRemainingDataBundleBalance", () => {
    it("should check remaining data bundle balance", async () => {
      const req = {
        query: {},
        body: { simCardId: "123" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createTransactionUtil, "sendMoneyToHost").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Remaining data bundle balance checked",
        data: { simCardId: "123", remainingBalance: "500MB" },
      });

      await createTransaction.checkRemainingDataBundleBalance(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createTransactionUtil.sendMoneyToHost.calledOnceWith(req)).to.be
        .true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Remaining data bundle balance checked",
          transaction: { simCardId: "123", remainingBalance: "500MB" },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createTransactionUtil.sendMoneyToHost.restore();
    });

    // Add more test cases for the checkRemainingDataBundleBalance method if needed
  });
});
