require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { check, oneOf, query, body, param } = require("express-validator");
const createTransactionController = require("@controllers/create-transaction");
const createTransactionRouter = require("./create-transaction");

describe("Create Transaction Router", () => {
  let app;

  before(() => {
    app = express();
    app.use(createTransactionRouter);
  });

  describe("POST /hosts/:host_id/payments", () => {
    it("should call createTransactionController.sendMoneyToHost", async () => {
      const createTransactionControllerStub = sinon.stub(
        createTransactionController,
        "sendMoneyToHost"
      );
      const hostId = "sample_host_id";
      const requestBody = {}; // Provide a sample request body

      await request(app).post(`/hosts/${hostId}/payments`).send(requestBody);

      expect(createTransactionControllerStub.calledOnce).to.be.true;

      createTransactionControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("POST /accounts/payments", () => {
    it("should call createTransactionController.addMoneyToOrganisationAccount", async () => {
      const createTransactionControllerStub = sinon.stub(
        createTransactionController,
        "addMoneyToOrganisationAccount"
      );
      const requestBody = {}; // Provide a sample request body

      await request(app).post("/accounts/payments").send(requestBody);

      expect(createTransactionControllerStub.calledOnce).to.be.true;

      createTransactionControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("POST /accounts/receive", () => {
    it("should call createTransactionController.receiveMoneyFromHost", async () => {
      const createTransactionControllerStub = sinon.stub(
        createTransactionController,
        "receiveMoneyFromHost"
      );
      const requestBody = {}; // Provide a sample request body

      await request(app).post("/accounts/receive").send(requestBody);

      expect(createTransactionControllerStub.calledOnce).to.be.true;

      createTransactionControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("POST /devices/:device_id/data", () => {
    it("should call createTransactionController.loadDataBundle", async () => {
      const createTransactionControllerStub = sinon.stub(
        createTransactionController,
        "loadDataBundle"
      );
      const deviceId = "sample_device_id";
      const requestBody = {}; // Provide a sample request body

      await request(app).post(`/devices/${deviceId}/data`).send(requestBody);

      expect(createTransactionControllerStub.calledOnce).to.be.true;

      createTransactionControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("GET /payments/:transaction_id", () => {
    it("should call createTransactionController.getTransactionDetails", async () => {
      const createTransactionControllerStub = sinon.stub(
        createTransactionController,
        "getTransactionDetails"
      );
      const transactionId = "sample_transaction_id";
      const queryParameters = {}; // Provide sample query parameters

      await request(app)
        .get(`/payments/${transactionId}`)
        .query(queryParameters);

      expect(createTransactionControllerStub.calledOnce).to.be.true;

      createTransactionControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("GET /devices/:device_id/balance", () => {
    it("should call createTransactionController.checkRemainingDataBundleBalance", async () => {
      const createTransactionControllerStub = sinon.stub(
        createTransactionController,
        "checkRemainingDataBundleBalance"
      );
      const deviceId = "sample_device_id";
      const queryParameters = {}; // Provide sample query parameters

      await request(app)
        .get(`/devices/${deviceId}/balance`)
        .query(queryParameters);

      expect(createTransactionControllerStub.calledOnce).to.be.true;

      createTransactionControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  // Add more test cases for other routes if needed
});
