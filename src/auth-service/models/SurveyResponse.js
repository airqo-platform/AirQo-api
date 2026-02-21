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

      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else if (err.code === 11000) {
        response["message"] = "the Survey Response must be unique";
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
        .lookup({
          from: "surveys",
          localField: "surveyId",
          foreignField: "_id",
          as: "survey",
        })
        .lookup({
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        })
        .addFields({
          // Defensive: handle both array and non-array cases
          survey: {
            $cond: {
              if: { $isArray: "$survey" },
              then: { $arrayElemAt: ["$survey", 0] },
              else: null,
            },
          },
          user: {
            $cond: {
              if: { $isArray: "$user" },
              then: { $arrayElemAt: ["$user", 0] },
              else: null,
            },
          },
        })
        .sort({ createdAt: -1 })
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
          return {
            success: false,
            message: "Answer question IDs must be unique within a response",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "Answer question IDs must be unique within a response",
            },
          };
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
