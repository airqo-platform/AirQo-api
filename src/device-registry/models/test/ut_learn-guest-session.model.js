require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("LearnGuestSession Model", () => {
  let Model;

  before(() => {
    const LearnGuestSessionModel = proxyquire(
      path.resolve(__dirname, "../LearnGuestSession"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = LearnGuestSessionModel("airqo");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Schema fields", () => {
    it("should define device_id as required String", () => {
      const path = Model.schema.path("device_id");
      expect(path).to.exist;
      expect(path.isRequired).to.be.true;
    });

    it("should define guest_id as required String", () => {
      const path = Model.schema.path("guest_id");
      expect(path.isRequired).to.be.true;
    });

    it("should define platform with enum [android, ios]", () => {
      const path = Model.schema.path("platform");
      expect(path.enumValues).to.include.members(["android", "ios"]);
    });

    it("should default linked_user_id to null", () => {
      const path = Model.schema.path("linked_user_id");
      expect(path.defaultValue).to.equal(null);
    });

    it("should default linked_at to null", () => {
      const path = Model.schema.path("linked_at");
      expect(path.defaultValue).to.equal(null);
    });
  });

  describe("Static method: register", () => {
    it("should return success with CREATED status", async () => {
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(),
        _doc: { device_id: "dev-001", guest_id: "guest_abc123" },
      };
      sinon.stub(Model, "create").resolves(fakeDoc);
      const next = sinon.spy();

      const result = await Model.register(
        { device_id: "dev-001", guest_id: "guest_abc123" },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.message).to.equal("guest session created");
    });

    it("should call next on duplicate device_id (11000)", async () => {
      const error = new Error("dup");
      error.code = 11000;
      error.keyPattern = { device_id: 1 };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: findOrCreate", () => {
    it("should return existing session when device_id already registered", async () => {
      const existingSession = { device_id: "dev-001", guest_id: "guest_existing" };
      sinon.stub(Model, "findOne").returns({
        lean: sinon.stub().resolves(existingSession),
      });
      const next = sinon.spy();

      const result = await Model.findOrCreate({ device_id: "dev-001" }, next);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal(existingSession);
    });

    it("should create and return a new session when device_id not found", async () => {
      sinon.stub(Model, "findOne").returns({
        lean: sinon.stub().resolves(null),
      });
      const fakeCreated = {
        _id: "new-id",
        _doc: { device_id: "dev-new", guest_id: "guest_new" },
      };
      sinon.stub(Model, "create").resolves(fakeCreated);
      const next = sinon.spy();

      const result = await Model.findOrCreate({ device_id: "dev-new" }, next);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
    });

    it("should re-fetch on race condition duplicate key", async () => {
      sinon.stub(Model, "findOne")
        .onFirstCall().returns({ lean: sinon.stub().resolves(null) })
        .onSecondCall().returns({ lean: sinon.stub().resolves({ device_id: "dev-race", guest_id: "guest_winner" }) });

      const dupError = new Error("dup");
      dupError.code = 11000;
      sinon.stub(Model, "create").rejects(dupError);
      const next = sinon.spy();

      const result = await Model.findOrCreate({ device_id: "dev-race" }, next);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.include({ device_id: "dev-race", guest_id: "guest_winner" });
    });
  });

  describe("Static method: findOrCreate — username + event scoping", () => {
    it("should create a new session with a chosen username when it's available in that event", async () => {
      sinon
        .stub(Model, "findOne")
        .onFirstCall().returns({ lean: sinon.stub().resolves(null) }) // no existing device_id session
        .onSecondCall().returns({ lean: sinon.stub().resolves(null) }); // username available
      const fakeCreated = {
        _id: "new-id",
        _doc: {
          device_id: "dev-new",
          guest_id: "guest_new",
          username: "Thabo",
          event_id: "pretoria-2026",
        },
      };
      sinon.stub(Model, "create").resolves(fakeCreated);
      const next = sinon.spy();

      const result = await Model.findOrCreate(
        { device_id: "dev-new", username: "Thabo", event_id: "pretoria-2026" },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(next.called).to.be.false;
    });

    it("should reject creation via next(CONFLICT) when the username is already taken in that event", async () => {
      sinon
        .stub(Model, "findOne")
        .onFirstCall().returns({ lean: sinon.stub().resolves(null) }) // no existing device_id session
        .onSecondCall().returns({
          lean: sinon.stub().resolves({ _id: "other-id", username: "Thabo" }),
        }); // clash
      const createStub = sinon.stub(Model, "create");
      const next = sinon.spy();

      const result = await Model.findOrCreate(
        { device_id: "dev-new-2", username: "Thabo", event_id: "pretoria-2026" },
        next
      );

      expect(result).to.be.undefined;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.CONFLICT);
      expect(createStub.called).to.be.false;
    });

    it("should update the username on an existing session when the new name is available", async () => {
      const existingSession = {
        _id: "session-1",
        device_id: "dev-001",
        guest_id: "guest_existing",
        username: null,
        event_id: "pretoria-2026",
      };
      sinon
        .stub(Model, "findOne")
        .onFirstCall().returns({ lean: sinon.stub().resolves(existingSession) })
        .onSecondCall().returns({ lean: sinon.stub().resolves(null) }); // username available
      sinon.stub(Model, "findOneAndUpdate").returns({
        lean: sinon.stub().resolves({ ...existingSession, username: "Thabo" }),
      });
      const next = sinon.spy();

      const result = await Model.findOrCreate(
        { device_id: "dev-001", username: "Thabo" },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.username).to.equal("Thabo");
    });

    it("should reject an update via next(CONFLICT) when the new username is already taken in that event", async () => {
      const existingSession = {
        _id: "session-1",
        device_id: "dev-001",
        guest_id: "guest_existing",
        username: null,
        event_id: "pretoria-2026",
      };
      sinon
        .stub(Model, "findOne")
        .onFirstCall().returns({ lean: sinon.stub().resolves(existingSession) })
        .onSecondCall().returns({
          lean: sinon.stub().resolves({ _id: "other-id", username: "Thabo" }),
        }); // clash
      const updateStub = sinon.stub(Model, "findOneAndUpdate");
      const next = sinon.spy();

      const result = await Model.findOrCreate(
        { device_id: "dev-001", username: "Thabo" },
        next
      );

      expect(result).to.be.undefined;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.CONFLICT);
      expect(updateStub.called).to.be.false;
    });
  });

  describe("Static method: modify", () => {
    it("should return success when session is updated", async () => {
      const fakeUpdated = {
        _id: "session-1",
        _doc: { linked_user_id: "user-123" },
      };
      sinon.stub(Model, "findOneAndUpdate").resolves(fakeUpdated);
      const next = sinon.spy();

      const result = await Model.modify(
        { filter: { device_id: "dev-001" }, update: { linked_user_id: "user-123" } },
        next
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the guest session");
    });

    it("should call next when no session found", async () => {
      sinon.stub(Model, "findOneAndUpdate").resolves(null);
      const next = sinon.spy();

      await Model.modify({ filter: {}, update: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });
});
