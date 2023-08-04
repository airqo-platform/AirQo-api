require("module-alias/register");
const express = require("express");
const { expect } = require("chai");
const sinon = require("sinon");
const request = require("supertest");
const app = express();

// Import route file
const router = require("../tokens");

// Import controllers and middleware
const createTokenController = require("@controllers/create-token");
const { setJWTAuth, authJWT } = require("@middleware/passport");

// Sample token for testing
const SAMPLE_TOKEN = "sample_token";

describe("Routes: /tokens", () => {
  describe("Middleware: Headers", () => {
    it("should add appropriate headers", (done) => {
      // Implement test for headers middleware here
      // Use Sinon to stub the 'next' function and check response headers
      done();
    });
  });

  describe("GET /tokens", () => {
    it("should return a list of tokens", (done) => {
      // Implement test for GET all tokens here
      // Use Sinon to stub the 'createTokenController.list' function and check response
      done();
    });
  });

  describe("POST /tokens", () => {
    it("should create a new token", (done) => {
      // Implement test for creating a new token here
      // Use Sinon to stub the 'createTokenController.create' function and check response
      done();
    });
  });

  describe("PUT /tokens/:token", () => {
    it("should update a token", (done) => {
      // Implement test for updating a token here
      // Use Sinon to stub the 'createTokenController.update' function and check response
      done();
    });
  });

  describe("DELETE /tokens/:token", () => {
    it("should delete a token", (done) => {
      // Implement test for deleting a token here
      // Use Sinon to stub the 'createTokenController.delete' function and check response
      done();
    });
  });

  describe("GET /tokens/:token/verify", () => {
    it("should verify a token", (done) => {
      // Implement test for verifying a token here
      // Use Sinon to stub the 'createTokenController.verify' function and check response
      done();
    });
  });

  describe("GET /tokens/:token", () => {
    it("should get a token by ID", (done) => {
      // Implement test for getting a token by ID here
      // Use Sinon to stub the 'createTokenController.list' function with a specific token and check response
      done();
    });
  });
});
