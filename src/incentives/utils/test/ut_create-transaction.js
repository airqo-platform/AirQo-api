require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");

const TransactionModel = require("@models/Transaction");
const createTransaction = require("@utils/create-transaction");

const axios = require("axios");
const sinonChai = require("sinon-chai");
const chaiHttp = require("chai-http");
chai.use(sinonChai);
chai.use(chaiHttp);

describe("createTransaction", () => {
  let request;
  let sandbox;

  beforeEach(() => {
    sinon.createSandbox();
    request = {
      // mock request object
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("createProductItemForMobileMoneyPayout", () => {
    it("should return the correct paymentProvider for airtelCodes", () => {
      const phone_number = "0751234567"; // Example phone number for airtelCodes
      const expectedResult = {
        paymentProvider: "AIRTELMOBILEMONEYPAYOUTUG_AIRTELMOBILEMONEYPAYOUTUG",
      };

      const result = createProductItemForMobileMoneyPayout(phone_number);
      expect(result).to.deep.equal(expectedResult);
    });

    it("should return the correct paymentProvider for mtnCodes", () => {
      const phone_number = "0781234567"; // Example phone number for mtnCodes
      const expectedResult = {
        paymentProvider: "MTNMOBILEMONEYPAYOUTUG_MTNMOBILEMONEYPAYOUTUG",
      };

      const result = createProductItemForMobileMoneyPayout(phone_number);
      expect(result).to.deep.equal(expectedResult);
    });

    it("should return undefined paymentProvider for unknown phone_number", () => {
      const phone_number = "0791234567"; // Example phone number not in airtelCodes or mtnCodes
      const expectedResult = {
        paymentProvider: undefined,
      };

      const result = createProductItemForMobileMoneyPayout(phone_number);
      expect(result).to.deep.equal(expectedResult);
    });
  });

  describe("createPaymentProviderForCollections", () => {
    it("should return the correct productItem for airtelCodes", () => {
      const phone_number = "0751234567"; // Example phone number for airtelCodes
      const expectedResult = {
        productItem: "AIRTELMONEYUG",
      };

      const result = createPaymentProviderForCollections(phone_number);
      expect(result).to.deep.equal(expectedResult);
    });

    it("should return the correct productItem for mtnCodes", () => {
      const phone_number = "0781234567"; // Example phone number for mtnCodes
      const expectedResult = {
        productItem: "MTNMOBILEMONEYUG",
      };

      const result = createPaymentProviderForCollections(phone_number);
      expect(result).to.deep.equal(expectedResult);
    });

    it("should return undefined productItem for unknown phone_number", () => {
      const phone_number = "0791234567"; // Example phone number not in airtelCodes or mtnCodes
      const expectedResult = {
        productItem: undefined,
      };

      const result = createPaymentProviderForCollections(phone_number);
      expect(result).to.deep.equal(expectedResult);
    });
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
    it("should return successful response if the host exists and has a phone number", async () => {
      const request = {
        body: {
          amount: 1000,
          channelId: "channel123",
          customerId: "customer123",
          customerPhone: "123456789",
          customerEmail: "customer@example.com",
          memo: "Payment for service",
          batchId: "batch123",
          requestId: "request123",
          metadata: { key: "value" },
        },
        params: { host_id: "host123" },
        query: { tenant: "tenant123" },
      };

      const expectedResponse = {
        success: true,
        message: "Transaction Successfully Completed",
        // Add other expected response properties here if needed
      };

      // Stubbing the external functions
      const hostData = { _id: "host123", phone_number: "987654321" };
      const axiosPostStub = sinon.stub(axios, "post").resolves({
        data: {
          status: "SUCCESS",
          data: { transactionId: "transaction123" },
        },
      });

      const transactionModelRegisterStub = sinon
        .stub()
        .resolves(expectedResponse);
      const HostModelStub = sinon.stub().returns({
        find: sinon.stub().returns({
          lean: sinon.stub().resolves(hostData),
        }),
      });
      const TransactionModelStub = sinon.stub().returns({
        register: transactionModelRegisterStub,
      });

      // Replace the actual dependencies with stubs for unit testing
      const originalHostModel = require("@models/Host");
      const originalTransactionModel = require("@models/transaction");

      require("@models/Host").hostModel = HostModelStub;
      require("@models/transaction").TransactionModel = TransactionModelStub;

      // Execute the function
      const response = await sendMoneyToHost(request);

      // Restore the original dependencies
      require("@models/Host").hostModel = originalHostModel;
      require("@models/transaction").TransactionModel =
        originalTransactionModel;

      // Assert the response
      expect(response).to.deep.equal(expectedResponse);

      // Assert that the stubbed functions were called with the correct parameters
      sinon.assert.calledWith(HostModelStub, request.query.tenant);
      sinon.assert.calledWith(HostModelStub().find, { _id: "host123" });
      sinon.assert.calledWith(transactionModelRegisterStub, {
        status: "SUCCESS",
        batch_id: request.body.batchId,
        ext_transaction_id: "transaction123",
        request_id: request.body.requestId,
        amount: request.body.amount,
        host_id: "host123",
        description: "Transaction Successfully Completed",
      });

      // Restore the stubs
      axiosPostStub.restore();
    });
  });

  describe("addMoneyToOrganisationAccount", () => {
    it("should return successful response if the API call is successful", async () => {
      const request = {
        body: {
          amount: 1000,
          phone_number: "987654321",
          channelId: "channel123",
          customerId: "customer123",
          customerPhone: "customerPhone123",
          customerEmail: "customer@example.com",
          memo: "Payment for service",
          batchId: "batch123",
          requestId: "request123",
          metadata: { key: "value" },
        },
      };

      const expectedResponse = {
        success: true,
        message: "Transaction Successfully Completed",
        // Add other expected response properties here if needed
      };

      // Stubbing the external functions
      const axiosPostStub = sinon.stub(axios, "post").resolves({
        data: {
          status: "SUCCESS",
          data: { transactionId: "transaction123" },
        },
      });

      const transactionModelRegisterStub = sinon
        .stub()
        .resolves(expectedResponse);
      const createPaymentProviderForCollectionsStub = sinon
        .stub()
        .returns("MOCK_PAYMENT_PROVIDER"); // Replace with the expected payment provider

      // Replace the actual dependencies with stubs for unit testing
      const originalTransactionModel = require("@models/transaction");
      const originalCreatePaymentProviderForCollections = require("./path/to/createPaymentProviderForCollections");

      // Stub the required functions
      sinon
        .stub(require("@models/transaction"), "TransactionModel")
        .get(() => transactionModelRegisterStub);
      sinon
        .stub(
          require("./path/to/createPaymentProviderForCollections"),
          "createPaymentProviderForCollections"
        )
        .returns(createPaymentProviderForCollectionsStub);

      // Execute the function
      const response = await addMoneyToOrganisationAccount(request);

      // Restore the original dependencies
      require("@models/transaction").TransactionModel =
        originalTransactionModel.TransactionModel;
      require("./path/to/createPaymentProviderForCollections").createPaymentProviderForCollections =
        originalCreatePaymentProviderForCollections.createPaymentProviderForCollections;

      // Assert the response
      expect(response).to.deep.equal(expectedResponse);

      // Assert that the stubbed functions were called with the correct parameters
      sinon.assert.calledWith(
        createPaymentProviderForCollectionsStub,
        request.body.phone_number
      );
      sinon.assert.calledWith(transactionModelRegisterStub, {
        status: "SUCCESS",
        batch_id: request.body.batchId,
        ext_transaction_id: "transaction123",
        request_id: request.body.requestId,
        amount: request.body.amount,
        description: "Transaction Successfully Completed",
      });

      // Restore the stubs
      axiosPostStub.restore();
    });
  });

  describe("receiveMoneyFromHost", () => {
    it("should return successful response if the API call is successful", async () => {
      const request = {
        body: {
          amount: 1000,
          host_id: "host123",
          channelId: "channel123",
          customerId: "customer123",
          customerPhone: "customerPhone123",
          customerEmail: "customer@example.com",
          memo: "Payment from host",
          batchId: "batch123",
          requestId: "request123",
          metadata: { key: "value" },
        },
        query: {
          tenant: "tenant123",
        },
      };

      const expectedResponse = {
        success: true,
        message: "Transaction Successfully Completed",
        // Add other expected response properties here if needed
      };

      // Stubbing the external functions
      const axiosPostStub = sinon.stub(axios, "post").resolves({
        data: {
          status: "SUCCESS",
          data: { transactionId: "transaction123" },
        },
      });

      const hostModelFindStub = sinon.stub().resolves({
        phone_number: "987654321",
      });
      const transactionModelRegisterStub = sinon
        .stub()
        .resolves(expectedResponse);
      const createPaymentProviderForCollectionsStub = sinon
        .stub()
        .returns("MOCK_PAYMENT_PROVIDER"); // Replace with the expected payment provider

      // Replace the actual dependencies with stubs for unit testing
      const originalHostModel = require("@models/host");
      const originalTransactionModel = require("@models/transaction");
      const originalCreatePaymentProviderForCollections = require("./path/to/createPaymentProviderForCollections");

      // Stub the required functions
      sinon
        .stub(require("@models/host"), "HostModel")
        .get(() => hostModelFindStub);
      sinon
        .stub(require("@models/transaction"), "TransactionModel")
        .get(() => transactionModelRegisterStub);
      sinon
        .stub(
          require("./path/to/createPaymentProviderForCollections"),
          "createPaymentProviderForCollections"
        )
        .returns(createPaymentProviderForCollectionsStub);

      // Execute the function
      const response = await receiveMoneyFromHost(request);

      // Restore the original dependencies
      require("@models/host").HostModel = originalHostModel.HostModel;
      require("@models/transaction").TransactionModel =
        originalTransactionModel.TransactionModel;
      require("./path/to/createPaymentProviderForCollections").createPaymentProviderForCollections =
        originalCreatePaymentProviderForCollections.createPaymentProviderForCollections;

      // Assert the response
      expect(response).to.deep.equal(expectedResponse);

      // Assert that the stubbed functions were called with the correct parameters
      sinon.assert.calledWith(hostModelFindStub, {
        _id: "host123",
      });
      sinon.assert.calledWith(
        createPaymentProviderForCollectionsStub,
        "987654321"
      );
      sinon.assert.calledWith(transactionModelRegisterStub, {
        status: "SUCCESS",
        batch_id: request.body.batchId,
        ext_transaction_id: "transaction123",
        request_id: request.body.requestId,
        amount: request.body.amount,
        description: "Transaction Successfully Completed",
        host_id: "host123",
      });

      // Restore the stubs
      axiosPostStub.restore();
    });
  });

  describe("getTransactionDetails", () => {
    it("should return successful response if the API call is successful", async () => {
      const request = {
        params: {
          transaction_id: "transaction123",
        },
      };

      const expectedResponse = {
        success: true,
        message: "Successfully retrieved the data",
        data: {
          // Add mock data that would be returned from the API call
          // based on your actual response structure
          // For example:
          transactionId: "transaction123",
          amount: 1000,
          customerId: "customer123",
        },
        status: 200, // HTTP status code for OK
      };

      // Stubbing the external functions
      const axiosGetStub = sinon.stub(axios, "get").resolves({
        data: {
          data: expectedResponse.data, // Assuming the API returns an object with a 'data' property
        },
      });

      // Execute the function
      const response = await getTransactionDetails(request);

      // Assert the response
      expect(response).to.deep.equal(expectedResponse);

      // Assert that the stubbed function was called with the correct parameter
      sinon.assert.calledWith(
        axiosGetStub,
        `${constants.XENTE_BASE_URL}/core/transactions/transaction123`
      );

      // Restore the stub
      axiosGetStub.restore();
    });

    it("should return an error response if the API call fails", async () => {
      const request = {
        params: {
          transaction_id: "transaction123",
        },
      };

      // Stubbing the external function to simulate API call failure
      const axiosGetStub = sinon
        .stub(axios, "get")
        .rejects(new Error("Network Error"));

      // Execute the function
      const response = await getTransactionDetails(request);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Network Error" }, // Assuming the error message from the rejected promise is used
        status: 500, // HTTP status code for Internal Server Error
      });

      // Assert that the stubbed function was called with the correct parameter
      sinon.assert.calledWith(
        axiosGetStub,
        `${constants.XENTE_BASE_URL}/core/transactions/transaction123`
      );

      // Restore the stub
      axiosGetStub.restore();
    });
  });

  describe("loadDataBundle", () => {
    it("should return successful response if the API call is successful", async () => {
      const request = {
        body: {
          amount: 1000,
          phone_number: "phone123",
          product_item: "data_bundle",
          channelId: "channel123",
          customerId: "customer123",
          customerPhone: "customerPhone123",
          customerEmail: "customerEmail@example.com",
          memo: "Load data bundle",
          batchId: "batch123",
          requestId: "request123",
          metadata: { key: "value" },
        },
        query: {
          tenant: "tenant123",
        },
      };

      const expectedResponse = {
        success: true,
        message: "Successfully retrieved the data",
        data: {
          // Add mock data that would be returned from the API call
          // based on your actual response structure
          // For example:
          transactionId: "transaction123",
          amount: 1000,
          customerId: "customer123",
        },
        status: 200, // HTTP status code for OK
      };

      // Stubbing the external functions
      const axiosPostStub = sinon.stub(axios, "post").resolves({
        data: {
          data: expectedResponse.data, // Assuming the API returns an object with a 'data' property
        },
      });

      // Execute the function
      const response = await loadDataBundle(request);

      // Assert the response
      expect(response).to.deep.equal(expectedResponse);

      // Assert that the stubbed function was called with the correct parameters
      const expectedApiUrl = `${constants.XENTE_BASE_URL}/transactions`;
      const expectedLoadDataRequestObject = {
        paymentProvider: constants.XENTE_DATA_PAYMENT_PROVIDER,
        productItem: JSON.stringify("data_bundle"),
        amount: JSON.stringify(1000),
        productReference: JSON.stringify("phone123"),
        paymentReference: constants.XENTE_DATA_PAYMENT_REFERENCE,
        type: constants.XENTE_DATA_TYPE,
        batchId: "batch123",
        requestId: "request123",
        metadata: { key: "value" },
        memo: "Load data bundle",
        channelId: "channel123",
        customerId: "customer123",
        customerPhone: "customerPhone123",
        customerEmail: "customerEmail@example.com",
      };
      sinon.assert.calledWith(
        axiosPostStub,
        expectedApiUrl,
        expectedLoadDataRequestObject
      );

      // Restore the stub
      axiosPostStub.restore();
    });

    it("should return an error response if the API call fails", async () => {
      const request = {
        body: {
          amount: 1000,
          phone_number: "phone123",
          product_item: "data_bundle",
          channelId: "channel123",
          customerId: "customer123",
          customerPhone: "customerPhone123",
          customerEmail: "customerEmail@example.com",
          memo: "Load data bundle",
          batchId: "batch123",
          requestId: "request123",
          metadata: { key: "value" },
        },
        query: {
          tenant: "tenant123",
        },
      };

      // Stubbing the external function to simulate API call failure
      const axiosPostStub = sinon
        .stub(axios, "post")
        .rejects(new Error("Network Error"));

      // Execute the function
      const response = await loadDataBundle(request);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Network Error" }, // Assuming the error message from the rejected promise is used
        status: 500, // HTTP status code for Internal Server Error
      });

      // Assert that the stubbed function was called with the correct parameters
      const expectedApiUrl = `${constants.XENTE_BASE_URL}/transactions`;
      const expectedLoadDataRequestObject = {
        paymentProvider: constants.XENTE_DATA_PAYMENT_PROVIDER,
        productItem: JSON.stringify("data_bundle"),
        amount: JSON.stringify(1000),
        productReference: JSON.stringify("phone123"),
        paymentReference: constants.XENTE_DATA_PAYMENT_REFERENCE,
        type: constants.XENTE_DATA_TYPE,
        batchId: "batch123",
        requestId: "request123",
        metadata: { key: "value" },
        memo: "Load data bundle",
        channelId: "channel123",
        customerId: "customer123",
        customerPhone: "customerPhone123",
        customerEmail: "customerEmail@example.com",
      };
      sinon.assert.calledWith(
        axiosPostStub,
        expectedApiUrl,
        expectedLoadDataRequestObject
      );

      // Restore the stub
      axiosPostStub.restore();
    });
  });

  const chai = require("chai");
  const { expect } = chai;

  const checkRemainingDataBundleBalance =
    createTransaction.checkRemainingDataBundleBalance; // Update the path accordingly

  describe("checkRemainingDataBundleBalance", () => {
    it("should return a 'Not Yet Implemented' response", async () => {
      const request = {
        params: {
          device_id: "device123",
        },
      };

      const expectedResponse = {
        success: false,
        message: "Not Yet Implemented",
        status: 501, // HTTP status code for Not Implemented
        errors: { message: "Not Yet Implemented" },
      };

      // Execute the function
      const response = await checkRemainingDataBundleBalance(request);

      // Assert the response
      expect(response).to.deep.equal(expectedResponse);
    });

    it("should return an error response if an error occurs", async () => {
      const request = {
        params: {
          device_id: "device123",
        },
      };

      const errorMessage = "Something went wrong";

      // Stubbing the log functions to simulate an error
      const logObjectStub = chai.spy.on(console, "error");
      const loggerErrorStub = chai.spy.on(logger, "error");

      // Stubbing the error to be thrown by the function
      const errorStub = new Error(errorMessage);
      const throwStub = chai.spy.on(errorStub, "throw");

      // Execute the function
      const response = await checkRemainingDataBundleBalance(request);

      // Assert the response
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: errorMessage },
        status: 500, // HTTP status code for Internal Server Error
      });

      // Assert that the error was logged
      expect(logObjectStub).to.have.been.called.with("error", errorStub);
      expect(loggerErrorStub).to.have.been.called.with(
        `Internal Server Error --- ${JSON.stringify(errorStub)}`
      );
      expect(throwStub).to.have.been.called;

      // Restore the stubs
      logObjectStub.restore();
      loggerErrorStub.restore();
      throwStub.restore();
    });
  });
});
