//src/auth-service/utils/survey.util.js
const SurveyModel = require("@models/Survey");
const SurveyResponseModel = require("@models/SurveyResponse");
const UserModel = require("@models/User");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { logObject, logText, HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;
const { GUEST_USER_ID } = constants;

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- survey-util`);

const survey = {
  createSurvey: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      let modifiedBody = Object.assign({}, body);

      // Generate ObjectId for questions if not provided
      if (modifiedBody.questions && modifiedBody.questions.length > 0) {
        modifiedBody.questions = modifiedBody.questions.map((question) => ({
          ...question,
          id: question.id || new ObjectId().toString(),
        }));
      }

      const responseFromCreateSurvey = await SurveyModel(
        tenant.toLowerCase(),
      ).register(modifiedBody, next);

      return responseFromCreateSurvey;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  updateSurvey: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.surveys(request, next);
      let update = Object.assign({}, body);

      // Ensure questions have IDs
      if (update.questions && update.questions.length > 0) {
        update.questions = update.questions.map((question) => ({
          ...question,
          id: question.id || new ObjectId().toString(),
        }));
      }

      const responseFromUpdateSurvey = await SurveyModel(
        tenant.toLowerCase(),
      ).modify({ filter, update }, next);

      return responseFromUpdateSurvey;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  deleteSurvey: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.surveys(request, next);
      const responseFromDeleteSurvey = await SurveyModel(
        tenant.toLowerCase(),
      ).remove({ filter }, next);
      return responseFromDeleteSurvey;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  listSurvey: async (request, next) => {
    try {
      const { tenant, limit, skip, isActive } = { ...request.query };
      const filter = generateFilter.surveys(request, next);

      // Add isActive filter by default to only show active surveys
      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
      } else {
        filter.isActive = true; // Default to only active surveys
      }

      // Add expiresAt filter to exclude expired surveys
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ];

      // CRITICAL: Warn about potentially dangerous operations
      if (Object.keys(filter).length === 0 && !request.allowBulkOperations) {
        logger.warn("Potentially unintended bulk operation detected", {
          endpoint: request.route?.path,
          query: request.query,
          params: request.params,
        });
      }

      const responseFromListSurvey = await SurveyModel(
        tenant.toLowerCase(),
      ).list({ skip, limit, filter }, next);
      return responseFromListSurvey;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  getSurveyById: async (request, next) => {
    try {
      const { survey_id } = request.params;
      const { tenant } = request.query;

      if (!survey_id) {
        return {
          success: false,
          message: "survey_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "survey_id parameter is required" },
        };
      }

      let validObjectId;
      try {
        validObjectId = ObjectId(survey_id);
      } catch (error) {
        return {
          success: false,
          message: "Invalid survey_id format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "survey_id must be a valid ObjectId" },
        };
      }

      const filter = { _id: validObjectId, isActive: true };
      const responseFromListSurvey = await SurveyModel(
        tenant.toLowerCase(),
      ).list({ skip: 0, limit: 1, filter }, next);

      if (responseFromListSurvey.success === true) {
        if (
          !responseFromListSurvey.data ||
          responseFromListSurvey.data.length === 0
        ) {
          return {
            success: false,
            message: "Survey not found",
            status: httpStatus.NOT_FOUND,
            errors: { message: `Survey with ID ${survey_id} not found` },
          };
        }

        return {
          success: true,
          message: "successfully retrieved the survey details",
          status: httpStatus.OK,
          data: responseFromListSurvey.data,
        };
      } else {
        return responseFromListSurvey;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in getSurveyById: ${error.message}`,
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  createSurveyResponse: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;

      // Early validation: Check for duplicate question IDs BEFORE any DB operations
      if (body.answers && Array.isArray(body.answers)) {
        const questionIds = body.answers.map((a) => a.questionId);
        const uniqueQuestionIds = [...new Set(questionIds)];

        if (questionIds.length !== uniqueQuestionIds.length) {
          return {
            success: false,
            message: "validation errors for some of the provided fields",
            status: httpStatus.BAD_REQUEST,
            errors: {
              answers: "Answer question IDs must be unique within a response",
            },
          };
        }
      }

      // Validate that survey exists and is active
      const surveyExists = await SurveyModel(tenant).exists({
        _id: body.surveyId,
        isActive: true,
      });

      if (!surveyExists) {
        return {
          success: false,
          message: `Survey with ID ${body.surveyId} not found or inactive`,
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Survey with ID ${body.surveyId} not found or inactive`,
          },
        };
      }

      // Check if this is a guest user
      const isGuestUser = body.userId === "guest";

      // Validate that user exists (skip for guest users)
      if (!isGuestUser) {
        const userExists = await UserModel(tenant).exists({ _id: body.userId });
        if (!userExists) {
          return {
            success: false,
            message: `User ${body.userId} does not exist`,
            status: httpStatus.BAD_REQUEST,
            errors: { message: `User ${body.userId} does not exist` },
          };
        }
      }

      let modifiedBody = Object.assign({}, body);

      // Assign sentinel guest user ID for all guest users
      // This ensures consistent guest user tracking and prevents $lookup failures
      if (isGuestUser) {
        modifiedBody.userId = GUEST_USER_ID;
      }

      // Set default status if not provided
      if (!modifiedBody.status) {
        modifiedBody.status = "completed";
      }

      // Set timestamps if not provided
      const now = new Date();
      if (!modifiedBody.startedAt) {
        modifiedBody.startedAt = now;
      }
      if (!modifiedBody.completedAt && modifiedBody.status === "completed") {
        modifiedBody.completedAt = now;
      }

      // Calculate timeToComplete if not provided
      if (
        !modifiedBody.timeToComplete &&
        modifiedBody.startedAt &&
        modifiedBody.completedAt
      ) {
        const startTime = new Date(modifiedBody.startedAt);
        const completedTime = new Date(modifiedBody.completedAt);
        modifiedBody.timeToComplete = Math.floor(
          (completedTime - startTime) / 1000,
        );
      }

      const responseFromCreateSurveyResponse = await SurveyResponseModel(
        tenant.toLowerCase(),
      ).register(modifiedBody, next);

      return responseFromCreateSurveyResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  listSurveyResponses: async (request, next) => {
    try {
      const { tenant, limit, skip, surveyId, userId } = { ...request.query };
      let filter = {};

      // Filter by surveyId if provided
      if (surveyId) {
        try {
          filter.surveyId = ObjectId(surveyId);
        } catch (error) {
          return {
            success: false,
            message: "Invalid surveyId format",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "surveyId must be a valid ObjectId" },
          };
        }
      }

      // Filter by userId if provided (or from authenticated user)
      if (userId) {
        try {
          filter.userId = ObjectId(userId);
        } catch (error) {
          return {
            success: false,
            message: "Invalid userId format",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "userId must be a valid ObjectId" },
          };
        }
      }

      const responseFromListSurveyResponse = await SurveyResponseModel(
        tenant.toLowerCase(),
      ).list({ skip, limit, filter }, next);
      return responseFromListSurveyResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  getSurveyStats: async (request, next) => {
    try {
      const { survey_id } = request.params;
      const { tenant } = request.query;

      if (!survey_id) {
        return {
          success: false,
          message: "survey_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "survey_id parameter is required" },
        };
      }

      let validObjectId;
      try {
        validObjectId = ObjectId(survey_id);
      } catch (error) {
        return {
          success: false,
          message: "Invalid survey_id format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "survey_id must be a valid ObjectId" },
        };
      }

      // Check if survey exists
      const surveyExists = await SurveyModel(tenant).exists({
        _id: validObjectId,
      });
      if (!surveyExists) {
        return {
          success: false,
          message: "Survey not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Survey with ID ${survey_id} not found` },
        };
      }

      // Get survey responses statistics
      const stats = await SurveyResponseModel(tenant).aggregate([
        { $match: { surveyId: validObjectId } },
        {
          $group: {
            _id: null,
            totalResponses: { $sum: 1 },
            completedResponses: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            skippedResponses: {
              $sum: { $cond: [{ $eq: ["$status", "skipped"] }, 1, 0] },
            },
            averageCompletionTime: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$timeToComplete", null] },
                      { $gt: ["$timeToComplete", 0] },
                    ],
                  },
                  "$timeToComplete",
                  null,
                ],
              },
            },
          },
        },
      ]);

      const baseStats = stats[0] || {
        totalResponses: 0,
        completedResponses: 0,
        skippedResponses: 0,
        averageCompletionTime: 0,
      };

      // Calculate completion rate
      const completionRate =
        baseStats.totalResponses > 0
          ? (baseStats.completedResponses / baseStats.totalResponses) * 100
          : 0;

      // Get answer distribution for each question
      const answerDistribution = await SurveyResponseModel(tenant).aggregate([
        { $match: { surveyId: validObjectId, status: "completed" } },
        { $unwind: "$answers" },
        {
          $group: {
            _id: {
              questionId: "$answers.questionId",
              answer: "$answers.answer",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.questionId",
            answers: {
              $push: {
                answer: "$_id.answer",
                count: "$count",
              },
            },
          },
        },
      ]);

      // Format answer distribution
      const formattedAnswerDistribution = {};
      answerDistribution.forEach((question) => {
        formattedAnswerDistribution[question._id] = {};
        question.answers.forEach((answer) => {
          formattedAnswerDistribution[question._id][answer.answer] =
            answer.count;
        });
      });

      const result = {
        surveyId: survey_id,
        totalResponses: baseStats.totalResponses,
        completedResponses: baseStats.completedResponses,
        skippedResponses: baseStats.skippedResponses,
        averageCompletionTime: Math.round(baseStats.averageCompletionTime || 0),
        completionRate: Math.round(completionRate * 100) / 100,
        answerDistribution: formattedAnswerDistribution,
      };

      return {
        success: true,
        message: "Successfully retrieved survey statistics",
        status: httpStatus.OK,
        data: result,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in getSurveyStats: ${error.message}`,
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },
};

module.exports = survey;
