require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("LearnCertificate Model", () => {
  let Model;

  before(() => {
    const LearnCertificateModel = proxyquire(
      path.resolve(__dirname, "../LearnCertificate"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = LearnCertificateModel("airqo");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Schema fields", () => {
    it("should define user_id as required String", () => {
      const path = Model.schema.path("user_id");
      expect(path).to.exist;
      expect(path.isRequired).to.be.true;
      expect(path.instance).to.equal("String");
    });

    it("should define course_id as required ObjectId ref", () => {
      const path = Model.schema.path("course_id");
      expect(path.isRequired).to.be.true;
    });

    it("should define learner_name as required String", () => {
      const path = Model.schema.path("learner_name");
      expect(path.isRequired).to.be.true;
    });

    it("should define verification_code as required unique String", () => {
      const path = Model.schema.path("verification_code");
      expect(path.isRequired).to.be.true;
    });

    it("should define share_url as optional", () => {
      const path = Model.schema.path("share_url");
      expect(path).to.exist;
      expect(path.isRequired).to.not.be.true;
    });
  });

  describe("Static method: register", () => {
    it("should return success and CREATED status on successful create", async () => {
      const courseId = new mongoose.Types.ObjectId();
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(),
        _doc: {
          user_id: "user-123",
          course_id: courseId,
          learner_name: "Alice",
          verification_code: "AQ-2025-LEARN-ABCD1234",
        },
      };
      sinon.stub(Model, "create").resolves(fakeDoc);
      const next = sinon.spy();

      const result = await Model.register(
        {
          user_id: "user-123",
          course_id: courseId,
          learner_name: "Alice",
          verification_code: "AQ-2025-LEARN-ABCD1234",
        },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.message).to.equal("certificate issued");
    });

    it("should call next on duplicate key error (11000)", async () => {
      const error = new Error("dup");
      error.code = 11000;
      error.keyPattern = { verification_code: 1 };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
    });

    it("should call next on validation errors", async () => {
      const error = new Error("val");
      error.errors = { user_id: { message: "user_id is required" } };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: list", () => {
    it("should return certificates sorted by createdAt descending", async () => {
      const fakeCerts = [
        { _id: "c1", verification_code: "AQ-2025-LEARN-AAAAAAAA" },
        { _id: "c2", verification_code: "AQ-2025-LEARN-BBBBBBBB" },
      ];
      const fakeQuery = {
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(fakeCerts),
      };
      sinon.stub(Model, "find").returns(fakeQuery);
      const next = sinon.spy();

      const result = await Model.list({}, next);

      expect(result.success).to.be.true;
      expect(result.data).to.have.lengthOf(2);
    });

    it("should call next when find throws", async () => {
      sinon.stub(Model, "find").throws(new Error("db error"));
      const next = sinon.spy();

      await Model.list({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });
});
