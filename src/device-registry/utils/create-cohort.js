const CohortSchema = require("@models/Cohort");
const DeviceSchema = require("@models/Device");
const NetworkSchema = require("@models/Network");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("@config/database");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-cohort-util`
);
const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const ObjectId = mongoose.Types.ObjectId;
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const CohortModel = (tenant) => {
  try {
    const cohorts = mongoose.model("cohorts");
    return cohorts;
  } catch (error) {
    const cohorts = getModelByTenant(tenant, "cohort", CohortSchema);
    return cohorts;
  }
};

const DeviceModel = (tenant) => {
  try {
    const devices = mongoose.model("devices");
    return devices;
  } catch (error) {
    const devices = getModelByTenant(tenant, "device", DeviceSchema);
    return devices;
  }
};

const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
  }
};

const createCohort = {
  listNetworks: async (request) => {
    try {
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.networks(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }
      const responseFromListNetworks = await NetworkModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListNetworks;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateNetwork: async (request) => {
    try {
      /**
       * in the near future, this wont be needed since Kafka
       * will handle the entire update process
       */
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.networks(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }
      if (isEmpty(filter)) {
        return {
          success: false,
          message: "Unable to find filter value",
          errors: { message: "Unable to find filter value" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const network = await NetworkModel(tenant)
        .find(filter)
        .lean();

      logObject("network", network);

      if (network.length !== 1) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Invalid Network Data" },
          status: httpStatus.BAD_REQUEST,
        };
      } else {
        const networkId = network[0]._id;
        const responseFromUpdateNetwork = await NetworkModel(
          tenant
        ).findByIdAndUpdate(ObjectId(networkId), body, { new: true });

        logObject(
          "responseFromUpdateNetwork in Util",
          responseFromUpdateNetwork
        );

        if (!isEmpty(responseFromUpdateNetwork)) {
          return {
            success: true,
            message: "successfuly updated the network",
            status: httpStatus.OK,
            data: responseFromUpdateNetwork,
          };
        } else if (isEmpty(responseFromUpdateNetwork)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: "unable to update the Network" },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteNetwork: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.networks(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }

      const network = await NetworkModel(tenant)
        .find(filter)
        .lean();

      logObject("network", network);

      if (network.length !== 1) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Invalid Network Data" },
          status: httpStatus.BAD_REQUEST,
        };
      } else {
        const networkId = network[0]._id;
        const responseFromDeleteNetwork = await NetworkModel(
          tenant
        ).findByIdAndDelete(ObjectId(networkId));

        if (!isEmpty(responseFromDeleteNetwork)) {
          return {
            success: true,
            message: "successfuly deleted the network",
            status: httpStatus.OK,
            data: responseFromDeleteNetwork,
          };
        } else if (isEmpty(responseFromDeleteNetwork)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: "unable to delete the Network" },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createNetwork: async (request) => {
    try {
      /**
       * in the near future, this wont be needed since Kafka
       * will handle the entire creation process
       */
      const { query, body } = request;
      const { tenant } = query;

      const responseFromCreateNetwork = await NetworkModel(tenant).register(
        body
      );
      return responseFromCreateNetwork;
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

  create: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = body;

      const responseFromRegisterCohort = await CohortModel(tenant).register(
        modifiedBody
      );

      logObject("responseFromRegisterCohort", responseFromRegisterCohort);

      if (responseFromRegisterCohort.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.COHORT_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterCohort.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterCohort;
      } else if (responseFromRegisterCohort.success === false) {
        return responseFromRegisterCohort;
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
      };
    }
  },
  update: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const update = body;
      const filter = generateFilter.cohorts(request);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromModifyCohort = await CohortModel(tenant).modify({
          filter,
          update,
        });
        return responseFromModifyCohort;
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.cohorts(request);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromRemoveCohort = await CohortModel(tenant).remove({
          filter,
        });
        return responseFromRemoveCohort;
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to delete airqloud",
        errors: err.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;

      const filter = generateFilter.cohorts(request);

      if (filter.success && filter.success === "false") {
        return filter;
      }

      const responseFromListCohort = await CohortModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListCohort;
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to list airqloud",
        errors: err.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  listAvailableDevices: async (request) => {
    try {
      const { tenant } = request.query;
      const { cohort_id } = request.params;

      const cohort = await CohortModel(tenant).findById(cohort_id);

      if (!cohort) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid cohort ID ${cohort_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAvailableDevices = await DeviceModel(tenant)
        .aggregate([
          {
            $match: {
              cohorts: { $nin: [cohort_id] },
            },
          },
          {
            $project: {
              _id: 1,
              long_name: 1,
              name: 1,
              description: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
            },
          },
        ])
        .exec();

      logObject(
        "responseFromListAvailableDevices",
        responseFromListAvailableDevices
      );

      return {
        success: true,
        message: `retrieved all available devices for cohort ${cohort_id}`,
        data: responseFromListAvailableDevices,
        status: httpStatus.OK,
      };
    } catch (error) {
      logElement("internal server error", error.message);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  listAssignedDevices: async (request) => {
    try {
      const { tenant } = request.query;
      const { cohort_id } = request.params;

      const cohort = await CohortModel(tenant).findById(cohort_id);

      if (!cohort) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid cohort ID ${cohort_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAssignedDevices = await DeviceModel(tenant)
        .aggregate([
          {
            $match: {
              cohorts: { $in: [cohort_id] },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              long_name: 1,
              description: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
            },
          },
        ])
        .exec();

      logObject(
        "responseFromListAssignedDevices",
        responseFromListAssignedDevices
      );

      return {
        success: true,
        message: `retrieved all assigned devices for cohort ${cohort_id}`,
        data: responseFromListAssignedDevices,
        status: httpStatus.OK,
      };
    } catch (error) {
      logElement("internal server error", error.message);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  assignManyDevicesToCohort: async (request) => {
    try {
      const { cohort_id } = request.params;
      const { device_ids } = request.body;
      const { tenant } = request.query;

      const cohort = await CohortModel(tenant).findById(cohort_id);

      if (!cohort) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid cohort ID ${cohort_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      for (const device_id of device_ids) {
        const device = await DeviceModel(tenant)
          .findById(ObjectId(device_id))
          .lean();

        if (!device) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Invalid Device ID ${device_id}, please crosscheck`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (device.cohorts && device.cohorts.includes(cohort_id.toString())) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Cohort ${cohort_id} is already assigned to the device ${device_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalDevices = device_ids.length;
      const { nModified, n } = await DeviceModel(tenant).updateMany(
        { _id: { $in: device_ids } },
        { $addToSet: { cohorts: cohort_id } }
      );

      const notFoundCount = totalDevices - nModified;
      if (nModified === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "No matching Device found in the system" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (notFoundCount > 0) {
        return {
          success: true,
          message: `Operation partially successful some ${notFoundCount} of the provided devices were not found in the system`,
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "successfully assigned all the provided devices to the Cohort",
        status: httpStatus.OK,
        data: [],
      };
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  unAssignManyDevicesFromCohort: async (request) => {
    try {
      const { device_ids } = request.body;
      const { cohort_id } = request.params;
      const { tenant } = request.query;

      // Check if cohort exists
      const cohort = await CohortModel(tenant).findById(cohort_id);
      if (!cohort) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Cohort not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check of all these provided devices actually do exist?
      const existingDevices = await DeviceModel(tenant).find(
        { _id: { $in: device_ids } },
        "_id"
      );

      if (existingDevices.length !== device_ids.length) {
        const nonExistentDevices = device_ids.filter(
          (device_id) =>
            !existingDevices.find((device) => device._id.equals(device_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following devices do not exist: ${nonExistentDevices}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check if all the provided device_ids have the cohort_id in their cohort's field?

      const devices = await DeviceModel(tenant).find({
        _id: { $in: device_ids },
        cohorts: { $all: [cohort_id] },
      });

      if (devices.length !== device_ids.length) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some of the provided Device IDs are not assigned to this cohort ${cohort_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //remove the cohort_id from all the device's cohort field

      try {
        const totalDevices = device_ids.length;
        const { nModified, n } = await DeviceModel(tenant).updateMany(
          { _id: { $in: device_ids }, cohorts: { $in: [cohort_id] } },
          { $pull: { cohorts: cohort_id } },
          { multi: true }
        );

        const notFoundCount = totalDevices - nModified;
        if (nModified === 0) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: { message: "No matching Device found in the system" },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (notFoundCount > 0) {
          return {
            success: true,
            message: `Operation partially successful since ${notFoundCount} of the provided devices were not found in the system`,
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
        message: `successfully unassigned all the provided  devices from the cohort ${cohort_id}`,
        status: httpStatus.OK,
        data: [],
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  assignOneDeviceToCohort: async (request) => {
    try {
      const { cohort_id, device_id } = request.params;
      const { tenant } = request.query;

      const deviceExists = await DeviceModel(tenant).exists({ _id: device_id });
      const cohortExists = await CohortModel(tenant).exists({
        _id: cohort_id,
      });

      if (!deviceExists || !cohortExists) {
        return {
          success: false,
          message: "Device or Cohort not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Device ${device_id} or Cohort ${cohort_id} not found`,
          },
        };
      }

      const device = await DeviceModel(tenant)
        .findById(device_id)
        .lean();

      logObject("device", device);

      if (
        device.cohorts &&
        device.cohorts.map(String).includes(cohort_id.toString())
      ) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Device already assigned to Cohort" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedDevice = await DeviceModel(tenant).findByIdAndUpdate(
        device_id,
        { $addToSet: { cohorts: cohort_id } },
        { new: true }
      );

      return {
        success: true,
        message: "Device assigned to the Cohort",
        data: updatedDevice,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  unAssignOneDeviceFromCohort: async (request) => {
    try {
      const { cohort_id, device_id } = request.params;
      const { tenant } = request.query;

      // Check if the cohort exists
      const cohort = await CohortModel(tenant).findById(cohort_id);
      if (!cohort) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Cohort not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if the device exists
      const device = await DeviceModel(tenant).findById(device_id);
      if (!device) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: { message: "Device not found" },
        };
      }

      // Check if the cohort is part of the device's cohorts
      const isCohortInDevice = device.cohorts.some(
        (cohortId) => cohortId.toString() === cohort_id.toString()
      );
      if (!isCohortInDevice) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Cohort ${cohort_id.toString()} is not part of the device's cohorts`,
          },
        };
      }

      // Remove the cohort from the device
      const updatedDevice = await DeviceModel(tenant).findByIdAndUpdate(
        device_id,
        { $pull: { cohorts: cohort_id } },
        { new: true }
      );

      return {
        success: true,
        message: "Successfully unassigned Device from the Cohort",
        data: updatedDevice,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createCohort;
