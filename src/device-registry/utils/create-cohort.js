const CohortModel = require("@models/Cohort");
const DeviceModel = require("@models/Device");
const NetworkModel = require("@models/Network");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-cohort-util`
);
const { HttpError } = require("@utils/errors");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createCohort = {
  listNetworks: async (request, next) => {
    try {
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.networks(request, next);
      const responseFromListNetworks = await NetworkModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListNetworks;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateNetwork: async (request, next) => {
    try {
      /**
       * in the near future, this wont be needed since Kafka
       * will handle the entire update process
       */
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.networks(request, next);

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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteNetwork: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.networks(request, next);

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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createNetwork: async (request, next) => {
    try {
      /**
       * in the near future, this wont be needed since Kafka
       * will handle the entire creation process
       */
      const { query, body } = request;
      const { tenant } = query;

      const responseFromCreateNetwork = await NetworkModel(tenant).register(
        body,
        next
      );
      return responseFromCreateNetwork;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = body;

      const responseFromRegisterCohort = await CohortModel(tenant).register(
        modifiedBody,
        next
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
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const update = body;
      const filter = generateFilter.cohorts(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromModifyCohort = await CohortModel(tenant).modify(
          {
            filter,
            update,
          },
          next
        );
        return responseFromModifyCohort;
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.cohorts(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromRemoveCohort = await CohortModel(tenant).remove(
          {
            filter,
          },
          next
        );
        return responseFromRemoveCohort;
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.cohorts(request, next);
      const responseFromListCohort = await CohortModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListCohort;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAvailableDevices: async (request, next) => {
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAssignedDevices: async (request, next) => {
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignManyDevicesToCohort: async (request, next) => {
    try {
      const { cohort_id } = request.params;
      const { device_ids } = request.body;
      const { tenant } = request.query;

      const cohort = await CohortModel(tenant)
        .findById(cohort_id)
        .lean();

      if (!cohort) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid cohort ID ${cohort_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const alreadyAssignedDevices = [];

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

        if (
          device.cohorts &&
          device.cohorts.map(String).includes(cohort_id.toString())
        ) {
          alreadyAssignedDevices.push(device_id);
        }
      }

      if (alreadyAssignedDevices.length > 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `The following devices are already assigned to the Cohort ${cohort_id}: ${alreadyAssignedDevices.join(
              ", "
            )}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }
      //
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
          data: cohort,
        };
      }

      return {
        success: true,
        message: "successfully assigned all the provided devices to the Cohort",
        status: httpStatus.OK,
        data: cohort,
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  unAssignManyDevicesFromCohort: async (request, next) => {
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
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignOneDeviceToCohort: async (request, next) => {
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  unAssignOneDeviceFromCohort: async (request, next) => {
    try {
      const { cohort_id, device_id } = request.params;
      const { tenant } = request.query;

      // Check if the cohort exists
      const cohort = await CohortModel(tenant).findById(cohort_id);
      // Check if the device exists
      const device = await DeviceModel(tenant).findById(device_id);

      if (!cohort || !device) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid Request --- either Cohort ${cohort_id.toString()} or Device ${device_id.toString()} not found`,
          },
          status: httpStatus.BAD_REQUEST,
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
            message: `Device ${device_id.toString()} is not assigned to Cohort ${cohort_id.toString()}`,
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getSiteAndDeviceIds: async (request, next) => {
    try {
      const { cohort_id, tenant } = { ...request.query, ...request.params };
      const cohortDetails = await CohortModel(tenant).findById(cohort_id);
      if (isEmpty(cohortDetails)) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: { message: "This Cohort does not exist" },
          status: httpStatus.BAD_REQUEST,
        };
      }
      // Fetch devices based on the provided Cohort ID
      const devices = await DeviceModel(tenant).find({ cohorts: cohort_id });

      // Extract device IDs from the fetched devices
      const device_ids = devices.map((device) => device._id);

      // Fetch sites for each device concurrently
      const site_ids_promises = device_ids.map(async (deviceId) => {
        const device = await DeviceModel(tenant).findOne({ _id: deviceId });
        return device.site_id;
      });

      const site_ids = await Promise.all(site_ids_promises);

      logObject("device_ids:", device_ids);
      logObject("device_ids:", site_ids);

      return {
        success: true,
        message: "Successfully returned the Site IDs and the Device IDs",
        status: httpStatus.OK,
        data: { device_ids, site_ids },
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = createCohort;
