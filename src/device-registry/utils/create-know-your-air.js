const httpStatus = require("http-status");
const KnowYourAirLessonSchema = require("@models/KnowYourAirLesson");
const KnowYourAirTaskSchema = require("@models/KnowYourAirTask");
const KnowYourAirUserLessonProgressSchema = require("@models/KnowYourAirUserLessonProgress");
const { getModelByTenant } = require("@config/database");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("./log");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-kya-util`);

const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const KnowYourAirLessonModel = (tenant) => {
  try {
    let kyalessons = mongoose.model("kyalessons");
    return kyalessons;
  } catch (error) {
    let kyalessons = getModelByTenant(
      tenant,
      "kyalesson",
      KnowYourAirLessonSchema
    );
    return kyalessons;
  }
};

const KnowYourAirTaskModel = (tenant) => {
  try {
    let kyatasks = mongoose.model("kyatasks");
    return kyatasks;
  } catch (error) {
    let kyatasks = getModelByTenant(tenant, "kyatask", KnowYourAirTaskSchema);
    return kyatasks;
  }
};

const KnowYourAirUserLessonProgressModel = (tenant) => {
  try {
    let kyaprogress = mongoose.model("kyaprogress");
    return kyaprogress;
  } catch (error) {
    let kyaprogress = getModelByTenant(
      tenant,
      "kyaprogress",
      KnowYourAirUserLessonProgressSchema
    );
    return kyaprogress;
  }
};

const createKnowYourAir = {
  sample: async (request) => {
    try {
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  /*************** lessons *******************************/
  listLesson: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const filter = generateFilter.kyalessons(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      logObject("filter", filter);
      const responseFromListLessons = await KnowYourAirLessonModel(tenant).list(
        {
          filter,
          limit,
          skip,
        }
      );
      logObject("responseFromListLessons", responseFromListLessons);
      return responseFromListLessons;
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  deleteLesson: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyalessons(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      const responseFromRemoveKyaLesson = await KnowYourAirLessonModel(
        tenant
      ).remove({ filter });
      logObject("responseFromRemoveKyaLesson", responseFromRemoveKyaLesson);
      return responseFromRemoveKyaLesson;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  updateLesson: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyalessons(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      const update = body;
      const opts = { new: true };
      const responseFromModifyKyaLesson = await KnowYourAirLessonModel(
        tenant
      ).modify({ filter, update, opts });
      logObject("responseFromModifyKyaLesson", responseFromModifyKyaLesson);
      return responseFromModifyKyaLesson;
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  createLesson: async (request) => {
    try {
      let { body, query } = request;
      let { tenant } = query;

      const responseFromRegisterKyaLesson = await KnowYourAirLessonModel(
        tenant
      ).register(body);

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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  listAvailableTasks: async (request) => {
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  listAssignedTasks: async (request) => {
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
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******************* tracking user progress ***************** */
  listUserLessonProgress: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);

      const filter = generateFilter.kyaprogress(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      logObject("filter", filter);

      const responseFromListUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).list({
        filter,
        limit,
        skip,
      });
      logObject(
        "responseFromListUserLessonProgress",
        responseFromListUserLessonProgress
      );
      return responseFromListUserLessonProgress;
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteUserLessonProgress: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.kyaprogress(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      logObject("filter", filter);
      const responseFromDeleteUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).remove({
        filter,
      });
      logObject(
        "responseFromDeleteUserLessonProgress",
        responseFromDeleteUserLessonProgress
      );
      return responseFromDeleteUserLessonProgress;
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateUserLessonProgress: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.kyaprogress(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      let update = Object.assign({}, body);
      logObject("update", update);
      logObject("filter", filter);
      const responseFromUpdateUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).modify({
        filter,
        update,
      });
      logObject(
        "responseFromUpdateUserLessonProgress",
        responseFromUpdateUserLessonProgress
      );
      return responseFromUpdateUserLessonProgress;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createUserLessonProgress: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      let requestBody = Object.assign({}, body);
      const responseFromCreateUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).register(requestBody);
      logObject(
        "responseFromCreateUserLessonProgress",
        responseFromCreateUserLessonProgress
      );
      return responseFromCreateUserLessonProgress;
    } catch (error) {
      logger.error("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  syncUserLessonProgress: async (request) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;
      const { user_id } = params;
      let progressList = body.kya_user_progress;

      if (progressList.length !== 0) {

        for (progress of progressList) {

          let responseFromListProgress = await createKnowYourAir.listUserLessonProgress(request)
          logObject(
            "responseFromListProgress",
            responseFromListProgress
          );
          if (responseFromListProgress.success === false) {
            return responseFromListProgress;
          }

          if (responseFromListProgress.data.length == 0) {
            let requestBody = {
              body:
              {
                user_id: user_id,
                lesson_id: progress.lesson_id,
                progress: progress.progress,
              },
            };
            let responseFromCreateUserLessonProgress = await createKnowYourAir.createUserLessonProgress(requestBody);
            logObject(
              "responseFromCreateUserLessonProgress",
              responseFromCreateUserLessonProgress
            );
            if (responseFromCreateUserLessonProgress.success === false) {
              return responseFromCreateUserLessonProgress;
            }
          }
          else {
            let requestBody = {
              query: {
                tenant: tenant,
              },
              params: {
                progress_id: responseFromListProgress.data[0]._id,
              },
              body: progress,
            }
            let responseFromUpdateUserLessonProgress = await createKnowYourAir.updateUserLessonProgress(requestBody);
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
        }
      };
      let syncResponse = await createKnowYourAir.listUserLessonProgress(requestBody)

      return syncResponse.success ?
        {
          success: true,
          message: "Sync successful",
          data: syncResponse.data,
          status: httpStatus.OK,
        } :
        syncResponse;


    } catch (error) {
      logger.error("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******************* tasks *******************************/
  listTask: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);

      const filter = generateFilter.kyatasks(request);
      if (filter.success && filter.success === false) {
        return filter;
      }

      const responseFromListKyaTask = await KnowYourAirTaskModel(tenant).list({
        filter,
        limit,
        skip,
      });
      logObject("responseFromListKyaTask", responseFromListKyaTask);
      return responseFromListKyaTask;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  deleteTask: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyatasks(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      const responseFromRemoveKyaTask = await KnowYourAirTaskModel(
        tenant
      ).remove({ filter });
      logObject("responseFromRemoveKyaTask", responseFromRemoveKyaTask);
      return responseFromRemoveKyaTask;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  updateTask: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.kyatasks(request);
      if (filter.success && filter.success === false) {
        return filter;
      }

      const update = body;
      const opts = { new: true };
      const responseFromModifyKyaTask = await KnowYourAirTaskModel(
        tenant
      ).modify({ filter, update, opts });

      return responseFromModifyKyaTask;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  createTask: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const responseFromRegisterKyaTask = await KnowYourAirTaskModel(
        tenant
      ).register(body);

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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },

  /******************* manage lessons *******************************/

  assignTaskToLesson: async (request) => {
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  assignManyTasksToLesson: async (request) => {
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  removeTaskFromLesson: async (request) => {
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  removeManyTasksFromLesson: async (request) => {
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
        logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createKnowYourAir;
