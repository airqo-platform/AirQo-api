require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const createClientController = require("@controllers/create-client");
const router = require("../clients");

describe("v1 clients route", () => {
  let app;

  before(() => {
    app = express();
    app.use("/", router);
  });

  describe("headers", () => {
    it("should set the Access-Control-Allow-Origin header", async () => {
      const response = await request(app).get("/");
      expect(response.header["access-control-allow-origin"]).to.equal("*");
    });

    it("should set the Access-Control-Allow-Headers header", async () => {
      const response = await request(app).get("/");
      expect(response.header["access-control-allow-headers"]).to.equal(
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
    });

    it("should set the Access-Control-Allow-Methods header", async () => {
      const response = await request(app).get("/");
      expect(response.header["access-control-allow-methods"]).to.equal(
        "GET, POST, PUT, DELETE"
      );
    });
  });

  describe("GET /", () => {
    it("should return 200 status when valid tenant is provided", async () => {
      const response = await request(app).get("/").query({ tenant: "kcca" });
      expect(response.status).to.equal(200);
    });

    it("should return 200 status when tenant is not provided", async () => {
      const response = await request(app).get("/");
      expect(response.status).to.equal(200);
    });

    it("should return 400 status when invalid tenant is provided", async () => {
      const response = await request(app).get("/").query({ tenant: "invalid" });
      expect(response.status).to.equal(400);
    });

    // Add more test cases specific to GET / route if needed
  });

  describe("POST /", () => {
    it("should return 200 status and create a new client with valid data", async () => {
      // Test the scenario where valid data is provided in the request
      const requestBody = {
        name: "Test Client",
        redirect_url: "https://example.com",
      };

      const response = await request(app)
        .post("/")
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    it("should return 400 status and error message if name is missing in the request", async () => {
      // Test the scenario where name is missing in the request
      const requestBody = {
        redirect_url: "https://example.com",
      };

      const response = await request(app)
        .post("/")
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal("name is missing in your request");
    });

    it("should return 400 status and error message if redirect_url is invalid", async () => {
      // Test the scenario where invalid redirect_url is provided in the request
      const requestBody = {
        name: "Test Client",
        redirect_url: "invalid-url",
      };

      const response = await request(app)
        .post("/")
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the redirect_url is not a valid URL"
      );
    });

    // Add more test cases specific to POST / route if needed
  });

  describe("PATCH /secret/:client_id", () => {
    it("should return 200 status and update the client secret with valid data", async () => {
      // Test the scenario where valid data is provided in the request
      const clientId = "your_client_id";
      const requestBody = {
        client_secret: "new_secret",
      };

      const response = await request(app)
        .patch(`/secret/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    it("should return 400 status and error message if client_id is missing in the request", async () => {
      // Test the scenario where client_id is missing in the request
      const requestBody = {
        client_secret: "new_secret",
      };

      const response = await request(app)
        .patch("/secret/")
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });

    it("should return 400 status and error message if client_secret is missing in the request", async () => {
      // Test the scenario where client_secret is missing in the request
      const clientId = "your_client_id";
      const requestBody = {
        // client_secret is not provided
      };

      const response = await request(app)
        .patch(`/secret/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "client_secret should be provided"
      );
    });
  });

  describe("PATCH /name/:client_id", () => {
    it("should return 200 status and update the client name with valid data", async () => {
      // Test the scenario where valid data is provided in the request
      const clientId = "your_client_id";
      const requestBody = {
        name: "new_name",
      };

      const response = await request(app)
        .patch(`/name/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    it("should return 400 status and error message if client_id is missing in the request", async () => {
      // Test the scenario where client_id is missing in the request
      const requestBody = {
        name: "new_name",
      };

      const response = await request(app)
        .patch("/name/")
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });

    it("should return 400 status and error message if name is missing in the request", async () => {
      // Test the scenario where name is missing in the request
      const clientId = "your_client_id";
      const requestBody = {
        // name is not provided
      };

      const response = await request(app)
        .patch(`/name/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal("the name should be provided");
    });
  });

  describe("PATCH /id/:client_id", () => {
    it("should return 200 status and update the client_id with valid data", async () => {
      // Test the scenario where valid data is provided in the request
      const clientId = "your_client_id";
      const requestBody = {
        client_id: "new_client_id",
      };

      const response = await request(app)
        .patch(`/id/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    it("should return 400 status and error message if client_id is missing in the request", async () => {
      // Test the scenario where client_id is missing in the request
      const requestBody = {
        client_id: "new_client_id",
      };

      const response = await request(app)
        .patch("/id/")
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });

    it("should return 400 status and error message if client_id is empty in the request", async () => {
      // Test the scenario where client_id is provided but empty in the request
      const clientId = "your_client_id";
      const requestBody = {
        client_id: "",
      };

      const response = await request(app)
        .patch(`/id/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal("client_id should not be empty");
    });
  });

  describe("PUT /:client_id", () => {
    it("should return 200 status and update the client data with valid data", async () => {
      // Test the scenario where valid data is provided in the request
      const clientId = "your_client_id";
      const requestBody = {
        name: "New Client Name",
        redirect_url: "https://example.com/callback",
      };

      const response = await request(app)
        .put(`/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    it("should return 400 status and error message if client_id is missing in the request", async () => {
      // Test the scenario where client_id is missing in the request
      const requestBody = {
        name: "New Client Name",
        redirect_url: "https://example.com/callback",
      };

      const response = await request(app)
        .put("/")
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });

    it("should return 400 status and error message if client_id is empty in the request", async () => {
      // Test the scenario where client_id is provided but empty in the request
      const clientId = "your_client_id";
      const requestBody = {
        client_id: "",
        name: "New Client Name",
        redirect_url: "https://example.com/callback",
      };

      const response = await request(app)
        .put(`/${clientId}`)
        .query({ tenant: "kcca" })
        .send(requestBody);

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal("client_id should not be empty");
    });
  });

  describe("DELETE /:client_id", () => {
    it("should return 200 status and delete the client data with valid client_id", async () => {
      // Test the scenario where a valid client_id is provided in the request
      const clientId = "your_client_id";

      const response = await request(app)
        .delete(`/${clientId}`)
        .query({ tenant: "kcca" });

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    it("should return 400 status and error message if client_id is missing in the request", async () => {
      // Test the scenario where client_id is missing in the request
      const response = await request(app).delete("/").query({ tenant: "kcca" });

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });

    it("should return 400 status and error message if client_id is empty in the request", async () => {
      // Test the scenario where client_id is provided but empty in the request
      const clientId = "your_client_id";

      const response = await request(app)
        .delete(`/${clientId}`)
        .query({ tenant: "kcca" });

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });
  });

  describe("GET /:client_id", () => {
    it("should return 200 status and client data with valid client_id", async () => {
      // Test the scenario where a valid client_id is provided in the request
      const clientId = "your_client_id";

      const response = await request(app)
        .get(`/${clientId}`)
        .query({ tenant: "kcca" });

      expect(response.status).to.equal(200);
      // Add more assertions as needed to verify the response body or any other behavior
    });

    it("should return 400 status and error message if client_id is missing in the request", async () => {
      // Test the scenario where client_id is missing in the request
      const response = await request(app).get("/").query({ tenant: "kcca" });

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });

    it("should return 400 status and error message if client_id is empty in the request", async () => {
      // Test the scenario where client_id is provided but empty in the request
      const clientId = "your_client_id";

      const response = await request(app)
        .get(`/${clientId}`)
        .query({ tenant: "kcca" });

      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal(
        "the client_id param is missing in the request"
      );
    });
  });

  // Add more hierarchical describes and test cases for other routes if needed
});
