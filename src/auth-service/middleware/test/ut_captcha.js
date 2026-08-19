const sinon = require("sinon");
const chai = require("chai");
const httpStatus = require("http-status");
const expect = chai.expect;

const axios = require("axios");
const constants = require("@config/constants");
const captchaMiddleware = require("@middleware/captcha");

describe("Middleware: captcha.verify", () => {
  let req, next, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = { body: { captchaToken: "valid-token" } };
    next = sandbox.stub();
    sandbox.stub(constants, "HCAPTCHA_SECRET_KEY").value("test-secret");
    sandbox.stub(constants, "ENVIRONMENT").value("PRODUCTION ENVIRONMENT");
    sandbox.stub(constants, "BYPASS_CAPTCHA").value(false);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("bypasses verification when BYPASS_CAPTCHA is true in non-production", async () => {
    sandbox.stub(constants, "ENVIRONMENT").value("STAGING ENVIRONMENT");
    sandbox.stub(constants, "BYPASS_CAPTCHA").value(true);
    await captchaMiddleware.verify(req, {}, next);
    sinon.assert.calledOnce(next);
    sinon.assert.calledWithExactly(next);
  });

  it("returns 400 when captchaToken is missing", async () => {
    req.body = {};
    await captchaMiddleware.verify(req, {}, next);
    sinon.assert.calledOnce(next);
    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
  });

  it("returns 500 when HCAPTCHA_SECRET_KEY is not configured", async () => {
    sandbox.stub(constants, "HCAPTCHA_SECRET_KEY").value(undefined);
    await captchaMiddleware.verify(req, {}, next);
    sinon.assert.calledOnce(next);
    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
  });

  it("calls hCaptcha siteverify with form-encoded body and calls next() on success", async () => {
    const axiosPost = sandbox
      .stub(axios, "post")
      .resolves({ data: { success: true } });

    await captchaMiddleware.verify(req, {}, next);

    sinon.assert.calledOnce(axiosPost);
    const [url, body, config] = axiosPost.firstCall.args;
    expect(url).to.equal("https://hcaptcha.com/siteverify");
    expect(body.get("secret")).to.equal("test-secret");
    expect(body.get("response")).to.equal("valid-token");
    expect(config.headers["Content-Type"]).to.equal(
      "application/x-www-form-urlencoded"
    );
    sinon.assert.calledOnce(next);
    sinon.assert.calledWithExactly(next);
  });

  it("returns 400 when hCaptcha returns success=false", async () => {
    sandbox
      .stub(axios, "post")
      .resolves({ data: { success: false, "error-codes": ["invalid-input-response"] } });

    await captchaMiddleware.verify(req, {}, next);

    sinon.assert.calledOnce(next);
    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
  });

  it("returns 500 when axios throws", async () => {
    sandbox.stub(axios, "post").rejects(new Error("network error"));

    await captchaMiddleware.verify(req, {}, next);

    sinon.assert.calledOnce(next);
    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
  });
});
