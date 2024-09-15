require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { query, body } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const createDefaultController = require("@controllers/create-default");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const router = require("../defaults");

describe("Default Routes", () => {
  let app;

  before(() => {
    app = express();
    app.use("/", router);
  });

  describe("PUT /", () => {
    it("should return 200 status and update the default data with valid inputs", async () => {
      // Test the scenario where valid input data is provided in the request
      const response = await request(app)
        .put("/")
        .query({ tenant: "kcca" })
        .send({
          pollutant: "pm2_5",
          frequency: "daily",
          chartType: "bar",
          startDate: "2023-07-25T10:00:00.000Z",
          endDate: "2023-07-26T10:00:00.000Z",
          user: "your_user_id",
          airqloud: "your_airqloud_id",
          chartTitle: "Sample Chart",
          period: {
            start: "2023-07-25T10:00:00.000Z",
            end: "2023-07-26T10:00:00.000Z",
          },
          chartSubTitle: "Sample Subtitle",
          sites: ["site_id_1", "site_id_2"],
        });

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    // Add more test cases to cover other scenarios and validations
  });

  describe("POST /", () => {
    it("should return 201 status and create a new default entry with valid inputs", async () => {
      // Test the scenario where valid input data is provided in the request
      const response = await request(app)
        .post("/")
        .query({ tenant: "kcca" })
        .send({
          pollutant: "no2",
          frequency: "hourly",
          chartType: "line",
          startDate: "2023-07-25T10:00:00.000Z",
          endDate: "2023-07-26T10:00:00.000Z",
          user: "your_user_id",
          chartTitle: "Sample Chart",
          period: {
            start: "2023-07-25T10:00:00.000Z",
            end: "2023-07-26T10:00:00.000Z",
          },
          chartSubTitle: "Sample Subtitle",
          sites: ["site_id_1", "site_id_2"],
        });

      expect(response.status).to.equal(201);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    // Add more test cases to cover other scenarios and validations
  });

  describe("GET /", () => {
    it("should return 200 status and list default entries with valid inputs", async () => {
      // Test the scenario where valid input data is provided in the request
      const response = await request(app).get("/").query({
        tenant: "kcca",
        id: "your_id",
        user: "your_user_id",
        airqloud: "your_airqloud_id",
        site: "your_site_id",
      });

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    // Add more test cases to cover other scenarios and validations
  });

  describe("DELETE /", () => {
    it("should return 204 status and delete the default entry with valid input", async () => {
      // Test the scenario where valid input data is provided in the request
      const response = await request(app)
        .delete("/")
        .query({ tenant: "kcca", id: "your_id" });

      expect(response.status).to.equal(204);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    // Add more test cases to cover other scenarios and validations
  });
});
