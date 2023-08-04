require("module-alias/register");
const { expect } = require("chai");
const request = require("supertest");
const sinon = require("sinon");
const express = require("express");
const bodyParser = require("body-parser");
const healthTipController = require("@controllers/create-health-tips");
const healthTipRoutes = require("@routes/v1/tips");

describe("Health Tip Routes", () => {
  let app;

  before(() => {
    app = express();
    app.use(bodyParser.json());
    app.use(healthTipRoutes);
  });

  describe("GET /", () => {
    it("should return a list of health tips", (done) => {
      // Mock the controller function
      sinon.stub(healthTipController, "list").resolves([]);

      request(app)
        .get("/")
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          // Add your assertions here
          // For example: expect(res.body).to.be.an("array");

          healthTipController.list.restore();
          done();
        });
    });
  });

  describe("POST /", () => {
    it("should create a new health tip", (done) => {
      // Mock the controller function
      sinon.stub(healthTipController, "create").resolves({});

      request(app)
        .post("/")
        .send({
          description: "Sample description",
          title: "Sample title",
          image: "sample.jpg",
          aqi_category: "good",
        })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);

          // Add your assertions here
          // For example: expect(res.body).to.have.property("id");

          healthTipController.create.restore();
          done();
        });
    });
  });

  // Add more describe blocks for other routes (PUT, DELETE, etc.)
});
