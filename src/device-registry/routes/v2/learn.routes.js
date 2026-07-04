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
// Option 3 — Account linking, Certificates & Leaderboard (JWT enforced at nginx gateway)
// ---------------------------------------------------------------------------

router.post("/progress/link", learnValidations.linkGuestProgress, learnController.linkGuestProgress);
router.get("/progress/courses", learnValidations.getCourseProgress, learnController.getCourseProgress);

router.post("/certificates/named", learnValidations.issueCertificate, learnController.issueCertificate);
router.get("/certificates", learnValidations.listCertificates, learnController.listCertificates);
router.get("/certificates/verify/:verification_code", learnValidations.verifyCertificate, learnController.verifyCertificate);

router.get("/leaderboard", learnValidations.getLeaderboard, learnController.getLeaderboard);

// ---------------------------------------------------------------------------
// Admin — Course Authoring (admin JWT enforced at nginx gateway)
// ---------------------------------------------------------------------------

router.get("/admin/courses", learnValidations.listCourses, learnController.listCourses);
router.post("/admin/courses", learnValidations.createCourse, learnController.createCourse);
router.get("/admin/courses/:course_id", learnValidations.getCourse, learnController.getCourse);
router.patch("/admin/courses/:course_id", learnValidations.updateCourse, learnController.updateCourse);
router.delete("/admin/courses/:course_id", learnValidations.deleteCourse, learnController.deleteCourse);

router.post("/admin/courses/:course_id/units", learnValidations.addUnit, learnController.addUnit);
router.patch("/admin/units/:unit_id", learnValidations.updateUnit, learnController.updateUnit);
router.delete("/admin/units/:unit_id", learnValidations.deleteUnit, learnController.deleteUnit);

router.post("/admin/units/:unit_id/lessons", learnValidations.addLesson, learnController.addLesson);
router.patch("/admin/lessons/:lesson_id", learnValidations.updateLesson, learnController.updateLesson);
router.delete("/admin/lessons/:lesson_id", learnValidations.deleteLesson, learnController.deleteLesson);

router.post("/admin/lessons/:lesson_id/activities", learnValidations.addActivity, learnController.addActivity);
router.patch("/admin/activities/:activity_id", learnValidations.updateActivity, learnController.updateActivity);
router.delete("/admin/activities/:activity_id", learnValidations.deleteActivity, learnController.deleteActivity);

module.exports = router;
