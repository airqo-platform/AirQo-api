const sinon = require("sinon");
const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const expect = chai.expect;

chai.use(chaiHttp);

const AccessTokenModel = require("@models/AccessToken");
const checkScope = require("@middleware/check-scope");

describe("Middleware: checkScope", () => {
  let req, res, next, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = {
      query: {},
      params: {},
    };
    res = {
      status: sandbox.stub().returnsThis(),
      send: sandbox.stub().returnsThis(),
    };
    next = sandbox.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return UNAUTHORIZED if no token is provided", async () => {
    await checkScope("requiredScope")(req, res, next);
    sinon.assert.calledWithExactly(res.status, httpStatus.UNAUTHORIZED);
    sinon.assert.calledWithExactly(
      res.send,
      "Unauthorized due to insufficient scope"
    );
    sinon.assert.notCalled(next);
  });

  it("should return UNAUTHORIZED if token is provided but not found in the database", async () => {
    req.params.token = "nonExistentToken";

    sandbox.stub(AccessTokenModel, "find").resolves([]);

    await checkScope("requiredScope")(req, res, next);

    sinon.assert.calledWithExactly(res.status, httpStatus.UNAUTHORIZED);
    sinon.assert.calledWithExactly(
      res.send,
      "Unauthorized due to insufficient scope"
    );
    sinon.assert.notCalled(next);
  });

  it("should return UNAUTHORIZED if token is provided with invalid client_id", async () => {
    req.params.token = "validToken";
    const tokenData = {
      client_id: "invalidClientId",
      scopes: ["requiredScope"],
    };

    sandbox.stub(AccessTokenModel, "find").resolves([tokenData]);

    await checkScope("requiredScope")(req, res, next);

    sinon.assert.calledWithExactly(res.status, httpStatus.UNAUTHORIZED);
    sinon.assert.calledWithExactly(
      res.send,
      "Unauthorized due to insufficient scope"
    );
    sinon.assert.notCalled(next);
  });

  it("should call next() if token with requiredScope is provided", async () => {
    req.params.token = "validToken";
    const tokenData = {
      client_id: "validClientId",
      scopes: ["requiredScope"],
    };

    sandbox.stub(AccessTokenModel, "find").resolves([tokenData]);

    await checkScope("requiredScope")(req, res, next);

    sinon.assert.calledOnce(next);
  });

  it("should call next() if token with multiple scopes is provided", async () => {
    req.params.token = "validToken";
    const tokenData = {
      client_id: "validClientId",
      scopes: ["scope1", "scope2", "requiredScope"],
    };

    sandbox.stub(AccessTokenModel, "find").resolves([tokenData]);

    await checkScope("requiredScope")(req, res, next);

    sinon.assert.calledOnce(next);
  });

  it("should handle internal server error and return 500", async () => {
    req.params.token = "validToken";
    const tokenData = {
      client_id: "validClientId",
      scopes: ["requiredScope"],
    };

    sandbox.stub(AccessTokenModel, "find").rejects(new Error("Test error"));

    await checkScope("requiredScope")(req, res, next);

    sinon.assert.calledWithExactly(
      res.status,
      httpStatus.INTERNAL_SERVER_ERROR
    );
    sinon.assert.calledWithMatch(res.send, /Internal Server Error/);
    sinon.assert.notCalled(next);
  });
});
