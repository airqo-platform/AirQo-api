const express = require("express");
const router = express.Router();
const knowYourAirController = require("@controllers/create-know-your-air");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");

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
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .isURL()
        .withMessage("the image_url is not a valid URL")
        .trim(),
    ],
  ]),
  knowYourAirController.createLesson
);
router.put(
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
    query("id")
      .exists()
      .withMessage(
        "the tip unique identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
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
      body("description")
        .optional()
        .notEmpty()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
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
        .trim(),
      body("aqi_category")
        .optional()
        .notEmpty()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  knowYourAirController.updateLesson
);
router.delete(
  "/lessons",
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
    query("id")
      .exists()
      .withMessage(
        "the tip identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  knowYourAirController.deleteLesson
);
router.get(
  "/lessons/{lesson_id}/assigned-tasks",
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

/****** CRUD for tracking user progress ******************************/
router.get(
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
        .trim()
        .isMongoId()
        .withMessage("user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
    query("id")
      .exists()
      .withMessage(
        "the tip identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  knowYourAirController.deleteUserLessonProgress
);
router.put(
  "/progress/:progress_id",
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
    query("id")
      .exists()
      .withMessage(
        "the tip unique identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
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
      body("description")
        .optional()
        .notEmpty()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
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
        .trim(),
      body("aqi_category")
        .optional()
        .notEmpty()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
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
      body("description")
        .exists()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .trim(),
      body("aqi_category")
        .exists()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  knowYourAirController.createUserLessonProgress
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
      body("description")
        .exists()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .trim(),
      body("aqi_category")
        .exists()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  knowYourAirController.createTask
);
router.put(
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
    query("id")
      .exists()
      .withMessage(
        "the tip unique identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
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
      body("description")
        .optional()
        .notEmpty()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
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
        .trim(),
      body("aqi_category")
        .optional()
        .notEmpty()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  knowYourAirController.updateTask
);
router.delete(
  "/tasks",
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
    query("id")
      .exists()
      .withMessage(
        "the tip identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  knowYourAirController.deleteTask
);

/******************* manage lessons *********************************************/
router.post(
  "/lessons/{lesson_id}/assign-tasks",
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
      body("description")
        .exists()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .trim(),
      body("aqi_category")
        .exists()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  knowYourAirController.assignManyTasksToLesson
);
router.put(
  "/lessons/{lesson_id}/assign-task/{task_id}",
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
    query("id")
      .exists()
      .withMessage(
        "the tip unique identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
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
      body("description")
        .optional()
        .notEmpty()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
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
        .trim(),
      body("aqi_category")
        .optional()
        .notEmpty()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  knowYourAirController.assignTaskToLesson
);
router.delete(
  "/lessons/{lesson_id}/unassign-task/{task_id}",
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
    query("id")
      .exists()
      .withMessage(
        "the tip identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  knowYourAirController.removeTaskFromLesson
);
router.delete(
  "/lessons/{lesson_id}/unassign-many-tasks",
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
    query("id")
      .exists()
      .withMessage(
        "the tip identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  knowYourAirController.removeManyTasksFromLesson
);

module.exports = router;
