require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const inquiryRoutes = require("../inquiries");

// Import mock controller for inquiry route (you need to provide mock implementations for this)
const createInquiryController = require("./mockControllers/create-inquiry");

describe("Inquiry API Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock the usage of the router file in the main router
    app.use("/", inquiryRoutes);
  });

  afterEach(() => {
    sinon.restore(); // Restore Sinon stubs after each test
  });

  // Test cases for the "/register" route
  describe("POST /register", () => {
    it("should create an inquiry and return status code 201", async () => {
      // Mock the behavior of the createInquiryController's create function
      sinon
        .stub(createInquiryController, "create")
        .resolves(/* Mocked data here */);

      // Perform the HTTP POST request
      const response = await request(app)
        .post("/register")
        .send({
          /* Request body with valid data for the inquiry */
        })
        .expect(201);

      // Assert the response
      expect(response.body).to.be.an("object");
      // Add more assertions based on the expected response data
    });

    // Add more test cases for different scenarios related to the POST /register route
  });

  // Test cases for the root route "/"
  describe("GET /", () => {
    it("should return a list of inquiries with status code 200", async () => {
      // Mock the behavior of the createInquiryController's list function
      sinon.stub(createInquiryController, "list").resolves([
        /* Mocked data here */
      ]);

      // Perform the HTTP GET request
      const response = await request(app).get("/").expect(200);

      // Assert the response
      expect(response.body).to.be.an("array");
      // Add more assertions based on the expected response data
    });

    // Add more test cases for different scenarios related to the root route
  });

  // Test cases for the DELETE route "/"
  describe("DELETE /", () => {
    it("should delete an inquiry and return status code 200", async () => {
      // Mock the behavior of the createInquiryController's delete function
      sinon
        .stub(createInquiryController, "delete")
        .resolves(/* Mocked data here */);

      // Perform the HTTP DELETE request
      const response = await request(app)
        .delete("/")
        .query({ id: "valid_id" })
        .expect(200);

      // Assert the response
      expect(response.body).to.be.an("object");
      // Add more assertions based on the expected response data
    });

    // Add more test cases for different scenarios related to the DELETE route
  });

  // Test cases for the PUT route "/"
  describe("PUT /", () => {
    it("should update an inquiry and return status code 200", async () => {
      // Mock the behavior of the createInquiryController's update function
      sinon
        .stub(createInquiryController, "update")
        .resolves(/* Mocked data here */);

      // Perform the HTTP PUT request
      const response = await request(app)
        .put("/")
        .query({ id: "valid_id" })
        .send({
          /* Request body with valid data for updating the inquiry */
        })
        .expect(200);

      // Assert the response
      expect(response.body).to.be.an("object");
      // Add more assertions based on the expected response data
    });

    // Add more test cases for different scenarios related to the PUT route
  });
});
