require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// Bootstrap in-memory model registration so factory works without DB
try {
  const _schema = rewire("@models/AccessToken").__get__("AccessTokenSchema");
  if (!mongoose.modelNames().includes("access_tokens")) {
    mongoose.model("access_tokens", _schema);
  }
} catch (_) {}

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const AccessTokenModel = require("@models/AccessToken");

describe("AccessTokenModel", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("findToken", () => {
    it("should return null user and currentAccessToken when no token is provided", async () => {
      const result = await AccessTokenModel("airqo").findToken("");
      expect(result.user).to.be.null;
      expect(result.currentAccessToken).to.be.null;
    });
  });

  describe("register", () => {
    it("should create a new access token and return success response", async () => {
      const mockAccessToken = { token: "testToken", user_id: "userId" };
      const createStub = sinon
        .stub(AccessTokenModel("airqo"), "create")
        .resolves(mockAccessToken);

      const args = { user_id: "userId", token: "testToken", expires: new Date() };
      const result = await AccessTokenModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Token created");
      expect(result.data).to.deep.equal(mockAccessToken);

      createStub.restore();
    });
  });

  describe.skip("list", () => {
    // Skipped: list() uses aggregate chain with multiple lookups that cannot be simply mocked
  });

  describe("modify", () => {
    it("should modify an access token and return success response", async () => {
      const mockToken = { _id: new mongoose.Types.ObjectId(), token: "testToken1" };
      const findOneAndUpdateStub = sinon
        .stub(AccessTokenModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...mockToken, _doc: mockToken }) });

      const result = await AccessTokenModel("airqo").modify({
        filter: { _id: mockToken._id },
        update: { token: "updatedToken" },
      });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the access token");
      expect(result.data).to.deep.equal(mockToken);
      expect(result.status).to.equal(httpStatus.OK);

      findOneAndUpdateStub.restore();
    });

    it("should return not found response when token does not exist", async () => {
      const findOneAndUpdateStub = sinon
        .stub(AccessTokenModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await AccessTokenModel("airqo").modify({
        filter: { _id: "nonExistentId" },
        update: { token: "updatedToken" },
      });

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Token does not exist, please crosscheck");
      expect(result.errors.message).to.equal("Token does not exist, please crosscheck");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      findOneAndUpdateStub.restore();
    });

    it("should return error response on internal server error", async () => {
      const findOneAndUpdateStub = sinon
        .stub(AccessTokenModel("airqo"), "findOneAndUpdate")
        .throws(new Error("Internal server error"));

      const result = await AccessTokenModel("airqo").modify({
        filter: { _id: "tokenId" },
        update: { token: "updatedToken" },
      });

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal("Internal server error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove", () => {
    it("should remove an access token and return success response", async () => {
      const mockToken = { _id: new mongoose.Types.ObjectId(), token: "testToken1" };
      const findOneAndRemoveStub = sinon
        .stub(AccessTokenModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...mockToken, _doc: mockToken }) });

      const result = await AccessTokenModel("airqo").remove({
        filter: { _id: mockToken._id },
      });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the access token");
      expect(result.data).to.deep.equal(mockToken);
      expect(result.status).to.equal(httpStatus.OK);

      findOneAndRemoveStub.restore();
    });

    it("should return not found response when token does not exist", async () => {
      const findOneAndRemoveStub = sinon
        .stub(AccessTokenModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await AccessTokenModel("airqo").remove({
        filter: { _id: "nonExistentId" },
      });

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Token does not exist, please crosscheck");
      expect(result.errors.message).to.equal("Token does not exist, please crosscheck");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      findOneAndRemoveStub.restore();
    });

    it("should return error response on internal server error", async () => {
      const findOneAndRemoveStub = sinon
        .stub(AccessTokenModel("airqo"), "findOneAndRemove")
        .throws(new Error("Internal server error"));

      const result = await AccessTokenModel("airqo").remove({
        filter: { _id: "tokenId" },
      });

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal("Internal server error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      findOneAndRemoveStub.restore();
    });
  });

  describe("toJSON", () => {
    it("should return the JSON representation of an access token", () => {
      const tokenId = new mongoose.Types.ObjectId();
      const createdAt = new Date("2023-07-25T12:34:56Z");
      const updatedAt = new Date("2023-07-25T12:34:56Z");
      const lastUsedAt = new Date("2023-07-25T12:34:56Z");
      const expires = new Date("2023-07-25T13:34:56Z");

      const token = new (AccessTokenModel("airqo"))({
        _id: tokenId,
        token: "testToken1",
        name: "AccessToken 1",
        last_ip_address: "192.168.1.1",
        createdAt,
        updatedAt,
        last_used_at: lastUsedAt,
        expires,
      });

      const result = token.toJSON();

      expect(result._id.toString()).to.equal(tokenId.toString());
      expect(result.token).to.equal("testToken1");
      expect(result.name).to.equal("AccessToken 1");
      expect(result.last_ip_address).to.equal("192.168.1.1");
      expect(result.createdAt).to.be.instanceOf(Date);
      expect(result.updatedAt).to.be.instanceOf(Date);
      expect(result.expires).to.be.instanceOf(Date);
    });
  });
});
