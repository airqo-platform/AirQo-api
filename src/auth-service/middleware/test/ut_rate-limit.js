require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const rateLimitMiddleware = require("@middleware/rate-limit");
chai.use(sinonChai);
const expect = chai.expect;
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { client1 } = require("@config/redis");
const redisClient = client1;
const AccessTokenModel = require("@models/AccessToken");
const ClientModel = require("@models/Client");

describe("Rate Limit Middleware", () => {
  let req, res, next, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = {
      params: {
        token: "sample-token",
      },
      query: {
        tenant: "sample-tenant",
      },
    };
    res = {
      status: sandbox.stub().returnsThis(),
      send: sandbox.stub(),
    };
    next = sandbox.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should handle valid token and client", async () => {
    const responseFromFindToken = [
      {
        client_id: mongoose.Types.ObjectId().toString(),
      },
    ];
    const client = {
      _id: mongoose.Types.ObjectId(),
      rateLimit: 10,
    };
    sandbox
      .stub(AccessTokenModel.prototype, "find")
      .resolves(responseFromFindToken);
    sandbox.stub(ClientModel.prototype, "findById").resolves(client);
    sandbox.stub(redisClient, "get").resolves("5");
    await rateLimitMiddleware(req, res, next);

    expect(res.status.calledWith(httpStatus.OK)).to.be.true;
    expect(next.calledOnce).to.be.true;
  });

  it("should handle invalid client ID", async () => {
    const responseFromFindToken = [
      {
        client_id: "invalid-client-id",
      },
    ];
    sandbox
      .stub(AccessTokenModel.prototype, "find")
      .resolves(responseFromFindToken);
    await rateLimitMiddleware(req, res, next);

    expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
    expect(
      res.send.calledWith("Invalid client ID associated with provided token")
    ).to.be.true;
  });

  it("should handle unauthorized client", async () => {
    sandbox.stub(AccessTokenModel.prototype, "find").resolves([]);
    await rateLimitMiddleware(req, res, next);

    expect(res.status.calledWith(httpStatus.UNAUTHORIZED)).to.be.true;
    expect(res.send.calledWith("Unauthorized")).to.be.true;
  });

  it("should handle rate limit exceeded", async () => {
    const responseFromFindToken = [
      {
        client_id: mongoose.Types.ObjectId().toString(),
      },
    ];
    const client = {
      _id: mongoose.Types.ObjectId(),
      rateLimit: 5,
    };
    sandbox
      .stub(AccessTokenModel.prototype, "find")
      .resolves(responseFromFindToken);
    sandbox.stub(ClientModel.prototype, "findById").resolves(client);
    sandbox.stub(redisClient, "get").resolves("10");
    await rateLimitMiddleware(req, res, next);

    expect(res.status.calledWith(httpStatus.TOO_MANY_REQUESTS)).to.be.true;
    expect(res.send.calledWith("Rate limit exceeded")).to.be.true;
  });

  it("should handle internal server error", async () => {
    sandbox
      .stub(AccessTokenModel.prototype, "find")
      .throws(new Error("Sample Error"));
    await rateLimitMiddleware(req, res, next);

    expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    expect(res.send.calledWith("Internal Server Error -- Sample Error")).to.be
      .true;
  });
});
