//src/auth-service/models/SurveyResponse.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const ObjectId = mongoose.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- survey-responses-model`,
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

// Answer Schema
const AnswerSchema = new Schema(
  {
    questionId: {
      type: String,
      required: [true, "Question ID is required"],
    },
    answer: {
      type: Schema.Types.Mixed,
      required: [true, "Answer value is required"],
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// Location Schema for context data
const LocationSchema = new Schema(
  {
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      min: [-90, "Latitude must be >= -90"],
      max: [90, "Latitude must be <= 90"],
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: [-180, "Longitude must be >= -180"],
      max: [180, "Longitude must be <= 180"],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    accuracy: {
      type: Number,
      min: [0, "Accuracy must be >= 0"],
    },
  },
  { _id: false },
);

// Context Data Schema
const ContextDataSchema = new Schema(
  {
    currentLocation: {
      type: LocationSchema,
      required: false,
    },
    currentAirQuality: {
      type: Number,
      min: [0, "Air quality value must be >= 0"],
    },
    currentAirQualityCategory: {
      type: String,
      trim: true,
    },
    additionalContext: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false },
);

// Main Survey Response Schema
const SurveyResponseSchema = new Schema(
  {
    surveyId: {
      type: ObjectId,
      ref: "survey",
      required: [true, "Survey ID is required"],
    },
    userId: {
      type: ObjectId,
      ref: "user",
      required: [true, "User ID is required"],
    },
    deviceId: {
      type: String,
      trim: true,
      index: true,
    },
    isGuest: {
      type: Boolean,
      default: false,
      index: true,
    },
    answers: {
      type: [AnswerSchema],
      required: [true, "Answers array is required"],
      validate: {
        validator: function (answers) {
          return answers && answers.length > 0;
        },
        message: "Survey response must have at least one answer",
      },
    },
    status: {
      type: String,
      enum: {
        values: ["completed", "skipped", "partial"],
        message: "{VALUE} is not a valid response status",
      },
      default: "completed",
    },
    startedAt: {
      type: Date,
      required: [true, "Start time is required"],
      default: Date.now,
    },
    completedAt: {
      type: Date,
      validate: {
        validator: function (completedAt) {
          return !completedAt || completedAt >= this.startedAt;
        },
        message: "Completion time must be after start time",
      },
    },
    contextData: {
      type: ContextDataSchema,
      required: false,
    },
    timeToComplete: {
      type: Number,
      min: [0, "Time to complete must be >= 0"],
    },
  },
  { timestamps: true },
);

SurveyResponseSchema.pre("save", function (next) {
  // Ensure answer question IDs are unique within the response
  const questionIds = this.answers.map((a) => a.questionId);
  const uniqueQuestionIds = [...new Set(questionIds)];

  if (questionIds.length !== uniqueQuestionIds.length) {
    // Use ValidationError instead of generic Error for proper 400 response
    const err = new Error(
      "Answer question IDs must be unique within a response",
    );
    err.name = "ValidationError";
    err.errors = {
      answers: {
        message: "Answer question IDs must be unique within a response",
        kind: "user defined",
      },
    };
    return next(err);
  }

  // Auto-set completedAt if status is completed and not already set
  if (this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }

  // Auto-calculate timeToComplete if not provided
  if (!this.timeToComplete && this.startedAt && this.completedAt) {
    const startTime = new Date(this.startedAt);
    const completedTime = new Date(this.completedAt);
    this.timeToComplete = Math.floor((completedTime - startTime) / 1000);
  }

  return next();
});

SurveyResponseSchema.pre("update", function (next) {
  return next();
});

// Indexes for performance
SurveyResponseSchema.index({ surveyId: 1, userId: 1 });
SurveyResponseSchema.index({ surveyId: 1, status: 1 });
SurveyResponseSchema.index({ userId: 1, createdAt: -1 });
// Supports filtered list queries sorted by createdAt (e.g. all responses for a
// survey in reverse-chronological order) without a blocking post-join sort.
SurveyResponseSchema.index({ surveyId: 1, createdAt: -1 });
SurveyResponseSchema.index(
  { surveyId: 1, deviceId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      isGuest: true,
      deviceId: { $exists: true, $nin: [null, ""] },
    },
  },
);

SurveyResponseSchema.statics = {
  async register(args, next) {
    try {
      let createBody = args;

      // Remove _id if present
      if (createBody._id) {
        delete createBody._id;
      }

      const data = await this.create({
        ...createBody,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "survey response", {
          message: "survey response created",
        });
      } else {
        return createEmptySuccessResponse(
          "survey response",
          "operation successful but survey response NOT successfully created",
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);

      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;

      // Handle duplicate key errors (including race condition duplicates)
      if (
        err.code === 11000 ||
        (err.name === "MongoServerError" && err.code === 11000)
      ) {
        // Check if it's a duplicate deviceId for guest survey response
        if (
          err.keyPattern &&
          err.keyPattern.deviceId &&
          err.keyPattern.surveyId
        ) {
          return {
            success: false,
            message: "You have already submitted a response to this survey",
            status: httpStatus.CONFLICT,
            errors: {
              message:
                "You have already submitted a response to this survey from this device.",
            },
          };
        }

        // Generic duplicate key error
        response["message"] = "the Survey Response must be unique";
      } else if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else {
        message = "Internal Server Error";
        status = httpStatus.INTERNAL_SERVER_ERROR;
        response = { message: err.message };
      }

      return {
        success: false,
        message,
        status,
        errors: response,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection =
        constants.SURVEY_RESPONSES_INCLUSION_PROJECTION || {
          _id: 1,
          id: 1,
          surveyId: 1,
          userId: 1,
          deviceId: 1,
          isGuest: 1,
          answers: 1,
          status: 1,
          startedAt: 1,
          completedAt: 1,
          contextData: 1,
          timeToComplete: 1,
          createdAt: 1,
          updatedAt: 1,
        };

      const exclusionProjection =
        constants.SURVEY_RESPONSES_EXCLUSION_PROJECTION
          ? constants.SURVEY_RESPONSES_EXCLUSION_PROJECTION(
              filter.category ? filter.category : "none",
            )
          : {};

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        // ── Sort BEFORE the $lookup/$unwind stages ──────────────────────────────
        // createdAt is a root-document field, so the sort can be served from the
        // { surveyId: 1, createdAt: -1 } or { userId: 1, createdAt: -1 } indexes
        // (see schema-level index declarations) without materialising the joined
        // result set first. Moving the sort here avoids an expensive blocking sort
        // over the much-larger post-join documents.
        .sort({ createdAt: -1 })
        .lookup({
          from: "surveys",
          localField: "surveyId",
          foreignField: "_id",
          as: "survey",
        })
        // preserveNullAndEmptyArrays: false — excludes orphaned responses (no
        // matching survey). $unwind with false is equivalent to the previous
        // .match({ survey: { $ne: null } }) but more efficient.
        .unwind({
          path: "$survey",
          preserveNullAndEmptyArrays: false,
        })
        .lookup({
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        })
        // preserveNullAndEmptyArrays: true — keeps guest responses whose sentinel
        // userId (constants.GUEST_USER_ID) has no matching user document. When
        // $unwind finds an empty array with this option it removes the field
        // entirely rather than setting it to null, so the $addFields stage below
        // is required to normalise the missing key to explicit null.
        .unwind({
          path: "$user",
          preserveNullAndEmptyArrays: true,
        })
        // ── Normalise missing user to explicit null ─────────────────────────────
        // After $unwind with preserveNullAndEmptyArrays: true, guest responses
        // whose userId did not resolve to a user document will have NO "user" key
        // on the document at all — not null, not undefined, simply absent. Without
        // this stage, the downstream projection `user: "$user"` silently omits the
        // key, giving the API an inconsistent response shape for guest vs
        // authenticated responses. $ifNull coerces the absent field to null so
        // consumers always receive a "user" key.
        .addFields({
          user: { $ifNull: ["$user", null] },
        })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "survey response", {
        message: "successfully retrieved the survey response details",
        emptyMessage: "no survey responses exist",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "survey response");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      // Validate answer question IDs are unique if answers are being updated
      if (modifiedUpdate.answers) {
        const questionIds = modifiedUpdate.answers.map((a) => a.questionId);
        const uniqueQuestionIds = [...new Set(questionIds)];

        if (questionIds.length !== uniqueQuestionIds.length) {
          // Create a ValidationError to match Mongoose's error structure
          // This will be caught in register() and returned as 409 CONFLICT
          // (see the err.errors catch block around line 203)
          const err = new Error(
            "Answer question IDs must be unique within a response",
          );
          err.name = "ValidationError";
          err.errors = {
            answers: {
              message: "Answer question IDs must be unique within a response",
              kind: "user defined",
            },
          };
          return next(err);
        }
      }

      const updatedSurveyResponse = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options,
      ).exec();

      if (!isEmpty(updatedSurveyResponse)) {
        return createSuccessResponse(
          "update",
          updatedSurveyResponse._doc,
          "survey response",
        );
      } else {
        return createNotFoundResponse(
          "survey response",
          "update",
          "survey response does not exist, please crosscheck",
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);

      let response = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;

      if (error.code === 11000 || error.code === 11001) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        if (error.keyValue) {
          Object.entries(error.keyValue).forEach(([key, value]) => {
            return (response[key] = `the ${key} must be unique`);
          });
        }
      } else if (error.errors) {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        Object.entries(error.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else {
        response = { message: error.message };
      }

      return {
        success: false,
        message,
        status,
        errors: response,
      };
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: { _id: 1, id: 1, surveyId: 1, userId: 1, status: 1 },
      };

      const removedSurveyResponse = await this.findOneAndRemove(
        filter,
        options,
      ).exec();

      if (!isEmpty(removedSurveyResponse)) {
        return createSuccessResponse(
          "delete",
          removedSurveyResponse._doc,
          "survey response",
        );
      } else {
        return createNotFoundResponse(
          "survey response",
          "delete",
          "survey response does not exist, please crosscheck",
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "survey response");
    }
  },
};

SurveyResponseSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      surveyId: this.surveyId,
      userId: this.userId,
      deviceId: this.deviceId,
      isGuest: this.isGuest,
      answers: this.answers,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      contextData: this.contextData,
      timeToComplete: this.timeToComplete,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const SurveyResponseModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let surveyResponses = mongoose.model("surveyresponses");
    return surveyResponses;
  } catch (error) {
    let surveyResponses = getModelByTenant(
      dbTenant,
      "surveyresponse",
      SurveyResponseSchema,
    );
    return surveyResponses;
  }
};

module.exports = SurveyResponseModel;
