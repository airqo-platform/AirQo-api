const httpStatus = require("http-status");
const LearnCourseModel = require("@models/LearnCourse");
const LearnUnitModel = require("@models/LearnUnit");
const LearnLessonModel = require("@models/LearnLesson");
const LearnActivityModel = require("@models/LearnActivity");
const LearnGuestSessionModel = require("@models/LearnGuestSession");
const LearnProgressModel = require("@models/LearnProgress");
const constants = require("@config/constants");
const { logObject, HttpError } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- learn-util`);
const isEmpty = require("is-empty");

const STAGES = LearnProgressModel("airqo").schema.statics?.STAGES || [
  { index: 0, name: "Curious" },
  { index: 1, name: "Aware" },
  { index: 2, name: "Observer" },
  { index: 3, name: "Champion" },
  { index: 4, name: "Defender" },
];

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
      const { device_id, app_version, platform } = request.body;

      const result = await LearnGuestSessionModel(tenant).findOrCreate(
        { device_id, app_version, platform },
        next
      );
      if (!result?.success) return result;

      const session = result.data;
      return {
        success: true,
        data: {
          guest_id: session.guest_id,
          display_name: session.display_name,
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

      const doc = result.data;
      if (!doc) {
        return {
          success: true,
          data: {
            learner_type: user_id ? "user" : "guest",
            guest_id: guest_id || undefined,
            total_points: 0,
            max_points: 2400,
            completed_lessons: 0,
            current_stage: STAGES[0],
            lessons: {},
          },
          message: "no progress found — returning empty state",
          status: httpStatus.OK,
        };
      }

      const stage = STAGES[doc.current_stage_index] || STAGES[0];
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
          max_points: 2400,
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

      const result = await LearnProgressModel(tenant).upsertLessonProgress(
        { device_id, guest_id, user_id, lesson_id, update, maxPoints: 2400 },
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

      for (const update of updates) {
        const lessonRes = await LearnLessonModel(tenant).list(
          { filter: { _id: update.lesson_id } },
          next
        );
        if (!lessonRes?.success || !lessonRes.data?.length) continue;

        const result = await LearnProgressModel(tenant).upsertLessonProgress(
          {
            device_id,
            guest_id,
            user_id,
            lesson_id: update.lesson_id,
            update,
            maxPoints: 2400,
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
      const user_id = request.user?.id;

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

      const result = await LearnProgressModel(tenant).mergeGuestToUser(
        { device_id, guest_id, user_id },
        next
      );
      if (!result?.success) return result;

      await LearnGuestSessionModel(tenant).findOneAndUpdate(
        { device_id },
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
};

module.exports = learn;
