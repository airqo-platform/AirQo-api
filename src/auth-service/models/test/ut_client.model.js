require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// ClientModel has no try/catch — always calls getModelByTenant.
// Rewire to inject a fake getModelByTenant that registers the schema in-memory.
const ClientModule = rewire("@models/Client");
const ClientSchema = ClientModule.__get__("ClientSchema");
ClientModule.__set__("getModelByTenant", (tenant, modelName, schema) => {
  if (!mongoose.modelNames().includes("clients")) {
    mongoose.model("clients", schema);
  }
  return mongoose.model("clients");
});
const ClientModel = ClientModule;

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");

describe("ClientModel - Statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register", () => {
    it("should register a new client and return success response", async () => {
      const userId = new mongoose.Types.ObjectId();
      const args = {
        user_id: userId,
        name: "Test Client",
        client_secret: "test_secret",
        redirect_uri: "https://example.com/callback",
      };
      const createdData = { ...args, _id: new mongoose.Types.ObjectId() };

      const createStub = sinon
        .stub(ClientModel("airqo"), "create")
        .resolves(createdData);

      const result = await ClientModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("client created");
      expect(result.data).to.deep.include({ name: "Test Client" });

      createStub.restore();
    });

    it("should return conflict response for duplicate key", async () => {
      const userId = new mongoose.Types.ObjectId();
      const args = { user_id: userId, name: "Test Client" };

      const createStub = sinon
        .stub(ClientModel("airqo"), "create")
        .throws({ code: 11000, keyValue: { name: "Test Client" }, message: "dup key" });

      const result = await ClientModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.CONFLICT);
      expect(result).to.have.property("errors").that.is.an("object");

      createStub.restore();
    });
  });

  describe.skip("list", () => {
    // Skipped: list() uses aggregate chain with multiple lookups that cannot be simply mocked
  });

  describe("modify", () => {
    it("should modify an existing client and return success response", async () => {
      const clientData = {
        _id: new mongoose.Types.ObjectId(),
        name: "Test Client",
        redirect_uri: "https://example.com/updated",
      };

      const findOneAndUpdateStub = sinon
        .stub(ClientModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...clientData, _doc: clientData }) });

      const result = await ClientModel("airqo").modify({
        filter: { name: "Test Client" },
        update: { redirect_uri: "https://example.com/updated" },
      });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the client");
      expect(result.data).to.deep.equal(clientData);

      findOneAndUpdateStub.restore();
    });

    it("should return not found response when client does not exist", async () => {
      const findOneAndUpdateStub = sinon
        .stub(ClientModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await ClientModel("airqo").modify({
        filter: { name: "nonexistent" },
        update: { redirect_uri: "https://example.com/updated" },
      });

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "client does not exist, please crosscheck",
      });
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove", () => {
    it("should remove an existing client and return success response", async () => {
      const clientData = {
        _id: new mongoose.Types.ObjectId(),
        client_secret: "test_secret",
      };

      const findOneAndRemoveStub = sinon
        .stub(ClientModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...clientData, _doc: clientData }) });

      const result = await ClientModel("airqo").remove({
        filter: { _id: clientData._id },
      });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the client");
      expect(result.data).to.deep.equal(clientData);

      findOneAndRemoveStub.restore();
    });

    it("should return not found response when client does not exist", async () => {
      const findOneAndRemoveStub = sinon
        .stub(ClientModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await ClientModel("airqo").remove({
        filter: { _id: "nonexistent_client" },
      });

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        message: "client does not exist, please crosscheck",
      });
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      findOneAndRemoveStub.restore();
    });
  });
});

describe("ClientModel - Methods", () => {
  describe("toJSON", () => {
    it("should return the JSON representation of the client object", () => {
      const clientId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const client = new (ClientModel("airqo"))({
        _id: clientId,
        user_id: userId,
        client_secret: "test_secret",
        name: "Test Client",
        redirect_uri: "https://example.com/callback",
        description: "Test description",
        isActive: true,
      });

      const result = client.toJSON();

      expect(result._id.toString()).to.equal(clientId.toString());
      expect(result.client_secret).to.equal("test_secret");
      expect(result.name).to.equal("Test Client");
      expect(result.redirect_uri).to.equal("https://example.com/callback");
      expect(result.description).to.equal("Test description");
      expect(result.isActive).to.equal(true);
    });

    it("should not include fields absent from toJSON definition", () => {
      const userId = new mongoose.Types.ObjectId();

      const client = new (ClientModel("airqo"))({
        user_id: userId,
        name: "Test Client",
        client_secret: "test_secret",
      });

      const result = client.toJSON();

      expect(result).to.not.have.property("user_id");
      expect(result).to.not.have.property("__v");
    });
  });
});
