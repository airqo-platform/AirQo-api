const CohortModel = require("@models/Cohort");
const DeviceModel = require("@models/Device");
const qs = require("qs");
const NetworkModel = require("@models/Network");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { generateFilter } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-cohort-util`
);
const { logObject, logText, HttpError } = require("@utils/shared");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

function filterOutPrivateIDs(privateIds, randomIds) {
  // Create a Set from the privateIds array
  const privateIdSet = new Set(privateIds);

  // Check if privateIds array is empty
  if (privateIdSet.size === 0) {
    return randomIds;
  }

  // Filter randomIds array to exclude privateIds
  const filteredIds = randomIds.filter(
    (randomId) => !privateIdSet.has(randomId)
  );

  return filteredIds;
}

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
  createNetwork: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
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
  updateName: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { name, update_reason } = body;

      const filter = generateFilter.cohorts(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      }

      // First, get the existing cohort to validate it exists
      const existingCohort = await CohortModel(tenant)
        .findOne(filter)
        .lean();
      if (!existingCohort) {
        return {
          success: false,
          message: "Cohort not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "The specified cohort does not exist" },
        };
      }

      // Check if the new name already exists (excluding current cohort)
      const nameExists = await CohortModel(tenant).findOne({
        name: name
          .replace(/[^a-zA-Z0-9]/g, "_")
          .slice(0, 41)
          .trim()
          .toLowerCase(),
        _id: { $ne: existingCohort._id },
      });

      if (nameExists) {
        return {
          success: false,
          message: "Name already exists",
          status: httpStatus.CONFLICT,
          errors: { message: "A cohort with this name already exists" },
        };
      }

      // Prepare the processed name and regenerated cohort_codes
      const processedName = name
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 41)
        .trim()
        .toLowerCase();

      const newCohortCodes = [existingCohort._id, processedName];

      // Prepare the update object
      const update = {
        name: processedName,
        cohort_codes: newCohortCodes,
        $push: {
          name_update_history: {
            updated_at: new Date(),
            reason: update_reason,
            previous_name: existingCohort.name,
            previous_cohort_codes: existingCohort.cohort_codes,
          },
        },
      };

      const responseFromUpdateCohortName = await CohortModel(tenant).modifyName(
        {
          filter,
          update,
        },
        next
      );

      return responseFromUpdateCohortName;
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
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
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
  list: async (request, next) => {
    try {
      const { tenant, limit, skip, detailLevel } = request.query;
      const filter = generateFilter.cohorts(request, next);

      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));

      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "devices",
            localField: "_id",
            foreignField: "cohorts",
            as: "devices",
          },
        },
        { $project: constants.COHORTS_INCLUSION_PROJECTION },
        { $project: constants.COHORTS_EXCLUSION_PROJECTION(detailLevel) },
        {
          $facet: {
            paginatedResults: [
              { $sort: { createdAt: -1 } },
              { $skip: _skip },
              { $limit: _limit },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const results = await CohortModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      const agg =
        Array.isArray(results) && results[0]
          ? results[0]
          : { paginatedResults: [], totalCount: [] };
      const paginatedResults = agg.paginatedResults || [];
      const total =
        Array.isArray(agg.totalCount) && agg.totalCount[0]
          ? agg.totalCount[0].count
          : 0;

      const baseUrl = `${request.protocol}://${request.get("host")}${
        request.originalUrl.split("?")[0]
      }`;

      const meta = {
        total,
        limit: _limit,
        skip: _skip,
        page: Math.floor(_skip / _limit) + 1,
        totalPages: Math.ceil(total / _limit),
      };

      const nextSkip = _skip + _limit;
      if (nextSkip < total) {
        const nextQuery = { ...request.query, skip: nextSkip, limit: _limit };
        meta.nextPage = `${baseUrl}?${qs.stringify(nextQuery)}`;
      }

      const prevSkip = _skip - _limit;
      if (prevSkip >= 0) {
        const prevQuery = { ...request.query, skip: prevSkip, limit: _limit };
        meta.previousPage = `${baseUrl}?${qs.stringify(prevQuery)}`;
      }

      return {
        success: true,
        message: "Successfully retrieved cohorts",
        data: paginatedResults,
        status: httpStatus.OK,
        meta,
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

  verify: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.cohorts(request, next);
      const response = await CohortModel(tenant)
        .find(filter)
        .lean()
        .select("_id");

      if (isEmpty(response)) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: { message: "Invalid Cohort ID provided" },
        };
      } else {
        return {
          success: true,
          status: httpStatus.OK,
          message: "Cohort ID is Valid!!",
        };
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
      return;
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
        message: `successfully unassigned all the provided  devices from the cohort ${cohort_id}`,
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
  filterOutPrivateDevices: async (request, next) => {
    try {
      const { tenant, devices, device_ids, device_names } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const privateCohorts = await CohortModel(tenant)
        .find({
          visibility: false,
        })
        .select("_id")
        .lean();

      const privateCohortIds = privateCohorts.map((cohort) => cohort._id);
      const privateDevices = await DeviceModel(tenant).find({
        cohorts: { $in: privateCohortIds },
      });

      const privateDeviceIds = privateDevices.map((device) =>
        device._id.toString()
      );
      const privateDeviceNames = privateDevices.map((device) => device.name);

      let idsForDevices, deviceIds, deviceNames;

      if (devices || device_ids) {
        idsForDevices = devices ? devices : device_ids || [];
        deviceIds = idsForDevices.map((device) => device.toString());
      } else if (device_names) {
        deviceNames = device_names;
      }

      let publicDevices;
      if (deviceIds) {
        publicDevices = filterOutPrivateIDs(privateDeviceIds, deviceIds);
      } else if (deviceNames) {
        publicDevices = filterOutPrivateIDs(privateDeviceNames, deviceNames);
      }

      return {
        success: true,
        status: httpStatus.OK,
        data: publicDevices,
        message: "operation successful",
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
  createCohortFromCohortIDs: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { name, description, cohort_ids } = body;

      // 1. Fetch all source cohorts to validate they exist and get network ID
      const existingCohorts = await CohortModel(tenant)
        .find({ _id: { $in: cohort_ids } })
        .select("network") // only need network
        .lean();

      logObject("existingCohorts", existingCohorts);

      if (existingCohorts.length !== cohort_ids.length) {
        const foundIds = existingCohorts.map((c) => c._id.toString());
        const notFoundIds = cohort_ids.filter((id) => !foundIds.includes(id));
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `The following cohorts were not found: ${notFoundIds.join(
              ", "
            )}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // 2. Ensure all cohorts belong to the same network
      // 2. Ensure all source cohorts belong to the same network
      if (existingCohorts.length === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message:
              "Cannot create a cohort from an empty list of source cohorts.",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }
      const networkId = existingCohorts[0].network;
      const allSameNetwork = existingCohorts.every(
        (cohort) =>
          cohort.network && cohort.network.toString() === networkId.toString()
      );

      if (!allSameNetwork) {
        // return {
        //   success: false,
        //   message: "Bad Request Error",
        //   errors: {
        //     message: "All provided cohorts must belong to the same network.",
        //   },
        //   status: httpStatus.BAD_REQUEST,
        // };
      }

      // 3. Create the new cohort first to get its ID
      const newCohortData = {
        name,
        description,
        network: networkId,
      };

      const newCohortResponse = await CohortModel(tenant).register(
        newCohortData,
        next
      );

      // const newCohort = newCohortResponse.data;

      const newCohort = newCohortResponse && newCohortResponse.data;
      if (!newCohortResponse?.success || !newCohort) {
        return {
          success: false,
          message: "Failed to create the new cohort",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              newCohortResponse?.errors?.message ||
              "Cohort registration did not return a valid cohort",
          },
        };
      }

      // 4. Find all unique devices belonging to the source cohorts
      const devicesToUpdate = await DeviceModel(tenant)
        .find({ cohorts: { $in: cohort_ids } })
        .distinct("_id");

      if (devicesToUpdate.length === 0) {
        // It's not an error if there are no devices, just return the newly created empty cohort.
        return {
          success: true,
          message:
            "Successfully created an empty cohort as source cohorts have no devices.",
          data: newCohort,
          status: httpStatus.CREATED,
        };
      }

      // 5. Assign the new cohort to all these devices
      const updateResult = await DeviceModel(tenant).updateMany(
        { _id: { $in: devicesToUpdate } },
        { $addToSet: { cohorts: newCohort._id } }
      );

      logObject(
        "updateResult from assigning devices to new cohort",
        updateResult
      );

      return {
        success: true,
        message: `Successfully created cohort and assigned it to ${updateResult.nModified} devices.`,
        data: newCohort,
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (error instanceof HttpError) {
        return next(error);
      }
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  listDevices: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { cohort_ids } = request.body;
      const maxActivities = 500;
      const inclusionProjection = constants.DEVICES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.DEVICES_EXCLUSION_PROJECTION(
        "full"
      );

      const filter = { cohorts: { $in: cohort_ids.map((id) => ObjectId(id)) } };

      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "sites",
            localField: "site_id",
            foreignField: "_id",
            as: "site",
          },
        },
        {
          $lookup: {
            from: "hosts",
            localField: "host_id",
            foreignField: "_id",
            as: "host",
          },
        },
        {
          $lookup: {
            from: "sites",
            localField: "previous_sites",
            foreignField: "_id",
            as: "previous_sites",
          },
        },
        {
          $lookup: {
            from: "cohorts",
            localField: "cohorts",
            foreignField: "_id",
            as: "cohorts",
          },
        },
        {
          $lookup: {
            from: "grids",
            localField: "site.grids",
            foreignField: "_id",
            as: "grids",
          },
        },
        {
          $lookup: {
            from: "grids",
            localField: "grid_id",
            foreignField: "_id",
            as: "assigned_grid",
          },
        },
        {
          $lookup: {
            from: "activities",
            let: { deviceName: "$name", deviceId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$device", "$$deviceName"] },
                      { $eq: ["$device_id", "$$deviceId"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              {
                $project: {
                  _id: 1,
                  site_id: 1,
                  device_id: 1,
                  device: 1,
                  activityType: 1,
                  maintenanceType: 1,
                  recallType: 1,
                  date: 1,
                  description: 1,
                  nextMaintenance: 1,
                  createdAt: 1,
                  tags: 1,
                },
              },
              { $limit: maxActivities },
            ],
            as: "activities",
          },
        },
        {
          $lookup: {
            from: "activities",
            let: { deviceName: "$name", deviceId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$device", "$$deviceName"] },
                          { $eq: ["$device_id", "$$deviceId"] },
                        ],
                      },
                      { $eq: ["$activityType", "deployment"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "latest_deployment_activity",
          },
        },
        {
          $lookup: {
            from: "activities",
            let: { deviceName: "$name", deviceId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$device", "$$deviceName"] },
                          { $eq: ["$device_id", "$$deviceId"] },
                        ],
                      },
                      { $eq: ["$activityType", "maintenance"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "latest_maintenance_activity",
          },
        },
        {
          $lookup: {
            from: "activities",
            let: { deviceName: "$name", deviceId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $or: [
                          { $eq: ["$device", "$$deviceName"] },
                          { $eq: ["$device_id", "$$deviceId"] },
                        ],
                      },
                      {
                        $or: [
                          { $eq: ["$activityType", "recall"] },
                          { $eq: ["$activityType", "recallment"] },
                        ],
                      },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "latest_recall_activity",
          },
        },
        {
          $addFields: {
            total_activities: {
              $cond: [{ $isArray: "$activities" }, { $size: "$activities" }, 0],
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $project: inclusionProjection },
        { $project: exclusionProjection },
      ];

      const devices = await DeviceModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      if (isEmpty(devices)) {
        return {
          success: true,
          message: "No devices found for the provided cohorts",
          data: [],
          status: httpStatus.OK,
        };
      }

      // Post-processing for consistency
      devices.forEach((device) => {
        // Process latest activities to extract single objects
        device.latest_deployment_activity =
          device.latest_deployment_activity &&
          device.latest_deployment_activity.length > 0
            ? device.latest_deployment_activity[0]
            : null;

        device.latest_maintenance_activity =
          device.latest_maintenance_activity &&
          device.latest_maintenance_activity.length > 0
            ? device.latest_maintenance_activity[0]
            : null;

        device.latest_recall_activity =
          device.latest_recall_activity &&
          device.latest_recall_activity.length > 0
            ? device.latest_recall_activity[0]
            : null;

        // Create activities by type mapping
        if (device.activities && device.activities.length > 0) {
          const activitiesByType = {};
          const latestActivitiesByType = {};

          device.activities.forEach((activity) => {
            const type = activity.activityType || "unknown";
            activitiesByType[type] = (activitiesByType[type] || 0) + 1;

            if (
              !latestActivitiesByType[type] ||
              new Date(activity.createdAt) >
                new Date(latestActivitiesByType[type].createdAt)
            ) {
              latestActivitiesByType[type] = activity;
            }
          });

          device.activities_by_type = activitiesByType;
          device.latest_activities_by_type = latestActivitiesByType;
        } else {
          device.activities_by_type = {};
          device.latest_activities_by_type = {};
        }

        // Process assigned_grid to extract single object
        if (device.assigned_grid && device.assigned_grid.length > 0) {
          const grid = device.assigned_grid[0];
          device.assigned_grid = {
            _id: grid._id,
            name: grid.name,
            admin_level: grid.admin_level,
            long_name: grid.long_name,
          };
        } else {
          device.assigned_grid = null;
        }
      });

      return {
        success: true,
        message: "Successfully retrieved devices for the provided cohorts",
        data: devices,
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

module.exports = createCohort;
