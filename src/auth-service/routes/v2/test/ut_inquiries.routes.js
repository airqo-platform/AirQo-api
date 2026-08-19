require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire").noPreserveCache();

describe("Inquiry API Routes", () => {
  let app;
  let createInquiryController;

  beforeEach(() => {
    createInquiryController = {
      create: sinon.stub(),
      list: sinon.stub(),
      update: sinon.stub(),
      delete: sinon.stub(),
    };

    // Require the route AFTER stubs are in place so the router binds our stubs
    const inquiryRoutes = proxyquire("../inquiries.routes", {
      "@controllers/inquiry.controller": createInquiryController,
    });

    app = express();
    app.use(express.json());
    app.use("/", inquiryRoutes);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("POST /register", () => {
    it("should create an inquiry and return status code 201", async () => {
      createInquiryController.create.callsFake((req, res) =>
        res.status(201).json({})
      );

      const response = await request(app).post("/register").send({}).expect(201);
      expect(response.body).to.be.an("object");
    });
  });

  describe("GET /", () => {
    it("should return a list of inquiries with status code 200", async () => {
      createInquiryController.list.callsFake((req, res) =>
        res.status(200).json([])
      );

      const response = await request(app).get("/").expect(200);
      expect(response.body).to.be.an("array");
    });
  });

  describe("DELETE /", () => {
    it("should delete an inquiry and return status code 200", async () => {
      createInquiryController.delete.callsFake((req, res) =>
        res.status(200).json({})
      );

      const response = await request(app).delete("/").query({ id: "valid_id" }).expect(200);
      expect(response.body).to.be.an("object");
    });
  });

  describe("PUT /", () => {
    it("should update an inquiry and return status code 200", async () => {
      createInquiryController.update.callsFake((req, res) =>
        res.status(200).json({})
      );

      const response = await request(app).put("/").query({ id: "valid_id" }).send({}).expect(200);
      expect(response.body).to.be.an("object");
    });
  });
});
