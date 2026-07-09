require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chai = require("chai");
chai.use(sinonChai);
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const proxyquire = require("proxyquire");

describe("learnUtil", () => {
  let learnUtil;

  let LearnCourseModelStub;
  let LearnUnitModelStub;
  let LearnLessonModelStub;
  let LearnActivityModelStub;
  let LearnGuestSessionModelStub;
  let LearnProgressModelStub;
  let LearnCertificateModelStub;

  let courseInstance;
  let unitInstance;
  let lessonInstance;
  let activityInstance;
  let guestSessionInstance;
  let progressInstance;
  let certInstance;

  beforeEach(() => {
    courseInstance = {
      list: sinon.stub(),
      register: sinon.stub(),
      modify: sinon.stub(),
      remove: sinon.stub(),
      findOne: sinon.stub(),
      distinct: sinon.stub(),
      deleteMany: sinon.stub(),
    };
    unitInstance = {
      list: sinon.stub(),
      register: sinon.stub(),
      modify: sinon.stub(),
      remove: sinon.stub(),
      distinct: sinon.stub(),
      deleteMany: sinon.stub(),
    };
    lessonInstance = {
      list: sinon.stub(),
      register: sinon.stub(),
      modify: sinon.stub(),
      remove: sinon.stub(),
      distinct: sinon.stub(),
      deleteMany: sinon.stub(),
    };
    activityInstance = {
      list: sinon.stub(),
      register: sinon.stub(),
      modify: sinon.stub(),
      remove: sinon.stub(),
      deleteMany: sinon.stub(),
    };
    guestSessionInstance = {
      findOrCreate: sinon.stub(),
      findOne: sinon.stub(),
      findOneAndUpdate: sinon.stub(),
    };
    progressInstance = {
      findProgress: sinon.stub(),
      upsertLessonProgress: sinon.stub(),
      mergeGuestToUser: sinon.stub(),
      find: sinon.stub(),
      findOne: sinon.stub(),
      countDocuments: sinon.stub(),
    };
    certInstance = {
      list: sinon.stub(),
      register: sinon.stub(),
    };

    LearnCourseModelStub = sinon.stub().returns(courseInstance);
    LearnUnitModelStub = sinon.stub().returns(unitInstance);
    LearnLessonModelStub = sinon.stub().returns(lessonInstance);
    LearnActivityModelStub = sinon.stub().returns(activityInstance);
    LearnGuestSessionModelStub = sinon.stub().returns(guestSessionInstance);
    LearnProgressModelStub = sinon.stub().returns(progressInstance);
    LearnCertificateModelStub = sinon.stub().returns(certInstance);

    learnUtil = proxyquire("@utils/learn.util", {
      "@models/LearnCourse": LearnCourseModelStub,
      "@models/LearnUnit": LearnUnitModelStub,
      "@models/LearnLesson": LearnLessonModelStub,
      "@models/LearnActivity": LearnActivityModelStub,
      "@models/LearnGuestSession": LearnGuestSessionModelStub,
      "@models/LearnProgress": LearnProgressModelStub,
      "@models/LearnCertificate": LearnCertificateModelStub,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  const makeReq = (overrides = {}) => ({
    query: { tenant: "airqo" },
    params: {},
    body: {},
    headers: {},
    user: null,
    ...overrides,
  });

  // ---------------------------------------------------------------------------
  // getCatalog
  // ---------------------------------------------------------------------------

  describe("getCatalog", () => {
    it("should return catalog with stages and courses on success", async () => {
      const courseId = new mongoose.Types.ObjectId();
      const unitId = new mongoose.Types.ObjectId();
      const lessonId = new mongoose.Types.ObjectId();
      const activityId = new mongoose.Types.ObjectId();

      courseInstance.list.resolves({
        success: true,
        data: [
          {
            _id: courseId,
            course_number: 1,
            title: "Intro",
            plain_title_key: "intro",
            cover_image_url: "https://example.com/img.png",
          },
        ],
      });
      unitInstance.list.resolves({
        success: true,
        data: [{ _id: unitId, course_id: courseId, title: "Unit 1", unit_order: 1 }],
      });
      lessonInstance.list.resolves({
        success: true,
        data: [{ _id: lessonId, unit_id: unitId, title: "Lesson 1", lesson_order: 1 }],
      });
      activityInstance.list.resolves({
        success: true,
        data: [{ _id: activityId, lesson_id: lessonId, type: "article", order: 1, payload: {} }],
      });
      courseInstance.findOne = sinon.stub().returns({
        sort: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves({
          catalog_version: "2025-01-01",
          updatedAt: new Date("2025-01-01"),
        }),
      });

      const next = sinon.spy();
      const result = await learnUtil.getCatalog(makeReq(), next);

      expect(result.success).to.be.true;
      expect(result.data).to.have.property("stages");
      expect(result.data).to.have.property("courses");
      expect(result.data.courses).to.have.lengthOf(1);
    });

    it("should call next on unexpected error", async () => {
      courseInstance.list.rejects(new Error("unexpected"));
      const next = sinon.spy();

      await learnUtil.getCatalog(makeReq(), next);

      expect(next.calledOnce).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // getLesson
  // ---------------------------------------------------------------------------

  describe("getLesson", () => {
    it("should return lesson with activities on success", async () => {
      const lessonId = new mongoose.Types.ObjectId().toString();
      const actId = new mongoose.Types.ObjectId();

      lessonInstance.list.resolves({
        success: true,
        data: [{ _id: lessonId, title: "Lesson 1" }],
      });
      activityInstance.list.resolves({
        success: true,
        data: [{ _id: actId, type: "article", order: 1, payload: {} }],
      });

      const next = sinon.spy();
      const result = await learnUtil.getLesson(
        makeReq({ params: { lesson_id: lessonId } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data).to.have.property("title", "Lesson 1");
      expect(result.data.activities).to.have.lengthOf(1);
    });

    it("should return 404 when lesson not found", async () => {
      lessonInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();
      const result = await learnUtil.getLesson(
        makeReq({ params: { lesson_id: "nonexistent" } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });
  });

  // ---------------------------------------------------------------------------
  // createAnonymousSession
  // ---------------------------------------------------------------------------

  describe("createAnonymousSession", () => {
    it("should return guest_id and display_name on success", async () => {
      guestSessionInstance.findOrCreate.resolves({
        success: true,
        data: { guest_id: "guest_abc", display_name: "guest_abc", createdAt: new Date() },
        message: "guest session created",
        status: httpStatus.CREATED,
      });
      const next = sinon.spy();
      const result = await learnUtil.createAnonymousSession(
        makeReq({ body: { device_id: "dev-001" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data).to.have.property("guest_id", "guest_abc");
    });

    it("should pass a chosen username/event_id through to the model and surface them plus a generated avatar_image_url", async () => {
      guestSessionInstance.findOrCreate.resolves({
        success: true,
        data: {
          guest_id: "guest_abc",
          display_name: "Curious Falcon 482",
          avatar_icon: "🦊",
          username: "Thabo",
          event_id: "pretoria-2026",
          createdAt: new Date(),
        },
        message: "guest session created",
        status: httpStatus.CREATED,
      });
      const next = sinon.spy();
      const result = await learnUtil.createAnonymousSession(
        makeReq({
          body: { device_id: "dev-001", username: "Thabo", event_id: "pretoria-2026" },
        }),
        next
      );

      expect(result.success).to.be.true;
      expect(guestSessionInstance.findOrCreate).to.have.been.calledWith(
        sinon.match({ device_id: "dev-001", username: "Thabo", event_id: "pretoria-2026" })
      );
      // The guest's own chosen username takes over the display_name shown back to the client.
      expect(result.data.display_name).to.equal("Thabo");
      expect(result.data.username).to.equal("Thabo");
      expect(result.data.event_id).to.equal("pretoria-2026");
      expect(result.data.avatar_image_url).to.match(/^data:image\/svg\+xml;base64,/);
    });

    it("should propagate a conflict (undefined result) when the model rejects a taken username", async () => {
      guestSessionInstance.findOrCreate.resolves(undefined);
      const next = sinon.spy();
      const result = await learnUtil.createAnonymousSession(
        makeReq({
          body: { device_id: "dev-002", username: "Thabo", event_id: "pretoria-2026" },
        }),
        next
      );

      expect(result).to.be.undefined;
    });
  });

  // ---------------------------------------------------------------------------
  // getProgress
  // ---------------------------------------------------------------------------

  describe("getProgress", () => {
    it("should return empty state when no progress doc exists", async () => {
      progressInstance.findProgress.resolves({ success: true, data: null });
      const next = sinon.spy();
      const result = await learnUtil.getProgress(
        makeReq({ headers: { "x-device-id": "dev-001" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data.total_points).to.equal(0);
      expect(result.data.lessons).to.deep.equal({});
    });

    it("should return BAD_REQUEST when no device_id or user_id", async () => {
      const next = sinon.spy();
      const result = await learnUtil.getProgress(makeReq(), next);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return formatted progress when doc exists", async () => {
      progressInstance.findProgress.resolves({
        success: true,
        data: {
          learner_type: "guest",
          guest_id: "guest_abc",
          total_points: 50,
          completed_lessons: 1,
          current_stage_index: 0,
          lessons: new Map([
            [
              "lid1",
              {
                completed: true,
                stars: 2,
                points_earned: 20,
                quiz_score_ratio: 0.8,
                furthest_activity_index: 4,
              },
            ],
          ]),
        },
      });
      const next = sinon.spy();
      const result = await learnUtil.getProgress(
        makeReq({ headers: { "x-device-id": "dev-001" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data.total_points).to.equal(50);
      expect(result.data.lessons).to.have.property("lid1");
      expect(result.data.lessons.lid1.furthest_activity_index).to.equal(4);
    });

    it("should derive max_points only from published-course quiz activities", async () => {
      progressInstance.findProgress.resolves({ success: true, data: null });
      courseInstance.list.resolves({ success: true, data: [{ _id: "c1" }] });
      unitInstance.list.resolves({ success: true, data: [{ _id: "u1", course_id: "c1" }] });
      lessonInstance.list.resolves({ success: true, data: [{ _id: "l1", unit_id: "u1" }] });
      activityInstance.list.resolves({
        success: true,
        data: [{ type: "quiz", payload: { format: "single_choice" } }],
      });

      const next = sinon.spy();
      const result = await learnUtil.getProgress(
        makeReq({ headers: { "x-device-id": "dev-001" } }),
        next
      );

      expect(
        courseInstance.list.calledWithMatch({ filter: { published: true } })
      ).to.be.true;
      expect(result.data.max_points).to.equal(10);
    });
  });

  // ---------------------------------------------------------------------------
  // updateLessonProgress
  // ---------------------------------------------------------------------------

  describe("updateLessonProgress", () => {
    it("should return BAD_REQUEST when no device_id or user_id", async () => {
      const next = sinon.spy();
      const result = await learnUtil.updateLessonProgress(
        makeReq({ params: { lesson_id: "l1" } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return 404 when lesson not found", async () => {
      lessonInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();
      const result = await learnUtil.updateLessonProgress(
        makeReq({
          params: { lesson_id: "l1" },
          headers: { "x-device-id": "dev-001" },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("should return progress data on success", async () => {
      const lessonId = new mongoose.Types.ObjectId().toString();
      lessonInstance.list
        .onFirstCall()
        .resolves({ success: true, data: [{ _id: lessonId, unit_id: "u1", lesson_order: 1 }] })
        .onSecondCall()
        .resolves({ success: true, data: [] });

      progressInstance.upsertLessonProgress.resolves({
        success: true,
        data: {
          lesson_id: lessonId,
          stars: 2,
          points_earned: 20,
          total_points: 20,
          current_stage: { index: 0, name: "Curious" },
          completed: true,
        },
      });

      const next = sinon.spy();
      const result = await learnUtil.updateLessonProgress(
        makeReq({
          params: { lesson_id: lessonId },
          headers: { "x-device-id": "dev-001" },
          body: { completed: true, quiz_attempts: [] },
        }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data).to.have.property("stars", 2);
    });

    it("should grade quiz attempts server-side using the stored correct answer", async () => {
      const lessonId = new mongoose.Types.ObjectId().toString();
      const activityId = new mongoose.Types.ObjectId().toString();
      lessonInstance.list
        .onFirstCall()
        .resolves({ success: true, data: [{ _id: lessonId, unit_id: "u1", lesson_order: 1 }] })
        .onSecondCall()
        .resolves({ success: true, data: [] });

      activityInstance.list.resolves({
        success: true,
        data: [
          {
            _id: activityId,
            type: "quiz",
            payload: { format: "single_choice", options: ["a", "b"], correct_index: 1 },
          },
        ],
      });

      progressInstance.upsertLessonProgress.resolves({
        success: true,
        data: {
          lesson_id: lessonId,
          stars: 3,
          points_earned: 10,
          total_points: 10,
          current_stage: { index: 0, name: "Curious" },
          completed: true,
        },
      });

      const next = sinon.spy();
      await learnUtil.updateLessonProgress(
        makeReq({
          params: { lesson_id: lessonId },
          headers: { "x-device-id": "dev-001" },
          body: {
            completed: true,
            quiz_attempts: [
              {
                activity_id: activityId,
                format: "single_choice",
                selected_index: 1,
                is_correct: false, // client under-reports — server should override
              },
            ],
          },
        }),
        next
      );

      const passedUpdate = progressInstance.upsertLessonProgress.firstCall.args[0].update;
      expect(passedUpdate.quiz_attempts[0].is_correct).to.equal(true);
    });

    it("should trust the client's is_correct when the activity can't be verified", async () => {
      const lessonId = new mongoose.Types.ObjectId().toString();
      lessonInstance.list
        .onFirstCall()
        .resolves({ success: true, data: [{ _id: lessonId, unit_id: "u1", lesson_order: 1 }] })
        .onSecondCall()
        .resolves({ success: true, data: [] });

      progressInstance.upsertLessonProgress.resolves({
        success: true,
        data: {
          lesson_id: lessonId,
          stars: 1,
          points_earned: 0,
          total_points: 0,
          current_stage: { index: 0, name: "Curious" },
          completed: true,
        },
      });

      const next = sinon.spy();
      await learnUtil.updateLessonProgress(
        makeReq({
          params: { lesson_id: lessonId },
          headers: { "x-device-id": "dev-001" },
          body: {
            completed: true,
            quiz_attempts: [
              {
                activity_id: "not-a-valid-object-id",
                format: "single_choice",
                selected_index: 0,
                is_correct: true,
              },
            ],
          },
        }),
        next
      );

      const passedUpdate = progressInstance.upsertLessonProgress.firstCall.args[0].update;
      expect(passedUpdate.quiz_attempts[0].is_correct).to.equal(true);
    });
  });

  // ---------------------------------------------------------------------------
  // createCourse
  // ---------------------------------------------------------------------------

  describe("createCourse", () => {
    it("should block creating with published: true", async () => {
      const next = sinon.spy();
      const result = await learnUtil.createCourse(
        makeReq({ body: { course_number: 1, title: "Test", plain_title_key: "test", published: true } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNPROCESSABLE_ENTITY);
    });

    it("should call model.register when published is false", async () => {
      courseInstance.register.resolves({
        success: true,
        data: { course_number: 1, title: "Test" },
        status: httpStatus.CREATED,
      });
      const next = sinon.spy();
      const result = await learnUtil.createCourse(
        makeReq({ body: { course_number: 1, title: "Test", plain_title_key: "test" } }),
        next
      );

      expect(courseInstance.register.calledOnce).to.be.true;
      expect(result.success).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // addActivity — payload validation
  // ---------------------------------------------------------------------------

  describe("addActivity", () => {
    beforeEach(() => {
      lessonInstance.list.resolves({
        success: true,
        data: [{ _id: "l1", title: "Lesson 1" }],
      });
    });

    it("should reject article activity missing payload.body", async () => {
      const next = sinon.spy();
      const result = await learnUtil.addActivity(
        makeReq({
          params: { lesson_id: "l1" },
          body: { type: "article", order: 1, payload: {} },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNPROCESSABLE_ENTITY);
    });

    it("should reject video activity missing both video_url and youtube_id", async () => {
      const next = sinon.spy();
      const result = await learnUtil.addActivity(
        makeReq({
          params: { lesson_id: "l1" },
          body: { type: "video", order: 1, payload: {} },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNPROCESSABLE_ENTITY);
    });

    it("should reject quiz activity missing payload.format", async () => {
      const next = sinon.spy();
      const result = await learnUtil.addActivity(
        makeReq({
          params: { lesson_id: "l1" },
          body: { type: "quiz", order: 1, payload: {} },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNPROCESSABLE_ENTITY);
    });

    it("should call model.register for valid article activity", async () => {
      activityInstance.register.resolves({
        success: true,
        data: { type: "article" },
        status: httpStatus.CREATED,
      });
      const next = sinon.spy();
      const result = await learnUtil.addActivity(
        makeReq({
          params: { lesson_id: "l1" },
          body: { type: "article", order: 1, payload: { body: "some content" } },
        }),
        next
      );

      expect(activityInstance.register.calledOnce).to.be.true;
      expect(result.success).to.be.true;
    });

    it("should reject quiz activity with an unrecognized format", async () => {
      const next = sinon.spy();
      const result = await learnUtil.addActivity(
        makeReq({
          params: { lesson_id: "l1" },
          body: {
            type: "quiz",
            order: 1,
            payload: { format: "matching", options: ["a", "b"] },
          },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNPROCESSABLE_ENTITY);
      expect(result.errors).to.have.property("payload.format");
    });

    it("should reject single_choice quiz missing correct_index", async () => {
      const next = sinon.spy();
      const result = await learnUtil.addActivity(
        makeReq({
          params: { lesson_id: "l1" },
          body: {
            type: "quiz",
            order: 1,
            payload: { format: "single_choice", options: ["a", "b"] },
          },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNPROCESSABLE_ENTITY);
      expect(result.errors).to.have.property("payload.correct_index");
    });

    it("should call model.register for a valid single_choice quiz", async () => {
      activityInstance.register.resolves({
        success: true,
        data: { type: "quiz" },
        status: httpStatus.CREATED,
      });
      const next = sinon.spy();
      const result = await learnUtil.addActivity(
        makeReq({
          params: { lesson_id: "l1" },
          body: {
            type: "quiz",
            order: 1,
            payload: { format: "single_choice", options: ["a", "b"], correct_index: 0 },
          },
        }),
        next
      );

      expect(activityInstance.register.calledOnce).to.be.true;
      expect(result.success).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // deleteCourse
  // ---------------------------------------------------------------------------

  describe("deleteCourse", () => {
    it("should return 404 when course not found", async () => {
      courseInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();
      const result = await learnUtil.deleteCourse(
        makeReq({ params: { course_id: "c1" } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("should return CONFLICT when course is published", async () => {
      courseInstance.list.resolves({
        success: true,
        data: [{ _id: "c1", published: true }],
      });
      const next = sinon.spy();
      const result = await learnUtil.deleteCourse(
        makeReq({ params: { course_id: "c1" } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.CONFLICT);
    });

    it("should cascade delete units/lessons/activities and remove course", async () => {
      courseInstance.list.resolves({
        success: true,
        data: [{ _id: "c1", published: false }],
      });
      unitInstance.distinct.resolves(["u1"]);
      lessonInstance.distinct.resolves(["l1"]);
      activityInstance.deleteMany.resolves({});
      lessonInstance.deleteMany.resolves({});
      unitInstance.deleteMany.resolves({});
      courseInstance.remove.resolves({ success: true, data: {} });
      const next = sinon.spy();

      const result = await learnUtil.deleteCourse(
        makeReq({ params: { course_id: "c1" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(activityInstance.deleteMany.calledOnce).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // linkGuestProgress
  // ---------------------------------------------------------------------------

  describe("linkGuestProgress", () => {
    it("should return UNAUTHORIZED when no user_id", async () => {
      const next = sinon.spy();
      const result = await learnUtil.linkGuestProgress(
        makeReq({ body: { device_id: "dev-001", guest_id: "guest_abc" } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNAUTHORIZED);
    });

    it("should return BAD_REQUEST when guest session not found", async () => {
      guestSessionInstance.findOne.returns({ lean: sinon.stub().resolves(null) });
      const next = sinon.spy();
      const result = await learnUtil.linkGuestProgress(
        makeReq({
          body: { device_id: "dev-001", guest_id: "guest_abc" },
          user: { id: "user-1" },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should merge and return success when session is valid", async () => {
      guestSessionInstance.findOne.returns({
        lean: sinon.stub().resolves({ device_id: "dev-001", guest_id: "guest_abc", linked_user_id: null }),
      });
      progressInstance.mergeGuestToUser.resolves({
        success: true,
        data: { lessons_transferred: 3, points_transferred: 60, courses_completed: 0 },
      });
      guestSessionInstance.findOneAndUpdate.resolves({});
      const next = sinon.spy();

      const result = await learnUtil.linkGuestProgress(
        makeReq({
          body: { device_id: "dev-001", guest_id: "guest_abc" },
          user: { id: "user-1" },
        }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data).to.have.property("user_id", "user-1");
    });
  });

  // ---------------------------------------------------------------------------
  // getLeaderboard
  // ---------------------------------------------------------------------------

  describe("getLeaderboard", () => {
    it("should return the leaderboard for a fully anonymous caller (no device_id, no user_id), without personalization", async () => {
      progressInstance.find = sinon.stub().returns({
        sort: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([
          {
            device_id: "dev-001",
            learner_type: "guest",
            total_points: 30,
            completed_lessons: 3,
          },
        ]),
      });

      const next = sinon.spy();
      const result = await learnUtil.getLeaderboard(makeReq(), next);

      expect(result.success).to.be.true;
      expect(result.data.entries[0].is_current_user).to.be.false;
      expect(result.data.current_user_rank).to.be.null;
      // No identity was supplied, so no per-caller lookup should have run.
      expect(progressInstance.findOne.called).to.be.false;
    });

    it("should allow a guest identified by X-Device-Id to view the leaderboard", async () => {
      progressInstance.find = sinon.stub().returns({
        sort: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([
          {
            device_id: "dev-001",
            learner_type: "guest",
            total_points: 30,
            completed_lessons: 3,
          },
        ]),
      });

      const next = sinon.spy();
      const result = await learnUtil.getLeaderboard(
        makeReq({ headers: { "x-device-id": "dev-001" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data.entries[0].is_current_user).to.be.true;
      expect(result.data.current_user_rank).to.equal(1);
    });

    it("should compute current_stage live from total_points and catalog-derived max_points", async () => {
      // Catalog: 1 published course/unit/lesson with 2 gradable quiz activities => max_points = 20
      courseInstance.list.resolves({ success: true, data: [{ _id: "c1" }] });
      unitInstance.list.resolves({ success: true, data: [{ _id: "u1", course_id: "c1" }] });
      lessonInstance.list.resolves({ success: true, data: [{ _id: "l1", unit_id: "u1" }] });
      activityInstance.list.resolves({
        success: true,
        data: [
          { type: "quiz", payload: { format: "single_choice" } },
          { type: "quiz", payload: { format: "single_choice" } },
        ],
      });

      progressInstance.find = sinon.stub().returns({
        sort: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([
          {
            user_id: "user-1",
            learner_type: "user",
            total_points: 20,
            completed_lessons: 2,
          },
        ]),
      });

      const next = sinon.spy();
      const result = await learnUtil.getLeaderboard(
        makeReq({ user: { id: "user-1" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data.entries[0].current_stage.name).to.equal("Defender");
    });

    it("should scope entries to a single event_id and resolve a guest's custom username + avatar_image_url", async () => {
      guestSessionInstance.find = sinon.stub().callsFake((filter) => {
        if (filter && filter.event_id) {
          return {
            select: sinon.stub().returnsThis(),
            lean: sinon.stub().resolves([{ guest_id: "guest_1", linked_user_id: null }]),
          };
        }
        return {
          select: sinon.stub().returnsThis(),
          lean: sinon.stub().resolves([
            {
              guest_id: "guest_1",
              display_name: "Curious Falcon 482",
              avatar_icon: "🦊",
              username: "Thabo",
            },
          ]),
        };
      });
      progressInstance.find = sinon.stub().returns({
        sort: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([
          {
            guest_id: "guest_1",
            learner_type: "guest",
            total_points: 50,
            completed_lessons: 5,
          },
        ]),
      });

      const next = sinon.spy();
      const result = await learnUtil.getLeaderboard(
        makeReq({ query: { tenant: "airqo", event_id: "pretoria-2026" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data.scope).to.equal("event");
      expect(result.data.event_id).to.equal("pretoria-2026");
      expect(result.data.entries[0].display_name).to.equal("Thabo");
      expect(result.data.entries[0].avatar_image_url).to.match(
        /^data:image\/svg\+xml;base64,/
      );
    });

    it("should return an empty event-scoped leaderboard without querying progress when nobody joined that event", async () => {
      guestSessionInstance.find = sinon.stub().returns({
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([]),
      });
      progressInstance.find = sinon.stub();

      const next = sinon.spy();
      const result = await learnUtil.getLeaderboard(
        makeReq({ query: { tenant: "airqo", event_id: "no-participants" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data.scope).to.equal("event");
      expect(result.data.entries).to.deep.equal([]);
      expect(progressInstance.find.called).to.be.false;
    });

    it("should not assign an event rank to a caller who has progress but never joined that event", async () => {
      // Only guest_1 joined the "pretoria-2026" event.
      guestSessionInstance.find = sinon.stub().returns({
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([{ guest_id: "guest_1", linked_user_id: null }]),
      });
      progressInstance.find = sinon.stub().returns({
        sort: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([
          {
            guest_id: "guest_1",
            learner_type: "guest",
            total_points: 50,
            completed_lessons: 5,
          },
        ]),
      });
      // Caller's own doc exists (they've played before) but under a device_id
      // that isn't part of the event's guest/user id set.
      progressInstance.findOne = sinon.stub().returns({
        lean: sinon.stub().resolves(null),
      });

      const next = sinon.spy();
      const result = await learnUtil.getLeaderboard(
        makeReq({
          query: { tenant: "airqo", event_id: "pretoria-2026" },
          headers: { "x-device-id": "dev-outsider" },
        }),
        next
      );

      expect(result.success).to.be.true;
      // The outsider's own-progress lookup must have been scoped to the
      // event's $or membership filter, not just their device_id.
      expect(progressInstance.findOne).to.have.been.calledWith(
        sinon.match({ device_id: "dev-outsider", $or: sinon.match.array })
      );
      expect(result.data.current_user_rank).to.be.null;
    });
  });

  // ---------------------------------------------------------------------------
  // issueCertificate
  // ---------------------------------------------------------------------------

  describe("issueCertificate", () => {
    it("should return UNAUTHORIZED when no user_id", async () => {
      const next = sinon.spy();
      const result = await learnUtil.issueCertificate(
        makeReq({ body: { course_id: "c1" } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.UNAUTHORIZED);
    });

    it("should return 404 when course not found", async () => {
      courseInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();
      const result = await learnUtil.issueCertificate(
        makeReq({
          body: { course_id: "c1", learner_name: "Alice" },
          user: { id: "user-1" },
        }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });
  });

  // ---------------------------------------------------------------------------
  // verifyCertificate
  // ---------------------------------------------------------------------------

  describe("verifyCertificate", () => {
    it("should return 404 when certificate not found", async () => {
      certInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();
      const result = await learnUtil.verifyCertificate(
        makeReq({ params: { verification_code: "AQ-2025-LEARN-NOTFOUND" } }),
        next
      );

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("should return certificate details when found", async () => {
      const courseId = new mongoose.Types.ObjectId();
      certInstance.list.resolves({
        success: true,
        data: [
          {
            _id: "cert-1",
            learner_name: "Alice",
            verification_code: "AQ-2025-LEARN-AAAAAAAA",
            course_id: courseId,
            share_url: "https://airqo.net/learn/cert/AQ-2025-LEARN-AAAAAAAA",
            createdAt: new Date(),
          },
        ],
      });
      courseInstance.list.resolves({
        success: true,
        data: [{ _id: courseId, title: "Intro to AQ" }],
      });
      const next = sinon.spy();

      const result = await learnUtil.verifyCertificate(
        makeReq({ params: { verification_code: "AQ-2025-LEARN-AAAAAAAA" } }),
        next
      );

      expect(result.success).to.be.true;
      expect(result.data.valid).to.be.true;
      expect(result.data.learner_name).to.equal("Alice");
    });
  });
});
