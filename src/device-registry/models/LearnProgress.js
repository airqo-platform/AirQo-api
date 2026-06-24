const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- learn-progress-model`
);

const MAX_LEARN_POINTS = 2400;

// Per-lesson progress sub-document
const lessonProgressSchema = new Schema(
  {
    lesson_id: { type: String, required: true },
    completed: { type: Boolean, default: false },
    stars: { type: Number, default: 0, min: 0, max: 3 },
    points_earned: { type: Number, default: 0, min: 0 },
    quiz_score_ratio: { type: Number, default: 0, min: 0, max: 1 },
    furthest_activity_index: { type: Number, default: 0, min: 0 },
    quiz_attempts: { type: Schema.Types.Mixed, default: [] },
  },
  { _id: false }
);

const learnProgressSchema = new Schema(
  {
    guest_id: { type: String, default: null },
    user_id: { type: String, default: null },
    device_id: { type: String, required: [true, "device_id is required"] },
    learner_type: {
      type: String,
      enum: ["guest", "user"],
      default: "guest",
    },
    total_points: { type: Number, default: 0, min: 0 },
    completed_lessons: { type: Number, default: 0, min: 0 },
    current_stage_index: { type: Number, default: 0, min: 0 },
    lessons: {
      type: Map,
      of: lessonProgressSchema,
      default: {},
    },
  },
  { timestamps: true }
);

learnProgressSchema.index({ guest_id: 1 }, { sparse: true });
learnProgressSchema.index({ user_id: 1 }, { sparse: true });
learnProgressSchema.index({ device_id: 1 }, { unique: true });

const STAGES = [
  { index: 0, name: "Curious" },
  { index: 1, name: "Aware" },
  { index: 2, name: "Observer" },
  { index: 3, name: "Champion" },
  { index: 4, name: "Defender" },
];

function computeStage(totalPoints, maxPoints) {
  if (!maxPoints || maxPoints === 0) return STAGES[0];
  const ratio = totalPoints / maxPoints;
  if (ratio >= 1.0) return STAGES[4];
  if (ratio >= 0.75) return STAGES[3];
  if (ratio >= 0.5) return STAGES[2];
  if (ratio >= 0.25) return STAGES[1];
  return STAGES[0];
}

// Normalize a lessons field from either a Mongoose Map or a plain object to a plain object
function normalizeLessons(lessons) {
  if (!lessons) return {};
  if (lessons instanceof Map) {
    const obj = {};
    lessons.forEach((v, k) => { obj[k] = v; });
    return obj;
  }
  return Object.fromEntries(Object.entries(lessons));
}

learnProgressSchema.statics = {
  STAGES,
  MAX_LEARN_POINTS,
  computeStage,

  async upsertLessonProgress(
    { device_id, guest_id, user_id, lesson_id, update, maxPoints },
    next
  ) {
    try {
      const filter = user_id ? { user_id } : { device_id };
      const existing = await this.findOne(filter);
      const currentLesson = existing?.lessons?.get(lesson_id) || {};

      const furthest = Math.max(
        currentLesson.furthest_activity_index || 0,
        update.furthest_activity_index || 0
      );

      let stars = currentLesson.stars || 0;
      let pointsEarned = currentLesson.points_earned || 0;
      let quizScoreRatio = currentLesson.quiz_score_ratio || 0;
      let completed = currentLesson.completed || false;

      if (update.completed && !currentLesson.completed) {
        completed = true;
        const attempts = update.quiz_attempts || [];
        const graded = attempts.filter(
          (a) => a.format !== "free_text" && a.is_correct !== undefined
        );
        const correct = graded.filter((a) => a.is_correct).length;
        quizScoreRatio = graded.length > 0 ? correct / graded.length : 1.0;
        pointsEarned = correct * 10;

        if (graded.length === 0) stars = 1;
        else if (quizScoreRatio === 1.0) stars = 3;
        else if (quizScoreRatio >= 0.5) stars = 2;
        else stars = 1;
      } else if (update.completed) {
        const newPoints = update.quiz_attempts
          ? update.quiz_attempts.filter(
              (a) => a.format !== "free_text" && a.is_correct
            ).length * 10
          : pointsEarned;
        pointsEarned = Math.max(pointsEarned, newPoints);
      }

      const lessonUpdate = {
        lesson_id,
        completed,
        stars,
        points_earned: pointsEarned,
        quiz_score_ratio: quizScoreRatio,
        furthest_activity_index: furthest,
        quiz_attempts: update.quiz_attempts || currentLesson.quiz_attempts || [],
      };

      // Compute aggregate totals from existing lessons + updated lesson in one pass
      let totalPoints = 0;
      let completedCount = 0;
      if (existing?.lessons) {
        existing.lessons.forEach((lp, lid) => {
          if (lid === lesson_id) return; // replaced below
          if (lp.completed) {
            totalPoints += lp.points_earned || 0;
            completedCount += 1;
          }
        });
      }
      if (lessonUpdate.completed) {
        totalPoints += lessonUpdate.points_earned;
        completedCount += 1;
      }

      const stage = computeStage(totalPoints, maxPoints || MAX_LEARN_POINTS);

      const setOp = {
        [`lessons.${lesson_id}`]: lessonUpdate,
        total_points: totalPoints,
        completed_lessons: completedCount,
        current_stage_index: stage.index,
      };
      if (!existing) {
        setOp.device_id = device_id;
        if (guest_id) setOp.guest_id = guest_id;
        if (user_id) { setOp.user_id = user_id; setOp.learner_type = "user"; }
      }

      // Single atomic write — no second findOneAndUpdate needed
      await this.findOneAndUpdate(
        filter,
        { $set: setOp },
        { upsert: true, new: true }
      );

      return {
        success: true,
        data: {
          lesson_id,
          stars: lessonUpdate.stars,
          points_earned: lessonUpdate.points_earned,
          total_points: totalPoints,
          current_stage: stage,
          completed: lessonUpdate.completed,
        },
        message: "lesson progress updated",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  async findProgress({ device_id, guest_id, user_id }, next) {
    try {
      const filter = user_id ? { user_id } : { device_id };
      const doc = await this.findOne(filter).lean();
      if (!doc) {
        return {
          success: true,
          data: null,
          message: "no progress found",
          status: httpStatus.OK,
        };
      }
      return {
        success: true,
        data: doc,
        message: "progress retrieved",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  async mergeGuestToUser({ device_id, guest_id, user_id }, next) {
    try {
      // Work with the existing guest doc (identified by device_id)
      const guestDoc = await this.findOne({ device_id });
      if (!guestDoc) {
        return {
          success: true,
          data: { lessons_transferred: 0, points_transferred: 0, courses_completed: 0 },
          message: "no guest progress to transfer",
          status: httpStatus.OK,
        };
      }

      // Normalize both lesson maps to plain objects for uniform iteration
      const guestLessons = normalizeLessons(guestDoc.lessons);

      // If a separate user doc already exists (e.g. from another device), merge its
      // lessons in too, keeping the best per lesson, then delete the orphan.
      const userDoc = await this.findOne({ user_id, device_id: { $ne: device_id } }).lean();
      const userLessons = userDoc ? normalizeLessons(userDoc.lessons) : {};

      const mergedLessons = { ...guestLessons };
      Object.entries(userLessons).forEach(([lid, lp]) => {
        const gl = mergedLessons[lid];
        if (!gl || (lp.points_earned || 0) > (gl.points_earned || 0)) {
          mergedLessons[lid] = lp;
        }
      });

      let totalPoints = 0;
      let completedCount = 0;
      let lessonsTransferred = 0;
      let pointsTransferred = 0;

      Object.values(mergedLessons).forEach((lp) => {
        if (lp.completed) {
          totalPoints += lp.points_earned || 0;
          completedCount += 1;
        }
        lessonsTransferred += 1;
        pointsTransferred += lp.points_earned || 0;
      });

      const stage = computeStage(totalPoints, MAX_LEARN_POINTS);

      // Promote the existing guest doc in place — avoids colliding with the unique device_id index
      const lessonsMap = {};
      Object.entries(mergedLessons).forEach(([lid, lp]) => {
        lessonsMap[`lessons.${lid}`] = lp;
      });

      await this.findOneAndUpdate(
        { device_id },
        {
          $set: {
            user_id,
            learner_type: "user",
            total_points: totalPoints,
            completed_lessons: completedCount,
            current_stage_index: stage.index,
            ...lessonsMap,
          },
        }
      );

      // Clean up the orphaned user doc if one existed on another device
      if (userDoc) {
        await this.deleteOne({ user_id, device_id: { $ne: device_id } });
      }

      return {
        success: true,
        data: {
          lessons_transferred: lessonsTransferred,
          points_transferred: pointsTransferred,
          courses_completed: 0,
        },
        message: "guest progress merged to user",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

const LearnProgressModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("learnprogresses");
  } catch (error) {
    return getModelByTenant(dbTenant, "learnprogress", learnProgressSchema);
  }
};

module.exports = LearnProgressModel;
