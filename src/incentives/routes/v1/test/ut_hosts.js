require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { check, oneOf, query, body, param } = require("express-validator");
const createHostController = require("@controllers/create-host");
const createHostRouter = require("@routes/hosts");

describe("Create Host Router", () => {
  let app;

  before(() => {
    app = express();
    app.use(createHostRouter);
  });

  describe("POST /", () => {
    it("should call createHostController.create", async () => {
      const createHostControllerStub = sinon.stub(
        createHostController,
        "create"
      );
      const requestBody = {}; // Provide a sample request body

      await request(app).post("/").send(requestBody);

      expect(createHostControllerStub.calledOnce).to.be.true;

      createHostControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("GET /", () => {
    it("should call createHostController.list", async () => {
      const createHostControllerStub = sinon.stub(createHostController, "list");
      const queryParameters = {}; // Provide sample query parameters

      await request(app).get("/").query(queryParameters);

      expect(createHostControllerStub.calledOnce).to.be.true;

      createHostControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("PUT /:host_id", () => {
    it("should call createHostController.update", async () => {
      const createHostControllerStub = sinon.stub(
        createHostController,
        "update"
      );
      const hostId = "sample_host_id";
      const requestBody = {}; // Provide a sample request body

      await request(app).put(`/${hostId}`).send(requestBody);

      expect(createHostControllerStub.calledOnce).to.be.true;

      createHostControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("DELETE /:host_id", () => {
    it("should call createHostController.delete", async () => {
      const createHostControllerStub = sinon.stub(
        createHostController,
        "delete"
      );
      const hostId = "sample_host_id";

      await request(app).delete(`/${hostId}`);

      expect(createHostControllerStub.calledOnce).to.be.true;

      createHostControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  describe("GET /:host_id", () => {
    it("should call createHostController.list", async () => {
      const createHostControllerStub = sinon.stub(createHostController, "list");
      const hostId = "sample_host_id";
      const queryParameters = {}; // Provide sample query parameters

      await request(app).get(`/${hostId}`).query(queryParameters);

      expect(createHostControllerStub.calledOnce).to.be.true;

      createHostControllerStub.restore();
    });

    // Add more test cases for validation middleware if needed
  });

  // Add more test cases for other routes if needed
});
