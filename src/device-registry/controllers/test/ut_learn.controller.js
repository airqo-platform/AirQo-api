require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chai = require("chai");
chai.use(sinonChai);
const httpStatus = require("http-status");
const proxyquire = require("proxyquire");

describe("learnController", () => {
  let controller;
  let learnUtilStub;
  let sharedStub;

  const makeRes = () => {
    const res = {};
    res.status = sinon.stub().returns(res);
    res.json = sinon.stub().returns(res);
    res.headersSent = false;
    return res;
  };

  const makeReq = (overrides = {}) => ({
    query: { tenant: "airqo" },
    params: {},
    body: {},
    headers: {},
    user: null,
    ...overrides,
  });

  beforeEach(() => {
    learnUtilStub = {
      getCatalog: sinon.stub(),
      getLesson: sinon.stub(),
      createAnonymousSession: sinon.stub(),
      getProgress: sinon.stub(),
      updateLessonProgress: sinon.stub(),
      syncProgress: sinon.stub(),
      linkGuestProgress: sinon.stub(),
      issueCertificate: sinon.stub(),
      listCertificates: sinon.stub(),
      verifyCertificate: sinon.stub(),
      getLeaderboard: sinon.stub(),
      getCourseProgress: sinon.stub(),
      createCourse: sinon.stub(),
      addUnit: sinon.stub(),
      addLesson: sinon.stub(),
      addActivity: sinon.stub(),
      listCourses: sinon.stub(),
      getCourse: sinon.stub(),
      deleteCourse: sinon.stub(),
      updateUnit: sinon.stub(),
      deleteUnit: sinon.stub(),
      updateLesson: sinon.stub(),
      deleteLesson: sinon.stub(),
      updateActivity: sinon.stub(),
      deleteActivity: sinon.stub(),
      updateCourse: sinon.stub(),
      deleteGuestProgress: sinon.stub(),
      clearLeaderboard: sinon.stub(),
    };

    sharedStub = {
      HttpError: class HttpError extends Error {
        constructor(message, status, errors) {
          super(message);
          this.statusCode = status;
          this.errors = errors;
        }
      },
      extractErrorsFromRequest: sinon.stub().returns(null),
    };

    controller = proxyquire("@controllers/learn.controller", {
      "@utils/learn.util": learnUtilStub,
      "@utils/shared": sharedStub,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getCatalog", () => {
    it("should return catalog with stages and courses on success", async () => {
      learnUtilStub.getCatalog.resolves({
        success: true,
        data: { catalog_version: "2025-01-01", stages: [], courses: [] },
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getCatalog(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.success).to.be.true;
      expect(jsonArgs).to.have.property("catalog_version");
      expect(jsonArgs).to.have.property("stages");
      expect(jsonArgs).to.have.property("courses");
    });

    it("should include max_points from the util result", async () => {
      learnUtilStub.getCatalog.resolves({
        success: true,
        data: {
          catalog_version: "2025-01-01",
          stages: [],
          max_points: 2400,
          courses: [],
        },
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getCatalog(req, res, next);

      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.max_points).to.equal(2400);
    });

    it("should call next when validation fails", async () => {
      sharedStub.extractErrorsFromRequest.returns({ field: "error" });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getCatalog(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it("should return failure response when util returns success=false", async () => {
      learnUtilStub.getCatalog.resolves({
        success: false,
        message: "no catalog available",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getCatalog(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.false;
    });
  });

  describe("getLesson", () => {
    it("should return lesson data on success", async () => {
      learnUtilStub.getLesson.resolves({
        success: true,
        data: { id: "l1", title: "Lesson 1", activities: [] },
        status: httpStatus.OK,
      });
      const req = makeReq({ params: { lesson_id: "l1" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.getLesson(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.lesson).to.exist;
      expect(jsonArgs.lesson.title).to.equal("Lesson 1");
    });

    it("should return 404 when lesson not found", async () => {
      learnUtilStub.getLesson.resolves({
        success: false,
        message: "lesson not found",
        status: httpStatus.NOT_FOUND,
      });
      const req = makeReq({ params: { lesson_id: "nonexistent" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.getLesson(req, res, next);

      expect(res.status.calledWith(httpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.false;
    });
  });

  describe("createAnonymousSession", () => {
    it("should return guest_id on success", async () => {
      learnUtilStub.createAnonymousSession.resolves({
        success: true,
        data: { guest_id: "guest_abc", display_name: "guest_abc", created_at: new Date() },
        status: httpStatus.CREATED,
      });
      const req = makeReq({ body: { device_id: "dev-001" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.createAnonymousSession(req, res, next);

      expect(res.status.calledWith(httpStatus.CREATED)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.guest_id).to.equal("guest_abc");
    });
  });

  describe("getProgress", () => {
    it("should return progress data spread into response on success", async () => {
      learnUtilStub.getProgress.resolves({
        success: true,
        data: {
          learner_type: "guest",
          total_points: 50,
          completed_lessons: 2,
          current_stage: { index: 0, name: "Curious" },
          lessons: {},
        },
        status: httpStatus.OK,
      });
      const req = makeReq({ headers: { "x-device-id": "dev-001" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.getProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.total_points).to.equal(50);
      expect(jsonArgs.learner_type).to.equal("guest");
    });
  });

  describe("updateLessonProgress", () => {
    it("should return lesson progress data on success", async () => {
      learnUtilStub.updateLessonProgress.resolves({
        success: true,
        data: {
          lesson_id: "l1",
          stars: 3,
          points_earned: 30,
          total_points: 30,
          current_stage: { index: 0, name: "Curious" },
          unlock: null,
        },
        status: httpStatus.OK,
      });
      const req = makeReq({
        params: { lesson_id: "l1" },
        headers: { "x-device-id": "dev-001" },
        body: { completed: true },
      });
      const res = makeRes();
      const next = sinon.spy();

      await controller.updateLessonProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.stars).to.equal(3);
    });
  });

  describe("syncProgress", () => {
    it("should return merged_count on success", async () => {
      learnUtilStub.syncProgress.resolves({
        success: true,
        data: { merged_count: 2, total_points: 40, current_stage: { index: 0, name: "Curious" } },
        status: httpStatus.OK,
      });
      const req = makeReq({
        body: { device_id: "dev-001", updates: [] },
        headers: { "x-device-id": "dev-001" },
      });
      const res = makeRes();
      const next = sinon.spy();

      await controller.syncProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.merged_count).to.equal(2);
    });
  });

  describe("linkGuestProgress", () => {
    it("should return user_id and merged data on success", async () => {
      learnUtilStub.linkGuestProgress.resolves({
        success: true,
        data: {
          user_id: "user-1",
          merged: { lessons_transferred: 3, points_transferred: 60 },
        },
        status: httpStatus.OK,
      });
      const req = makeReq({
        body: { device_id: "dev-001", guest_id: "guest_abc" },
        user: { id: "user-1" },
      });
      const res = makeRes();
      const next = sinon.spy();

      await controller.linkGuestProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.user_id).to.equal("user-1");
    });

    it("should return 401 when not authenticated", async () => {
      learnUtilStub.linkGuestProgress.resolves({
        success: false,
        message: "authentication required",
        status: httpStatus.UNAUTHORIZED,
      });
      const req = makeReq({ body: { device_id: "dev-001", guest_id: "guest_abc" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.linkGuestProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.UNAUTHORIZED)).to.be.true;
    });
  });

  describe("issueCertificate", () => {
    it("should return certificate data on success", async () => {
      learnUtilStub.issueCertificate.resolves({
        success: true,
        data: {
          certificate_id: "cert-1",
          learner_name: "Alice",
          verification_code: "AQ-2025-LEARN-AAAAAAAA",
          share_url: "https://airqo.net/learn/cert/AQ-2025-LEARN-AAAAAAAA",
          issued_at: new Date(),
        },
        status: httpStatus.CREATED,
      });
      const req = makeReq({
        body: { course_id: "c1", learner_name: "Alice" },
        user: { id: "user-1" },
      });
      const res = makeRes();
      const next = sinon.spy();

      await controller.issueCertificate(req, res, next);

      expect(res.status.calledWith(httpStatus.CREATED)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.certificate_id).to.equal("cert-1");
    });
  });

  describe("listCertificates", () => {
    it("should return certificates array on success", async () => {
      learnUtilStub.listCertificates.resolves({
        success: true,
        data: [{ certificate_id: "cert-1" }],
        status: httpStatus.OK,
      });
      const req = makeReq({ user: { id: "user-1" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.listCertificates(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.certificates).to.have.lengthOf(1);
    });
  });

  describe("verifyCertificate", () => {
    it("should return certificate verification data on success", async () => {
      learnUtilStub.verifyCertificate.resolves({
        success: true,
        data: {
          certificate_id: "cert-1",
          learner_name: "Alice",
          verification_code: "AQ-2025-LEARN-AAAAAAAA",
          valid: true,
          share_url: "https://airqo.net/learn/cert/AQ-2025-LEARN-AAAAAAAA",
          issued_at: new Date(),
        },
        status: httpStatus.OK,
      });
      const req = makeReq({ params: { verification_code: "AQ-2025-LEARN-AAAAAAAA" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.verifyCertificate(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.valid).to.be.true;
    });

    it("should return 404 for invalid verification code", async () => {
      learnUtilStub.verifyCertificate.resolves({
        success: false,
        message: "certificate not found",
        status: httpStatus.NOT_FOUND,
      });
      const req = makeReq({ params: { verification_code: "AQ-2025-LEARN-NOTFOUND" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.verifyCertificate(req, res, next);

      expect(res.status.calledWith(httpStatus.NOT_FOUND)).to.be.true;
    });
  });

  describe("getLeaderboard", () => {
    it("should return leaderboard entries on success", async () => {
      learnUtilStub.getLeaderboard.resolves({
        success: true,
        data: { scope: "global", entries: [], current_user_rank: 1 },
        status: httpStatus.OK,
      });
      const req = makeReq({ user: { id: "user-1" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.getLeaderboard(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.scope).to.equal("global");
      expect(jsonArgs).to.have.property("entries");
    });
  });

  describe("getCourseProgress", () => {
    it("should return courses array on success", async () => {
      learnUtilStub.getCourseProgress.resolves({
        success: true,
        data: [{ course_id: "c1", is_complete: false }],
        status: httpStatus.OK,
      });
      const req = makeReq({ headers: { "x-device-id": "dev-001" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.getCourseProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.courses).to.have.lengthOf(1);
    });
  });

  describe("createCourse", () => {
    it("should return course data with 201 on success", async () => {
      learnUtilStub.createCourse.resolves({
        success: true,
        data: { course_number: 1, title: "Intro" },
        status: httpStatus.CREATED,
      });
      const req = makeReq({ body: { course_number: 1, title: "Intro", plain_title_key: "intro" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.createCourse(req, res, next);

      expect(res.status.calledWith(httpStatus.CREATED)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.course).to.exist;
    });
  });

  describe("addUnit", () => {
    it("should return unit data with 201 on success", async () => {
      learnUtilStub.addUnit.resolves({
        success: true,
        data: { title: "Unit 1", unit_order: 1 },
        status: httpStatus.CREATED,
      });
      const req = makeReq({
        params: { course_id: "c1" },
        body: { title: "Unit 1", plain_title_key: "unit_1", unit_order: 1 },
      });
      const res = makeRes();
      const next = sinon.spy();

      await controller.addUnit(req, res, next);

      expect(res.status.calledWith(httpStatus.CREATED)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.unit).to.exist;
    });
  });

  describe("deleteCourse", () => {
    it("should return success message on deletion", async () => {
      learnUtilStub.deleteCourse.resolves({
        success: true,
        message: "course deleted successfully",
        status: httpStatus.OK,
      });
      const req = makeReq({ params: { course_id: "c1" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.deleteCourse(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.message).to.equal("course deleted successfully");
    });

    it("should return 409 when attempting to delete a published course", async () => {
      learnUtilStub.deleteCourse.resolves({
        success: false,
        message: "cannot delete a published course — unpublish it first",
        status: httpStatus.CONFLICT,
      });
      const req = makeReq({ params: { course_id: "c1" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.deleteCourse(req, res, next);

      expect(res.status.calledWith(httpStatus.CONFLICT)).to.be.true;
    });
  });

  describe("updateCourse", () => {
    it("should return updated course on success", async () => {
      learnUtilStub.updateCourse.resolves({
        success: true,
        data: { title: "Updated Title", published: true },
        status: httpStatus.OK,
      });
      const req = makeReq({
        params: { course_id: "c1" },
        body: { title: "Updated Title" },
      });
      const res = makeRes();
      const next = sinon.spy();

      await controller.updateCourse(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.course).to.have.property("title", "Updated Title");
    });
  });

  describe("deleteGuestProgress", () => {
    it("should return counts on success", async () => {
      learnUtilStub.deleteGuestProgress.resolves({
        success: true,
        data: { guest_id: "guest_1", deleted_progress: 1, deleted_guest_sessions: 1 },
        message: "guest leaderboard entry deleted successfully",
        status: httpStatus.OK,
      });
      const req = makeReq({ params: { guest_id: "guest_1" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.deleteGuestProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.deleted_progress).to.equal(1);
    });

    it("should return 404 when nothing matched", async () => {
      learnUtilStub.deleteGuestProgress.resolves({
        success: false,
        message: "no guest progress or session found for this guest_id",
        status: httpStatus.NOT_FOUND,
      });
      const req = makeReq({ params: { guest_id: "guest_missing" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.deleteGuestProgress(req, res, next);

      expect(res.status.calledWith(httpStatus.NOT_FOUND)).to.be.true;
    });
  });

  describe("clearLeaderboard", () => {
    it("should return dry-run counts when confirm is not set", async () => {
      learnUtilStub.clearLeaderboard.resolves({
        success: true,
        data: { dry_run: true, would_delete_progress: 5, would_delete_guest_sessions: 3 },
        message: "dry run only -- pass confirm=true to actually delete this data",
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.clearLeaderboard(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.dry_run).to.be.true;
      expect(jsonArgs.would_delete_progress).to.equal(5);
    });

    it("should return deleted counts when confirm=true", async () => {
      learnUtilStub.clearLeaderboard.resolves({
        success: true,
        data: { deleted_progress: 5, deleted_guest_sessions: 3 },
        message: "leaderboard data cleared successfully",
        status: httpStatus.OK,
      });
      const req = makeReq({ query: { tenant: "airqo", confirm: "true" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.clearLeaderboard(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.deleted_progress).to.equal(5);
    });
  });
});
