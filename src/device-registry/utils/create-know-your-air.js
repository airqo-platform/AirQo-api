const httpStatus = require("http-status");
const KnowYourAirLessonSchema = require("@models/KnowYourAirLesson");
const KnowYourAirTaskSchema = require("@models/KnowYourAirTask");
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
      const opts = { new: false };
      const responseFromModifyKyaLesson = await KnowYourAirLessonModel(
        tenant
      ).modify({ filter, update, opts });
      return responseFromModifyKyaLesson;
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
      const { net_id } = request.params;

      const network = await NetworkModel(tenant).findById(net_id);

      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid network ID ${net_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAvailableUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              networks: { $nin: [net_id] },
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
        "responseFromListAvailableUsers",
        responseFromListAvailableUsers
      );

      return {
        success: true,
        message: `retrieved all available users for network ${net_id}`,
        data: responseFromListAvailableUsers,
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
      const { net_id } = request.params;

      const network = await NetworkModel(tenant).findById(net_id);

      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid network ID ${net_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              networks: { $in: [net_id] },
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

      logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      return {
        success: true,
        message: `retrieved all assigned users for network ${net_id}`,
        data: responseFromListAssignedUsers,
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

      if (user.networks && user.networks.includes(net_id.toString())) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network already assigned to User" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { $addToSet: { networks: net_id } },
        { new: true }
      );

      return {
        success: true,
        message: "User assigned to the Network",
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
      const { net_id } = request.params;
      const { user_ids } = request.body;
      const { tenant } = request.query;

      const network = await NetworkModel(tenant).findById(net_id);

      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid network ID ${net_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      for (const user_id of user_ids) {
        const user = await UserModel(tenant)
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

        if (user.networks && user.networks.includes(net_id.toString())) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Network ${net_id} is already assigned to the user ${user_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalUsers = user_ids.length;
      const { nModified, n } = await UserModel(tenant).updateMany(
        { _id: { $in: user_ids } },
        { $addToSet: { networks: net_id } }
      );

      const notFoundCount = totalUsers - nModified;
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
          message: `Operation partially successful some ${notFoundCount} of the provided users were not found in the system`,
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "successfully assigned all the provided users to the Network",
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
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;

      // Check if the network exists
      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if the user exists
      const user = await UserModel(tenant).findById(user_id);
      if (!user) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: { message: "User not found" },
        };
      }

      // Check if the network is part of the user's networks
      const isNetworkInUser = user.networks.some(
        (networkId) => networkId.toString() === net_id.toString()
      );
      if (!isNetworkInUser) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Network ${net_id.toString()} is not part of the user's networks`,
          },
        };
      }

      // Remove the network from the user
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { $pull: { networks: net_id } },
        { new: true }
      );

      return {
        success: true,
        message: "Successfully unassigned User from the Network",
        data: { updatedNetwork, updatedUser },
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
      const { user_ids } = request.body;
      const { net_id } = request.params;
      const { tenant } = request.query;

      // Check if network exists
      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check of all these provided users actually do exist?
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      if (existingUsers.length !== user_ids.length) {
        const nonExistentUsers = user_ids.filter(
          (user_id) => !existingUsers.find((user) => user._id.equals(user_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following users do not exist: ${nonExistentUsers}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check if all the provided user_ids have the network_id in their network's field?

      const users = await UserModel(tenant).find({
        _id: { $in: user_ids },
        networks: { $all: [net_id] },
      });

      if (users.length !== user_ids.length) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some of the provided User IDs are not assigned to this network ${net_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //remove the net_id from all the user's network field

      try {
        const totalUsers = user_ids.length;
        const { nModified, n } = await UserModel(tenant).updateMany(
          { _id: { $in: user_ids }, networks: { $in: [net_id] } },
          { $pull: { networks: net_id } },
          { multi: true }
        );

        const notFoundCount = totalUsers - nModified;
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
            message: `Operation partially successful since ${notFoundCount} of the provided users were not found in the system`,
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
        message: `successfully unassigned all the provided  users from the network ${net_id}`,
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
