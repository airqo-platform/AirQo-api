require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const createDepartmentController = require("@controllers/create-department");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const router = require("../departments");

// ... Express Router Configuration ... (the provided route configurations)

describe("Department Routes", () => {
  let app;

  before(() => {
    app = express();
    app.use("/", router);
  });

  describe("POST /", () => {
    it("should return 201 status and create a new department with valid inputs", async () => {
      // Test the scenario where valid input data is provided in the request
      const response = await request(app)
        .post("/")
        .query({ tenant: "kcca" })
        .send({
          dep_network_id: "network_id",
          dep_title: "Test Department",
          dep_description: "This is a test department",
          // Add more valid input fields here as needed
        });

      expect(response.status).to.equal(201);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    // Add more test cases to cover other scenarios and validations
  });

  describe("GET /:dep_id", () => {
    it("should return 200 status and fetch department details with valid dep_id", async () => {
      // Test the scenario where valid dep_id is provided in the request
      const departmentId = "your_department_id";
      const response = await request(app)
        .get(`/${departmentId}`)
        .query({ tenant: "kcca" });

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    // Add more test cases to cover other scenarios and validations
  });

  // Add more describe blocks and test cases for other routes (if available)...
});
