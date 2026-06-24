// learn.routes.js
// publicRouter  → mounted at /api/v2/learn
// adminRouter   → mounted at /api/v2/admin/learn
const express = require("express");
const learnController = require("@controllers/learn.controller");
const learnValidations = require("@validators/learn.validators");
const { headers } = require("@validators/common");

// ---------------------------------------------------------------------------
// Public / guest router — /api/v2/learn/*
// ---------------------------------------------------------------------------
const publicRouter = express.Router();
publicRouter.use(headers);

// Option 1 — Content (no auth required)
publicRouter.get("/catalog", learnValidations.getCatalog, learnController.getCatalog);
publicRouter.get("/lessons/:lesson_id", learnValidations.getLesson, learnController.getLesson);

// Option 2 — Guest Progress
publicRouter.post("/sessions/anonymous", learnValidations.createAnonymousSession, learnController.createAnonymousSession);
publicRouter.get("/progress", learnValidations.getProgress, learnController.getProgress);
publicRouter.put("/progress/lessons/:lesson_id", learnValidations.updateLessonProgress, learnController.updateLessonProgress);
publicRouter.post("/progress/sync", learnValidations.syncProgress, learnController.syncProgress);

// Option 3 — Account linking (JWT enforced at nginx gateway)
publicRouter.post("/progress/link", learnValidations.linkGuestProgress, learnController.linkGuestProgress);

// ---------------------------------------------------------------------------
// Admin router — /api/v2/admin/learn/*
// Auth (admin JWT with learn:write scope) enforced at nginx gateway
// ---------------------------------------------------------------------------
const adminRouter = express.Router();
adminRouter.use(headers);

// Step 1 — Create course shell
adminRouter.post("/courses", learnValidations.createCourse, learnController.createCourse);

// Step 2 — Add unit to course
adminRouter.post("/courses/:course_id/units", learnValidations.addUnit, learnController.addUnit);

// Step 3 — Add lesson to unit
adminRouter.post("/units/:unit_id/lessons", learnValidations.addLesson, learnController.addLesson);

// Step 4 — Add activity to lesson
adminRouter.post("/lessons/:lesson_id/activities", learnValidations.addActivity, learnController.addActivity);

// Step 5 — Publish / update course metadata
adminRouter.patch("/courses/:course_id", learnValidations.updateCourse, learnController.updateCourse);

module.exports = { publicRouter, adminRouter };
