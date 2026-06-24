// learn.routes.js
// Mounted at /api/v2/devices/learn
const express = require("express");
const router = express.Router();
const learnController = require("@controllers/learn.controller");
const learnValidations = require("@validators/learn.validators");
const { headers } = require("@validators/common");

router.use(headers);

// ---------------------------------------------------------------------------
// Option 1 — Content (no auth required)
// ---------------------------------------------------------------------------

router.get("/catalog", learnValidations.getCatalog, learnController.getCatalog);
router.get("/lessons/:lesson_id", learnValidations.getLesson, learnController.getLesson);

// ---------------------------------------------------------------------------
// Option 2 — Guest Progress (guest headers or JWT)
// ---------------------------------------------------------------------------

router.post("/sessions/anonymous", learnValidations.createAnonymousSession, learnController.createAnonymousSession);
router.get("/progress", learnValidations.getProgress, learnController.getProgress);
router.put("/progress/lessons/:lesson_id", learnValidations.updateLessonProgress, learnController.updateLessonProgress);
router.post("/progress/sync", learnValidations.syncProgress, learnController.syncProgress);

// ---------------------------------------------------------------------------
// Option 3 — Account linking (JWT enforced at nginx gateway)
// ---------------------------------------------------------------------------

router.post("/progress/link", learnValidations.linkGuestProgress, learnController.linkGuestProgress);

// ---------------------------------------------------------------------------
// Admin — Course Authoring (admin JWT enforced at nginx gateway)
// ---------------------------------------------------------------------------

router.post("/admin/courses", learnValidations.createCourse, learnController.createCourse);
router.post("/admin/courses/:course_id/units", learnValidations.addUnit, learnController.addUnit);
router.post("/admin/units/:unit_id/lessons", learnValidations.addLesson, learnController.addLesson);
router.post("/admin/lessons/:lesson_id/activities", learnValidations.addActivity, learnController.addActivity);
router.patch("/admin/courses/:course_id", learnValidations.updateCourse, learnController.updateCourse);

module.exports = router;
