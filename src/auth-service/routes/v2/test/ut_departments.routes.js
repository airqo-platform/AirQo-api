require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const supertest = require("supertest");
const express = require("express");

// IMPORTANT FINDING (verified by reading routes/v2/departments.routes.js and
// its git history): unlike most other v2 route files, departments.routes.js
// does NOT register any actual CRUD routes. It only does:
//   router.use(headers);
// It imports @controllers/user.controller and @middleware/passport
// (enhancedJWTAuth) but never wires either into a route, and it has never
// (since the file was first created) had any router.get/post/put/delete
// calls in it, even though a fully-featured department controller, util,
// and model exist elsewhere in the codebase and the router IS mounted at
// "/departments" in routes/v2/index.js. This looks like an unfinished
// feature / production gap, not something introduced by a refactor, and
// fixing it is out of scope for this test-repair task - the test below
// intentionally exercises the router's REAL current behavior (CORS headers
// only, no reachable department endpoints) instead of fabricating passing
// assertions for routes that don't exist.
//
// We still proxyquire-stub @controllers/user.controller and
// @middleware/passport before requiring the router. Neither stub is ever
// invoked (the real router never calls into them), but stubbing avoids
// pulling in their real implementations - which transitively require
// @config/constants - at require time, consistent with how the sibling
// ut_permissions.routes.js test avoids touching modules that trigger the
// full app bootstrap.
const passportStub = {
  enhancedJWTAuth: (req, res, next) => next(),
};

const router = proxyquire("@routes/v2/departments.routes", {
  "@controllers/user.controller": {},
  "@middleware/passport": passportStub,
});

describe("Department Router API Tests", () => {
  let app;
  let request;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);
    request = supertest(app);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("CORS headers middleware", () => {
    it("should set CORS headers on a GET request", async () => {
      // No routes are registered, so this falls through to Express's
      // default 404 handler, but the headers middleware still runs first
      // (router.use has no path restriction) and sets the headers on the
      // response before next() is called.
      const response = await request.get("/");

      expect(response.headers["access-control-allow-origin"]).to.equal("*");
      expect(response.headers["access-control-allow-headers"]).to.equal(
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      expect(response.headers["access-control-allow-methods"]).to.equal(
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
    });

    it("should set CORS headers on a POST request", async () => {
      const response = await request.post("/").send({
        dep_network_id: "60d21b4667d0d8992e610c85",
        dep_title: "Test Department",
        dep_description: "This is a test department",
      });

      expect(response.headers["access-control-allow-origin"]).to.equal("*");
    });
  });

  describe("OPTIONS preflight requests", () => {
    it("should short-circuit with 204 and not fall through to a route handler", async () => {
      const response = await request.options("/");

      expect(response.status).to.equal(204);
      expect(response.headers["access-control-allow-origin"]).to.equal("*");
    });

    it("should short-circuit with 204 for any sub-path", async () => {
      const response = await request.options(
        "/60d21b4667d0d8992e610c85"
      );

      expect(response.status).to.equal(204);
    });
  });

  describe("Unregistered department CRUD routes", () => {
    // departments.routes.js currently registers no router.get/post/put/delete
    // handlers at all, so every non-OPTIONS request - regardless of method
    // or path - falls through to Express's built-in 404 handler.
    it("should return 404 for POST / (no create-department route is registered)", async () => {
      const response = await request.post("/").send({
        dep_network_id: "60d21b4667d0d8992e610c85",
        dep_title: "Test Department",
        dep_description: "This is a test department",
      });

      expect(response.status).to.equal(404);
    });

    it("should return 404 for GET /:dep_id (no fetch-department route is registered)", async () => {
      const response = await request.get(
        "/60d21b4667d0d8992e610c85"
      );

      expect(response.status).to.equal(404);
    });

    it("should return 404 for GET / (no list-departments route is registered)", async () => {
      const response = await request.get("/");

      expect(response.status).to.equal(404);
    });

    it("should return 404 for PUT /:dep_id (no update-department route is registered)", async () => {
      const response = await request
        .put("/60d21b4667d0d8992e610c85")
        .send({ dep_title: "Updated Department" });

      expect(response.status).to.equal(404);
    });

    it("should return 404 for DELETE /:dep_id (no delete-department route is registered)", async () => {
      const response = await request.delete(
        "/60d21b4667d0d8992e610c85"
      );

      expect(response.status).to.equal(404);
    });
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
