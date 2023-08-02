require("module-alias/register");
const express = require("express");
const sinon = require("sinon");
const chai = require("chai");
const chaiHttp = require("chai-http");
const photoController = require("@controllers/create-photo");
const router = require("@routes/v2/photos");

// Configure chai
chai.use(chaiHttp);
const expect = chai.expect;

// Mock Express router
const app = express();
app.use("/", router);

describe("Photo Controller Unit Tests", () => {
  describe("DELETE /", () => {
    it("should call photoController.delete when valid request is made", async () => {
      const deleteStub = sinon.stub(photoController, "delete");

      // Send a mock DELETE request to your router
      const res = await chai.request(app).delete("/");

      // Assert the response and other expectations
      expect(res).to.have.status(200);
      expect(deleteStub.calledOnce).to.be.true;

      deleteStub.restore();
    });

    it("should return 400 if required query parameter 'tenant' is missing", async () => {
      // Send a mock DELETE request without 'tenant' query parameter
      const res = await chai.request(app).delete("/");

      // Assert the response and other expectations
      expect(res).to.have.status(400);
      // Add other assertions as needed
    });

    // Add more test cases for different scenarios
  });

  // Add more describe blocks for other API endpoints (POST, PUT, GET) and their test cases

  describe("POST /soft", () => {
    // Write your test cases for this endpoint
  });

  describe("PUT /soft", () => {
    // Write your test cases for this endpoint
  });

  describe("DELETE /soft", () => {
    // Write your test cases for this endpoint
  });

  describe("POST /cloud", () => {
    // Write your test cases for this endpoint
  });

  describe("DELETE /cloud", () => {
    // Write your test cases for this endpoint
  });

  describe("PUT /cloud", () => {
    // Write your test cases for this endpoint
  });
});
