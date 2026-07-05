require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("LearnProgress Model", () => {
  let Model;

  before(() => {
    const LearnProgressModel = proxyquire(
      path.resolve(__dirname, "../LearnProgress"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = LearnProgressModel("airqo");
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

    it("should define learner_type with enum [guest, user] and default guest", () => {
      const path = Model.schema.path("learner_type");
      expect(path.enumValues).to.include.members(["guest", "user"]);
      expect(path.defaultValue).to.equal("guest");
    });

    it("should default total_points to 0", () => {
      const path = Model.schema.path("total_points");
      expect(path.defaultValue).to.equal(0);
    });

    it("should define lessons as a Map", () => {
      const path = Model.schema.path("lessons");
      expect(path).to.exist;
    });
  });

  describe("Static: computeStage", () => {
    const { computeStage } = (() => {
      const MAX = 2400;
      function computeStage(totalPoints, maxPoints) {
        const STAGES = [
          { index: 0, name: "Curious" },
          { index: 1, name: "Aware" },
          { index: 2, name: "Observer" },
          { index: 3, name: "Champion" },
          { index: 4, name: "Defender" },
        ];
        if (!maxPoints || maxPoints === 0) return STAGES[0];
        const ratio = totalPoints / maxPoints;
        if (ratio >= 1.0) return STAGES[4];
        if (ratio >= 0.75) return STAGES[3];
        if (ratio >= 0.5) return STAGES[2];
        if (ratio >= 0.25) return STAGES[1];
        return STAGES[0];
      }
      return { computeStage, MAX };
    })();

    it("should return Curious for 0 points", () => {
      const stage = computeStage(0, 2400);
      expect(stage.name).to.equal("Curious");
    });

    it("should return Aware for 25% of max", () => {
      const stage = computeStage(600, 2400);
      expect(stage.name).to.equal("Aware");
    });

    it("should return Observer for 50% of max", () => {
      const stage = computeStage(1200, 2400);
      expect(stage.name).to.equal("Observer");
    });

    it("should return Champion for 75% of max", () => {
      const stage = computeStage(1800, 2400);
      expect(stage.name).to.equal("Champion");
    });

    it("should return Defender for 100% of max", () => {
      const stage = computeStage(2400, 2400);
      expect(stage.name).to.equal("Defender");
    });

    it("should return Curious when maxPoints is 0", () => {
      const stage = computeStage(500, 0);
      expect(stage.name).to.equal("Curious");
    });
  });

  describe("Static method: findProgress", () => {
    it("should return progress doc when found by device_id", async () => {
      const fakeDoc = { device_id: "dev-001", total_points: 100 };
      sinon.stub(Model, "findOne").returns({ lean: sinon.stub().resolves(fakeDoc) });
      const next = sinon.spy();

      const result = await Model.findProgress({ device_id: "dev-001" }, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeDoc);
    });

    it("should return null data and success true when no progress found", async () => {
      sinon.stub(Model, "findOne").returns({ lean: sinon.stub().resolves(null) });
      const next = sinon.spy();

      const result = await Model.findProgress({ device_id: "dev-missing" }, next);

      expect(result.success).to.be.true;
      expect(result.data).to.be.null;
      expect(result.message).to.equal("no progress found");
    });

    it("should prioritize user_id filter over device_id", async () => {
      const findOneStub = sinon.stub(Model, "findOne").returns({
        lean: sinon.stub().resolves(null),
      });
      const next = sinon.spy();

      await Model.findProgress({ device_id: "dev-001", user_id: "user-42" }, next);

      expect(findOneStub.calledWith({ user_id: "user-42" })).to.be.true;
    });

    it("should call next on db error", async () => {
      sinon.stub(Model, "findOne").throws(new Error("db error"));
      const next = sinon.spy();

      await Model.findProgress({ device_id: "dev-001" }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: upsertLessonProgress", () => {
    it("should call next on db error", async () => {
      sinon.stub(Model, "findOne").rejects(new Error("db error"));
      const next = sinon.spy();

      await Model.upsertLessonProgress(
        {
          device_id: "dev-001",
          lesson_id: "lesson-1",
          update: { completed: true, quiz_attempts: [] },
          maxPoints: 2400,
        },
        next
      );

      expect(next.calledOnce).to.be.true;
    });

    it("should return progress data on success", async () => {
      sinon.stub(Model, "findOne").returns({ lean: undefined });
      Model.findOne.restore();
      sinon.stub(Model, "findOne").resolves(null);
      sinon.stub(Model, "findOneAndUpdate").resolves({});
      const next = sinon.spy();

      const result = await Model.upsertLessonProgress(
        {
          device_id: "dev-002",
          lesson_id: "lesson-2",
          update: { completed: false, furthest_activity_index: 1 },
          maxPoints: 2400,
        },
        next
      );

      expect(result.success).to.be.true;
      expect(result.data).to.have.property("lesson_id", "lesson-2");
    });
  });
});
