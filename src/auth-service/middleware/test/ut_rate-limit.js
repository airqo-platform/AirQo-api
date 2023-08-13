require("module-alias/register");
const express = require("express");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const rateLimitMiddleware = require("@middleware/rate-limit");
const request = require("supertest");
chai.use(sinonChai);
const expect = chai.expect;
const httpStatus = require("http-status");
const { client1 } = require("@config/redis");

describe("Rate Limit Middleware", () => {
  let redisClientStub;

  beforeEach(() => {
    redisClientStub = sinon.stub(client1);
  });

  afterEach(() => {
    redisClientStub.restore();
  });

  it("should allow requests when rate limit is not exceeded", async () => {
    const req = {
      user: { _id: "user123" },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    const next = sinon.stub();

    redisClientStub.get.withArgs("user123").resolves("5");
    const middleware = rateLimitMiddleware(() => 10);

    await middleware(req, res, next);

    expect(res.status.calledWith(httpStatus.OK)).to.be.true;
    expect(res.json.called).to.be.false;
    expect(next.calledOnce).to.be.true;
    expect(redisClientStub.incr.calledOnce).to.be.true;
    expect(redisClientStub.expire.calledOnce).to.be.true;
  });

  it("should return 429 when rate limit is exceeded", async () => {
    const req = {
      user: { _id: "user123" },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    const next = sinon.stub();

    redisClientStub.get.withArgs("user123").resolves("15");
    const middleware = rateLimitMiddleware(() => 10);

    await middleware(req, res, next);

    expect(res.status.calledWith(httpStatus.TOO_MANY_REQUESTS)).to.be.true;
    expect(res.json.calledWith({ message: "Rate limit exceeded" })).to.be.true;
    expect(next.called).to.be.false;
    expect(redisClientStub.incr.called).to.be.false;
    expect(redisClientStub.expire.called).to.be.false;
  });

  it("should handle internal server error", async () => {
    const req = {
      user: { _id: "user123" },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    const next = sinon.stub();

    redisClientStub.get.rejects(new Error("Redis error"));
    const middleware = rateLimitMiddleware(() => 10);

    await middleware(req, res, next);

    expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    expect(res.json.calledWith({ message: "Internal Server Error" })).to.be
      .true;
    expect(next.called).to.be.false;
    expect(redisClientStub.incr.called).to.be.false;
    expect(redisClientStub.expire.called).to.be.false;
  });
});
