require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// Bootstrap in-memory model registration so AccessTokenModel factory works without DB
try {
  const _schema = rewire("@models/AccessToken").__get__("AccessTokenSchema");
  if (!mongoose.modelNames().includes("access_tokens")) {
    mongoose.model("access_tokens", _schema);
  }
} catch (_) {}

const sinon = require("sinon");
const chai = require("chai");
const httpStatus = require("http-status");
const expect = chai.expect;
const AccessTokenModel = require("@models/AccessToken");
const checkScope = require("@middleware/check-scope");

describe("Middleware: checkScope", () => {
  let req, res, next, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = { query: {}, params: {} };
    res = {
      status: sandbox.stub().returnsThis(),
      send: sandbox.stub().returnsThis(),
    };
    next = sandbox.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should call next() when no token is provided", async () => {
    await checkScope("requiredScope")(req, res, next);
    sinon.assert.called(next);
    sinon.assert.notCalled(res.status);
  });

  it("should call next() when token is not found in the database", async () => {
    req.params.token = "nonExistentToken";
    sandbox.stub(AccessTokenModel("airqo"), "find").returns({
      lean: sandbox.stub().resolves([]),
    });

    await checkScope("requiredScope")(req, res, next);
    sinon.assert.called(next);
    sinon.assert.notCalled(res.status);
  });

  it("should return UNAUTHORIZED when token has invalid client_id (not a valid ObjectId)", async () => {
    req.params.token = "validToken";
    const tokenData = {
      client_id: "bad",
      scopes: ["requiredScope"],
    };
    sandbox.stub(AccessTokenModel("airqo"), "find").returns({
      lean: sandbox.stub().resolves([tokenData]),
    });

    await checkScope("requiredScope")(req, res, next);
    sinon.assert.calledWithExactly(res.status, httpStatus.UNAUTHORIZED);
    sinon.assert.calledWithExactly(res.send, "Unauthorized due to insufficient scope");
    sinon.assert.notCalled(next);
  });

  it("should call next() when token has valid client_id and required scope", async () => {
    req.params.token = "validToken";
    const validClientId = new mongoose.Types.ObjectId().toHexString();
    const tokenData = {
      client_id: validClientId,
      scopes: ["requiredScope"],
    };
    sandbox.stub(AccessTokenModel("airqo"), "find").returns({
      lean: sandbox.stub().resolves([tokenData]),
    });

    await checkScope("requiredScope")(req, res, next);
    sinon.assert.called(next);
    sinon.assert.notCalled(res.status);
  });

  it("should call next() when token has multiple scopes including the required one", async () => {
    req.params.token = "validToken";
    const validClientId = new mongoose.Types.ObjectId().toHexString();
    const tokenData = {
      client_id: validClientId,
      scopes: ["scope1", "scope2", "requiredScope"],
    };
    sandbox.stub(AccessTokenModel("airqo"), "find").returns({
      lean: sandbox.stub().resolves([tokenData]),
    });

    await checkScope("requiredScope")(req, res, next);
    sinon.assert.called(next);
    sinon.assert.notCalled(res.status);
  });

  it("should call next with an error on internal server error", async () => {
    req.params.token = "validToken";
    sandbox.stub(AccessTokenModel("airqo"), "find").returns({
      lean: sandbox.stub().rejects(new Error("Test error")),
    });

    await checkScope("requiredScope")(req, res, next);
    sinon.assert.calledOnce(next);
    sinon.assert.notCalled(res.status);
    expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    expect(next.firstCall.args[0].message).to.equal("Internal Server Error");
  });
});
