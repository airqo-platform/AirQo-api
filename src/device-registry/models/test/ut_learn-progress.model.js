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
    const computeStage = (...args) => Model.computeStage(...args);

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

    it("should explicitly set learner_type on a brand-new guest document", async () => {
      // findOneAndUpdate(upsert: true) doesn't apply schema defaults on insert,
      // so learner_type must be written explicitly here or a new guest doc is
      // created with no learner_type at all (the bug this test guards against).
      sinon.stub(Model, "findOne").resolves(null);
      const findOneAndUpdateStub = sinon
        .stub(Model, "findOneAndUpdate")
        .resolves({});
      const next = sinon.spy();

      await Model.upsertLessonProgress(
        {
          device_id: "dev-007",
          guest_id: "guest-007",
          lesson_id: "lesson-7",
          update: { completed: false, furthest_activity_index: 1 },
          maxPoints: 2400,
        },
        next
      );

      const setOp = findOneAndUpdateStub.firstCall.args[1].$set;
      expect(setOp.learner_type).to.equal("guest");
    });

    it("should overwrite stars/points/quiz_score_ratio on a replay that scores better", async () => {
      const existingLessons = new Map([
        [
          "lesson-3",
          {
            completed: true,
            stars: 1,
            points_earned: 10,
            quiz_score_ratio: 1 / 3,
            furthest_activity_index: 4,
            quiz_attempts: [
              { activity_id: "a1", format: "single_choice", is_correct: true },
            ],
          },
        ],
      ]);
      sinon.stub(Model, "findOne").resolves({ lessons: existingLessons });
      sinon.stub(Model, "findOneAndUpdate").resolves({});
      const next = sinon.spy();

      const result = await Model.upsertLessonProgress(
        {
          device_id: "dev-003",
          lesson_id: "lesson-3",
          update: {
            completed: true,
            quiz_attempts: [
              { activity_id: "a1", format: "single_choice", is_correct: true },
              { activity_id: "a2", format: "single_choice", is_correct: true },
              { activity_id: "a3", format: "single_choice", is_correct: true },
            ],
          },
          maxPoints: 2400,
        },
        next
      );

      expect(result.data.stars).to.equal(3);
      expect(result.data.points_earned).to.equal(30);
    });

    it("should not downgrade stars/quiz_score_ratio on a replay that ties on points but has a worse ratio", async () => {
      // Previous best: 3/3 correct = 30 points, ratio 1.0, 3 stars.
      const existingLessons = new Map([
        [
          "lesson-3b",
          {
            completed: true,
            stars: 3,
            points_earned: 30,
            quiz_score_ratio: 1,
            furthest_activity_index: 3,
            quiz_attempts: [
              { activity_id: "a1", format: "single_choice", is_correct: true },
              { activity_id: "a2", format: "single_choice", is_correct: true },
              { activity_id: "a3", format: "single_choice", is_correct: true },
            ],
          },
        ],
      ]);
      sinon.stub(Model, "findOne").resolves({ lessons: existingLessons });
      const findOneAndUpdateStub = sinon
        .stub(Model, "findOneAndUpdate")
        .resolves({});
      const next = sinon.spy();

      // Replay: 3/6 correct — also 30 points, but a worse ratio (0.5) and stars (2).
      const result = await Model.upsertLessonProgress(
        {
          device_id: "dev-003b",
          lesson_id: "lesson-3b",
          update: {
            completed: true,
            quiz_attempts: [
              { activity_id: "a1", format: "single_choice", is_correct: true },
              { activity_id: "a2", format: "single_choice", is_correct: true },
              { activity_id: "a3", format: "single_choice", is_correct: true },
              { activity_id: "a4", format: "single_choice", is_correct: false },
              { activity_id: "a5", format: "single_choice", is_correct: false },
              { activity_id: "a6", format: "single_choice", is_correct: false },
            ],
          },
          maxPoints: 2400,
        },
        next
      );

      expect(result.data.stars).to.equal(3);
      expect(result.data.points_earned).to.equal(30);

      const setOp = findOneAndUpdateStub.firstCall.args[1].$set;
      expect(setOp["lessons.lesson-3b"].quiz_score_ratio).to.equal(1);
      expect(setOp["lessons.lesson-3b"].quiz_attempts).to.have.lengthOf(3);
    });

    it("should keep the previous best result (stars, points, and quiz_attempts together) on a replay that scores worse", async () => {
      const existingLessons = new Map([
        [
          "lesson-4",
          {
            completed: true,
            stars: 3,
            points_earned: 30,
            quiz_score_ratio: 1,
            furthest_activity_index: 4,
            quiz_attempts: [
              { activity_id: "a1", format: "single_choice", is_correct: true },
              { activity_id: "a2", format: "single_choice", is_correct: true },
              { activity_id: "a3", format: "single_choice", is_correct: true },
            ],
          },
        ],
      ]);
      sinon.stub(Model, "findOne").resolves({ lessons: existingLessons });
      const findOneAndUpdateStub = sinon
        .stub(Model, "findOneAndUpdate")
        .resolves({});
      const next = sinon.spy();

      const result = await Model.upsertLessonProgress(
        {
          device_id: "dev-004",
          lesson_id: "lesson-4",
          update: {
            completed: true,
            quiz_attempts: [
              { activity_id: "a1", format: "single_choice", is_correct: false },
              { activity_id: "a2", format: "single_choice", is_correct: false },
              { activity_id: "a3", format: "single_choice", is_correct: true },
            ],
          },
          maxPoints: 2400,
        },
        next
      );

      expect(result.data.stars).to.equal(3);
      expect(result.data.points_earned).to.equal(30);

      const setOp = findOneAndUpdateStub.firstCall.args[1].$set;
      expect(setOp["lessons.lesson-4"].quiz_attempts).to.have.lengthOf(3);
      expect(
        setOp["lessons.lesson-4"].quiz_attempts.every((a) => a.is_correct)
      ).to.be.true;
    });

    it("should persist free_text_response independent of quiz scoring", async () => {
      sinon.stub(Model, "findOne").resolves(null);
      const findOneAndUpdateStub = sinon
        .stub(Model, "findOneAndUpdate")
        .resolves({});
      const next = sinon.spy();

      await Model.upsertLessonProgress(
        {
          device_id: "dev-005",
          lesson_id: "lesson-5",
          update: {
            completed: true,
            free_text_response: "Because air pollution affects everyone.",
          },
          maxPoints: 2400,
        },
        next
      );

      const setOp = findOneAndUpdateStub.firstCall.args[1].$set;
      expect(setOp["lessons.lesson-5"].free_text_response).to.equal(
        "Because air pollution affects everyone."
      );
    });

    it("should keep the previous free_text_response when a later update omits it", async () => {
      const existingLessons = new Map([
        [
          "lesson-6",
          {
            completed: true,
            stars: 1,
            points_earned: 0,
            quiz_score_ratio: 1,
            furthest_activity_index: 2,
            free_text_response: "My first answer.",
          },
        ],
      ]);
      sinon.stub(Model, "findOne").resolves({ lessons: existingLessons });
      const findOneAndUpdateStub = sinon
        .stub(Model, "findOneAndUpdate")
        .resolves({});
      const next = sinon.spy();

      await Model.upsertLessonProgress(
        {
          device_id: "dev-006",
          lesson_id: "lesson-6",
          update: { completed: true, furthest_activity_index: 3 },
          maxPoints: 2400,
        },
        next
      );

      const setOp = findOneAndUpdateStub.firstCall.args[1].$set;
      expect(setOp["lessons.lesson-6"].free_text_response).to.equal(
        "My first answer."
      );
    });
  });
});
