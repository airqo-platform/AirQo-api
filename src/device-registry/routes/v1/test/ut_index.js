require("module-alias/register");
const express = require("express");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const { createSandbox } = sinon;
const request = require("supertest");

const app = express();
const router = require("@routes/v1/index");

describe("Index Router for v1", () => {
  let sandbox;

  before(() => {
    sandbox = createSandbox();
    app.use(router);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("GET /activities", () => {
    it("should handle GET request to /activities", async () => {
      // Mock the handler for "/activities" route
      sandbox
        .stub(require("@routes/v1/activities"), "getActivities")
        .resolves({});

      const response = await request(app).get("/activities");

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("object");
    });
  });

  describe("GET /airqlouds", () => {
    // Add similar tests as above for the /airqlouds route
    // Mock the handler for "/airqlouds" route
  });

  describe("GET /sites", () => {
    // Add similar tests as above for the /sites route
    // Mock the handler for "/sites" route
  });

  describe("GET /devices", () => {
    // Add similar tests as above for the /devices route
    // Mock the handler for "/devices" route
  });

  describe("GET /events", () => {
    // Add similar tests as above for the /events route
    // Mock the handler for "/events" route
  });

  describe("GET /locations", () => {
    // Add similar tests as above for the /locations route
    // Mock the handler for "/locations" route
  });

  describe("GET /photos", () => {
    // Add similar tests as above for the /photos route
    // Mock the handler for "/photos" route
  });

  describe("GET /tips", () => {
    // Add similar tests as above for the /tips route
    // Mock the handler for "/tips" route
  });

  describe("GET /kya", () => {
    // Add similar tests as above for the /kya route
    // Mock the handler for "/kya" route
  });

  describe("GET /sensors", () => {
    // Add similar tests as above for the /sensors route
    // Mock the handler for "/sensors" route
  });

  describe("GET /cohorts", () => {
    // Add similar tests as above for the /cohorts route
    // Mock the handler for "/cohorts" route
  });

  describe("GET /grids", () => {
    // Add similar tests as above for the /grids route
    // Mock the handler for "/grids" route
  });
});
