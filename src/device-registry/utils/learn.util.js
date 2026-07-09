const crypto = require("crypto");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const LearnCourseModel = require("@models/LearnCourse");
const LearnUnitModel = require("@models/LearnUnit");
const LearnLessonModel = require("@models/LearnLesson");
const LearnActivityModel = require("@models/LearnActivity");
const LearnGuestSessionModel = require("@models/LearnGuestSession");
const LearnProgressModel = require("@models/LearnProgress");
const LearnCertificateModel = require("@models/LearnCertificate");
const constants = require("@config/constants");
const { logObject, HttpError } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- learn-util`);
const isEmpty = require("is-empty");
const {
  STAGES,
  computeStage,
  POINTS_PER_QUESTION,
  DEFAULT_MAX_LEARN_POINTS,
} = require("@utils/learn-progress.constants");

const AVATAR_BACKGROUND_COLORS = [
  "#F97316", "#10B981", "#3B82F6", "#EF4444",
  "#8B5CF6", "#EC4899", "#EAB308", "#14B8A6",
];
const AVATAR_FALLBACK_ICONS = LearnGuestSessionModel.AVATAR_ICONS || ["🙂"];

// Builds a self-contained, deterministic avatar image (a data URI, no
// external service or upload step) from a stable seed (guest_id/user_id) so
// every leaderboard entry has an image without requiring a photo upload.
function buildAvatarImageUrl({ seed, icon }) {
  const hash = crypto.createHash("sha256").update(String(seed || "")).digest();
  const background = AVATAR_BACKGROUND_COLORS[hash[0] % AVATAR_BACKGROUND_COLORS.length];
  const resolvedIcon = icon || AVATAR_FALLBACK_ICONS[hash[1] % AVATAR_FALLBACK_ICONS.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
    `<rect width="128" height="128" rx="64" fill="${background}"/>` +
    `<text x="50%" y="54%" font-size="64" text-anchor="middle" dominant-baseline="middle">${resolvedIcon}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Lesson ids belonging to published courses only — draft/unpublished course
// content is invisible to learners and must not count toward max_points.
async function getPublishedLessonIds(tenant, next) {
  const coursesRes = await LearnCourseModel(tenant).list(
    { filter: { published: true }, limit: 0 },
    next
  );
  const courseIds = (coursesRes?.data || []).map((c) => c._id);
  if (courseIds.length === 0) return [];

  const unitsRes = await LearnUnitModel(tenant).list(
    { filter: { course_id: { $in: courseIds } }, limit: 0 },
    next
  );
  const unitIds = (unitsRes?.data || []).map((u) => u._id);
  if (unitIds.length === 0) return [];

  const lessonsRes = await LearnLessonModel(tenant).list(
    { filter: { unit_id: { $in: unitIds } }, limit: 0 },
    next
  );
  return (lessonsRes?.data || []).map((l) => l._id);
}

// The true "max points" for the Learn stage/level calculation is derived from
// the live, published catalog (one gradable quiz question =
// POINTS_PER_QUESTION), not a hardcoded number — otherwise adding/removing
// lessons via Course Management silently desyncs the stage shown from the
// points actually earned.
async function getMaxLearnPoints(tenant, next) {
  try {
    const lessonIds = await getPublishedLessonIds(tenant, next);
    if (lessonIds.length === 0) return DEFAULT_MAX_LEARN_POINTS;

    const activitiesRes = await LearnActivityModel(tenant).list(
      { filter: { type: "quiz", lesson_id: { $in: lessonIds } }, limit: 0 },
      next
    );
    const gradableCount = (activitiesRes?.data || []).filter(
      (a) => a.payload?.format && a.payload.format !== "free_text"
    ).length;
    return gradableCount > 0
      ? gradableCount * POINTS_PER_QUESTION
      : DEFAULT_MAX_LEARN_POINTS;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- getMaxLearnPoints: ${error.message}`);
    return DEFAULT_MAX_LEARN_POINTS;
  }
}

// Checks one submitted quiz attempt against the correct-answer fields stored on
// the activity's own payload (as authored in Course Management), rather than
// trusting whatever `is_correct` a client sends.
function isAttemptCorrect(attempt, quizPayload = {}) {
  switch (attempt.format) {
    case "single_choice":
      return (
        typeof quizPayload.correct_index === "number" &&
        attempt.selected_index === quizPayload.correct_index
      );
    case "multi_choice": {
      const expected = Array.isArray(quizPayload.correct_indices)
        ? [...quizPayload.correct_indices].sort((a, b) => a - b)
        : [];
      const selected = Array.isArray(attempt.selected_indices)
        ? [...attempt.selected_indices].sort((a, b) => a - b)
        : [];
      return (
        expected.length > 0 &&
        expected.length === selected.length &&
        expected.every((v, i) => v === selected[i])
      );
    }
    case "ranking": {
      const expected = Array.isArray(quizPayload.correct_order)
        ? quizPayload.correct_order
        : [];
      const selected = Array.isArray(attempt.selected_order)
        ? attempt.selected_order
        : [];
      return (
        expected.length > 0 &&
        expected.length === selected.length &&
        expected.every((v, i) => v === selected[i])
      );
    }
    default:
      return false;
  }
}

// A quiz attempt only carries a real answer (`selected_index` /
// `selected_indices` / `selected_order`) once the calling client has been
// updated to submit it — until then we fall back to trusting the client's
// own `is_correct` so existing app versions keep working unchanged.
function attemptHasSubmittedAnswer(attempt) {
  return (
    attempt.selected_index !== undefined ||
    attempt.selected_indices !== undefined ||
    attempt.selected_order !== undefined
  );
}

// Re-grades quiz_attempts server-side wherever a real answer was submitted,
// looking up each attempt's activity by its actual LearnActivity _id.
async function gradeQuizAttempts(tenant, quizAttempts, next) {
  if (!Array.isArray(quizAttempts) || quizAttempts.length === 0) {
    return quizAttempts;
  }

  const gradableAttempts = quizAttempts.filter(
    (a) =>
      a.format !== "free_text" &&
      attemptHasSubmittedAnswer(a) &&
      mongoose.Types.ObjectId.isValid(a.activity_id)
  );
  if (gradableAttempts.length === 0) return quizAttempts;

  const activitiesRes = await LearnActivityModel(tenant).list(
    { filter: { _id: { $in: gradableAttempts.map((a) => a.activity_id) } } },
    next
  );
  const activitiesById = new Map(
    (activitiesRes?.data || []).map((a) => [a._id.toString(), a])
  );

  return quizAttempts.map((attempt) => {
    if (!attemptHasSubmittedAnswer(attempt) || attempt.format === "free_text") {
      return attempt;
    }
    const activity = activitiesById.get(String(attempt.activity_id));
    if (activity?.type !== "quiz") {
      // Can't verify this one server-side (missing/invalid activity_id, or it
      // doesn't resolve to a real quiz activity) — fall back to trusting the
      // client rather than failing the attempt closed.
      return attempt;
    }
    return { ...attempt, is_correct: isAttemptCorrect(attempt, activity.payload) };
  });
}

// Beyond requiring `format`, a quiz payload must carry a correct-answer field
// matching that format — otherwise the question can never be graded
// server-side (see gradeQuizAttempts above), and Course Management would
// silently ship an unscorable question. Returns null when valid, or
// { field, message } describing the first problem found.
function validateQuizCorrectAnswer(payload) {
  const { format, options, correct_index, correct_indices, correct_order } =
    payload || {};

  const allowedFormats = ["single_choice", "multi_choice", "ranking", "free_text"];
  if (!allowedFormats.includes(format)) {
    return {
      field: "payload.format",
      message: `format must be one of: ${allowedFormats.join(", ")}`,
    };
  }
  if (format === "free_text") return null;

  if (!Array.isArray(options) || options.length < 2) {
    return {
      field: "payload.options",
      message: "options must be an array with at least 2 items",
    };
  }

  if (format === "single_choice") {
    if (
      !Number.isInteger(correct_index) ||
      correct_index < 0 ||
      correct_index >= options.length
    ) {
      return {
        field: "payload.correct_index",
        message: "correct_index must be a valid index into payload.options",
      };
    }
  } else if (format === "multi_choice") {
    if (!Array.isArray(correct_indices) || correct_indices.length === 0) {
      return {
        field: "payload.correct_indices",
        message:
          "correct_indices must be a non-empty array of option indices",
      };
    }
    const unique = new Set(correct_indices);
    const allValid = correct_indices.every(
      (i) => Number.isInteger(i) && i >= 0 && i < options.length
    );
    if (unique.size !== correct_indices.length || !allValid) {
      return {
        field: "payload.correct_indices",
        message: "correct_indices must contain unique, valid option indices",
      };
    }
  } else if (format === "ranking") {
    if (!Array.isArray(correct_order) || correct_order.length !== options.length) {
      return {
        field: "payload.correct_order",
        message: "correct_order must list every option index exactly once",
      };
    }
    const sorted = [...correct_order].sort((a, b) => a - b);
    const expected = options.map((_, i) => i);
    if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
      return {
        field: "payload.correct_order",
        message: "correct_order must be a permutation of payload.options indices",
      };
    }
  }
  return null;
}

function generateVerificationCode() {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[crypto.randomInt(chars.length)];
  }
  return `AQ-${year}-LEARN-${suffix}`;
}

function getTenant(request) {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  return isEmpty(request.query?.tenant) ? defaultTenant : request.query.tenant;
}

// ---------------------------------------------------------------------------
// Catalog helpers
// ---------------------------------------------------------------------------

async function buildCatalog(tenant, next) {
  const [coursesRes, unitsRes, lessonsRes, activitiesRes] = await Promise.all([
    LearnCourseModel(tenant).list({ filter: { published: true } }, next),
    LearnUnitModel(tenant).list({}, next),
    LearnLessonModel(tenant).list({}, next),
    LearnActivityModel(tenant).list({}, next),
  ]);

  if (!coursesRes?.success) return coursesRes;

  const courses = coursesRes.data || [];
  const units = unitsRes?.data || [];
  const lessons = lessonsRes?.data || [];
  const activities = activitiesRes?.data || [];

  // Index for quick lookup
  const unitsByCourse = {};
  units.forEach((u) => {
    const cid = u.course_id.toString();
    if (!unitsByCourse[cid]) unitsByCourse[cid] = [];
    unitsByCourse[cid].push(u);
  });

  const lessonsByUnit = {};
  lessons.forEach((l) => {
    const uid = l.unit_id.toString();
    if (!lessonsByUnit[uid]) lessonsByUnit[uid] = [];
    lessonsByUnit[uid].push(l);
  });

  const activitiesByLesson = {};
  activities.forEach((a) => {
    const lid = a.lesson_id.toString();
    if (!activitiesByLesson[lid]) activitiesByLesson[lid] = [];
    activitiesByLesson[lid].push(a);
  });

  const catalog = courses.map((course) => {
    const courseUnits = (unitsByCourse[course._id.toString()] || []).sort(
      (a, b) => a.unit_order - b.unit_order
    );
    return {
      id: course._id,
      course_number: course.course_number,
      title: course.title,
      plain_title_key: course.plain_title_key,
      cover_image_url: course.cover_image_url,
      units: courseUnits.map((unit) => {
        const unitLessons = (lessonsByUnit[unit._id.toString()] || []).sort(
          (a, b) => a.lesson_order - b.lesson_order
        );
        return {
          id: unit._id,
          title: unit.title,
          lessons: unitLessons.map((lesson) => {
            const lessonActivities = (
              activitiesByLesson[lesson._id.toString()] || []
            ).sort((a, b) => a.order - b.order);
            return {
              id: lesson._id,
              title: lesson.title,
              cover_image_url: lesson.cover_image_url || undefined,
              completion_message: lesson.completion_message || undefined,
              activities: lessonActivities.map((act) => ({
                id: act._id,
                type: act.type,
                order: act.order,
                payload: act.payload,
              })),
            };
          }),
        };
      }),
    };
  });

  return { success: true, data: catalog, status: httpStatus.OK };
}

// ---------------------------------------------------------------------------
// Option 1 — Content APIs
// ---------------------------------------------------------------------------

const learn = {
  getCatalog: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const result = await buildCatalog(tenant, next);
      if (!result?.success) return result;

      const maxPoints = await getMaxLearnPoints(tenant, next);

      const latestCourse = await LearnCourseModel(tenant)
        .findOne({ published: true })
        .sort({ updatedAt: -1 })
        .lean();
      const catalogVersion =
        latestCourse?.catalog_version ||
        (latestCourse?.updatedAt
          ? latestCourse.updatedAt.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10));

      return {
        success: true,
        data: {
          catalog_version: catalogVersion,
          stages: STAGES,
          max_points: maxPoints,
          courses: result.data,
        },
        message: "successfully retrieved learn catalog",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  getLesson: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { lesson_id } = request.params;

      const [lessonRes, activitiesRes] = await Promise.all([
        LearnLessonModel(tenant).list(
          { filter: { _id: lesson_id } },
          next
        ),
        LearnActivityModel(tenant).list(
          { filter: { lesson_id } },
          next
        ),
      ]);

      if (!lessonRes?.success || !lessonRes.data?.length) {
        return {
          success: false,
          message: "lesson not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      const lesson = lessonRes.data[0];
      const activities = (activitiesRes?.data || []).sort(
        (a, b) => a.order - b.order
      );

      return {
        success: true,
        data: {
          id: lesson._id,
          title: lesson.title,
          cover_image_url: lesson.cover_image_url || undefined,
          completion_message: lesson.completion_message || undefined,
          activities: activities.map((a) => ({
            id: a._id,
            type: a.type,
            order: a.order,
            payload: a.payload,
          })),
        },
        message: "successfully retrieved lesson",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Option 2 — Guest Progress APIs
  // ---------------------------------------------------------------------------

  createAnonymousSession: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { device_id, app_version, platform, username, event_id } = request.body;

      const result = await LearnGuestSessionModel(tenant).findOrCreate(
        { device_id, app_version, platform, username, event_id },
        next
      );
      if (!result?.success) return result;

      const session = result.data;
      return {
        success: true,
        data: {
          guest_id: session.guest_id,
          display_name: session.username || session.display_name,
          avatar_icon: session.avatar_icon,
          avatar_image_url: buildAvatarImageUrl({
            seed: session.guest_id,
            icon: session.avatar_icon,
          }),
          username: session.username || null,
          event_id: session.event_id || null,
          created_at: session.createdAt,
        },
        message: result.message,
        status: result.status,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  getProgress: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const device_id = request.headers["x-device-id"];
      const guest_id = request.headers["x-guest-id"] || null;
      const user_id = request.user?.id || null;

      if (!user_id && !device_id) {
        return {
          success: false,
          message: "X-Device-Id header is required for guest progress",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const result = await LearnProgressModel(tenant).findProgress(
        { device_id, guest_id, user_id },
        next
      );
      if (!result?.success) return result;

      const maxPoints = await getMaxLearnPoints(tenant, next);

      const doc = result.data;
      if (!doc) {
        return {
          success: true,
          data: {
            learner_type: user_id ? "user" : "guest",
            guest_id: guest_id || undefined,
            total_points: 0,
            max_points: maxPoints,
            completed_lessons: 0,
            current_stage: STAGES[0],
            lessons: {},
          },
          message: "no progress found — returning empty state",
          status: httpStatus.OK,
        };
      }

      // Recomputed live from total_points/maxPoints rather than trusting the
      // persisted current_stage_index, which can go stale if the catalog
      // (and therefore maxPoints) has changed since the last progress write.
      const stage = computeStage(doc.total_points, maxPoints);
      const lessonsOut = {};
      if (doc.lessons) {
        const entries =
          doc.lessons instanceof Map
            ? doc.lessons
            : new Map(Object.entries(doc.lessons));
        entries.forEach((lp, lid) => {
          lessonsOut[lid] = {
            completed: lp.completed,
            stars: lp.stars,
            points_earned: lp.points_earned,
            quiz_score_ratio: lp.quiz_score_ratio,
          };
        });
      }

      return {
        success: true,
        data: {
          learner_type: doc.learner_type,
          guest_id: doc.guest_id || undefined,
          total_points: doc.total_points,
          max_points: maxPoints,
          completed_lessons: doc.completed_lessons,
          current_stage: stage,
          lessons: lessonsOut,
        },
        message: "successfully retrieved progress",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  updateLessonProgress: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { lesson_id } = request.params;
      const device_id = request.headers["x-device-id"];
      const guest_id = request.headers["x-guest-id"] || null;
      const user_id = request.user?.id || null;
      const update = request.body;

      if (!user_id && !device_id) {
        return {
          success: false,
          message: "X-Device-Id header is required for guest progress",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Verify lesson exists and is published
      const lessonRes = await LearnLessonModel(tenant).list(
        { filter: { _id: lesson_id } },
        next
      );
      if (!lessonRes?.success || !lessonRes.data?.length) {
        return {
          success: false,
          message: "lesson not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      if (Array.isArray(update.quiz_attempts) && update.quiz_attempts.length) {
        update.quiz_attempts = await gradeQuizAttempts(
          tenant,
          update.quiz_attempts,
          next
        );
      }

      const maxPoints = await getMaxLearnPoints(tenant, next);
      const result = await LearnProgressModel(tenant).upsertLessonProgress(
        { device_id, guest_id, user_id, lesson_id, update, maxPoints },
        next
      );
      if (!result?.success) return result;

      // Determine next lesson to unlock
      const progress = result.data;
      let nextLessonId = null;
      if (progress.completed) {
        const lesson = lessonRes.data[0];
        const siblingsRes = await LearnLessonModel(tenant).list(
          {
            filter: {
              unit_id: lesson.unit_id,
              lesson_order: { $gt: lesson.lesson_order },
            },
            limit: 1,
          },
          next
        );
        if (siblingsRes?.data?.length) {
          nextLessonId = siblingsRes.data[0]._id;
        }
      }

      return {
        success: true,
        data: {
          lesson_id,
          stars: progress.stars,
          points_earned: progress.points_earned,
          total_points: progress.total_points,
          current_stage: progress.current_stage,
          unlock: nextLessonId
            ? { next_lesson_id: nextLessonId, course_complete: false }
            : null,
        },
        message: "lesson progress updated",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  syncProgress: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { device_id, guest_id, updates } = request.body;
      const user_id = request.user?.id || null;

      let lastStage = STAGES[0];
      let totalPoints = 0;
      let mergedCount = 0;
      const maxPoints = await getMaxLearnPoints(tenant, next);

      for (const update of updates) {
        const lessonRes = await LearnLessonModel(tenant).list(
          { filter: { _id: update.lesson_id } },
          next
        );
        if (!lessonRes?.success || !lessonRes.data?.length) continue;

        if (Array.isArray(update.quiz_attempts) && update.quiz_attempts.length) {
          update.quiz_attempts = await gradeQuizAttempts(
            tenant,
            update.quiz_attempts,
            next
          );
        }

        const result = await LearnProgressModel(tenant).upsertLessonProgress(
          {
            device_id,
            guest_id,
            user_id,
            lesson_id: update.lesson_id,
            update,
            maxPoints,
          },
          next
        );
        if (result?.success) {
          lastStage = result.data.current_stage;
          totalPoints = result.data.total_points;
          mergedCount += 1;
        }
      }

      return {
        success: true,
        data: {
          merged_count: mergedCount,
          total_points: totalPoints,
          current_stage: lastStage,
        },
        message: "progress sync complete",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Option 3 — Account, Certificate & Leaderboard
  // ---------------------------------------------------------------------------

  linkGuestProgress: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { device_id, guest_id } = request.body;
      const user_id = request.user?.id || null;

      if (!user_id) {
        return {
          success: false,
          message: "authentication required",
          status: httpStatus.UNAUTHORIZED,
        };
      }

      // Verify the guest session exists and is not already linked to another user
      const sessionRes = await LearnGuestSessionModel(tenant)
        .findOne({ device_id, guest_id })
        .lean();
      if (
        !sessionRes ||
        (sessionRes.linked_user_id && sessionRes.linked_user_id !== user_id)
      ) {
        return {
          success: false,
          message: "guest session not found or already linked to another user",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const maxPoints = await getMaxLearnPoints(tenant, next);
      const result = await LearnProgressModel(tenant).mergeGuestToUser(
        { device_id, guest_id, user_id, maxPoints },
        next
      );
      if (!result?.success) return result;

      await LearnGuestSessionModel(tenant).findOneAndUpdate(
        { device_id, guest_id },
        { $set: { linked_user_id: user_id, linked_at: new Date() } }
      );

      return {
        success: true,
        data: {
          user_id,
          merged: result.data,
        },
        message: "guest progress merged successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Admin — Course Authoring
  // ---------------------------------------------------------------------------

  createCourse: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { course_number, title, plain_title_key, cover_image_url, published } =
        request.body;

      if (published === true) {
        return {
          success: false,
          message: "cannot publish a course on creation — add units and lessons first",
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }

      return await LearnCourseModel(tenant).register(
        { course_number, title, plain_title_key, cover_image_url, published: false },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  addUnit: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { course_id } = request.params;
      const { title, plain_title_key, unit_order } = request.body;

      const courseRes = await LearnCourseModel(tenant).list(
        { filter: { _id: course_id } },
        next
      );
      if (!courseRes?.success || !courseRes.data?.length) {
        return {
          success: false,
          message: "course not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return await LearnUnitModel(tenant).register(
        { course_id, title, plain_title_key, unit_order },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  addLesson: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { unit_id } = request.params;
      const { title, plain_title_key, lesson_order, cover_image_url, completion_message } =
        request.body;

      const unitRes = await LearnUnitModel(tenant).list(
        { filter: { _id: unit_id } },
        next
      );
      if (!unitRes?.success || !unitRes.data?.length) {
        return {
          success: false,
          message: "unit not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return await LearnLessonModel(tenant).register(
        { unit_id, title, plain_title_key, lesson_order, cover_image_url, completion_message },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  addActivity: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { lesson_id } = request.params;
      const { type, order, payload } = request.body;

      const lessonRes = await LearnLessonModel(tenant).list(
        { filter: { _id: lesson_id } },
        next
      );
      if (!lessonRes?.success || !lessonRes.data?.length) {
        return {
          success: false,
          message: "lesson not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Payload validation per type
      if (type === "article" && isEmpty(payload?.body)) {
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          errors: { "payload.body": "body is required for article activities" },
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }
      if (type === "video" && isEmpty(payload?.video_url) && isEmpty(payload?.youtube_id)) {
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          errors: { "payload.video_url": "video_url or youtube_id is required for video activities" },
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }
      if (type === "quiz" && isEmpty(payload?.format)) {
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          errors: { "payload.format": "format is required for quiz activities" },
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }
      if (type === "quiz" && !isEmpty(payload?.format)) {
        const answerError = validateQuizCorrectAnswer(payload);
        if (answerError) {
          return {
            success: false,
            message: "validation errors for some of the provided fields",
            errors: { [answerError.field]: answerError.message },
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }
      }

      return await LearnActivityModel(tenant).register(
        { lesson_id, type, order, payload },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Admin — Read & Delete (Course / Unit / Lesson / Activity)
  // ---------------------------------------------------------------------------

  listCourses: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const [coursesRes, unitsRes, lessonsRes, activitiesRes] = await Promise.all([
        LearnCourseModel(tenant).list({}, next),
        LearnUnitModel(tenant).list({ limit: 0 }, next),
        LearnLessonModel(tenant).list({ limit: 0 }, next),
        LearnActivityModel(tenant).list({ limit: 0 }, next),
      ]);

      if (!coursesRes?.success) return coursesRes;
      if (!unitsRes?.success || !lessonsRes?.success || !activitiesRes?.success) {
        return {
          success: false,
          message: "failed to retrieve course count data",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const unitIdToCourseId = {};
      const unitCountByCourse = {};
      (unitsRes?.data || []).forEach((u) => {
        const cid = u.course_id.toString();
        unitIdToCourseId[u._id.toString()] = cid;
        unitCountByCourse[cid] = (unitCountByCourse[cid] || 0) + 1;
      });

      const lessonIdToCourseId = {};
      const lessonCountByCourse = {};
      (lessonsRes?.data || []).forEach((l) => {
        const cid = unitIdToCourseId[l.unit_id.toString()];
        if (cid) {
          lessonIdToCourseId[l._id.toString()] = cid;
          lessonCountByCourse[cid] = (lessonCountByCourse[cid] || 0) + 1;
        }
      });

      const activityCountByCourse = {};
      (activitiesRes?.data || []).forEach((a) => {
        const cid = lessonIdToCourseId[a.lesson_id.toString()];
        if (cid) activityCountByCourse[cid] = (activityCountByCourse[cid] || 0) + 1;
      });

      const courses = coursesRes.data.map((c) => {
        const cid = c._id.toString();
        return {
          _id: c._id,
          course_number: c.course_number,
          title: c.title,
          plain_title_key: c.plain_title_key,
          cover_image_url: c.cover_image_url || null,
          published: c.published,
          catalog_version: c.catalog_version || null,
          unit_count: unitCountByCourse[cid] || 0,
          lesson_count: lessonCountByCourse[cid] || 0,
          activity_count: activityCountByCourse[cid] || 0,
          created_at: c.createdAt,
          updated_at: c.updatedAt,
        };
      });

      return {
        success: true,
        data: courses,
        message: "successfully retrieved courses",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  getCourse: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { course_id } = request.params;

      const courseRes = await LearnCourseModel(tenant).list(
        { filter: { _id: course_id } },
        next
      );
      if (!courseRes?.success || !courseRes.data?.length) {
        return { success: false, message: "course not found", status: httpStatus.NOT_FOUND };
      }

      const course = courseRes.data[0];
      const unitsRes = await LearnUnitModel(tenant).list(
        { filter: { course_id }, limit: 0 },
        next
      );
      const units = (unitsRes?.data || []).sort((a, b) => a.unit_order - b.unit_order);
      const unitIds = units.map((u) => u._id);

      const lessonsRes = await LearnLessonModel(tenant).list(
        { filter: { unit_id: { $in: unitIds } }, limit: 0 },
        next
      );
      const lessons = lessonsRes?.data || [];
      const lessonIds = lessons.map((l) => l._id);

      const activitiesRes = await LearnActivityModel(tenant).list(
        { filter: { lesson_id: { $in: lessonIds } }, limit: 0 },
        next
      );
      const activities = activitiesRes?.data || [];

      const lessonsByUnit = {};
      lessons.forEach((l) => {
        const uid = l.unit_id.toString();
        if (!lessonsByUnit[uid]) lessonsByUnit[uid] = [];
        lessonsByUnit[uid].push(l);
      });

      const activitiesByLesson = {};
      activities.forEach((a) => {
        const lid = a.lesson_id.toString();
        if (!activitiesByLesson[lid]) activitiesByLesson[lid] = [];
        activitiesByLesson[lid].push(a);
      });

      return {
        success: true,
        data: {
          _id: course._id,
          course_number: course.course_number,
          title: course.title,
          plain_title_key: course.plain_title_key,
          cover_image_url: course.cover_image_url || null,
          published: course.published,
          catalog_version: course.catalog_version || null,
          units: units.map((unit) => {
            const unitLessons = (lessonsByUnit[unit._id.toString()] || []).sort(
              (a, b) => a.lesson_order - b.lesson_order
            );
            return {
              _id: unit._id,
              title: unit.title,
              plain_title_key: unit.plain_title_key,
              unit_order: unit.unit_order,
              lessons: unitLessons.map((lesson) => {
                const lessonActivities = (
                  activitiesByLesson[lesson._id.toString()] || []
                ).sort((a, b) => a.order - b.order);
                return {
                  _id: lesson._id,
                  title: lesson.title,
                  plain_title_key: lesson.plain_title_key,
                  lesson_order: lesson.lesson_order,
                  cover_image_url: lesson.cover_image_url || null,
                  completion_message: lesson.completion_message || null,
                  activities: lessonActivities.map((act) => ({
                    _id: act._id,
                    type: act.type,
                    order: act.order,
                    payload: act.payload,
                  })),
                };
              }),
            };
          }),
        },
        message: "successfully retrieved course",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  deleteCourse: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { course_id } = request.params;

      const courseRes = await LearnCourseModel(tenant).list(
        { filter: { _id: course_id } },
        next
      );
      if (!courseRes?.success || !courseRes.data?.length) {
        return { success: false, message: "course not found", status: httpStatus.NOT_FOUND };
      }

      if (courseRes.data[0].published) {
        return {
          success: false,
          message: "cannot delete a published course — unpublish it first",
          status: httpStatus.CONFLICT,
        };
      }

      const unitIds = await LearnUnitModel(tenant).distinct("_id", { course_id });

      if (unitIds.length) {
        const lessonIds = await LearnLessonModel(tenant).distinct("_id", {
          unit_id: { $in: unitIds },
        });

        if (lessonIds.length) {
          await LearnActivityModel(tenant).deleteMany({ lesson_id: { $in: lessonIds } });
        }
        await LearnLessonModel(tenant).deleteMany({ unit_id: { $in: unitIds } });
        await LearnUnitModel(tenant).deleteMany({ course_id });
      }

      await LearnCourseModel(tenant).remove({ filter: { _id: course_id } }, next);

      return {
        success: true,
        data: {},
        message: "course deleted successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  updateUnit: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { unit_id } = request.params;
      const { title, plain_title_key, unit_order } = request.body;

      const unitRes = await LearnUnitModel(tenant).list({ filter: { _id: unit_id } }, next);
      if (!unitRes?.success || !unitRes.data?.length) {
        return { success: false, message: "unit not found", status: httpStatus.NOT_FOUND };
      }

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (plain_title_key !== undefined) updates.plain_title_key = plain_title_key;
      if (unit_order !== undefined) updates.unit_order = unit_order;

      return await LearnUnitModel(tenant).modify(
        { filter: { _id: unit_id }, update: updates },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  deleteUnit: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { unit_id } = request.params;

      const unitRes = await LearnUnitModel(tenant).list({ filter: { _id: unit_id } }, next);
      if (!unitRes?.success || !unitRes.data?.length) {
        return { success: false, message: "unit not found", status: httpStatus.NOT_FOUND };
      }

      const unit = unitRes.data[0];
      const courseRes = await LearnCourseModel(tenant).list(
        { filter: { _id: unit.course_id } },
        next
      );
      if (!courseRes?.success) {
        return {
          success: false,
          message: "failed to verify parent course status",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      if (courseRes.data?.length && courseRes.data[0].published) {
        return {
          success: false,
          message: "cannot delete a unit from a published course — unpublish the course first",
          status: httpStatus.CONFLICT,
        };
      }

      const lessonIds = await LearnLessonModel(tenant).distinct("_id", { unit_id });

      if (lessonIds.length) {
        await LearnActivityModel(tenant).deleteMany({ lesson_id: { $in: lessonIds } });
        await LearnLessonModel(tenant).deleteMany({ unit_id });
      }

      await LearnUnitModel(tenant).remove({ filter: { _id: unit_id } }, next);

      return {
        success: true,
        data: {},
        message: "unit deleted successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  updateLesson: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { lesson_id } = request.params;
      const { title, plain_title_key, lesson_order, cover_image_url, completion_message } =
        request.body;

      const lessonRes = await LearnLessonModel(tenant).list(
        { filter: { _id: lesson_id } },
        next
      );
      if (!lessonRes?.success || !lessonRes.data?.length) {
        return { success: false, message: "lesson not found", status: httpStatus.NOT_FOUND };
      }

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (plain_title_key !== undefined) updates.plain_title_key = plain_title_key;
      if (lesson_order !== undefined) updates.lesson_order = lesson_order;
      if (cover_image_url !== undefined) updates.cover_image_url = cover_image_url;
      if (completion_message !== undefined) updates.completion_message = completion_message;

      return await LearnLessonModel(tenant).modify(
        { filter: { _id: lesson_id }, update: updates },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  deleteLesson: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { lesson_id } = request.params;

      const lessonRes = await LearnLessonModel(tenant).list(
        { filter: { _id: lesson_id } },
        next
      );
      if (!lessonRes?.success || !lessonRes.data?.length) {
        return { success: false, message: "lesson not found", status: httpStatus.NOT_FOUND };
      }

      const lesson = lessonRes.data[0];
      const unitRes = await LearnUnitModel(tenant).list(
        { filter: { _id: lesson.unit_id } },
        next
      );
      if (!unitRes?.success) {
        return {
          success: false,
          message: "failed to verify parent course status",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      if (unitRes.data?.length) {
        const courseRes = await LearnCourseModel(tenant).list(
          { filter: { _id: unitRes.data[0].course_id } },
          next
        );
        if (!courseRes?.success) {
          return {
            success: false,
            message: "failed to verify parent course status",
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
        if (courseRes.data?.length && courseRes.data[0].published) {
          return {
            success: false,
            message: "cannot delete a lesson from a published course — unpublish the course first",
            status: httpStatus.CONFLICT,
          };
        }
      }

      await LearnActivityModel(tenant).deleteMany({ lesson_id });
      await LearnLessonModel(tenant).remove({ filter: { _id: lesson_id } }, next);

      return {
        success: true,
        data: {},
        message: "lesson deleted successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  updateActivity: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { activity_id } = request.params;
      const { type, order, payload } = request.body;

      const activityRes = await LearnActivityModel(tenant).list(
        { filter: { _id: activity_id } },
        next
      );
      if (!activityRes?.success || !activityRes.data?.length) {
        return { success: false, message: "activity not found", status: httpStatus.NOT_FOUND };
      }

      const effectiveType = type || activityRes.data[0].type;
      const effectivePayload =
        payload !== undefined ? payload : activityRes.data[0].payload;

      if (payload !== undefined || type !== undefined) {
        if (effectiveType === "article" && isEmpty(effectivePayload?.body)) {
          return {
            success: false,
            message: "validation errors for some of the provided fields",
            errors: { "payload.body": "body is required for article activities" },
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }
        if (
          effectiveType === "video" &&
          isEmpty(effectivePayload?.video_url) &&
          isEmpty(effectivePayload?.youtube_id)
        ) {
          return {
            success: false,
            message: "validation errors for some of the provided fields",
            errors: {
              "payload.video_url": "video_url or youtube_id is required for video activities",
            },
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }
        if (effectiveType === "quiz" && isEmpty(effectivePayload?.format)) {
          return {
            success: false,
            message: "validation errors for some of the provided fields",
            errors: { "payload.format": "format is required for quiz activities" },
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }
        if (effectiveType === "quiz" && !isEmpty(effectivePayload?.format)) {
          const answerError = validateQuizCorrectAnswer(effectivePayload);
          if (answerError) {
            return {
              success: false,
              message: "validation errors for some of the provided fields",
              errors: { [answerError.field]: answerError.message },
              status: httpStatus.UNPROCESSABLE_ENTITY,
            };
          }
        }
      }

      const updates = {};
      if (type !== undefined) updates.type = type;
      if (order !== undefined) updates.order = order;
      if (payload !== undefined) updates.payload = payload;

      return await LearnActivityModel(tenant).modify(
        { filter: { _id: activity_id }, update: updates },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  deleteActivity: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { activity_id } = request.params;

      const activityRes = await LearnActivityModel(tenant).list(
        { filter: { _id: activity_id } },
        next
      );
      if (!activityRes?.success || !activityRes.data?.length) {
        return { success: false, message: "activity not found", status: httpStatus.NOT_FOUND };
      }

      const activity = activityRes.data[0];
      const lessonRes = await LearnLessonModel(tenant).list(
        { filter: { _id: activity.lesson_id } },
        next
      );
      if (!lessonRes?.success) {
        return {
          success: false,
          message: "failed to verify parent course status",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      if (lessonRes.data?.length) {
        const unitRes = await LearnUnitModel(tenant).list(
          { filter: { _id: lessonRes.data[0].unit_id } },
          next
        );
        if (!unitRes?.success) {
          return {
            success: false,
            message: "failed to verify parent course status",
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
        if (unitRes.data?.length) {
          const courseRes = await LearnCourseModel(tenant).list(
            { filter: { _id: unitRes.data[0].course_id } },
            next
          );
          if (!courseRes?.success) {
            return {
              success: false,
              message: "failed to verify parent course status",
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
          if (courseRes.data?.length && courseRes.data[0].published) {
            return {
              success: false,
              message:
                "cannot delete an activity from a published course — unpublish the course first",
              status: httpStatus.CONFLICT,
            };
          }
        }
      }

      await LearnActivityModel(tenant).remove({ filter: { _id: activity_id } }, next);

      return {
        success: true,
        data: {},
        message: "activity deleted successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  updateCourse: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { course_id } = request.params;
      const updates = request.body;

      if (updates.published === true) {
        // Validate complete tree before publishing
        const unitsRes = await LearnUnitModel(tenant).list(
          { filter: { course_id } },
          next
        );
        if (!unitsRes?.data?.length) {
          return {
            success: false,
            message: "cannot publish — course must have units, lessons, and activities",
            errors: { published: "at least one unit is required" },
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }

        for (const unit of unitsRes.data) {
          const lessonsRes = await LearnLessonModel(tenant).list(
            { filter: { unit_id: unit._id } },
            next
          );
          if (!lessonsRes?.data?.length) {
            return {
              success: false,
              message: "cannot publish — course must have units, lessons, and activities",
              errors: { published: `unit "${unit.title}" has no lessons` },
              status: httpStatus.UNPROCESSABLE_ENTITY,
            };
          }
          for (const lesson of lessonsRes.data) {
            const activitiesRes = await LearnActivityModel(tenant).list(
              { filter: { lesson_id: lesson._id } },
              next
            );
            if (!activitiesRes?.data?.length) {
              return {
                success: false,
                message: "cannot publish — course must have units, lessons, and activities",
                errors: { published: "at least one lesson must contain an activity" },
                status: httpStatus.UNPROCESSABLE_ENTITY,
              };
            }
          }
        }

        const courseRes = await LearnCourseModel(tenant).list(
          { filter: { _id: course_id } },
          next
        );
        if (courseRes?.data?.length && !courseRes.data[0].cover_image_url) {
          return {
            success: false,
            message: "cannot publish — cover_image_url is required before publishing",
            errors: { cover_image_url: "cover_image_url is required for published courses" },
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }

        updates.catalog_version = new Date().toISOString().slice(0, 10);
      }

      return await LearnCourseModel(tenant).modify(
        { filter: { _id: course_id }, update: updates },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
  // ---------------------------------------------------------------------------
  // Option 3 — Certificates
  // ---------------------------------------------------------------------------

  issueCertificate: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const user_id = request.user?.id || null;

      if (!user_id) {
        return {
          success: false,
          message: "authentication required",
          status: httpStatus.UNAUTHORIZED,
        };
      }

      const { course_id, learner_name } = request.body;

      const courseRes = await LearnCourseModel(tenant).list(
        { filter: { _id: course_id, published: true } },
        next
      );
      if (!courseRes?.success || !courseRes.data?.length) {
        return { success: false, message: "course not found", status: httpStatus.NOT_FOUND };
      }

      // Idempotent — return existing certificate if already issued
      const existingRes = await LearnCertificateModel(tenant).list(
        { filter: { user_id, course_id } },
        next
      );
      if (existingRes?.success && existingRes.data?.length) {
        const cert = existingRes.data[0];
        return {
          success: true,
          data: {
            certificate_id: cert._id,
            learner_name: cert.learner_name,
            verification_code: cert.verification_code,
            share_url: cert.share_url,
            issued_at: cert.createdAt,
          },
          message: "certificate already issued",
          status: httpStatus.OK,
        };
      }

      // Verify all lessons in the course are completed
      const unitsRes = await LearnUnitModel(tenant).list({ filter: { course_id } }, next);
      if (!unitsRes?.success) {
        return {
          success: false,
          message: "failed to verify course completion",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const unitIds = (unitsRes.data || []).map((u) => u._id);

      const lessonIds = unitIds.length
        ? await LearnLessonModel(tenant).distinct("_id", { unit_id: { $in: unitIds } })
        : [];

      if (!lessonIds.length) {
        return {
          success: false,
          message: "course not complete — finish all lessons before requesting certificate",
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }

      const progressRes = await LearnProgressModel(tenant).findProgress({ user_id }, next);
      const progressDoc = progressRes?.data || null;

      if (!progressDoc) {
        return {
          success: false,
          message: "course not complete — finish all lessons before requesting certificate",
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }

      const lessonsMap =
        progressDoc.lessons instanceof Map
          ? progressDoc.lessons
          : new Map(Object.entries(progressDoc.lessons || {}));

      const allComplete = lessonIds.every((lid) => {
        const lp = lessonsMap.get(lid.toString());
        return lp?.completed === true;
      });

      if (!allComplete) {
        return {
          success: false,
          message: "course not complete — finish all lessons before requesting certificate",
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }

      // Generate a unique verification code
      let verification_code;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateVerificationCode();
        const collision = await LearnCertificateModel(tenant).list(
          { filter: { verification_code: candidate } },
          next
        );
        if (!collision?.data?.length) {
          verification_code = candidate;
          break;
        }
      }

      if (!verification_code) {
        return {
          success: false,
          message: "failed to generate a unique verification code — please retry",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const name =
        learner_name || request.user?.displayName || "Learner";

      const certResult = await LearnCertificateModel(tenant).register(
        {
          user_id,
          course_id,
          learner_name: name,
          verification_code,
          share_url: `https://airqo.net/learn/cert/${verification_code}`,
        },
        next
      );
      if (!certResult?.success) return certResult;

      const cert = certResult.data;
      return {
        success: true,
        data: {
          certificate_id: cert._id,
          learner_name: cert.learner_name,
          verification_code: cert.verification_code,
          share_url: cert.share_url,
          issued_at: cert.createdAt,
        },
        message: "certificate issued",
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  listCertificates: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const user_id = request.user?.id || null;

      if (!user_id) {
        return {
          success: false,
          message: "authentication required",
          status: httpStatus.UNAUTHORIZED,
        };
      }

      const certsRes = await LearnCertificateModel(tenant).list(
        { filter: { user_id } },
        next
      );
      if (!certsRes?.success) return certsRes;

      return {
        success: true,
        data: (certsRes.data || []).map((c) => ({
          certificate_id: c._id,
          course_id: c.course_id,
          learner_name: c.learner_name,
          verification_code: c.verification_code,
          share_url: c.share_url,
          issued_at: c.createdAt,
        })),
        message: "successfully retrieved certificates",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  verifyCertificate: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const { verification_code } = request.params;

      const certsRes = await LearnCertificateModel(tenant).list(
        { filter: { verification_code } },
        next
      );
      if (!certsRes?.success || !certsRes.data?.length) {
        return {
          success: false,
          message: "certificate not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      const cert = certsRes.data[0];
      const courseRes = await LearnCourseModel(tenant).list(
        { filter: { _id: cert.course_id } },
        next
      );
      const course = courseRes?.data?.[0] || null;

      return {
        success: true,
        data: {
          certificate_id: cert._id,
          learner_name: cert.learner_name,
          verification_code: cert.verification_code,
          course_title: course?.title || null,
          share_url: cert.share_url,
          issued_at: cert.createdAt,
          valid: true,
        },
        message: "certificate is valid",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Option 3 — Leaderboard
  // ---------------------------------------------------------------------------

  getLeaderboard: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const device_id = request.headers["x-device-id"];
      const user_id = request.user?.id || null;
      const hasIdentity = Boolean(user_id || device_id);
      const event_id = request.query.event_id || null;

      // The leaderboard is public, read-only, aggregate data -- viewing it
      // never requires an identity. user_id/device_id are only used below
      // to personalize the response (is_current_user/current_user_rank)
      // when the caller happens to be identifiable.
      const limit = Math.min(parseInt(request.query.limit) || 20, 100);
      const LearnProgress = LearnProgressModel(tenant);
      const maxPoints = await getMaxLearnPoints(tenant, next);

      const progressFilter = { total_points: { $gt: 0 } };

      // For a one-off quiz/event (e.g. an in-person stall), scope entries to
      // only the guest sessions (and any accounts they later linked to) that
      // joined under that event_id, instead of the global leaderboard.
      if (event_id) {
        const eventSessions = await LearnGuestSessionModel(tenant)
          .find({ event_id })
          .select("guest_id linked_user_id")
          .lean();
        const eventGuestIds = eventSessions.map((s) => s.guest_id);
        const eventUserIds = eventSessions
          .filter((s) => s.linked_user_id)
          .map((s) => s.linked_user_id);

        if (eventGuestIds.length === 0 && eventUserIds.length === 0) {
          return {
            success: true,
            data: { scope: "event", event_id, entries: [], current_user_rank: null },
            message: "successfully retrieved leaderboard",
            status: httpStatus.OK,
          };
        }
        progressFilter.$or = [
          { guest_id: { $in: eventGuestIds } },
          { user_id: { $in: eventUserIds } },
        ];
      }

      // Guests are ranked alongside registered users — they're identified by
      // a random display name/icon (see LearnGuestSession) rather than being
      // excluded outright.
      const topLearners = await LearnProgress.find(progressFilter)
        .sort({ total_points: -1 })
        .limit(limit)
        .select(
          "user_id device_id guest_id learner_type total_points completed_lessons"
        )
        .lean();

      // Matches the caller against their own progress row -- user_id when
      // JWT-authenticated, otherwise device_id (unique per LearnProgress
      // doc, same convention used by getProgress/findProgress). Always
      // false for a fully anonymous caller (no identity to match).
      const isCaller = (l) =>
        hasIdentity && (user_id ? l.user_id === user_id : l.device_id === device_id);

      const guestIds = topLearners
        .filter((l) => l.learner_type === "guest" && l.guest_id)
        .map((l) => l.guest_id);
      let guestIdentityByGuestId = new Map();
      if (guestIds.length > 0) {
        const guestSessions = await LearnGuestSessionModel(tenant)
          .find({ guest_id: { $in: guestIds } })
          .select("guest_id display_name avatar_icon username")
          .lean();
        guestIdentityByGuestId = new Map(
          guestSessions.map((s) => [s.guest_id, s])
        );
      }

      // Determine caller's rank when they fall outside the top N -- skipped
      // entirely for a fully anonymous caller (no identity to look up, and
      // an unguarded { device_id: undefined } filter would otherwise be
      // stripped by Mongoose into an unfiltered findOne({}), matching an
      // arbitrary document).
      const currentUserInTop = topLearners.some(isCaller);
      let currentUserRank = null;

      if (!currentUserInTop && hasIdentity) {
        const callerFilter = user_id ? { user_id } : { device_id };
        // When scoped to an event, the caller's own doc must also satisfy the
        // event's guest/user membership -- otherwise someone who never joined
        // this event would still get back a rank computed against it.
        const scopedCallerFilter = progressFilter.$or
          ? { ...callerFilter, $or: progressFilter.$or }
          : callerFilter;
        const userProgress = await LearnProgress.findOne(scopedCallerFilter).lean();
        if (userProgress) {
          const ahead = await LearnProgress.countDocuments({
            ...progressFilter,
            total_points: { $gt: userProgress.total_points },
          });
          currentUserRank = ahead + 1;
        }
      }

      return {
        success: true,
        data: {
          scope: event_id ? "event" : "global",
          ...(event_id ? { event_id } : {}),
          entries: topLearners.map((l, i) => {
            const guestIdentity =
              l.learner_type === "guest"
                ? guestIdentityByGuestId.get(l.guest_id)
                : null;
            // A guest's own chosen username (set via the anonymous-session
            // endpoint) takes precedence over the auto-generated display name.
            const resolvedName =
              guestIdentity?.username || guestIdentity?.display_name || undefined;
            const avatarIcon = guestIdentity?.avatar_icon || undefined;
            return {
              rank: i + 1,
              learner_type: l.learner_type,
              display_name: resolvedName,
              avatar_icon: avatarIcon,
              // Auto-generated server-side so the leaderboard always has an
              // image to show without requiring a photo upload from the learner.
              avatar_image_url: buildAvatarImageUrl({
                seed: l.guest_id || l.user_id || l.device_id,
                icon: avatarIcon,
              }),
              total_points: l.total_points,
              completed_lessons: l.completed_lessons,
              // Computed live so a leaderboard row can never disagree with
              // getProgress/getCatalog if the catalog changed since this
              // learner's last write.
              current_stage: computeStage(l.total_points, maxPoints),
              is_current_user: isCaller(l),
            };
          }),
          current_user_rank: currentUserInTop
            ? topLearners.findIndex(isCaller) + 1
            : currentUserRank,
        },
        message: "successfully retrieved leaderboard",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Bonus — per-course progress summary
  // ---------------------------------------------------------------------------

  getCourseProgress: async (request, next) => {
    try {
      const tenant = getTenant(request);
      const device_id = request.headers["x-device-id"];
      const guest_id = request.headers["x-guest-id"] || null;
      const user_id = request.user?.id || null;

      if (!user_id && !device_id) {
        return {
          success: false,
          message: "X-Device-Id header is required for guest progress",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const progressRes = await LearnProgressModel(tenant).findProgress(
        { device_id, guest_id, user_id },
        next
      );
      if (progressRes && !progressRes.success) return progressRes;
      const progressDoc = progressRes?.data || null;
      const lessonsMap =
        progressDoc?.lessons instanceof Map
          ? progressDoc.lessons
          : new Map(Object.entries(progressDoc?.lessons || {}));

      const [coursesRes, unitsRes, lessonsRes] = await Promise.all([
        LearnCourseModel(tenant).list({ filter: { published: true } }, next),
        LearnUnitModel(tenant).list({ limit: 0 }, next),
        LearnLessonModel(tenant).list({ limit: 0 }, next),
      ]);

      if (!coursesRes?.success) return coursesRes;
      if (!unitsRes?.success) return unitsRes;
      if (!lessonsRes?.success) return lessonsRes;

      const unitsByCourse = {};
      (unitsRes?.data || []).forEach((u) => {
        const cid = u.course_id.toString();
        if (!unitsByCourse[cid]) unitsByCourse[cid] = [];
        unitsByCourse[cid].push(u._id.toString());
      });

      const lessonsByUnit = {};
      (lessonsRes?.data || []).forEach((l) => {
        const uid = l.unit_id.toString();
        if (!lessonsByUnit[uid]) lessonsByUnit[uid] = [];
        lessonsByUnit[uid].push(l._id.toString());
      });

      const courses = coursesRes.data.map((course) => {
        const cid = course._id.toString();
        const unitIds = unitsByCourse[cid] || [];
        const allLessonIds = unitIds.flatMap((uid) => lessonsByUnit[uid] || []);
        const total_lessons = allLessonIds.length;

        let completed_lessons = 0;
        let points_earned = 0;
        let total_stars = 0;

        allLessonIds.forEach((lid) => {
          const lp = lessonsMap.get(lid);
          if (lp?.completed) {
            completed_lessons++;
            points_earned += lp.points_earned || 0;
            total_stars += lp.stars || 0;
          }
        });

        return {
          course_id: course._id,
          title: course.title,
          course_number: course.course_number,
          cover_image_url: course.cover_image_url || null,
          total_lessons,
          completed_lessons,
          points_earned,
          is_complete: total_lessons > 0 && completed_lessons === total_lessons,
          average_stars:
            completed_lessons > 0
              ? Math.round((total_stars / completed_lessons) * 10) / 10
              : 0,
        };
      });

      return {
        success: true,
        data: courses,
        message: "successfully retrieved course progress",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

module.exports = learn;
