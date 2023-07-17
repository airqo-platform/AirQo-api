require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const transactionsRouter = require("@routes/v2/transactions");
const hostsRouter = require("@routes/v2/hosts");
const app = express();

app.use("/transactions", transactionsRouter);
app.use("/hosts", hostsRouter);

describe("Routes", () => {
  describe("/transactions", () => {
    it("should handle the /transactions route", async () => {
      const transactionsStub = sinon.stub(transactionsRouter, "handle");

      await request(app).get("/transactions");

      expect(transactionsStub.calledOnce).to.be.true;

      transactionsStub.restore();
    });

    // Add more test cases for the transactions route if needed
  });

  describe("/hosts", () => {
    it("should handle the /hosts route", async () => {
      const hostsStub = sinon.stub(hostsRouter, "handle");

      await request(app).get("/hosts");

      expect(hostsStub.calledOnce).to.be.true;

      hostsStub.restore();
    });

    // Add more test cases for the hosts route if needed
  });

  // Add more test cases for other routes if needed
});
