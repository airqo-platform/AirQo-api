require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const transactionModel = require("@models/transaction");

// Stub the mongoose model's create and aggregate methods
const mongoose = require("mongoose");
const createStub = sinon.stub(mongoose.Model, "create");
const aggregateStub = sinon.stub(mongoose.Model, "aggregate");
const findOneAndRemoveStub = sinon.stub(mongoose.Model, "findOneAndRemove");

// Mock the request object for testing
const request = {
  body: {
    amount: 100,
    host_id: "host123",
    ext_transaction_id: "ext123",
    status: "completed",
    batch_id: "batch123",
    request_id: "request123",
  },
};

describe("transactionModel", () => {
  describe("register", () => {
    it("should create a transaction and return success response", async () => {
      // Stub the create method to resolve with the mocked data
      createStub.resolves({ _id: "transaction123", ...request.body });

      // Execute the function
      const response = await TransactionModel.register(request.body);

      // Assert the response
      expect(response).to.deep.equal({
        success: true,
        status: 200,
        data: { _id: "transaction123", ...request.body },
        message: "transaction created",
      });
    });

    it("should return an error response if the transaction already exists", async () => {
      // Stub the create method to reject with a duplicate error
      const duplicateError = new Error();
      duplicateError.code = 11000;
      duplicateError.keyPattern = { host_id: 1 };
      createStub.rejects(duplicateError);

      // Execute the function
      const response = await TransactionModel.register(request.body);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 500,
        errors: { host_id: "duplicate value" },
        message: "validation errors for some of the provided fields",
      });
    });

    it("should return an error response if validation errors occur", async () => {
      // Stub the create method to reject with a validation error
      const validationError = new Error();
      validationError.errors = {
        amount: { path: "amount", message: "Amount is required" },
      };
      createStub.rejects(validationError);

      // Execute the function
      const response = await TransactionModel.register(request.body);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 500,
        errors: { amount: "Amount is required" },
        message: "validation errors for some of the provided fields",
      });
    });

    it("should return an error response if an internal server error occurs", async () => {
      // Stub the create method to reject with an error
      createStub.rejects(new Error("Some internal error"));

      // Execute the function
      const response = await TransactionModel.register(request.body);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 500,
        errors: { message: "Some internal error" },
        message: "Internal Server Error",
      });
    });
  });

  describe("list", () => {
    it("should return a list of transactions", async () => {
      const transactionsData = [
        { _id: "transaction1", ...request.body },
        { _id: "transaction2", ...request.body },
      ];
      // Stub the aggregate method to resolve with the mocked data
      aggregateStub.returns({
        match: sinon.stub().returnsThis(),
        addFields: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(transactionsData),
      });

      // Execute the function
      const response = await TransactionModel.list();

      // Assert the response
      expect(response).to.deep.equal({
        success: true,
        status: 200,
        data: transactionsData,
        message: "successfully listed the transactions",
      });
    });

    it("should return a not found response if no transactions are found", async () => {
      // Stub the aggregate method to resolve with an empty array
      aggregateStub.returns({
        match: sinon.stub().returnsThis(),
        addFields: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([]),
      });

      // Execute the function
      const response = await TransactionModel.list();

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 404,
        message: "no transactions exist for this search",
      });
    });

    it("should return an error response if an internal server error occurs", async () => {
      // Stub the aggregate method to reject with an error
      aggregateStub.returns({
        match: sinon.stub().returnsThis(),
        addFields: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(new Error("Some internal error")),
      });

      // Execute the function
      const response = await TransactionModel.list();

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 500,
        errors: { message: "Some internal error" },
        message: "Internal Server Error",
      });
    });
  });

  describe("modify", () => {
    it("should modify the transaction and return success response", async () => {
      const updatedTransactionData = {
        _id: "transaction123",
        ...request.body,
        amount: 200,
      };

      // Stub the findOneAndUpdate method to resolve with the mocked data
      findOneAndUpdateStub.resolves(updatedTransactionData);

      // Execute the function
      const response = await TransactionModel.modify({
        filter: { _id: "transaction123" },
        update: { amount: 200 },
      });

      // Assert the response
      expect(response).to.deep.equal({
        success: true,
        status: 200,
        data: updatedTransactionData,
        message: "successfully modified the transaction",
      });
    });

    it("should return a not found response if the transaction does not exist", async () => {
      // Stub the findOneAndUpdate method to resolve with null
      findOneAndUpdateStub.resolves(null);

      // Execute the function
      const response = await TransactionModel.modify({
        filter: { _id: "transaction123" },
        update: { amount: 200 },
      });

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 404,
        errors: { message: "transaction does not exist" },
        message: "transaction does not exist, please crosscheck",
      });
    });

    it("should return an error response if an internal server error occurs", async () => {
      // Stub the findOneAndUpdate method to reject with an error
      findOneAndUpdateStub.rejects(new Error("Some internal error"));

      // Execute the function
      const response = await TransactionModel.modify({
        filter: { _id: "transaction123" },
        update: { amount: 200 },
      });

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 500,
        errors: { message: "Some internal error" },
        message: "Internal Server Error",
      });
    });
  });

  describe("remove", () => {
    it("should remove the transaction and return success response", async () => {
      const removedTransactionData = {
        _id: "transaction123",
        ...request.body,
      };

      // Stub the findOneAndRemove method to resolve with the mocked data
      findOneAndRemoveStub.resolves(removedTransactionData);

      // Execute the function
      const response = await TransactionModel.remove({
        filter: { _id: "transaction123" },
      });

      // Assert the response
      expect(response).to.deep.equal({
        success: true,
        status: 200,
        data: removedTransactionData,
        message: "successfully removed the transaction",
      });
    });

    it("should return a not found response if the transaction does not exist", async () => {
      // Stub the findOneAndRemove method to resolve with null
      findOneAndRemoveStub.resolves(null);

      // Execute the function
      const response = await TransactionModel.remove({
        filter: { _id: "transaction123" },
      });

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 404,
        errors: { message: "transaction does not exist" },
        message: "transaction does not exist, please crosscheck",
      });
    });

    it("should return an error response if an internal server error occurs", async () => {
      // Stub the findOneAndRemove method to reject with an error
      findOneAndRemoveStub.rejects(new Error("Some internal error"));

      // Execute the function
      const response = await TransactionModel.remove({
        filter: { _id: "transaction123" },
      });

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        status: 500,
        errors: { message: "Some internal error" },
        message: "Internal Server Error",
      });
    });
  });
});

// Restore the stubs after running the tests
afterEach(() => {
  sinon.restore();
});
