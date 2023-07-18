const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");

const TransactionModel = require("@models/Transaction");
const createTransaction = require("@utils/create-transaction");

describe("createTransaction", () => {
  let request;

  beforeEach(() => {
    request = {
      // mock request object
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getFirstBearerToken", () => {
    it("should return the first bearer token", async () => {
      // Stub the axios post function
      sinon.stub(createTransaction.api, "post").resolves({
        status: httpStatus.OK,
        data: { token: "firstBearerToken" },
      });

      const response = await createTransaction.getFirstBearerToken();

      // Assert the response
      expect(response).to.equal("firstBearerToken");

      // Restore the stubbed function
      createTransaction.api.post.restore();
    });

    it("should handle unauthorized error", async () => {
      // Stub the axios post function
      sinon.stub(createTransaction.api, "post").resolves({
        status: httpStatus.UNAUTHORIZED,
      });

      const response = await createTransaction.getFirstBearerToken();

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Unauthorized",
        errors: { message: "Not Authorized" },
        status: httpStatus.UNAUTHORIZED,
      });

      // Restore the stubbed function
      createTransaction.api.post.restore();
    });

    it("should handle internal server error", async () => {
      // Stub the axios post function
      sinon
        .stub(createTransaction.api, "post")
        .rejects(new Error("Error message"));

      const response = await createTransaction.getFirstBearerToken();

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Error message" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Restore the stubbed function
      createTransaction.api.post.restore();
    });
  });

  describe("getSecondBearerToken", () => {
    it("should return the second bearer token", async () => {
      // Stub the axios post function
      sinon.stub(createTransaction.api, "post").resolves({
        status: httpStatus.OK,
        data: { token: "secondBearerToken" },
      });

      const response = await createTransaction.getSecondBearerToken(
        "firstBearerToken"
      );

      // Assert the response
      expect(response).to.equal("secondBearerToken");

      // Restore the stubbed function
      createTransaction.api.post.restore();
    });

    it("should handle unauthorized error", async () => {
      // Stub the axios post function
      sinon.stub(createTransaction.api, "post").resolves({
        status: httpStatus.UNAUTHORIZED,
      });

      const response = await createTransaction.getSecondBearerToken(
        "firstBearerToken"
      );

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Unauthorized",
        errors: { message: "Not Authorized" },
        status: httpStatus.UNAUTHORIZED,
      });

      // Restore the stubbed function
      createTransaction.api.post.restore();
    });

    it("should handle internal server error", async () => {
      // Stub the axios post function
      sinon
        .stub(createTransaction.api, "post")
        .rejects(new Error("Error message"));

      const response = await createTransaction.getSecondBearerToken(
        "firstBearerToken"
      );

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Error message" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Restore the stubbed function
      createTransaction.api.post.restore();
    });
  });

  describe("sendMoneyToHost", () => {
    it("should successfully send money to host", async () => {
      const request = {
        // Mock request object
        amount: 100,
        host_id: "host123",
        // Add other properties as required
      };

      const firstBearerToken = "firstBearerToken";
      const secondBearerToken = "secondBearerToken";
      const responseFromSaveTransaction = {
        success: true,
        message: "Transaction successfully saved",
        data: {}, // Mocked data object
      };

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon
        .stub(createTransaction, "getFirstBearerToken")
        .resolves(firstBearerToken);
      sinon
        .stub(createTransaction, "getSecondBearerToken")
        .resolves(secondBearerToken);

      // Stub the axios create and post functions
      sinon
        .stub(createTransaction.api, "create")
        .returns(createTransaction.api);
      sinon.stub(createTransaction.api, "post").resolves({
        status: httpStatus.OK,
        data: {
          status: "success",
          data: {
            requestId: "request123",
            batchId: "batch123",
            transactionId: "transaction123",
            // Add other properties as required
          },
        },
      });

      // Stub the TransactionModel register function
      sinon
        .stub(TransactionModel.prototype, "register")
        .resolves(responseFromSaveTransaction);

      const response = await createTransaction.sendMoneyToHost(request);

      // Assert the response
      expect(response).to.deep.equal(responseFromSaveTransaction);

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      createTransaction.api.create.restore();
      createTransaction.api.post.restore();
      TransactionModel.prototype.register.restore();
    });

    it("should handle internal server error", async () => {
      const request = {
        // Mock request object
        amount: 100,
        host_id: "host123",
        // Add other properties as required
      };

      const error = new Error("Error message");

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon.stub(createTransaction, "getFirstBearerToken").throws(error);
      sinon.stub(createTransaction, "getSecondBearerToken").throws(error);

      // Stub the axios create and post functions
      sinon
        .stub(createTransaction.api, "create")
        .returns(createTransaction.api);
      sinon.stub(createTransaction.api, "post").throws(error);

      // Stub the logger error function
      sinon.stub(logger, "error");

      const response = await createTransaction.sendMoneyToHost(request);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Error message" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Assert that the logger error function was called
      expect(logger.error).to.have.been.calledOnceWithExactly(
        `Internal Server Error --- ${error}`
      );

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      createTransaction.api.create.restore();
      createTransaction.api.post.restore();
      logger.error.restore();
    });

    // Add more test cases as required
  });

  describe("addMoneyToOrganisationAccount", () => {
    it("should successfully add money to the organization account", async () => {
      const request = {
        // Mock request object
        amount: 100,
        host_id: "host123",
        // Add other properties as required
      };

      const firstBearerToken = "firstBearerToken";
      const secondBearerToken = "secondBearerToken";
      const responseFromSaveTransaction = {
        success: true,
        message: "Transaction successfully saved",
        data: {}, // Mocked data object
      };

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon
        .stub(createTransaction, "getFirstBearerToken")
        .resolves(firstBearerToken);
      sinon
        .stub(createTransaction, "getSecondBearerToken")
        .resolves(secondBearerToken);

      // Stub the axios create and post functions
      sinon
        .stub(createTransaction.api, "create")
        .returns(createTransaction.api);
      sinon.stub(createTransaction.api, "post").resolves({
        status: httpStatus.OK,
        data: {
          status: "success",
          data: {
            requestId: "request123",
            batchId: "batch123",
            transactionId: "transaction123",
            // Add other properties as required
          },
        },
      });

      // Stub the TransactionModel register function
      sinon
        .stub(TransactionModel.prototype, "register")
        .resolves(responseFromSaveTransaction);

      const response = await createTransaction.addMoneyToOrganisationAccount(
        request
      );

      // Assert the response
      expect(response).to.deep.equal(responseFromSaveTransaction);

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      createTransaction.api.create.restore();
      createTransaction.api.post.restore();
      TransactionModel.prototype.register.restore();
    });

    it("should handle internal server error", async () => {
      const request = {
        // Mock request object
        amount: 100,
        host_id: "host123",
        // Add other properties as required
      };

      const error = new Error("Error message");

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon.stub(createTransaction, "getFirstBearerToken").throws(error);
      sinon.stub(createTransaction, "getSecondBearerToken").throws(error);

      // Stub the axios create and post functions
      sinon
        .stub(createTransaction.api, "create")
        .returns(createTransaction.api);
      sinon.stub(createTransaction.api, "post").throws(error);

      // Stub the logger error function
      sinon.stub(logger, "error");

      const response = await createTransaction.addMoneyToOrganisationAccount(
        request
      );

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Error message" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Assert that the logger error function was called
      expect(logger.error).to.have.been.calledOnceWithExactly(
        `Internal Server Error --- ${error}`
      );

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      createTransaction.api.create.restore();
      createTransaction.api.post.restore();
      logger.error.restore();
    });

    // Add more test cases as required
  });

  describe("receiveMoneyFromHost", () => {
    it("should successfully receive money from the host", async () => {
      const request = {
        // Mock request object
        amount: 100,
        host_id: "host123",
        // Add other properties as required
      };

      const firstBearerToken = "firstBearerToken";
      const secondBearerToken = "secondBearerToken";
      const responseFromSaveTransaction = {
        success: true,
        message: "Transaction successfully saved",
        data: {}, // Mocked data object
      };

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon
        .stub(createTransaction, "getFirstBearerToken")
        .resolves(firstBearerToken);
      sinon
        .stub(createTransaction, "getSecondBearerToken")
        .resolves(secondBearerToken);

      // Stub the axios create and post functions
      sinon
        .stub(createTransaction.api, "create")
        .returns(createTransaction.api);
      sinon.stub(createTransaction.api, "post").resolves({
        status: httpStatus.OK,
        data: {
          status: "success",
          data: {
            requestId: "request123",
            batchId: "batch123",
            transactionId: "transaction123",
            // Add other properties as required
          },
        },
      });

      // Stub the TransactionModel register function
      sinon
        .stub(TransactionModel.prototype, "register")
        .resolves(responseFromSaveTransaction);

      const response = await createTransaction.receiveMoneyFromHost(request);

      // Assert the response
      expect(response).to.deep.equal(responseFromSaveTransaction);

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      createTransaction.api.create.restore();
      createTransaction.api.post.restore();
      TransactionModel.prototype.register.restore();
    });

    it("should handle internal server error", async () => {
      const request = {
        // Mock request object
        amount: 100,
        host_id: "host123",
        // Add other properties as required
      };

      const error = new Error("Error message");

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon.stub(createTransaction, "getFirstBearerToken").throws(error);
      sinon.stub(createTransaction, "getSecondBearerToken").throws(error);

      // Stub the axios create and post functions
      sinon
        .stub(createTransaction.api, "create")
        .returns(createTransaction.api);
      sinon.stub(createTransaction.api, "post").throws(error);

      // Stub the logger error function
      sinon.stub(logger, "error");

      const response = await createTransaction.receiveMoneyFromHost(request);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Assert that the logger error function was called
      expect(logger.error).to.have.been.calledOnceWithExactly(
        `Internal Server Error --- ${error}`
      );

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      createTransaction.api.create.restore();
      createTransaction.api.post.restore();
      logger.error.restore();
    });

    // Add more test cases as required
  });

  describe("getTransactionDetails", () => {
    it("should successfully retrieve transaction details", async () => {
      const request = {
        // Mock request object
        params: {
          transaction_id: "transaction123",
        },
        // Add other properties as required
      };

      const firstBearerToken = "firstBearerToken";
      const secondBearerToken = "secondBearerToken";
      const responseFromApi = {
        status: httpStatus.OK,
        data: {
          status: "success",
          data: {
            transactionId: "transaction123",
            // Add other properties as required
          },
        },
      };

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon
        .stub(createTransaction, "getFirstBearerToken")
        .resolves(firstBearerToken);
      sinon
        .stub(createTransaction, "getSecondBearerToken")
        .resolves(secondBearerToken);

      // Stub the axios create and get functions
      sinon
        .stub(createTransaction.api, "create")
        .returns(createTransaction.api);
      sinon.stub(createTransaction.api, "get").resolves(responseFromApi);

      const response = await createTransaction.getTransactionDetails(request);

      // Assert the response
      expect(response).to.deep.equal({
        success: true,
        message: "Successfully retrieved the data",
        data: responseFromApi.data.data,
        status: httpStatus.OK,
      });

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      createTransaction.api.create.restore();
      createTransaction.api.get.restore();
    });

    it("should handle internal server error", async () => {
      const request = {
        // Mock request object
        params: {
          transaction_id: "transaction123",
        },
        // Add other properties as required
      };

      const error = new Error("Error message");

      // Stub the getFirstBearerToken and getSecondBearerToken functions
      sinon.stub(createTransaction, "getFirstBearerToken").throws(error);
      sinon.stub(createTransaction, "getSecondBearerToken").throws(error);

      // Stub the logger error function
      sinon.stub(logger, "error");

      const response = await createTransaction.getTransactionDetails(request);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Assert that the logger error function was called
      expect(logger.error).to.have.been.calledOnceWithExactly(
        `Internal Server Error --- ${error}`
      );

      // Restore the stubbed functions
      createTransaction.getFirstBearerToken.restore();
      createTransaction.getSecondBearerToken.restore();
      logger.error.restore();
    });

    // Add more test cases as required
  });

  describe("loadDataBundle", () => {
    it("should handle internal server error", async () => {
      // Stub the getFirstBearerToken and getSecondBearerToken functions
      const stubFirstBearerToken = sinon.stub().resolves("firstBearerToken");
      const stubSecondBearerToken = sinon.stub().resolves("secondBearerToken");

      // Replace the actual functions with the stubs
      const getFirstBearerToken = stubFirstBearerToken;
      const getSecondBearerToken = stubSecondBearerToken;

      // Mock the necessary dependencies
      const axios = {
        create: sinon.stub().returns({
          post: sinon.stub().resolves({
            data: {
              status: "success",
              data: {
                requestId: "12345",
                batchId: "batchId123",
                transactionId: "transactionId123",
              },
            },
          }),
        }),
      };
      const TransactionModel = sinon.stub().returns({
        register: sinon.stub().resolves({
          /* your desired response object */
        }),
      });

      // Your test code here
      const request = {
        /* your request data here */
      };
      const response = await createTransaction.loadDataBundle(request);

      // Assertions and expectations
      // ...
    });
  });

  describe("checkRemainingDataBundleBalance", () => {
    it("should return 'Not Yet Implemented' response", async () => {
      const request = {
        // Mock request object if required
      };

      const response = await createTransaction.checkRemainingDataBundleBalance(
        request
      );

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Not Yet Implemented",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "Not Yet Implemented" },
      });
    });

    // Add more test cases as required
  });
});
