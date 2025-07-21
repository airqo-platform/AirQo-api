// kya.routes.js
const express = require("express");
const router = express.Router();
const knowYourAirController = require("@controllers/know-your-air.controller");
const kyaValidations = require("@validators/kya.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.get(
  "/lessons",
  kyaValidations.listLessons,
  pagination(),
  knowYourAirController.listLessons
);

router.get(
  "/lessons/users/:user_id",
  kyaValidations.listLessonsByUserId,
  pagination(),
  knowYourAirController.listLessons
);

router.post(
  "/lessons",
  kyaValidations.createLesson,
  knowYourAirController.createLesson
);

router.put(
  "/lessons/:lesson_id",
  kyaValidations.updateLesson,
  knowYourAirController.updateLesson
);

router.delete(
  "/lessons/:lesson_id",
  kyaValidations.deleteLesson,
  knowYourAirController.deleteLesson
);

router.get(
  "/lessons/:lesson_id/assigned-tasks",
  kyaValidations.listAssignedTasks,
  pagination(),
  knowYourAirController.listAssignedTasks
);

router.get(
  "/lessons/:lesson_id/available-tasks",
  kyaValidations.listAvailableTasks,
  pagination(),
  knowYourAirController.listAvailableTasks
);

router.get(
  "/lessons/:lesson_id",
  kyaValidations.getLesson,
  pagination(),
  knowYourAirController.listLessons
);

router.get(
  "/progress/:user_id?",
  kyaValidations.listUserLessonProgress,
  pagination(),
  knowYourAirController.listUserLessonProgress
);

router.get(
  "/progress/lessons/:lesson_id/users/:user_id",
  kyaValidations.getUserLessonProgress,
  pagination(),
  knowYourAirController.listUserLessonProgress
);

router.delete(
  "/progress/:progress_id",
  kyaValidations.deleteUserLessonProgress,
  knowYourAirController.deleteUserLessonProgress
);

router.put(
  "/progress/:progress_id",
  kyaValidations.updateUserLessonProgress,
  knowYourAirController.updateUserLessonProgress
);

router.post(
  "/progress",
  kyaValidations.createUserLessonProgress,
  knowYourAirController.createUserLessonProgress
);

router.post(
  "/progress/sync/:user_id",
  kyaValidations.syncUserLessonProgress,
  knowYourAirController.syncUserLessonProgress
);

router.get(
  "/tasks",
  kyaValidations.listTasks,
  pagination(),
  knowYourAirController.listTask
);

router.post(
  "/tasks",
  kyaValidations.createTask,
  knowYourAirController.createTask
);

router.put(
  "/tasks/:task_id",
  kyaValidations.updateTask,
  knowYourAirController.updateTask
);

router.delete(
  "/tasks/:task_id",
  kyaValidations.deleteTask,
  knowYourAirController.deleteTask
);

router.get(
  "/tasks/:task_id",
  kyaValidations.getTask,
  pagination(),
  knowYourAirController.listTask
);

router.post(
  "/lessons/:lesson_id/assign-tasks",
  kyaValidations.assignManyTasksToLesson,
  knowYourAirController.assignManyTasksToLesson
);

router.put(
  "/lessons/:lesson_id/assign-task/:task_id",
  kyaValidations.assignTaskToLesson,
  knowYourAirController.assignTaskToLesson
);

router.delete(
  "/lessons/:lesson_id/unassign-task/:task_id",
  kyaValidations.removeTaskFromLesson,
  knowYourAirController.removeTaskFromLesson
);

router.delete(
  "/lessons/:lesson_id/unassign-many-tasks",
  kyaValidations.removeManyTasksFromLesson,
  knowYourAirController.removeManyTasksFromLesson
);

router.get(
  "/quizzes/questions",
  kyaValidations.listQuestions,
  pagination(),
  knowYourAirController.listQuestions
);

router.get(
  "/quizzes/answers",
  kyaValidations.listAnswers,
  pagination(),
  knowYourAirController.listAnswers
);

router.get(
  "/quizzes/progress/:user_id?",
  kyaValidations.listUserQuizProgress,
  pagination(),
  knowYourAirController.listUserQuizProgress
);

router.get(
  "/quizzes",
  kyaValidations.listQuizzes,
  pagination(),
  knowYourAirController.listQuizzes
);

router.get(
  "/quizzes/users/:user_id",
  kyaValidations.listQuizzesByUserId,
  pagination(),
  knowYourAirController.listQuizzes
);

router.post(
  "/quizzes",
  kyaValidations.createQuiz,
  knowYourAirController.createQuiz
);

router.put(
  "/quizzes/:quiz_id",
  kyaValidations.updateQuiz,
  knowYourAirController.updateQuiz
);

router.delete(
  "/quizzes/:quiz_id",
  kyaValidations.deleteQuiz,
  knowYourAirController.deleteQuiz
);

router.get(
  "/quizzes/:quiz_id",
  kyaValidations.getQuiz,
  pagination(),
  knowYourAirController.listQuizzes
);

router.delete(
  "/quizzes/progress/:progress_id",
  kyaValidations.deleteUserQuizProgress,
  knowYourAirController.deleteUserQuizProgress
);

router.put(
  "/quizzes/progress/:progress_id",
  kyaValidations.updateUserQuizProgress,
  knowYourAirController.updateUserQuizProgress
);

router.post(
  "/quizzes/progress",
  kyaValidations.createUserQuizProgress,
  knowYourAirController.createUserQuizProgress
);

router.post(
  "/quizzes/progress/sync/:user_id",
  kyaValidations.syncUserQuizProgress,
  knowYourAirController.syncUserQuizProgress
);

router.post(
  "/quizzes/questions",
  kyaValidations.createQuestion,
  knowYourAirController.createQuestion
);

router.put(
  "/quizzes/questions/:question_id",
  kyaValidations.updateQuestion,
  knowYourAirController.updateQuestion
);

router.delete(
  "/quizzes/questions/:question_id",
  kyaValidations.deleteQuestion,
  knowYourAirController.deleteQuestion
);

router.get(
  "/quizzes/questions/:question_id",
  kyaValidations.getQuestion,
  pagination(),
  knowYourAirController.listQuestions
);

router.post(
  "/quizzes/answers",
  kyaValidations.createAnswer,
  knowYourAirController.createAnswer
);

router.put(
  "/quizzes/answers/:answer_id",
  kyaValidations.updateAnswer,
  knowYourAirController.updateAnswer
);

router.delete(
  "/quizzes/answers/:answer_id",
  kyaValidations.deleteAnswer,
  knowYourAirController.deleteAnswer
);

router.get(
  "/quizzes/answers/:answer_id",
  kyaValidations.getAnswer,
  pagination(),
  knowYourAirController.listAnswers
);

router.post(
  "/quizzes/:quiz_id/assign-questions",
  kyaValidations.assignManyQuestionsToQuiz,
  knowYourAirController.assignManyQuestionsToQuiz
);

router.delete(
  "/quizzes/:quiz_id/unassign-many-questions",
  kyaValidations.removeManyQuestionsFromQuiz,
  knowYourAirController.removeManyQuestionsFromQuiz
);

router.post(
  "/quizzes/:question_id/assign-answers",
  kyaValidations.assignManyAnswersToQuestion,
  knowYourAirController.assignManyAnswersToQuestion
);

router.delete(
  "/quizzes/:question_id/unassign-many-answers",
  kyaValidations.removeManyAnswersFromQuestion,
  knowYourAirController.removeManyAnswersFromQuestion
);

module.exports = router;
