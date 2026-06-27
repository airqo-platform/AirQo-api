require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire").noPreserveCache();

describe("Location History API Routes", () => {
  let app;
  let createLocationHistoryController;

  beforeEach(() => {
    createLocationHistoryController = {
      list: sinon.stub(),
      create: sinon.stub(),
      update: sinon.stub(),
      delete: sinon.stub(),
      syncLocationHistory: sinon.stub(),
    };

    // Require the route AFTER stubs are in place so the router binds our stubs
    const locationHistoryRoutes = proxyquire("../location-history.routes", {
      "@controllers/location-history.controller": createLocationHistoryController,
    });

    app = express();
    app.use(express.json());
    app.use("/", locationHistoryRoutes);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("GET /", () => {
    it("should return a list of location histories with status code 200", async () => {
      createLocationHistoryController.list.callsFake((req, res) =>
        res.status(200).json([])
      );

      const response = await request(app).get("/").expect(200);
      expect(response.body).to.be.an("array");
    });
  });

  describe("POST /", () => {
    it("should create a new location history and return status code 201", async () => {
      createLocationHistoryController.create.callsFake((req, res) =>
        res.status(201).json({})
      );

      const response = await request(app).post("/").send({}).expect(201);
      expect(response.body).to.be.an("object");
    });
  });
});
