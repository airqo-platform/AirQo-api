const httpStatus = require("http-status");
const KnowYourAirLessonModel = require("@models/KnowYourAirLesson");
const KnowYourAirTaskModel = require("@models/KnowYourAirTask");
const KnowYourAirUserLessonProgressModel = require("@models/KnowYourAirUserLessonProgress");
const KnowYourAirQuizModel = require("@models/KnowYourAirQuiz");
const KnowYourAirQuestionModel = require("@models/KnowYourAirQuestion");
const KnowYourAirAnswerModel = require("@models/KnowYourAirAnswer");
const KnowYourAirUserQuizProgressModel = require("@models/KnowYourAirUserQuizProgress");
const constants = require("@config/constants");
const { logObject } = require("./log");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-kya-util`);
const translateUtil = require("./translate");
const { HttpError } = require("@utils/errors");
const { Kafka } = require("kafkajs");
const isEmpty = require("is-empty");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createKnowYourAir = {
  sample: async (request) => {
    try {
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  /*************** lessons *******************************/
  listLesson: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip, language } = query;
      const { user_id } = params;
      const filter = generateFilter.kyalessons(request, next);

      logObject("filter", filter);
      const responseFromListLessons = await KnowYourAirLessonModel(tenant).list(
        {
          filter,
          limit,
          skip,
          user_id: user_id,
        },
        next
      );
      if (
        language !== undefined &&
        !isEmpty(responseFromListLessons) &&
        !isEmpty(responseFromListLessons.data)
      ) {
        const translatedLessons = await translateUtil.translateLessons(
          { lessons: responseFromListLessons.data, targetLanguage: language },
          next
        );
        if (translatedLessons.success === true) {
          return translatedLessons;
        }
      }
      logObject("responseFromListLessons", responseFromListLessons);
      return responseFromListLessons;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteLesson: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyalessons(request, next);

      const responseFromRemoveKyaLesson = await KnowYourAirLessonModel(
        tenant
      ).remove({ filter }, next);
      logObject("responseFromRemoveKyaLesson", responseFromRemoveKyaLesson);
      return responseFromRemoveKyaLesson;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateLesson: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyalessons(request, next);
      const update = body;
      const opts = { new: true };
      const responseFromModifyKyaLesson = await KnowYourAirLessonModel(
        tenant
      ).modify({ filter, update, opts }, next);
      logObject("responseFromModifyKyaLesson", responseFromModifyKyaLesson);
      return responseFromModifyKyaLesson;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createLesson: async (request, next) => {
    try {
      let { body, query } = request;
      let { tenant } = query;

      const responseFromRegisterKyaLesson = await KnowYourAirLessonModel(
        tenant
      ).register(body, next);

      logObject("responseFromRegisterKyaLesson", responseFromRegisterKyaLesson);

      if (responseFromRegisterKyaLesson.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.KYA_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterKyaLesson.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterKyaLesson;
      } else if (responseFromRegisterKyaLesson.success === false) {
        return responseFromRegisterKyaLesson;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAvailableTasks: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { lesson_id } = request.params;

      const lesson = await KnowYourAirLessonModel(tenant).findById(lesson_id);

      if (!lesson) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid lesson ID ${lesson_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAvailableTasks = await KnowYourAirTaskModel(tenant)
        .aggregate([
          {
            $match: {
              kya_lesson: { $ne: lesson_id },
            },
          },
          {
            $project: constants.KYA_TASKS_INCLUSION_PROJECTION,
          },
        ])
        .exec();

      logObject(
        "responseFromListAvailableTasks",
        responseFromListAvailableTasks
      );

      return {
        success: true,
        message: `retrieved all available tasks for lesson ${lesson_id}`,
        data: responseFromListAvailableTasks,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAssignedTasks: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { lesson_id } = request.params;

      const lesson = await KnowYourAirLessonModel(tenant).findById(lesson_id);

      if (!lesson) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid lesson ID ${lesson_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAssignedTasks = await KnowYourAirTaskModel(tenant)
        .aggregate([
          {
            $match: {
              kya_lesson: lesson_id,
            },
          },
          {
            $project: constants.KYA_TASKS_INCLUSION_PROJECTION,
          },
        ])
        .exec();

      logObject("responseFromListAssignedTasks", responseFromListAssignedTasks);

      return {
        success: true,
        message: `retrieved all assigned tasks for lesson ${lesson_id}`,
        data: responseFromListAssignedTasks,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******************* tracking user progress ***************** */
  listUserLessonProgress: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const filter = generateFilter.kyaprogress(request, next);
      logObject("filter", filter);

      const responseFromListUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      logObject(
        "responseFromListUserLessonProgress",
        responseFromListUserLessonProgress
      );
      return responseFromListUserLessonProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteUserLessonProgress: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.kyaprogress(request, next);
      logObject("filter", filter);
      const responseFromDeleteUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).remove(
        {
          filter,
        },
        next
      );
      logObject(
        "responseFromDeleteUserLessonProgress",
        responseFromDeleteUserLessonProgress
      );
      return responseFromDeleteUserLessonProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateUserLessonProgress: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.kyaprogress(request, next);
      let update = Object.assign({}, body);
      logObject("update", update);
      logObject("filter", filter);
      const responseFromUpdateUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).modify(
        {
          filter,
          update,
        },
        next
      );
      logObject(
        "responseFromUpdateUserLessonProgress",
        responseFromUpdateUserLessonProgress
      );
      return responseFromUpdateUserLessonProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createUserLessonProgress: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      let requestBody = Object.assign({}, body);
      const responseFromCreateUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).register(requestBody, next);
      logObject(
        "responseFromCreateUserLessonProgress",
        responseFromCreateUserLessonProgress
      );
      return responseFromCreateUserLessonProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  syncUserLessonProgress: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;
      const { user_id } = params;
      let progressList = body.kya_user_progress;

      if (progressList.length !== 0) {
        for (progress of progressList) {
          let responseFromListProgress = await createKnowYourAir.listUserLessonProgress(
            request,
            next
          );
          logObject("responseFromListProgress", responseFromListProgress);
          if (responseFromListProgress.success === false) {
            return responseFromListProgress;
          }

          if (responseFromListProgress.data.length == 0) {
            let requestBody = {
              query: {
                tenant: tenant,
              },
              body: {
                user_id: user_id,
                lesson_id: progress._id,
                active_task: progress.active_task,
                status: progress.status,
              },
            };
            let responseFromCreateUserLessonProgress = await createKnowYourAir.createUserLessonProgress(
              requestBody,
              next
            );
            logObject(
              "responseFromCreateUserLessonProgress",
              responseFromCreateUserLessonProgress
            );
            if (responseFromCreateUserLessonProgress.success === false) {
              return responseFromCreateUserLessonProgress;
            }
          } else {
            let requestBody = {
              query: {
                tenant: tenant,
              },
              params: {
                progress_id: responseFromListProgress.data[0]._id,
              },
              body: progress,
            };
            let responseFromUpdateUserLessonProgress = await createKnowYourAir.updateUserLessonProgress(
              requestBody,
              next
            );
            logObject(
              "responseFromUpdateUserLessonProgress",
              responseFromUpdateUserLessonProgress
            );
            if (responseFromUpdateUserLessonProgress.success === false) {
              return responseFromUpdateUserLessonProgress;
            }
          }
        }
      }
      let requestBody = {
        query: {
          tenant: tenant,
        },
        params: {
          user_id: user_id,
        },
      };
      let syncResponse = await createKnowYourAir.listUserLessonProgress(
        requestBody,
        next
      );

      return syncResponse.success
        ? {
            success: true,
            message: "Sync successful",
            data: syncResponse.data,
            status: httpStatus.OK,
          }
        : syncResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******************* tasks *******************************/
  listTask: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const filter = generateFilter.kyatasks(request, next);

      const responseFromListKyaTask = await KnowYourAirTaskModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      logObject("responseFromListKyaTask", responseFromListKyaTask);
      return responseFromListKyaTask;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteTask: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyatasks(request, next);

      const responseFromRemoveKyaTask = await KnowYourAirTaskModel(
        tenant
      ).remove({ filter }, next);
      logObject("responseFromRemoveKyaTask", responseFromRemoveKyaTask);
      return responseFromRemoveKyaTask;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateTask: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyatasks(request, next);
      const update = body;
      const opts = { new: true };
      const responseFromModifyKyaTask = await KnowYourAirTaskModel(
        tenant
      ).modify({ filter, update, opts }, next);

      return responseFromModifyKyaTask;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createTask: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const responseFromRegisterKyaTask = await KnowYourAirTaskModel(
        tenant
      ).register(body, next);

      logObject("responseFromRegisterKyaTask", responseFromRegisterKyaTask);

      if (responseFromRegisterKyaTask.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.KYA_LESSON,
            messages: [
              {
                action: "create-kya-task",
                value: JSON.stringify(responseFromRegisterKyaTask.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterKyaTask;
      } else if (responseFromRegisterKyaTask.success === false) {
        return responseFromRegisterKyaTask;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******************* manage lessons *******************************/
  assignTaskToLesson: async (request, next) => {
    try {
      const { task_id, lesson_id } = request.params;
      const { tenant } = request.query;

      const taskExists = await KnowYourAirTaskModel(tenant).exists({
        _id: task_id,
      });
      const lessonExists = await KnowYourAirLessonModel(tenant).exists({
        _id: lesson_id,
      });

      if (!taskExists || !lessonExists) {
        return {
          success: false,
          message: "Task or Lesson not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Task ${task_id} or Lesson ${lesson_id} are not found`,
          },
        };
      }

      const task = await KnowYourAirTaskModel(tenant)
        .findById(task_id)
        .lean();

      logObject("task", task);

      if (
        task.kya_lesson &&
        task.kya_lesson.toString() === lesson_id.toString()
      ) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Task ${task_id} is already assigned to the Lesson ${lesson_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedTask = await KnowYourAirTaskModel(tenant).findByIdAndUpdate(
        task_id,
        { kya_lesson: lesson_id },
        { new: true }
      );

      return {
        success: true,
        message: "Task assigned to the Lesson",
        data: updatedTask,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignManyTasksToLesson: async (request, next) => {
    try {
      const { lesson_id } = request.params;
      const { task_ids } = request.body;
      const { tenant } = request.query;

      const lesson = await KnowYourAirLessonModel(tenant).findById(lesson_id);

      if (!lesson) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid lesson ID ${lesson_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      for (const task_id of task_ids) {
        const task = await KnowYourAirTaskModel(tenant)
          .findById(task_id)
          .lean();

        if (!task) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Invalid Task ID ${task_id}, please crosscheck`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (
          task.kya_lessson &&
          task.kya_lessons.toString() === lesson_id.toString()
        ) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Task ${task_id} is already assigned to the Lesson ${lesson_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalTasks = task_ids.length;
      const { nModified, n } = await KnowYourAirTaskModel(tenant).updateMany(
        { _id: { $in: task_ids } },
        { kya_lesson: lesson_id }
      );

      const notFoundCount = totalTasks - nModified;
      if (nModified === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "No matching Task found in the system" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (notFoundCount > 0) {
        return {
          success: true,
          message: `Operation partially successful some ${notFoundCount} of the provided tasks were not found in the system`,
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "successfully assigned all the provided tasks to the Lesson",
        status: httpStatus.OK,
        data: [],
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  removeTaskFromLesson: async (request, next) => {
    try {
      const { lesson_id, task_id } = request.params;
      const { tenant } = request.query;

      const lesson = await KnowYourAirLessonModel(tenant).findById(lesson_id);
      if (!lesson) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Lesson ${lesson_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const task = await KnowYourAirTaskModel(tenant).findById(task_id);
      if (!task) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: { message: `Task  ${task_id} not found` },
        };
      }

      const isTaskAssignedToLesson =
        task.kya_lesson && task.kya_lesson.toString() === lesson_id.toString();

      if (!isTaskAssignedToLesson) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Task ${task_id.toString()} is not assigned to Lesson ${lesson_id}`,
          },
        };
      }

      const updatedTask = await KnowYourAirTaskModel(tenant).findByIdAndUpdate(
        task_id,
        { kya_lesson: null },
        { new: true }
      );

      return {
        success: true,
        message: "Successfully unassigned User from the Lesson",
        data: updatedTask,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  removeManyTasksFromLesson: async (request, next) => {
    try {
      const { task_ids } = request.body;
      const { lesson_id } = request.params;
      const { tenant } = request.query;

      // Check if lesson exists
      const lesson = await KnowYourAirLessonModel(tenant).findById(lesson_id);
      if (!lesson) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Lesson ${lesson_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check of all these provided tasks actually do exist?
      const existingTasks = await KnowYourAirTaskModel(tenant).find(
        { _id: { $in: task_ids } },
        "_id"
      );

      if (existingTasks.length !== task_ids.length) {
        const nonExistentTasks = task_ids.filter(
          (user_id) => !existingTasks.find((user) => user._id.equals(user_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following tasks do not exist: ${nonExistentTasks}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      try {
        const totalTasks = task_ids.length;
        const { nModified, n } = await KnowYourAirTaskModel(tenant).updateMany(
          { _id: { $in: task_ids } },
          { kya_lesson: null },
          { multi: true }
        );

        const notFoundCount = totalTasks - nModified;
        if (nModified === 0) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: { message: "No matching Task found in the system" },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (notFoundCount > 0) {
          return {
            success: true,
            message: `Operation partially successful since ${notFoundCount} of the provided tasks were not found in the system`,
            status: httpStatus.OK,
          };
        }
      } catch (error) {
        logObject("error", JSON.stringify(error));
        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: error.message },
        };
      }

      return {
        success: true,
        message: `successfully unassigned all the provided  tasks from the lesson ${lesson_id}`,
        status: httpStatus.OK,
        data: [],
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /*************** quizzes *******************************/
  listQuiz: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip, language } = query;
      const { user_id } = params;
      const filter = generateFilter.kyaquizzes(request, next);
      logObject("filter", filter);
      const responseFromListQuizzes = await KnowYourAirQuizModel(tenant).list(
        {
          filter,
          limit,
          skip,
          user_id: user_id,
        },
        next
      );
      if (
        language !== undefined &&
        !isEmpty(responseFromListQuizzes) &&
        !isEmpty(responseFromListQuizzes.data)
      ) {
        const translatedQuizzes = await translateUtil.translateQuizzes(
          { quizzes: responseFromListQuizzes.data, targetLanguage: language },
          next
        );
        if (translatedQuizzes.success === true) {
          return translatedQuizzes;
        }
      }
      logObject("responseFromListQuizzes", responseFromListQuizzes);
      return responseFromListQuizzes;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteQuiz: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyaquizzes(request, next);
      const responseFromRemoveKyaQuiz = await KnowYourAirQuizModel(
        tenant
      ).remove({ filter }, next);
      logObject("responseFromRemoveKyaQuiz", responseFromRemoveKyaQuiz);
      return responseFromRemoveKyaQuiz;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateQuiz: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyaquizzes(request, next);
      const update = body;
      const opts = { new: true };
      const responseFromModifyKyaQuiz = await KnowYourAirQuizModel(
        tenant
      ).modify({ filter, update, opts }, next);
      logObject("responseFromModifyKyaQuiz", responseFromModifyKyaQuiz);
      return responseFromModifyKyaQuiz;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createQuiz: async (request, next) => {
    try {
      let { body, query } = request;
      let { tenant } = query;

      const responseFromRegisterKyaQuiz = await KnowYourAirQuizModel(
        tenant
      ).register(body, next);

      logObject("responseFromRegisterKyaQuiz", responseFromRegisterKyaQuiz);

      if (responseFromRegisterKyaQuiz.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.KYA_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterKyaQuiz.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterKyaQuiz;
      } else if (responseFromRegisterKyaQuiz.success === false) {
        return responseFromRegisterKyaQuiz;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******************* tracking user QUIZ progress ***************** */
  listUserQuizProgress: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const filter = generateFilter.kyaprogress(request, next);

      const responseFromListUserQuizProgress = await KnowYourAirUserQuizProgressModel(
        tenant
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      logObject(
        "responseFromListUserQuizProgress",
        responseFromListUserQuizProgress
      );
      return responseFromListUserQuizProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteUserQuizProgress: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.kyaprogress(request, next);
      const responseFromDeleteUserQuizProgress = await KnowYourAirUserQuizProgressModel(
        tenant
      ).remove(
        {
          filter,
        },
        next
      );
      logObject(
        "responseFromDeleteUserQuizProgress",
        responseFromDeleteUserQuizProgress
      );
      return responseFromDeleteUserQuizProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateUserQuizProgress: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.kyaprogress(request, next);
      let update = Object.assign({}, body);
      logObject("update", update);
      logObject("filter", filter);
      const responseFromUpdateUserQuizProgress = await KnowYourAirUserQuizProgressModel(
        tenant
      ).modify(
        {
          filter,
          update,
        },
        next
      );
      logObject(
        "responseFromUpdateUserQuizProgress",
        responseFromUpdateUserQuizProgress
      );
      return responseFromUpdateUserQuizProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createUserQuizProgress: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      let requestBody = Object.assign({}, body);
      const responseFromCreateUserQuizProgress = await KnowYourAirUserQuizProgressModel(
        tenant
      ).register(requestBody, next);
      logObject(
        "responseFromCreateUserQuizProgress",
        responseFromCreateUserQuizProgress
      );
      return responseFromCreateUserQuizProgress;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  syncUserQuizProgress: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;
      const { user_id } = params;
      let progressList = body.kya_quiz_user_progress;

      if (progressList.length !== 0) {
        for (progress of progressList) {
          let responseFromListProgress = await createKnowYourAir.listUserQuizProgress(
            request,
            next
          );
          logObject("responseFromListProgress", responseFromListProgress);
          if (responseFromListProgress.success === false) {
            return responseFromListProgress;
          }

          if (responseFromListProgress.data.length == 0) {
            let requestBody = {
              query: {
                tenant: tenant,
              },
              body: {
                user_id: user_id,
                quiz_id: progress._id,
                active_question: progress.active_question,
                status: progress.status,
              },
            };
            let responseFromCreateUserQuizProgress = await createKnowYourAir.createUserQuizProgress(
              requestBody,
              next
            );
            logObject(
              "responseFromCreateUserQuizProgress",
              responseFromCreateUserQuizProgress
            );
            if (responseFromCreateUserQuizProgress.success === false) {
              return responseFromCreateUserQuizProgress;
            }
          } else {
            let requestBody = {
              query: {
                tenant: tenant,
              },
              params: {
                progress_id: responseFromListProgress.data[0]._id,
              },
              body: progress,
            };
            let responseFromUpdateUserQuizProgress = await createKnowYourAir.updateUserQuizProgress(
              requestBody,
              next
            );

            if (responseFromUpdateUserQuizProgress.success === false) {
              return responseFromUpdateUserQuizProgress;
            }
          }
        }
      }
      let requestBody = {
        query: {
          tenant: tenant,
        },
        params: {
          user_id: user_id,
        },
      };
      let syncResponse = await createKnowYourAir.listUserQuizProgress(
        requestBody,
        next
      );

      return syncResponse.success
        ? {
            success: true,
            message: "Sync successful",
            data: syncResponse.data,
            status: httpStatus.OK,
          }
        : syncResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******************* questions *******************************/
  listQuestions: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const filter = generateFilter.kyaquestions(request, next);

      const responseFromListKyaQuestion = await KnowYourAirQuestionModel(
        tenant
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      logObject("responseFromListKyaQuestion", responseFromListKyaQuestion);
      return responseFromListKyaQuestion;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteQuestion: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyaquestions(request, next);

      const responseFromRemoveKyaQuestion = await KnowYourAirQuestionModel(
        tenant
      ).remove({ filter }, next);
      logObject("responseFromRemoveKyaQuestion", responseFromRemoveKyaQuestion);
      return responseFromRemoveKyaQuestion;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateQuestion: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyaquestions(request, next);
      const update = body;
      const opts = { new: true };
      const responseFromModifyKyaQuestion = await KnowYourAirQuestionModel(
        tenant
      ).modify({ filter, update, opts }, next);

      return responseFromModifyKyaQuestion;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createQuestion: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const responseFromRegisterKyaQuestion = await KnowYourAirQuestionModel(
        tenant
      ).register(body, next);

      logObject(
        "responseFromRegisterKyaQuestion",
        responseFromRegisterKyaQuestion
      );

      if (responseFromRegisterKyaQuestion.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.KYA_QUIZ,
            messages: [
              {
                action: "create-kya-question",
                value: JSON.stringify(responseFromRegisterKyaQuestion.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterKyaQuestion;
      } else if (responseFromRegisterKyaQuestion.success === false) {
        return responseFromRegisterKyaQuestion;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******************* Answers *******************************/
  listAnswers: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const filter = generateFilter.kyaquestions(request, next);

      const responseFromListKyaAnswer = await KnowYourAirAnswerModel(
        tenant
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      logObject("responseFromListKyaAnswer", responseFromListKyaAnswer);
      return responseFromListKyaAnswer;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteAnswer: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyaquestions(request, next);

      const responseFromRemoveKyaAnswer = await KnowYourAirAnswerModel(
        tenant
      ).remove({ filter }, next);
      logObject("responseFromRemoveKyaAnswer", responseFromRemoveKyaAnswer);
      return responseFromRemoveKyaAnswer;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateAnswer: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyaquestions(request, next);
      const update = body;
      const opts = { new: true };
      const responseFromModifyKyaAnswer = await KnowYourAirAnswerModel(
        tenant
      ).modify({ filter, update, opts }, next);

      return responseFromModifyKyaAnswer;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createAnswer: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const responseFromRegisterKyaAnswer = await KnowYourAirAnswerModel(
        tenant
      ).register(body, next);

      logObject("responseFromRegisterKyaAnswer", responseFromRegisterKyaAnswer);

      if (responseFromRegisterKyaAnswer.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.KYA_QUIZ,
            messages: [
              {
                action: "create-kya-answer",
                value: JSON.stringify(responseFromRegisterKyaAnswer.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterKyaAnswer;
      } else if (responseFromRegisterKyaAnswer.success === false) {
        return responseFromRegisterKyaAnswer;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******************* manage Quizes *******************************/
  assignManyQuestionsToQuiz: async (request, next) => {
    try {
      const { quiz_id } = request.params;
      const { question_ids } = request.body;
      const { tenant } = request.query;

      const quiz = await KnowYourAirQuizModel(tenant).findById(quiz_id);

      if (!quiz) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid quiz ID ${quiz_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      for (const question_id of question_ids) {
        const question = await KnowYourAirQuestionModel(tenant)
          .findById(question_id)
          .lean();

        if (!question) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Invalid Question ID ${question_id}, please crosscheck`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (
          question.quiz &&
          question.kya_quizzes.toString() === quiz_id.toString()
        ) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Question ${question_id} is already assigned to the Quiz ${quiz_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalQuestions = question_ids.length;
      const { nModified, n } = await KnowYourAirQuestionModel(
        tenant
      ).updateMany({ _id: { $in: question_ids } }, { kya_quiz: quiz_id });

      const notFoundCount = totalQuestions - nModified;
      if (nModified === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "No matching Question found in the system" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (notFoundCount > 0) {
        return {
          success: true,
          message: `Operation partially successful some ${notFoundCount} of the provided questions were not found in the system`,
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "successfully assigned all the provided questions to the Quiz",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  removeManyQuestionsFromQuiz: async (request, next) => {
    try {
      const { question_ids } = request.body;
      const { quiz_id } = request.params;
      const { tenant } = request.query;

      // Check if quiz exists
      const quiz = await KnowYourAirQuizModel(tenant).findById(quiz_id);
      if (!quiz) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Quiz ${quiz_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check of all these provided questions actually do exist?
      const existingQuestions = await KnowYourAirQuestionModel(tenant).find(
        { _id: { $in: question_ids } },
        "_id"
      );

      if (existingQuestions.length !== question_ids.length) {
        const nonExistentQuestions = question_ids.filter(
          (user_id) =>
            !existingQuestions.find((user) => user._id.equals(user_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following questions do not exist: ${nonExistentQuestions}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      try {
        const totalQuestions = question_ids.length;
        const { nModified, n } = await KnowYourAirQuestionModel(
          tenant
        ).updateMany(
          { _id: { $in: question_ids } },
          { kya_quiz: null },
          { multi: true }
        );

        const notFoundCount = totalQuestions - nModified;
        if (nModified === 0) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: { message: "No matching Question found in the system" },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (notFoundCount > 0) {
          return {
            success: true,
            message: `Operation partially successful since ${notFoundCount} of the provided questions were not found in the system`,
            status: httpStatus.OK,
          };
        }
      } catch (error) {
        logObject("error", JSON.stringify(error));
        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: error.message },
        };
      }

      return {
        success: true,
        message: `successfully unassigned all the provided  questions from the quiz ${quiz_id}`,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignManyAnswersToQuestion: async (request, next) => {
    try {
      const { question_id } = request.params;
      const { answer_ids } = request.body;
      const { tenant } = request.query;

      const question = await KnowYourAirQuestionModel(tenant).findById(
        question_id
      );

      if (!question) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid question ID ${question_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      for (const answer_id of answer_ids) {
        const answer = await KnowYourAirAnswerModel(tenant)
          .findById(answer_id)
          .lean();

        if (!answer) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Invalid Answer ID ${answer_id}, please crosscheck`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (
          answer.question &&
          answer.kya_questionzes.toString() === question_id.toString()
        ) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Answer ${answer_id} is already assigned to the Question ${question_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalAnswers = answer_ids.length;
      const { nModified, n } = await KnowYourAirAnswerModel(tenant).updateMany(
        { _id: { $in: answer_ids } },
        { kya_question: question_id }
      );

      const notFoundCount = totalAnswers - nModified;
      if (nModified === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "No matching Answer found in the system" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (notFoundCount > 0) {
        return {
          success: true,
          message: `Operation partially successful some ${notFoundCount} of the provided answers were not found in the system`,
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message:
          "successfully assigned all the provided answers to the Question",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  removeManyAnswersFromQuestion: async (request, next) => {
    try {
      const { answer_ids } = request.body;
      const { question_id } = request.params;
      const { tenant } = request.query;

      // Check if question exists
      const question = await KnowYourAirQuestionModel(tenant).findById(
        question_id
      );
      if (!question) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Question ${question_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check of all these provided answers actually do exist?
      const existingAnswers = await KnowYourAirAnswerModel(tenant).find(
        { _id: { $in: answer_ids } },
        "_id"
      );

      if (existingAnswers.length !== answer_ids.length) {
        const nonExistentAnswers = answer_ids.filter(
          (user_id) => !existingAnswers.find((user) => user._id.equals(user_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following answers do not exist: ${nonExistentAnswers}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      try {
        const totalAnswers = answer_ids.length;
        const { nModified, n } = await KnowYourAirAnswerModel(
          tenant
        ).updateMany(
          { _id: { $in: answer_ids } },
          { kya_question: null },
          { multi: true }
        );

        const notFoundCount = totalAnswers - nModified;
        if (nModified === 0) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: { message: "No matching Answer found in the system" },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (notFoundCount > 0) {
          return {
            success: true,
            message: `Operation partially successful since ${notFoundCount} of the provided answers were not found in the system`,
            status: httpStatus.OK,
          };
        }
      } catch (error) {
        logObject("error", JSON.stringify(error));
        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: error.message },
        };
      }

      return {
        success: true,
        message: `successfully unassigned all the provided  answers from the question ${question_id}`,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = createKnowYourAir;
