//src/auth-service/models/Survey.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- surveys-model`);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

// Question Schema
const QuestionSchema = new Schema(
  {
    id: {
      type: String,
      required: [true, "Question id is required"],
    },
    question: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Question type is required"],
      enum: {
        values: ["multipleChoice", "rating", "text", "yesNo", "scale"],
        message: "{VALUE} is not a valid question type",
      },
    },
    options: [
      {
        type: String,
        trim: true,
      },
    ],
    minValue: {
      type: Number,
      min: 0,
    },
    maxValue: {
      type: Number,
      min: 1,
    },
    placeholder: {
      type: String,
      trim: true,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

// Trigger Schema
const TriggerSchema = new Schema(
  {
    type: {
      type: String,
      required: [true, "Trigger type is required"],
      enum: {
        values: [
          "locationBased",
          "timeBased",
          "airQualityThreshold",
          "manual",
          "postExposure",
        ],
        message: "{VALUE} is not a valid trigger type",
      },
    },
    conditions: {
      type: Schema.Types.Mixed,
      required: [true, "Trigger conditions are required"],
    },
  },
  { _id: false }
);

// Main Survey Schema
const SurveySchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Survey title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    questions: {
      type: [QuestionSchema],
      required: [true, "Survey must have at least one question"],
      validate: {
        validator: function (questions) {
          return questions && questions.length > 0;
        },
        message: "Survey must have at least one question",
      },
    },
    trigger: {
      type: TriggerSchema,
      required: [true, "Survey trigger is required"],
    },
    timeToComplete: {
      type: Number,
      min: [1, "Time to complete must be at least 1 second"],
      default: 180, // 3 minutes default
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      validate: {
        validator: function (date) {
          return !date || date > new Date();
        },
        message: "Expiration date must be in the future",
      },
    },
  },
  { timestamps: true }
);

// Validate question type-specific fields
QuestionSchema.pre("validate", function (next) {
  if (this.type === "multipleChoice") {
    if (!this.options || this.options.length === 0) {
      return next(new Error("Multiple choice questions must have options"));
    }
  }

  if (this.type === "rating" || this.type === "scale") {
    if (!this.maxValue || this.maxValue < 1) {
      return next(new Error("Rating/scale questions must have maxValue >= 1"));
    }
    if (this.minValue !== undefined && this.minValue >= this.maxValue) {
      return next(new Error("minValue must be less than maxValue"));
    }
  }

  next();
});

// Validate trigger type-specific conditions
TriggerSchema.pre("validate", function (next) {
  if (this.type === "locationBased") {
    const { latitude, longitude, radius } = this.conditions;
    if (
      latitude === undefined ||
      longitude === undefined ||
      radius === undefined
    ) {
      return next(
        new Error(
          "Location-based triggers require latitude, longitude, and radius"
        )
      );
    }
  }

  if (this.type === "airQualityThreshold") {
    const { threshold } = this.conditions;
    if (threshold === undefined || threshold < 0) {
      return next(
        new Error(
          "Air quality threshold triggers require a valid threshold value"
        )
      );
    }
  }

  next();
});

SurveySchema.pre("save", function (next) {
  // Ensure question IDs are unique within the survey
  const questionIds = this.questions.map((q) => q.id);
  const uniqueQuestionIds = [...new Set(questionIds)];

  if (questionIds.length !== uniqueQuestionIds.length) {
    return next(new Error("Question IDs must be unique within a survey"));
  }

  // Validate expiration date
  if (this.expiresAt && this.expiresAt <= new Date()) {
    return next(new Error("Expiration date must be in the future"));
  }

  return next();
});

SurveySchema.pre("update", function (next) {
  return next();
});

SurveySchema.statics = {
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
        return createSuccessResponse("create", data, "survey", {
          message: "survey created",
        });
      } else {
        return createEmptySuccessResponse(
          "survey",
          "operation successful but survey NOT successfully created"
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
        response["message"] = "the Survey must be unique";
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
      const inclusionProjection = constants.SURVEYS_INCLUSION_PROJECTION || {
        _id: 1,
        title: 1,
        description: 1,
        questions: 1,
        trigger: 1,
        timeToComplete: 1,
        isActive: 1,
        expiresAt: 1,
        createdAt: 1,
        updatedAt: 1,
      };

      const exclusionProjection = constants.SURVEYS_EXCLUSION_PROJECTION
        ? constants.SURVEYS_EXCLUSION_PROJECTION(
            filter.category ? filter.category : "none"
          )
        : {};

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "survey", {
        message: "successfully retrieved the survey details",
        emptyMessage: "no surveys exist",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "survey");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      // Validate question IDs are unique if questions are being updated
      if (modifiedUpdate.questions) {
        const questionIds = modifiedUpdate.questions.map((q) => q.id);
        const uniqueQuestionIds = [...new Set(questionIds)];

        if (questionIds.length !== uniqueQuestionIds.length) {
          return {
            success: false,
            message: "Question IDs must be unique within a survey",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "Question IDs must be unique within a survey" },
          };
        }
      }

      const updatedSurvey = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedSurvey)) {
        return createSuccessResponse("update", updatedSurvey._doc, "survey");
      } else {
        return createNotFoundResponse(
          "survey",
          "update",
          "survey does not exist, please crosscheck"
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
        projection: { _id: 1, title: 1, isActive: 1 },
      };

      const removedSurvey = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedSurvey)) {
        return createSuccessResponse("delete", removedSurvey._doc, "survey");
      } else {
        return createNotFoundResponse(
          "survey",
          "delete",
          "survey does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "survey");
    }
  },
};

SurveySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      title: this.title,
      description: this.description,
      questions: this.questions,
      trigger: this.trigger,
      timeToComplete: this.timeToComplete,
      isActive: this.isActive,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const SurveyModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let surveys = mongoose.model("surveys");
    return surveys;
  } catch (error) {
    let surveys = getModelByTenant(dbTenant, "survey", SurveySchema);
    return surveys;
  }
};

module.exports = SurveyModel;
