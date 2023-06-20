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
              lessons: { $nin: [lesson_id] },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
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
              lessons: { $in: [lesson_id] },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
              jobTitle: 1,
              website: 1,
              category: 1,
              country: 1,
              description: 1,
            },
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

      const filter = generateFilter.kyaprogress(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      let requestBody = Object.assign({}, body);
      const responseFromCreateUserLessonProgress = await KnowYourAirUserLessonProgressModel(
        tenant
      ).modify(requestBody);
      logObject(
        "responseFromCreateUserLessonProgress",
        responseFromCreateUserLessonProgress
      );
      return responseFromCreateUserLessonProgress;
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
          errors: { message: "Task or Lesson not found" },
        };
      }

      const task = await KnowYourAirTaskModel(tenant)
        .findById(task_id)
        .lean();

      logObject("task", task);

      if (user.lessons && user.lessons.includes(lesson_id.toString())) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Lesson already assigned to User" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedUser = await KnowYourAirTaskModel(tenant).findByIdAndUpdate(
        user_id,
        { $addToSet: { lessons: lesson_id } },
        { new: true }
      );

      return {
        success: true,
        message: "User assigned to the Lesson",
        data: updatedUser,
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

      for (const user_id of task_ids) {
        const user = await KnowYourAirTaskModel(tenant)
          .findById(ObjectId(user_id))
          .lean();

        if (!user) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Invalid User ID ${user_id}, please crosscheck`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (user.lessons && user.lessons.includes(lesson_id.toString())) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Lesson ${lesson_id} is already assigned to the user ${user_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalTasks = task_ids.length;
      const { nModified, n } = await KnowYourAirTaskModel(tenant).updateMany(
        { _id: { $in: task_ids } },
        { $addToSet: { lessons: lesson_id } }
      );

      const notFoundCount = totalTasks - nModified;
      if (nModified === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "No matching User found in the system" },
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
      const { lesson_id, user_id } = request.params;
      const { tenant } = request.query;

      // Check if the lesson exists
      const lesson = await KnowYourAirLessonModel(tenant).findById(lesson_id);
      if (!lesson) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Lesson not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if the user exists
      const user = await KnowYourAirTaskModel(tenant).findById(user_id);
      if (!user) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: { message: "User not found" },
        };
      }

      // Check if the lesson is part of the user's lessons
      const isLessonInUser = user.lessons.some(
        (lessonId) => lessonId.toString() === lesson_id.toString()
      );
      if (!isLessonInUser) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Lesson ${lesson_id.toString()} is not part of the user's lessons`,
          },
        };
      }

      // Remove the lesson from the user
      const updatedUser = await KnowYourAirTaskModel(tenant).findByIdAndUpdate(
        user_id,
        { $pull: { lessons: lesson_id } },
        { new: true }
      );

      return {
        success: true,
        message: "Successfully unassigned User from the Lesson",
        data: { updatedLesson, updatedUser },
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
          errors: { message: "Lesson not found" },
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

      //check if all the provided task_ids have the lesson_id in their lesson's field?

      const tasks = await KnowYourAirTaskModel(tenant).find({
        _id: { $in: task_ids },
        lessons: { $all: [lesson_id] },
      });

      if (tasks.length !== task_ids.length) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some of the provided User IDs are not assigned to this lesson ${lesson_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //remove the lesson_id from all the user's lesson field

      try {
        const totalTasks = task_ids.length;
        const { nModified, n } = await KnowYourAirTaskModel(tenant).updateMany(
          { _id: { $in: task_ids }, lessons: { $in: [lesson_id] } },
          { $pull: { lessons: lesson_id } },
          { multi: true }
        );

        const notFoundCount = totalTasks - nModified;
        if (nModified === 0) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: { message: "No matching User found in the system" },
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
