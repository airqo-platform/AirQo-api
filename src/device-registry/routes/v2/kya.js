const express = require("express");
const router = express.Router();
const knowYourAirController = require("@controllers/create-know-your-air");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const NetworkModel = require("@models/Network");

const validNetworks = async () => {
  const networks = await NetworkModel("airqo").distinct("name");
  return networks.map((network) => network.toLowerCase());
};

const validateNetwork = async (value) => {
  const networks = await validNetworks();
  if (!networks.includes(value.toLowerCase())) {
    throw new Error("Invalid network");
  }
};

const validatePagination = (req, res, next) => {
  let limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 1000;
  }
  if (limit > 2000) {
    limit = 2000;
  }
  if (isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  req.query.limit = limit;

  next();
};

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(validatePagination);

/******************* lessons *********************************************/
router.get(
  "/lessons",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("this tip identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
      query("language")
        .optional()
        .notEmpty()
        .withMessage("the language cannot be empty when provided")
        .bail()
        .trim(),
    ],
  ]),
  knowYourAirController.listLessons
);

router.get(
  "/lessons/users/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("language")
        .optional()
        .notEmpty()
        .withMessage("the language cannot be empty when provided")
        .bail()
        .trim(),
    ],
  ]),

  oneOf([
    [
      param("user_id")
        .exists()
        .withMessage("the user_id is missing in the request")
        .bail()
        .trim(),
    ],
  ]),

  knowYourAirController.listLessons
);

router.post(
  "/lessons",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("completion_message")
        .exists()
        .withMessage("the completion_message is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the completion_message should not be empty")
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the title should not be empty")
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .isURL()
        .withMessage("the image url is not a valid URL")
        .trim(),
    ],
  ]),
  knowYourAirController.createLesson
);
router.put(
  "/lessons/:lesson_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("The request body should not be empty."),
  ]),
  oneOf([
    [
      body("title")
        .optional()
        .notEmpty()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .optional()
        .notEmpty()
        .withMessage("the image is missing in request")
        .bail()
        .isURL()
        .withMessage("the image url is not a valid URL")
        .trim(),
      body("completion_message")
        .optional()
        .notEmpty()
        .withMessage("the completion_message is missing in request")
        .bail()
        .trim(),
    ],
  ]),
  knowYourAirController.updateLesson
);
router.delete(
  "/lessons/:lesson_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("lesson_id")
        .exists()
        .withMessage("the lesson_id should exist")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the lesson_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  knowYourAirController.deleteLesson
);
router.get(
  "/lessons/:lesson_id/assigned-tasks",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.listAssignedTasks
);
router.get(
  "/lessons/:lesson_id/available-tasks",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("this tip identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  knowYourAirController.listAvailableTasks
);
router.get(
  "/lessons/:lesson_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.listLessons
);

/************* tracking user progress ******************************/
router.get(
  "/progress/:user_id?",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  knowYourAirController.listUserLessonProgress
);
router.get(
  "/progress/lessons/:lesson_id/users/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("lesson_id")
        .exists()
        .withMessage("the lesson_id is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("lesson_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("user_id")
        .exists()
        .withMessage("the user_id is missing in the request")
        .bail()
        .trim(),
    ],
  ]),
  knowYourAirController.listUserLessonProgress
);
router.delete(
  "/progress/:progress_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.deleteUserLessonProgress
);
router.put(
  "/progress/:progress_id",
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    [
      body("user_id")
        .optional()
        .notEmpty()
        .withMessage("the user_id should not be empty IF provided")
        .bail()
        .trim(),
      body("lesson_id")
        .optional()
        .notEmpty()
        .withMessage("the lesson_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("lesson_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("completed")
        .optional()
        .notEmpty()
        .withMessage("completed should not be empty IF provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("the completed should be boolean"),
      body("active_task")
        .exists()
        .withMessage("the progress is missing in request")
        .bail()
        .trim(),
      body("status")
        .exists()
        .withMessage("the status is missing in request")
        .bail()
        .isIn(["TODO", "IN_PROGRESS", "PENDING_COMPLETION", "COMPLETE"])
        .withMessage(
          "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE"
        )
        .bail()
        .trim(),
      ,
    ],
  ]),
  knowYourAirController.updateUserLessonProgress
);
router.post(
  "/progress",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("user_id")
        .exists()
        .withMessage("the user_id is missing in request")
        .bail()
        .trim(),
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
      body("completed")
        .optional()
        .notEmpty()
        .withMessage("the lesson_id should not be empty IF provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("the completed should be boolean"),
      body("active_task")
        .exists()
        .withMessage("the progress is missing in request")
        .bail()
        .trim(),
      body("status")
        .exists()
        .withMessage("the status is missing in request")
        .bail()
        .isIn(["TODO", "IN_PROGRESS", "PENDING_COMPLETION", "COMPLETE"])
        .withMessage(
          "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE"
        )
        .bail()
        .trim(),
    ],
  ]),
  knowYourAirController.createUserLessonProgress
);

router.post(
  "/progress/sync/:user_id",
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("user_id")
        .exists()
        .withMessage("the user_id should exist")
        .bail()
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("kya_user_progress")
        .exists()
        .withMessage("the kya_user_progress is missing in the request body")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage(
          "Invalid request body format. The kya_user_progress should be an array"
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
          "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE"
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
  ]),
  knowYourAirController.syncUserLessonProgress
);

/******************* tasks *********************************************/
router.get(
  "/tasks",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("this tip identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  knowYourAirController.listTask
);
router.post(
  "/tasks",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("content")
        .exists()
        .withMessage("the content is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the content should not be empty")
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the title should not be empty")
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .isURL()
        .withMessage("the image url is not a valid URL")
        .trim(),
      body("task_position")
        .exists()
        .withMessage("the task_position is missing in request")
        .bail()
        .isNumeric()
        .withMessage("the task_position should be a number")
        .trim(),
    ],
  ]),
  knowYourAirController.createTask
);
router.put(
  "/tasks/:task_id",
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),

  oneOf([
    [
      body("content")
        .optional()
        .notEmpty()
        .withMessage("the content should not be empty IF provided")
        .bail()
        .trim(),
      body("title")
        .optional()
        .notEmpty()
        .withMessage("the title should not be empty IF provided")
        .bail()
        .trim(),
      body("image")
        .optional()
        .notEmpty()
        .withMessage("the image should not be empty IF provided")
        .bail()
        .isURL()
        .withMessage("the image url is not a valid URL")
        .trim(),
      body("task_position")
        .optional()
        .isNumeric()
        .withMessage("the task_position should be a number")
        .trim(),
    ],
  ]),
  knowYourAirController.updateTask
);
router.delete(
  "/tasks/:task_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.deleteTask
);
router.get(
  "/tasks/:task_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.listTask
);

/******************* manage lessons *********************************************/
router.post(
  "/lessons/:lesson_id/assign-tasks",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("lesson_id")
        .exists()
        .withMessage("the lesson_id is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the lesson_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
  ]),
  knowYourAirController.assignManyTasksToLesson
);
router.put(
  "/lessons/:lesson_id/assign-task/:task_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.assignTaskToLesson
);
router.delete(
  "/lessons/:lesson_id/unassign-task/:task_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.removeTaskFromLesson
);
router.delete(
  "/lessons/:lesson_id/unassign-many-tasks",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),

  knowYourAirController.removeManyTasksFromLesson
);

/******************* KYA QUIZ *********************************************/

/******************* quizzes *********************************************/
router.get(
  "/quizzes/questions",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("this question identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  knowYourAirController.listQuestions
);

router.get(
  "/quizzes/answers",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("this answer identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  knowYourAirController.listAnswers
);

router.get(
  "/quizzes/progress/:user_id?",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  knowYourAirController.listUserQuizProgress
);

router.get(
  "/quizzes",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("this quiz identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
      query("language")
        .optional()
        .notEmpty()
        .withMessage("the language cannot be empty when provided")
        .bail()
        .trim(),
    ],
  ]),
  knowYourAirController.listQuizzes
);

router.get(
  "/quizzes/users/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("language")
        .optional()
        .notEmpty()
        .withMessage("the language cannot be empty when provided")
        .bail()
        .trim(),
    ],
  ]),

  oneOf([
    [
      param("user_id")
        .exists()
        .withMessage("the user_id is missing in the request")
        .bail()
        .trim(),
    ],
  ]),

  knowYourAirController.listQuizzes
);

router.post(
  "/quizzes",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("completion_message")
        .exists()
        .withMessage("the completion_message is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the completion_message should not be empty")
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the title should not be empty")
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .isURL()
        .withMessage("the image url is not a valid URL")
        .trim(),
      body("description")
        .exists()
        .withMessage("the description is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the description should not be empty")
        .trim(),
    ],
  ]),
  knowYourAirController.createQuiz
);
router.put(
  "/quizzes/:quiz_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("The request body should not be empty."),
  ]),
  oneOf([
    [
      body("title")
        .optional()
        .notEmpty()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .optional()
        .notEmpty()
        .withMessage("the image is missing in request")
        .bail()
        .isURL()
        .withMessage("the image url is not a valid URL")
        .trim(),
      body("completion_message")
        .optional()
        .notEmpty()
        .withMessage("the completion_message is missing in request")
        .bail()
        .trim(),
      body("description")
        .optional()
        .notEmpty()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
    ],
  ]),
  knowYourAirController.updateQuiz
);
router.delete(
  "/quizzes/:quiz_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("quiz_id")
        .exists()
        .withMessage("the quiz_id should exist")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the quiz_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  knowYourAirController.deleteQuiz
);
router.get(
  "/quizzes/:quiz_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.listQuizzes
);

/************* tracking user progress ******************************/

router.delete(
  "/quizzes/progress/:progress_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.deleteUserQuizProgress
);
router.put(
  "/quizzes/progress/:progress_id",
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    [
      body("user_id")
        .optional()
        .notEmpty()
        .withMessage("the user_id should not be empty IF provided")
        .bail()
        .trim(),
      body("quiz_id")
        .optional()
        .notEmpty()
        .withMessage("the quiz_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("quiz_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("active_question")
        .exists()
        .withMessage("the active_question is missing in request")
        .bail()
        .trim(),
      body("status")
        .exists()
        .withMessage("the status is missing in request")
        .bail()
        .isIn(["TODO", "IN_PROGRESS", "PENDING_COMPLETION", "COMPLETE"])
        .withMessage(
          "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE"
        )
        .bail()
        .trim(),
      ,
    ],
  ]),
  knowYourAirController.updateUserQuizProgress
);
router.post(
  "/quizzes/progress",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("user_id")
        .exists()
        .withMessage("the user_id is missing in request")
        .bail()
        .trim(),
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
      body("active_question")
        .exists()
        .withMessage("the active_question is missing in request")
        .bail()
        .trim(),
      body("status")
        .exists()
        .withMessage("the status is missing in request")
        .bail()
        .isIn(["TODO", "IN_PROGRESS", "PENDING_COMPLETION", "COMPLETE"])
        .withMessage(
          "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE"
        )
        .bail()
        .trim(),
    ],
  ]),
  knowYourAirController.createUserQuizProgress
);

router.post(
  "/quizzes/progress/sync/:user_id",
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("user_id")
        .exists()
        .withMessage("the user_id should exist")
        .bail()
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("kya_quiz_user_progress")
        .exists()
        .withMessage(
          "the kya_quiz_user_progress is missing in the request body"
        )
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage(
          "Invalid request body format. The kya_quiz_user_progress should be an array"
        ),
      body("kya_quiz_user_progress.*")
        .optional()
        .isObject()
        .withMessage("Each kya user progress should be an object"),
      body("kya_quiz_user_progress.*.active_question")
        .exists()
        .withMessage(
          "active_question is missing in the kya user progress object"
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
          "the status must be one of the following: TODO, IN_PROGRESS, PENDING_COMPLETION, COMPLETE"
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
  ]),
  knowYourAirController.syncUserQuizProgress
);

/******************* Questions *********************************************/

router.post(
  "/quizzes/questions",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the title should not be empty")
        .trim(),
      body("context")
        .exists()
        .withMessage("the context is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the context should not be empty")
        .trim(),
      body("question_position")
        .exists()
        .withMessage("the question_position is missing in request")
        .bail()
        .isNumeric()
        .withMessage("the question_position should be a number")
        .trim(),
    ],
  ]),
  knowYourAirController.createQuestion
);
router.put(
  "/quizzes/questions/:question_id",
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),

  oneOf([
    [
      body("title")
        .optional()
        .notEmpty()
        .withMessage("the title should not be empty IF provided")
        .bail()
        .trim(),
      body("context")
        .optional()
        .notEmpty()
        .withMessage("the context should not be empty")
        .trim(),
      body("question_position")
        .optional()
        .isNumeric()
        .withMessage("the question_position should be a number")
        .trim(),
    ],
  ]),
  knowYourAirController.updateQuestion
);
router.delete(
  "/quizzes/questions/:question_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.deleteQuestion
);
router.get(
  "/quizzes/questions/:question_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.listQuestions
);

/******************* Answers *********************************************/

router.post(
  "/quizzes/answers",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .notEmpty()
        .withMessage("the title should not be empty")
        .trim(),
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
  ]),
  knowYourAirController.createAnswer
);
router.put(
  "/quizzes/answers/:answer_id",
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),

  oneOf([
    [
      body("title")
        .optional()
        .notEmpty()
        .withMessage("the title should not be empty IF provided")
        .bail()
        .trim(),
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
    ],
  ]),
  knowYourAirController.updateAnswer
);
router.delete(
  "/quizzes/answers/:answer_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.deleteAnswer
);
router.get(
  "/quizzes/answers/:answer_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),
  knowYourAirController.listAnswers
);

/******************* manage Quiz Questions *********************************************/
router.post(
  "/quizzes/:quiz_id/assign-questions",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("quiz_id")
        .exists()
        .withMessage("the quiz_id is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the quiz_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
  ]),
  knowYourAirController.assignManyQuestionsToQuiz
);
router.delete(
  "/quizzess/:quiz_id/unassign-many-questions",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),

  knowYourAirController.removeManyQuestionsFromQuiz
);

/******************* manage Quiz Answers*********************************************/
router.post(
  "/quizzes/:question_id/assign-answers",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("question_id")
        .exists()
        .withMessage("the question_id is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the question_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
  ]),
  knowYourAirController.assignManyAnswersToQuestion
);
router.delete(
  "/quizzess/:question_id/unassign-many-answers",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
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
  ]),

  knowYourAirController.removeManyAnswersFromQuestion
);

module.exports = router;
