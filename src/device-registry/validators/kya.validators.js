// kya.validators.js
const {
  oneOf,
  query,
  body,
  param,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("the tenant cannot be empty, if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
    return (req, res, next) => {
      let limit = parseInt(req.query.limit, 10);
      const skip = parseInt(req.query.skip, 10);
      if (Number.isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }
      if (limit > maxLimit) {
        limit = maxLimit;
      }
      if (Number.isNaN(skip) || skip < 0) {
        req.query.skip = 0;
      }
      req.query.limit = limit;
      req.query.skip = skip;

      next();
    };
  },

  language: [
    query("language")
      .optional()
      .notEmpty()
      .withMessage("the language cannot be empty when provided")
      .bail()
      .trim(),
  ],

  userIdParam: [
    param("user_id")
      .exists()
      .withMessage("the user_id is missing in the request")
      .bail()
      .trim(),
  ],

  completionMessage: [
    body("completion_message")
      .exists()
      .withMessage("the completion_message is missing in request")
      .bail()
      .notEmpty()
      .withMessage("the completion_message should not be empty")
      .trim(),
  ],

  title: [
    body("title")
      .exists()
      .withMessage("the title is missing in request")
      .bail()
      .notEmpty()
      .withMessage("the title should not be empty")
      .trim(),
  ],

  titleOptional: [
    body("title")
      .optional()
      .notEmpty()
      .withMessage("the title is missing in request")
      .bail()
      .trim(),
  ],

  image: [
    body("image")
      .exists()
      .withMessage("the image is missing in request")
      .bail()
      .isURL()
      .withMessage("the image url is not a valid URL")
      .trim(),
  ],

  imageOptional: [
    body("image")
      .optional()
      .notEmpty()
      .withMessage("the image is missing in request")
      .bail()
      .isURL()
      .withMessage("the image url is not a valid URL")
      .trim(),
  ],

  lessonIdParam: [
    param("lesson_id")
      .exists()
      .withMessage("the lesson_id should exist")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("lesson_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  notEmptyBody: [
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("The request body should not be empty."),
  ],

  completionMessageOptional: [
    body("completion_message")
      .optional()
      .notEmpty()
      .withMessage("the completion_message is missing in request")
      .bail()
      .trim(),
  ],

  validObjectId: (field, location = query) => {
    return location(field)
      .optional()
      .notEmpty()
      .withMessage("this identifier cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      });
  },
  taskIdParam: [
    param("task_id")
      .exists()
      .withMessage("the task_id should exist")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("task_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  content: [
    body("content")
      .exists()
      .withMessage("the content is missing in request")
      .bail()
      .notEmpty()
      .withMessage("the content should not be empty")
      .trim(),
  ],
  contentOptional: [
    body("content")
      .optional()
      .notEmpty()
      .withMessage("the content should not be empty IF provided")
      .bail()
      .trim(),
  ],

  taskPosition: [
    body("task_position")
      .exists()
      .withMessage("the task_position is missing in request")
      .bail()
      .isNumeric()
      .withMessage("the task_position should be a number")
      .trim(),
  ],
  taskPositionOptional: [
    body("task_position")
      .optional()
      .isNumeric()
      .withMessage("the task_position should be a number")
      .trim(),
  ],

  progressIdParam: [
    param("progress_id")
      .exists()
      .withMessage("the progress_id should exist")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("progress_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  userIdBody: [
    body("user_id")
      .exists()
      .withMessage("the user_id is missing in request")
      .bail()
      .trim(),
  ],

  lessonIdBody: [
    body("lesson_id")
      .exists()
      .withMessage("the lesson_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("lesson_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  completed: [
    body("completed")
      .optional()
      .notEmpty()
      .withMessage("the lesson_id should not be empty IF provided")
      .bail()
      .trim()
      .isBoolean()
      .withMessage("the completed should be boolean"),
  ],

  activeTask: [
    body("active_task")
      .exists()
      .withMessage("the progress is missing in request")
      .bail()
      .trim(),
  ],

  status: [
    body("status")
      .exists()
      .withMessage("the status is missing in request")
      .bail()
      .isIn(["TODO", "IN_PROGRESS", "PENDING_COMPLETION", "COMPLETE"])
      .withMessage(
        "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE",
      )
      .bail()
      .trim(),
  ],

  kyaUserProgress: [
    body("kya_user_progress")
      .exists()
      .withMessage("the kya_user_progress is missing in the request body")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage(
        "Invalid request body format. The kya_user_progress should be an array",
      ),
    body("kya_user_progress.*")
      .optional()
      .isObject()
      .withMessage("Each kya user progress should be an object"),
    body("kya_user_progress.*.active_task")
      .exists()
      .withMessage("active_task is missing in the kya user progress object")
      .bail()
      .notEmpty()
      .withMessage("the active_task must not be empty")
      .bail()
      .trim(),
    body("kya_user_progress.*.status")
      .exists()
      .withMessage("status is missing in the kya user progress object")
      .bail()
      .isIn(["TODO", "IN_PROGRESS", "PENDING_COMPLETION", "COMPLETE"])
      .withMessage(
        "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE",
      )
      .bail()
      .trim(),

    body("kya_user_progress.*._id")
      .exists()
      .withMessage("the lesson_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("lesson_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  description: [
    body("description")
      .exists()
      .withMessage("the description is missing in request")
      .bail()
      .notEmpty()
      .withMessage("the description should not be empty")
      .trim(),
  ],

  descriptionOptional: [
    body("description")
      .optional()
      .notEmpty()
      .withMessage("the description is missing in request")
      .bail()
      .trim(),
  ],

  quizIdParam: [
    param("quiz_id")
      .exists()
      .withMessage("the quiz_id should exist")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("quiz_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  context: [
    body("context")
      .exists()
      .withMessage("the context is missing in request")
      .bail()
      .notEmpty()
      .withMessage("the context should not be empty")
      .trim(),
  ],

  contextOptional: [
    body("context")
      .optional()
      .notEmpty()
      .withMessage("the context should not be empty")
      .trim(),
  ],

  questionPosition: [
    body("question_position")
      .exists()
      .withMessage("the question_position is missing in request")
      .bail()
      .isNumeric()
      .withMessage("the question_position should be a number")
      .trim(),
  ],

  questionPositionOptional: [
    body("question_position")
      .optional()
      .isNumeric()
      .withMessage("the question_position should be a number")
      .trim(),
  ],

  questionIdParam: [
    param("question_id")
      .exists()
      .withMessage("the question_id should exist")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("question_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  answerTitle: [
    body("title")
      .exists()
      .withMessage("the title is missing in request")
      .bail()
      .notEmpty()
      .withMessage("the title should not be empty")
      .trim(),
  ],

  answerTitleOptional: [
    body("title")
      .optional()
      .notEmpty()
      .withMessage("the title should not be empty IF provided")
      .bail()
      .trim(),
  ],

  answerContent: [
    body("content")
      .isArray()
      .withMessage("content should be an array")
      .bail()
      .custom((value) => {
        for (const sentence of value) {
          if (typeof sentence !== "string") {
            throw new Error("Each element in content should be a string");
          }
        }
        return true;
      }),
  ],

  answerIdParam: [
    param("answer_id")
      .exists()
      .withMessage("the answer_id should exist")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("answer_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  taskIds: [
    body("task_ids")
      .exists()
      .withMessage("the task_ids should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the task_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the task_ids should not be empty"),
    body("task_ids.*")
      .isMongoId()
      .withMessage("task_id provided must be an object ID"),
  ],
  questionIds: [
    body("question_ids")
      .exists()
      .withMessage("the question_ids should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the question_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the question_ids should not be empty"),
    body("question_ids.*")
      .isMongoId()
      .withMessage("question_id provided must be an object ID"),
  ],

  answerIds: [
    body("answer_ids")
      .exists()
      .withMessage("the answer_ids should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the answer_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the answer_ids should not be empty"),
    body("answer_ids.*")
      .isMongoId()
      .withMessage("answer_id provided must be an object ID"),
  ],

  kyaQuizUserProgress: [
    body("kya_quiz_user_progress")
      .exists()
      .withMessage("the kya_quiz_user_progress is missing in the request body")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage(
        "Invalid request body format. The kya_quiz_user_progress should be an array",
      ),
    body("kya_quiz_user_progress.*")
      .optional()
      .isObject()
      .withMessage("Each kya quiz user progress should be an object"),
    body("kya_quiz_user_progress.*.active_question")
      .exists()
      .withMessage(
        "active_question is missing in the kya quiz user progress object",
      )
      .bail()
      .notEmpty()
      .withMessage("the active_question must not be empty")
      .bail()
      .trim(),
    body("kya_quiz_user_progress.*.status")
      .exists()
      .withMessage("status is missing in the kya user progress object")
      .bail()
      .isIn(["TODO", "IN_PROGRESS", "PENDING_COMPLETION", "COMPLETE"])
      .withMessage(
        "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE",
      )
      .bail()
      .trim(),

    body("kya_quiz_user_progress.*._id")
      .exists()
      .withMessage("the quiz_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("quiz_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  activeQuestion: [
    body("active_question")
      .exists()
      .withMessage("the active_question is missing in request")
      .bail()
      .trim(),
  ],

  quizIdBody: [
    body("quiz_id")
      .exists()
      .withMessage("the quiz_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("quiz_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
};

const kyaValidations = {
  listLessons: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    ...commonValidations.language,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  listLessonsByUserId: [
    ...commonValidations.tenant,
    ...commonValidations.language,
    ...commonValidations.userIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  createLesson: [
    ...commonValidations.tenant,
    ...commonValidations.completionMessage,
    ...commonValidations.title,
    ...commonValidations.image,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  updateLesson: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    ...commonValidations.notEmptyBody,
    ...commonValidations.titleOptional,
    ...commonValidations.imageOptional,
    ...commonValidations.completionMessageOptional,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  deleteLesson: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  getLesson: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  listAssignedTasks: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  listAvailableTasks: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  listUserLessonProgress: [
    ...commonValidations.tenant,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  getUserLessonProgress: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    ...commonValidations.userIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  deleteUserLessonProgress: [
    ...commonValidations.tenant,
    ...commonValidations.progressIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  updateUserLessonProgress: [
    ...commonValidations.notEmptyBody,
    ...commonValidations.tenant,
    ...commonValidations.progressIdParam,
    ...commonValidations.userIdBody,
    ...commonValidations.lessonIdBody,
    ...commonValidations.completed,
    ...commonValidations.activeTask,
    ...commonValidations.status,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  createUserLessonProgress: [
    ...commonValidations.tenant,
    ...commonValidations.userIdBody,
    ...commonValidations.lessonIdBody,
    ...commonValidations.completed,
    ...commonValidations.activeTask,
    ...commonValidations.status,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  syncUserLessonProgress: [
    ...commonValidations.notEmptyBody,
    ...commonValidations.tenant,
    ...commonValidations.userIdParam,
    ...commonValidations.kyaUserProgress,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  listTasks: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  getTask: [
    ...commonValidations.tenant,
    ...commonValidations.taskIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  createTask: [
    ...commonValidations.tenant,
    ...commonValidations.content,
    ...commonValidations.title,
    ...commonValidations.image,
    ...commonValidations.taskPosition,
    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  updateTask: [
    ...commonValidations.notEmptyBody,
    ...commonValidations.tenant,
    ...commonValidations.taskIdParam,
    ...commonValidations.contentOptional,
    ...commonValidations.titleOptional,
    ...commonValidations.imageOptional,
    ...commonValidations.taskPositionOptional,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  deleteTask: [
    ...commonValidations.tenant,
    ...commonValidations.taskIdParam,

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  assignManyTasksToLesson: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    ...commonValidations.taskIds,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  assignTaskToLesson: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    ...commonValidations.taskIdParam,

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  removeTaskFromLesson: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    ...commonValidations.taskIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  removeManyTasksFromLesson: [
    ...commonValidations.tenant,
    ...commonValidations.lessonIdParam,
    ...commonValidations.taskIds,

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  listQuestions: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  listAnswers: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  listUserQuizProgress: [
    ...commonValidations.tenant,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  listQuizzes: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    ...commonValidations.language,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  listQuizzesByUserId: [
    ...commonValidations.tenant,
    ...commonValidations.language,
    ...commonValidations.userIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  createQuiz: [
    ...commonValidations.tenant,
    ...commonValidations.completionMessage,
    ...commonValidations.title,
    ...commonValidations.image,
    ...commonValidations.description,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  updateQuiz: [
    ...commonValidations.tenant,
    ...commonValidations.quizIdParam,
    ...commonValidations.notEmptyBody,
    ...commonValidations.titleOptional,
    ...commonValidations.imageOptional,
    ...commonValidations.completionMessageOptional,
    ...commonValidations.descriptionOptional,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  deleteQuiz: [
    ...commonValidations.tenant,
    ...commonValidations.quizIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  getQuiz: [
    ...commonValidations.tenant,
    ...commonValidations.quizIdParam,

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  deleteUserQuizProgress: [
    ...commonValidations.tenant,
    ...commonValidations.progressIdParam,
    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  updateUserQuizProgress: [
    ...commonValidations.notEmptyBody,
    ...commonValidations.tenant,
    ...commonValidations.progressIdParam,
    ...commonValidations.userIdBody,
    ...commonValidations.quizIdBody,
    ...commonValidations.activeQuestion,
    ...commonValidations.status,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  createUserQuizProgress: [
    ...commonValidations.tenant,
    ...commonValidations.userIdBody,
    ...commonValidations.quizIdBody,
    ...commonValidations.activeQuestion,
    ...commonValidations.status,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  syncUserQuizProgress: [
    ...commonValidations.notEmptyBody,
    ...commonValidations.tenant,
    ...commonValidations.userIdParam,
    ...commonValidations.kyaQuizUserProgress,
    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  createQuestion: [
    ...commonValidations.tenant,
    ...commonValidations.title,
    ...commonValidations.context,
    ...commonValidations.questionPosition,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  updateQuestion: [
    ...commonValidations.notEmptyBody,
    ...commonValidations.tenant,
    ...commonValidations.questionIdParam,
    ...commonValidations.titleOptional,
    ...commonValidations.contextOptional,
    ...commonValidations.questionPositionOptional,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  deleteQuestion: [
    ...commonValidations.tenant,
    ...commonValidations.questionIdParam,
    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  getQuestion: [
    ...commonValidations.tenant,
    ...commonValidations.questionIdParam,

    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  createAnswer: [
    ...commonValidations.tenant,
    ...commonValidations.answerTitle,
    ...commonValidations.answerContent,

    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  updateAnswer: [
    ...commonValidations.notEmptyBody,
    ...commonValidations.tenant,
    ...commonValidations.answerIdParam,
    ...commonValidations.answerTitleOptional,
    body("content")
      .isArray()
      .withMessage("content should be an array")
      .bail()
      .custom((value) => {
        if (!Array.isArray(value)) {
          throw new Error("content should be an array");
        }
        for (const sentence of value) {
          if (typeof sentence !== "string") {
            throw new Error("Each element in content should be a string");
          }
        }
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  deleteAnswer: [
    ...commonValidations.tenant,
    ...commonValidations.answerIdParam,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  getAnswer: [
    ...commonValidations.tenant,
    ...commonValidations.answerIdParam,
    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],

  assignManyQuestionsToQuiz: [
    ...commonValidations.tenant,
    ...commonValidations.quizIdParam,
    ...commonValidations.questionIds,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  removeManyQuestionsFromQuiz: [
    ...commonValidations.tenant,
    ...commonValidations.quizIdParam,
    ...commonValidations.questionIds,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  assignManyAnswersToQuestion: [
    ...commonValidations.tenant,
    ...commonValidations.questionIdParam,
    ...commonValidations.answerIds,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  removeManyAnswersFromQuestion: [
    ...commonValidations.tenant,
    ...commonValidations.questionIdParam,
    ...commonValidations.answerIds,

    (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
};

module.exports = {
  ...kyaValidations,
  pagination: commonValidations.pagination,
};
