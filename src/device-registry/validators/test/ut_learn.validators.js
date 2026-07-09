require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const mockRequest = (query = {}, body = {}, params = {}) => ({
  query,
  body,
  params,
  headers: {},
  get: function(header) {
    return this.headers[header];
  },
});

const runMiddlewareChain = (chain, req) =>
  new Promise((resolve) => {
    let idx = 0;
    const res = {};
    const runNext = (err) => {
      if (err || idx >= chain.length) return resolve(err);
      const mw = chain[idx++];
      Promise.resolve(mw(req, res, runNext)).catch(runNext);
    };
    runNext();
  });

describe("learnValidations", () => {
  let validations;

  before(() => {
    validations = require("@validators/learn.validators");
  });

  afterEach(() => {
    sinon.restore();
  });

  // ---------------------------------------------------------------------------
  // getCatalog
  // ---------------------------------------------------------------------------

  describe("getCatalog", () => {
    it("should pass with no query params", async () => {
      const req = mockRequest({});
      await runMiddlewareChain(validations.getCatalog, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should pass with valid tenant", async () => {
      const req = mockRequest({ tenant: "airqo" });
      await runMiddlewareChain(validations.getCatalog, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail with invalid tenant", async () => {
      const req = mockRequest({ tenant: "invalid_xyz" });
      await runMiddlewareChain(validations.getCatalog, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // getLesson
  // ---------------------------------------------------------------------------

  describe("getLesson", () => {
    it("should pass with a valid MongoDB ObjectId as lesson_id", async () => {
      const req = mockRequest({}, {}, { lesson_id: new mongoose.Types.ObjectId().toString() });
      await runMiddlewareChain(validations.getLesson, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when lesson_id is not a valid ObjectId", async () => {
      const req = mockRequest({}, {}, { lesson_id: "not-an-objectid" });
      await runMiddlewareChain(validations.getLesson, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when lesson_id is missing", async () => {
      const req = mockRequest({}, {}, {});
      await runMiddlewareChain(validations.getLesson, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // createAnonymousSession
  // ---------------------------------------------------------------------------

  describe("createAnonymousSession", () => {
    const validBody = {
      device_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    it("should pass with a valid UUID device_id", async () => {
      const req = mockRequest({}, validBody);
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when device_id is missing", async () => {
      const req = mockRequest({}, {});
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when device_id is not a valid UUID", async () => {
      const req = mockRequest({}, { device_id: "not-a-uuid" });
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when platform is not android or ios", async () => {
      const req = mockRequest({}, { ...validBody, platform: "windows" });
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass when platform is android", async () => {
      const req = mockRequest({}, { ...validBody, platform: "android" });
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should pass when platform is omitted (optional)", async () => {
      const req = mockRequest({}, validBody);
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should pass with a valid username and event_id", async () => {
      const req = mockRequest(
        {},
        { ...validBody, username: "Thabo M.", event_id: "pretoria-2026" }
      );
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when username is shorter than 3 characters", async () => {
      const req = mockRequest({}, { ...validBody, username: "Th" });
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when username contains disallowed characters", async () => {
      const req = mockRequest({}, { ...validBody, username: "Thabo<script>" });
      await runMiddlewareChain(validations.createAnonymousSession, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // updateLessonProgress
  // ---------------------------------------------------------------------------

  describe("updateLessonProgress", () => {
    it("should pass with valid lesson_id ObjectId", async () => {
      const req = mockRequest(
        {},
        {},
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.updateLessonProgress, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail with invalid lesson_id", async () => {
      const req = mockRequest({}, {}, { lesson_id: "bad-id" });
      await runMiddlewareChain(validations.updateLessonProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when furthest_activity_index is negative", async () => {
      const req = mockRequest(
        {},
        { furthest_activity_index: -1 },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.updateLessonProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when completed is not a boolean", async () => {
      const req = mockRequest(
        {},
        { completed: "yes" },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.updateLessonProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when quiz_attempts is not an array", async () => {
      const req = mockRequest(
        {},
        { quiz_attempts: "not-array" },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.updateLessonProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid quiz_attempts array", async () => {
      const req = mockRequest(
        {},
        {
          completed: true,
          quiz_attempts: [
            { activity_id: "a1", format: "single_choice", is_correct: true },
          ],
        },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.updateLessonProgress, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // syncProgress
  // ---------------------------------------------------------------------------

  describe("syncProgress", () => {
    it("should fail when device_id is missing", async () => {
      const req = mockRequest({}, { updates: [{ lesson_id: "l1" }] });
      await runMiddlewareChain(validations.syncProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when updates array is empty", async () => {
      const req = mockRequest(
        {},
        { device_id: "550e8400-e29b-41d4-a716-446655440000", updates: [] }
      );
      await runMiddlewareChain(validations.syncProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid device_id and non-empty updates", async () => {
      const req = mockRequest(
        {},
        {
          device_id: "550e8400-e29b-41d4-a716-446655440000",
          updates: [{ lesson_id: "l1", completed: true }],
        }
      );
      await runMiddlewareChain(validations.syncProgress, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // linkGuestProgress
  // ---------------------------------------------------------------------------

  describe("linkGuestProgress", () => {
    it("should fail when device_id is missing", async () => {
      const req = mockRequest({}, { guest_id: "guest_abc" });
      await runMiddlewareChain(validations.linkGuestProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when guest_id is missing", async () => {
      const req = mockRequest(
        {},
        { device_id: "550e8400-e29b-41d4-a716-446655440000" }
      );
      await runMiddlewareChain(validations.linkGuestProgress, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid device_id UUID and guest_id", async () => {
      const req = mockRequest(
        {},
        {
          device_id: "550e8400-e29b-41d4-a716-446655440000",
          guest_id: "guest_abc",
        }
      );
      await runMiddlewareChain(validations.linkGuestProgress, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // issueCertificate
  // ---------------------------------------------------------------------------

  describe("issueCertificate", () => {
    it("should fail when course_id is missing", async () => {
      const req = mockRequest({}, { learner_name: "Alice" });
      await runMiddlewareChain(validations.issueCertificate, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when course_id is not a valid ObjectId", async () => {
      const req = mockRequest({}, { course_id: "bad-id" });
      await runMiddlewareChain(validations.issueCertificate, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid course_id and optional learner_name", async () => {
      const req = mockRequest(
        {},
        {
          course_id: new mongoose.Types.ObjectId().toString(),
          learner_name: "Alice",
        }
      );
      await runMiddlewareChain(validations.issueCertificate, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when learner_name exceeds 100 characters", async () => {
      const req = mockRequest(
        {},
        {
          course_id: new mongoose.Types.ObjectId().toString(),
          learner_name: "A".repeat(101),
        }
      );
      await runMiddlewareChain(validations.issueCertificate, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // verifyCertificate
  // ---------------------------------------------------------------------------

  describe("verifyCertificate", () => {
    it("should pass with a valid verification_code format", async () => {
      const req = mockRequest({}, {}, { verification_code: "AQ-2025-LEARN-ABCD1234" });
      await runMiddlewareChain(validations.verifyCertificate, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail with an invalid verification_code format", async () => {
      const req = mockRequest({}, {}, { verification_code: "INVALID-CODE" });
      await runMiddlewareChain(validations.verifyCertificate, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when verification_code is missing", async () => {
      const req = mockRequest({}, {}, {});
      await runMiddlewareChain(validations.verifyCertificate, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // getLeaderboard
  // ---------------------------------------------------------------------------

  describe("getLeaderboard", () => {
    it("should pass when limit is within valid range", async () => {
      const req = mockRequest({ limit: "20" });
      await runMiddlewareChain(validations.getLeaderboard, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when limit is out of range (> 100)", async () => {
      const req = mockRequest({ limit: "200" });
      await runMiddlewareChain(validations.getLeaderboard, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when limit is less than 1", async () => {
      const req = mockRequest({ limit: "0" });
      await runMiddlewareChain(validations.getLeaderboard, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass when a valid event_id is provided", async () => {
      const req = mockRequest({ event_id: "pretoria-2026" });
      await runMiddlewareChain(validations.getLeaderboard, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // createCourse
  // ---------------------------------------------------------------------------

  describe("createCourse", () => {
    const validBody = {
      course_number: 1,
      title: "Intro to AQ",
      plain_title_key: "intro_to_aq",
    };

    it("should pass with required fields", async () => {
      const req = mockRequest({}, validBody);
      await runMiddlewareChain(validations.createCourse, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when course_number is missing", async () => {
      const { course_number, ...body } = validBody;
      const req = mockRequest({}, body);
      await runMiddlewareChain(validations.createCourse, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when course_number is less than 1", async () => {
      const req = mockRequest({}, { ...validBody, course_number: 0 });
      await runMiddlewareChain(validations.createCourse, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when title exceeds 120 characters", async () => {
      const req = mockRequest({}, { ...validBody, title: "T".repeat(121) });
      await runMiddlewareChain(validations.createCourse, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when cover_image_url is not HTTPS", async () => {
      const req = mockRequest(
        {},
        { ...validBody, cover_image_url: "http://insecure.com/img.png" }
      );
      await runMiddlewareChain(validations.createCourse, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass when cover_image_url is a valid HTTPS URL", async () => {
      const req = mockRequest(
        {},
        { ...validBody, cover_image_url: "https://example.com/img.png" }
      );
      await runMiddlewareChain(validations.createCourse, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // addUnit
  // ---------------------------------------------------------------------------

  describe("addUnit", () => {
    it("should fail when course_id param is not a valid ObjectId", async () => {
      const req = mockRequest(
        {},
        { title: "Unit 1", plain_title_key: "unit_1", unit_order: 1 },
        { course_id: "bad-id" }
      );
      await runMiddlewareChain(validations.addUnit, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid ObjectId and required body fields", async () => {
      const req = mockRequest(
        {},
        { title: "Unit 1", plain_title_key: "unit_1", unit_order: 1 },
        { course_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addUnit, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when unit_order is less than 1", async () => {
      const req = mockRequest(
        {},
        { title: "Unit 1", plain_title_key: "unit_1", unit_order: 0 },
        { course_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addUnit, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // addLesson
  // ---------------------------------------------------------------------------

  describe("addLesson", () => {
    it("should fail when unit_id is not a valid ObjectId", async () => {
      const req = mockRequest(
        {},
        { title: "Lesson 1", plain_title_key: "lesson_1", lesson_order: 1 },
        { unit_id: "bad-id" }
      );
      await runMiddlewareChain(validations.addLesson, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid unit_id and required fields", async () => {
      const req = mockRequest(
        {},
        { title: "Lesson 1", plain_title_key: "lesson_1", lesson_order: 1 },
        { unit_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addLesson, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when cover_image_url uses http instead of https", async () => {
      const req = mockRequest(
        {},
        {
          title: "Lesson 1",
          plain_title_key: "lesson_1",
          lesson_order: 1,
          cover_image_url: "http://insecure.com/img.png",
        },
        { unit_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addLesson, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // addActivity
  // ---------------------------------------------------------------------------

  describe("addActivity", () => {
    it("should fail when type is not in [article, video, image, quiz]", async () => {
      const req = mockRequest(
        {},
        { type: "audio", order: 1, payload: {} },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addActivity, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when order is less than 1", async () => {
      const req = mockRequest(
        {},
        { type: "article", order: 0, payload: {} },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addActivity, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when payload is not an object", async () => {
      const req = mockRequest(
        {},
        { type: "article", order: 1, payload: "not-an-object" },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addActivity, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid activity fields", async () => {
      const req = mockRequest(
        {},
        { type: "article", order: 1, payload: { body: "content" } },
        { lesson_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.addActivity, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // updateCourse
  // ---------------------------------------------------------------------------

  describe("updateCourse", () => {
    it("should fail when course_id param is not a valid ObjectId", async () => {
      const req = mockRequest({}, { title: "New Title" }, { course_id: "bad-id" });
      await runMiddlewareChain(validations.updateCourse, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid course_id and optional body fields", async () => {
      const req = mockRequest(
        {},
        { title: "New Title" },
        { course_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.updateCourse, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when published is not a boolean", async () => {
      const req = mockRequest(
        {},
        { published: "yes" },
        { course_id: new mongoose.Types.ObjectId().toString() }
      );
      await runMiddlewareChain(validations.updateCourse, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });
});
