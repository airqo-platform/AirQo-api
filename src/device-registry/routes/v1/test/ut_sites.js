require("module-alias/register");
const express = require("express");
const { expect } = require("chai");
const request = require("supertest");
const sinon = require("sinon");
const app = express();
const router = require("@routes/v1/sites");

// Sample test data
const sampleSiteData = {
  latitude: "0.12345",
  longitude: "0.67890",
  name: "Test Site",
};

describe("Site Router", () => {
  beforeEach(() => {
    // Sinon stubs for any dependencies used in the routes
    sinon.stub(siteController, "bulkUpdate").resolves({});
    sinon.stub(siteController, "bulkDelete").resolves({});
    sinon.stub(siteController, "bulkCreate").resolves({});
    sinon.stub(siteController, "list").resolves([]);
    // Add more stubs as needed for other route handlers
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("POST /", () => {
    it("should return 200 and create a new site", async () => {
      const response = await request(app)
        .post("/")
        .send(sampleSiteData)
        .expect(200);

      expect(response.body).to.deep.equal({
        message: "Site created successfully",
      });
    });

    it("should return 400 when invalid data is provided", async () => {
      const response = await request(app)
        .post("/")
        .send({ latitude: "invalid", longitude: "invalid", name: "Short" })
        .expect(400);

      expect(response.body).to.deep.equal({ error: "Invalid data provided" });
    });
  });

  describe("PUT /bulk/update", () => {
    // Add test cases for bulkUpdate route
  });

  describe("DELETE /bulk/delete", () => {
    // Add test cases for bulkDelete route
  });

  // Add more describe blocks for other routes as needed

  describe("GET /nonexistentroute", () => {
    it("should return 404 when accessing a nonexistent route", async () => {
      const response = await request(app)
        .get("/nonexistentroute")
        .expect(404);

      expect(response.body).to.deep.equal({ error: "Route not found" });
    });
  });
});
