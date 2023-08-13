require("module-alias/register");
const express = require("express");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const rateLimitMiddleware = require("@middleware/rate-limit");
const request = require("supertest");

chai.use(sinonChai);
const expect = chai.expect;

describe("Rate Limit Middleware", () => {
  let app;

  before(() => {
    app = express();

    // Mock user object with rateLimit property
    const mockUser = { rateLimit: 5 };

    // Function to extract user limit from req.user
    const getUserLimit = (user) => {
      return user.rateLimit || 100;
    };

    // Apply rate limiting middleware for a specific route
    app.get(
      "/api/some-route",
      rateLimitMiddleware(getUserLimit),
      (req, res) => {
        res.status(200).json({ message: "Success" });
      }
    );

    // ...other route definitions
  });

  it("should allow access when user limit is not exceeded", (done) => {
    request(app)
      .get("/api/some-route")
      .set("Authorization", "Bearer valid-token")
      .set("Accept", "application/json")
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal("Success");
        done();
      });
  });

  it("should deny access when user limit is exceeded", (done) => {
    request(app)
      .get("/api/some-route")
      .set("Authorization", "Bearer valid-token")
      .set("Accept", "application/json")
      .end((err, res) => {
        expect(res.status).to.equal(429);
        expect(res.body.message).to.equal("Rate limit exceeded");
        done();
      });
  });

  it("should allow access for a different route", (done) => {
    request(app)
      .post("/api/another-route")
      .set("Authorization", "Bearer valid-token")
      .set("Accept", "application/json")
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal("Success");
        done();
      });
  });
});
