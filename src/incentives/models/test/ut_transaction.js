require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const transactionModel = require("@models/Transaction");

describe("transactionModel", () => {
  describe("register", () => {
    it("should create a new transaction", async () => {
      const args = {
        amount: 100,
        host_id: "1234567890",
        description: "Payment",
        transaction_id: "ABC123",
        status: "pending",
      };

      const createStub = sinon.stub(transactionModel, "create").resolves(args);

      const result = await transactionModel.register(args);

      expect(createStub.calledOnceWith(args)).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        data: args,
        message: "transaction created",
        status: httpStatus.OK,
      });

      createStub.restore();
    });

    it("should handle validation errors", async () => {
      const args = {
        amount: 100,
        host_id: "1234567890",
        description: "Payment",
        transaction_id: "ABC123",
        status: "pending",
      };

      const error = new Error("Validation error");
      error.errors = {
        transaction_id: { message: "Transaction ID already exists" },
      };

      const createStub = sinon.stub(transactionModel, "create").throws(error);

      const result = await transactionModel.register(args);

      expect(createStub.calledOnceWith(args)).to.be.true;
      expect(result).to.deep.equal({
        errors: { transaction_id: "Transaction ID already exists" },
        message: "validation errors for some of the provided fields",
        success: false,
        status: httpStatus.CONFLICT,
      });

      createStub.restore();
    });

    // Add more test cases for the register method if needed
  });

  describe("list", () => {
    it("should list transactions with filter and pagination", async () => {
      const filter = { host_id: "1234567890" };
      const skip = 0;
      const limit = 5;
      const transactions = [
        {
          amount: 100,
          host_id: "1234567890",
          description: "Payment",
          transaction_id: "ABC123",
          status: "pending",
        },
        {
          amount: 200,
          host_id: "1234567890",
          description: "Refund",
          transaction_id: "DEF456",
          status: "completed",
        },
      ];

      const aggregateStub = sinon.stub().returnsThis();
      const matchStub = sinon.stub().returnsThis();
      const addFieldsStub = sinon.stub().returnsThis();
      const sortStub = sinon.stub().returnsThis();
      const skipStub = sinon.stub().returnsThis();
      const limitStub = sinon.stub().returnsThis();
      const execStub = sinon.stub().resolves(transactions);

      const modelStub = {
        aggregate: aggregateStub,
      };

      aggregateStub.returns({
        match: matchStub,
        addFields: addFieldsStub,
        sort: sortStub,
        skip: skipStub,
        limit: limitStub,
        exec: execStub,
      });

      const result = await transactionModel.list({ filter, skip, limit });

      expect(result).to.deep.equal({
        success: true,
        data: transactions,
        message: "successfully listed the transactions",
        status: httpStatus.OK,
      });

      expect(aggregateStub.calledOnce).to.be.true;
      expect(matchStub.calledOnceWith(filter)).to.be.true;
      expect(addFieldsStub.calledOnce).to.be.true;
      expect(sortStub.calledOnceWith({ createdAt: -1 })).to.be.true;
      expect(skipStub.calledOnceWith(skip)).to.be.true;
      expect(limitStub.calledOnceWith(limit)).to.be.true;
      expect(execStub.calledOnce).to.be.true;
    });

    // Add more test cases for the list method if needed
  });

  describe("modify", () => {
    it("should modify an existing transaction", async () => {
      const filter = { _id: "1234567890" };
      const update = { amount: 200, status: "completed" };
      const modifiedUpdate = { amount: 200, status: "completed", __v: 1 };
      const updatedTransaction = {
        _id: "1234567890",
        amount: 200,
        status: "completed",
      };

      const findOneAndUpdateStub = sinon
        .stub(transactionModel, "findOneAndUpdate")
        .resolves(updatedTransaction);

      const result = await transactionModel.modify({ filter, update });

      expect(
        findOneAndUpdateStub.calledOnceWith(filter, modifiedUpdate, {
          new: true,
        })
      ).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "successfully modified the transaction",
        data: updatedTransaction,
        status: httpStatus.OK,
      });

      findOneAndUpdateStub.restore();
    });

    // Add more test cases for the modify method if needed
  });

  describe("remove", () => {
    it("should remove an existing transaction", async () => {
      const filter = { _id: "1234567890" };
      const removedTransaction = {
        _id: "1234567890",
        amount: 100,
        host_id: "1234567890",
        description: "Payment",
        transaction_id: "ABC123",
        status: "pending",
      };

      const findOneAndRemoveStub = sinon
        .stub(transactionModel, "findOneAndRemove")
        .resolves(removedTransaction);

      const result = await transactionModel.remove({ filter });

      expect(
        findOneAndRemoveStub.calledOnceWith(filter, {
          projection: {
            _id: 1,
            amount: 1,
            host_id: 1,
            description: 1,
            transaction_id: 1,
            status: 1,
          },
        })
      ).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "successfully removed the transaction",
        data: removedTransaction,
        status: httpStatus.OK,
      });

      findOneAndRemoveStub.restore();
    });

    // Add more test cases for the remove method if needed
  });
});
