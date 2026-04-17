const CohortModel = require("@models/Cohort");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const CohortDeviceSnapshotModel = require("@models/CohortDeviceSnapshot");
const CohortSiteSnapshotModel = require("@models/CohortSiteSnapshot");
const qs = require("qs");
const networkUtil = require("@utils/network.util");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { generateFilter, stringify } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-cohort-util`,
);
const { logObject, logText, HttpError } = require("@utils/shared");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const buildDeviceSetKey = (deviceIds) => {
  // Canonical key for a set of devices, used for grouping
  return deviceIds
    .map((id) => id.toString())
    .sort()
    .join(",");
};

function filterOutPrivateIDs(privateIds, randomIds) {
  // Create a Set from the privateIds array
  const privateIdSet = new Set(privateIds);

  // Check if privateIds array is empty
  if (privateIdSet.size === 0) {
    return randomIds;
  }

  // Filter randomIds array to exclude privateIds
  const filteredIds = randomIds.filter(
    (randomId) => !privateIdSet.has(randomId),
  );

  return filteredIds;
}

const createCohort = {
  // Network CRUD — logic lives in network.util.js; these are kept for
  // backward compatibility so the existing /cohorts/networks endpoints
  // continue to work without any changes to the cohort controller or routes.
  listNetworks: (request, next) => networkUtil.listNetworks(request, next),
  updateNetwork: (request, next) => networkUtil.updateNetwork(request, next),
  deleteNetwork: (request, next) => networkUtil.deleteNetwork(request, next),
  createNetwork: (request, next) => networkUtil.createNetwork(request, next),
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = body;

      const responseFromRegisterCohort = await CohortModel(tenant).register(
        modifiedBody,
        next,
      );

      logObject("responseFromRegisterCohort", responseFromRegisterCohort);

      if (responseFromRegisterCohort.success === true) {
        try {
          const kafkaProducer = kafka.producer();
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.COHORT_TOPIC,
            messages: [
              {
                action: "create",
                value: stringify(responseFromRegisterCohort.data),
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
          { message: error.message },
        ),
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
          next,
        );
        return responseFromModifyCohort;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
        next,
      );

      return responseFromUpdateCohortName;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
          next,
        );
        return responseFromRemoveCohort;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  list: async (request, next) => {
    try {
      const { tenant, limit, skip, detailLevel, sortBy, order } = request.query;
      const filter = generateFilter.cohorts(request, next);

      const originalFilter = { ...filter };

      // Only exclude user cohorts if we are not fetching by a specific ID
      if (!filter._id) {
        const userCohortExclusion = { name: { $not: /^coh_user_/i } };
        if (filter.name) {
          // If a name filter already exists, combine it with the exclusion using $and
          const existingNameFilter = { name: filter.name };
          filter.$and = [
            ...(filter.$and || []),
            existingNameFilter,
            userCohortExclusion,
          ];
          delete filter.name;
        } else {
          // If no name filter, just add the exclusion directly
          filter.name = userCohortExclusion.name;
        }
      }

      const result = await createCohort._list(request, filter, next);

      // Handle case where a specific cohort ID was requested but not found
      if (
        isEmpty(result.data) &&
        originalFilter._id &&
        Object.keys(originalFilter).length === 1
      ) {
        const idString = originalFilter._id.$in
          ? `[${originalFilter._id.$in.join(", ")}]`
          : originalFilter._id;
        return {
          success: false,
          message: "Cohort not found",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: `Cohort with ID ${idString} does not exist`,
          },
        };
      }

      return {
        ...result,
        message: "Successfully retrieved cohorts",
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  _list: async (request, filter, next) => {
    try {
      const { tenant, limit, skip, detailLevel, sortBy, order } = request.query;
      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));
      const sortOrder = order === "asc" ? 1 : -1;
      const sortField = sortBy ? sortBy : "createdAt";

      const pipeline = [
        { $match: filter },
        {
          // Simple array-membership join: MongoDB can use a multikey index on
          // devices.cohorts with this form, unlike the correlated $expr/$in
          // pipeline approach. Field trimming is handled downstream by the
          // $map in COHORTS_INCLUSION_PROJECTION.
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
              { $sort: { [sortField]: sortOrder } },
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

      const baseUrl =
        typeof request.protocol === "string" &&
        typeof request.get === "function" &&
        typeof request.originalUrl === "string"
          ? `${request.protocol}://${request.get("host")}${
              request.originalUrl.split("?")[0]
            }`
          : "";

      const meta = {
        total,
        limit: _limit,
        skip: _skip,
        page: Math.floor(_skip / _limit) + 1,
        totalPages: Math.ceil(total / _limit),
      };

      if (baseUrl) {
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
      }

      return {
        success: true,
        data: paginatedResults,
        status: httpStatus.OK,
        meta,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error on _list: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      // Ensure we don't proceed with a partial result
      return {
        success: false,
      };
    }
  },

  listUserCohorts: async (request, next) => {
    try {
      const { tenant, limit, skip, detailLevel, sortBy, order } = request.query;
      const filter = generateFilter.cohorts(request, next);

      const originalFilter = { ...filter };
      // Filter for only individual user cohorts. Use $and to correctly combine with other name filters.
      const userCohortInclusion = { name: { $regex: /^coh_user_/i } };
      if (filter.name) {
        // If filter.name is a string, it's treated as an implicit $eq.
        // If it's an object, it contains operators like $in.
        // In both cases, we create a separate object for the $and array.
        const existingNameFilter = { name: filter.name };
        filter.$and = [
          ...(filter.$and || []),
          existingNameFilter,
          userCohortInclusion,
        ];
        delete filter.name;
      } else {
        // If no name filter exists, just add the regex filter
        filter.name = userCohortInclusion.name;
      }

      const result = await createCohort._list(request, filter, next);

      if (
        isEmpty(result.data) &&
        originalFilter._id &&
        Object.keys(originalFilter).length === 1
      ) {
        const idString = originalFilter._id.$in
          ? `[${originalFilter._id.$in.join(", ")}]`
          : originalFilter._id;
        return {
          success: false,
          message: "User Cohort not found",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: `User Cohort with ID ${idString} does not exist`,
          },
        };
      }

      return {
        ...result,
        message: "Successfully retrieved user cohorts",
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  verify: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.cohorts(request, next);
      const response = await CohortModel(tenant) // Use findOne for single document lookup
        .findOne(filter)
        .lean()
        .select("_id name");

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
          data: response, // Directly return the cohort object
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
                  format: "%Y-%m-%dT%H:%M:%SZ",
                  date: "$createdAt",
                },
              },
            },
          },
        ])
        .exec();

      logObject(
        "responseFromListAvailableDevices",
        responseFromListAvailableDevices,
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
          { message: error.message },
        ),
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
                  format: "%Y-%m-%dT%H:%M:%SZ",
                  date: "$createdAt",
                },
              },
            },
          },
        ])
        .exec();

      logObject(
        "responseFromListAssignedDevices",
        responseFromListAssignedDevices,
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
          { message: error.message },
        ),
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

      // Batch fetch all devices at once to avoid N+1 queries
      const existingDevices = await DeviceModel(tenant)
        .find({ _id: { $in: device_ids } })
        .select("_id cohorts")
        .lean();

      const foundIds = new Set(existingDevices.map((d) => d._id.toString()));
      const notFoundIds = device_ids.filter(
        (id) => !foundIds.has(id.toString()),
      );

      if (notFoundIds.length > 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `The following Device IDs were not found: ${notFoundIds.join(", ")}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Split into already-assigned and new-to-assign; proceed with new ones
      const cohortIdStr = cohort_id.toString();
      const alreadyAssigned = existingDevices
        .filter(
          (d) =>
            d.cohorts && d.cohorts.map(String).includes(cohortIdStr),
        )
        .map((d) => d._id);

      const toAssign = existingDevices
        .filter(
          (d) =>
            !d.cohorts || !d.cohorts.map(String).includes(cohortIdStr),
        )
        .map((d) => d._id);

      if (toAssign.length === 0) {
        return {
          success: true,
          message: "All provided devices are already assigned to this cohort",
          status: httpStatus.OK,
          data: { assigned: [], already_assigned: alreadyAssigned },
        };
      }

      await DeviceModel(tenant).updateMany(
        { _id: { $in: toAssign } },
        { $addToSet: { cohorts: cohort_id } },
      );

      // Re-query after the update to confirm which devices were actually assigned,
      // guarding against concurrent requests that may have already written the same cohort_id.
      const confirmedDocs = await DeviceModel(tenant)
        .find({ _id: { $in: toAssign }, cohorts: cohort_id })
        .select("_id")
        .lean();
      const confirmedAssigned = confirmedDocs.map((d) => d._id);

      const partialMessage =
        alreadyAssigned.length > 0
          ? `${alreadyAssigned.length} device(s) were already assigned and skipped`
          : null;

      return {
        success: true,
        message: partialMessage
          ? `Partially successful: ${partialMessage}`
          : "Successfully assigned all provided devices to the cohort",
        status: httpStatus.OK,
        data: { assigned: confirmedAssigned, already_assigned: alreadyAssigned },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
        "_id",
      );

      if (existingDevices.length !== device_ids.length) {
        const nonExistentDevices = device_ids.filter(
          (device_id) =>
            !existingDevices.find((device) => device._id.equals(device_id)),
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
          { multi: true },
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
          { message: error.message },
        ),
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
        { new: true },
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
          { message: error.message },
        ),
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
        (cohortId) => cohortId.toString() === cohort_id.toString(),
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
        { new: true },
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
          { message: error.message },
        ),
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
      const devices = await DeviceModel(tenant)
        .find({ cohorts: cohort_id })
        .select("_id site_id")
        .lean();

      // Extract device and site IDs directly from the fetched documents
      const device_ids = devices.map((device) => device._id);
      const site_ids = devices.map((device) => device.site_id);

      logObject("device_ids:", device_ids);
      logObject("site_ids:", site_ids);

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
          { message: error.message },
        ),
      );
    }
  },
  filterOutPrivateDevices: async (request, next) => {
    try {
      const { tenant, devices, device_ids, device_names, user_id } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const privateCohorts = await CohortModel(tenant)
        .find({ visibility: false })
        .select("_id")
        .lean();

      const privateCohortIds = privateCohorts.map((cohort) => cohort._id);

      // When a user_id is provided, exclude devices owned by that user from the
      // "private" set so owners can always access their own device data.
      const privateDevicesQuery = { cohorts: { $in: privateCohortIds } };
      if (user_id && ObjectId.isValid(user_id)) {
        privateDevicesQuery.owner_id = { $ne: new ObjectId(user_id) };
      }
      const privateDevices = await DeviceModel(tenant).find(
        privateDevicesQuery,
      );

      const privateDeviceIds = privateDevices.map((device) =>
        device._id.toString(),
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
          { message: error.message },
        ),
      );
    }
  },
  promoteCohorts: async (request, next) => {
    try {
      const { cohort_ids } = request.body;
      const tenant = request.query.tenant || request.body.tenant;

      const objectIds = cohort_ids.map((id) => new ObjectId(id));

      // Identify which IDs exist in the DB
      const existingCohorts = await CohortModel(tenant)
        .find({ _id: { $in: objectIds } })
        .select("_id visibility")
        .lean();

      const existingIds = new Set(
        existingCohorts.map((c) => c._id.toString()),
      );
      const notFound = cohort_ids.filter((id) => !existingIds.has(id));
      const alreadyPublic = existingCohorts
        .filter((c) => c.visibility === true)
        .map((c) => c._id.toString());
      const toPromote = existingCohorts
        .filter((c) => c.visibility !== true)
        .map((c) => c._id);

      if (toPromote.length > 0) {
        await CohortModel(tenant).updateMany(
          { _id: { $in: toPromote } },
          { $set: { visibility: true } },
        );
      }

      return {
        success: true,
        status: httpStatus.OK,
        message: (() => {
          if (toPromote.length > 0 && notFound.length > 0) {
            return `Promoted ${toPromote.length} cohort(s) to public; ${notFound.length} ID(s) not found`;
          }
          if (toPromote.length > 0) {
            return `Successfully promoted ${toPromote.length} cohort(s) to public`;
          }
          if (notFound.length > 0) {
            return `No cohorts promoted; the following ID(s) were not found: ${notFound.join(", ")}`;
          }
          return "All provided cohorts are already public";
        })(),
        data: {
          promoted: toPromote.map((id) => id.toString()),
          already_public: alreadyPublic,
          not_found: notFound,
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
              ", ",
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
          cohort.network && cohort.network.toString() === networkId.toString(),
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
        next,
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
        { $addToSet: { cohorts: newCohort._id } },
      );

      logObject(
        "updateResult from assigning devices to new cohort",
        updateResult,
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
          },
        ),
      );
    }
  },
  findOriginal: async (request, next) => {
    try {
      const { cohort_id } = request.params;
      const { tenant } = request.query;

      // 1. Find the source cohort and its devices
      const sourceCohort = await CohortModel(tenant)
        .findById(cohort_id)
        .lean();
      if (!sourceCohort) {
        return {
          success: false,
          message: "Cohort not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Cohort with ID ${cohort_id} not found` },
        };
      }

      // 2. Find all cohorts that share devices with the source cohort.
      // This is more efficient than fetching all device IDs first.
      const candidateCohorts = await DeviceModel(tenant).distinct("cohorts", {
        cohorts: cohort_id,
      });

      if (candidateCohorts.length <= 1) {
        return {
          success: true,
          message: "This cohort is unique and has no duplicates.",
          data: null,
          status: httpStatus.OK,
        };
      }

      // 3. Group these candidates by their full device set
      const devicesByCohort = await DeviceModel(tenant).aggregate([
        { $match: { cohorts: { $in: candidateCohorts } } },
        { $unwind: "$cohorts" },
        { $match: { cohorts: { $in: candidateCohorts } } },
        { $group: { _id: "$cohorts", deviceIds: { $push: "$_id" } } },
      ]);

      const cohortDeviceSets = new Map();
      for (const item of devicesByCohort) {
        cohortDeviceSets.set(
          item._id.toString(),
          buildDeviceSetKey(item.deviceIds),
        );
      }

      // 4. Identify the group of cohorts with the exact same device set
      const sourceKey = cohortDeviceSets.get(cohort_id.toString());
      const duplicateGroupIdSet = new Set();
      for (const [id, key] of cohortDeviceSets.entries()) {
        if (key === sourceKey) {
          duplicateGroupIdSet.add(id);
        }
      }

      const duplicateGroupIds = Array.from(duplicateGroupIdSet).map(
        (id) => new ObjectId(id),
      );

      if (duplicateGroupIds.length <= 1) {
        return {
          success: true,
          message: "This cohort is unique and has no duplicates.",
          data: null,
          status: httpStatus.OK,
        };
      }

      // 5. Find the oldest cohort in the group (the "original")
      const originalCohort = await CohortModel(tenant)
        .find({ _id: { $in: duplicateGroupIds } })
        .sort({ createdAt: 1, _id: 1 }) // Sort by creation date, then by ID as a tie-breaker
        .limit(1)
        .lean();

      if (originalCohort.length === 0) {
        // This case should be rare
        return {
          success: false,
          message: "Could not determine the original cohort.",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        success: true,
        message: "Original cohort found.",
        data: originalCohort[0],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error on findOriginal: ${error.message}`,
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listDevices: async (request, next) => {
    try {
      const {
        tenant,
        limit,
        skip,
        activities_limit,
        sortBy,
        order,
      } = request.query;
      const { cohort_ids } = {
        ...request.body,
        ...request.query,
      };

      // Pagination and activities controls
      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
      const activitiesLimit = Math.min(
        parseInt(activities_limit, 10) || 100,
        500,
      );

      // Sorting controls
      const sortOrder = order === "asc" ? 1 : -1;
      const sortField = sortBy ? sortBy : "createdAt";

      const inclusionProjection = constants.DEVICES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.DEVICES_EXCLUSION_PROJECTION(
        "summary",
      );

      // ✅ Get standard device filter from generateFilter
      const baseFilter = generateFilter.devices(request, next);

      // ✅ Merge with cohort-specific filter
      const filter = {
        ...baseFilter,
        cohorts: { $in: cohort_ids.map((id) => ObjectId(id)) },
      };

      // Get total count for pagination metadata before applying limit and skip
      const total = await DeviceModel(tenant)
        .countDocuments(filter)
        .maxTimeMS(45000);

      const pipeline = [
        { $match: filter },
        { $sort: { [sortField]: sortOrder } },
        { $skip: _skip },
        { $limit: _limit },
        {
          $lookup: {
            from: "sites",
            localField: "site_id",
            foreignField: "_id",
            as: "site",
          },
        },
        // Normalize site array to a single doc for downstream lookups
        {
          $addFields: {
            site: {
              $cond: [
                { $gt: [{ $size: "$site" }, 0] },
                { $arrayElemAt: ["$site", 0] },
                null,
              ],
            },
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
          // Simple-form $lookup allows MongoDB to use the _id index on the grids
          // collection. The previous pipeline-form with $expr/$in blocked index
          // usage, causing a full grids collection scan per device.
          $lookup: {
            from: "grids",
            localField: "site.grids",
            foreignField: "_id",
            as: "grids",
          },
        },
        {
          // Trim grids to the same field subset the previous pipeline-form
          // $project returned, keeping the response payload unchanged.
          $addFields: {
            grids: {
              $map: {
                input: "$grids",
                as: "g",
                in: {
                  _id: "$$g._id",
                  name: "$$g.name",
                  admin_level: "$$g.admin_level",
                  long_name: "$$g.long_name",
                },
              },
            },
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
        // ── Main activities — split by device_id / device-name to allow index use ─
        // A single $expr/$or on two fields prevents MongoDB from using either
        // { device_id, createdAt } or { device, createdAt } index. Two targeted
        // single-field lookups let MongoDB use an index for each branch.
        {
          $lookup: {
            from: "activities",
            let: { deviceId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$device_id", "$$deviceId"] } } },
              { $sort: { createdAt: -1 } },
              {
                $project: {
                  _id: 1, site_id: 1, device_id: 1, device: 1,
                  activityType: 1, maintenanceType: 1, recallType: 1,
                  date: 1, description: 1, nextMaintenance: 1,
                  createdAt: 1, tags: 1,
                },
              },
              { $limit: activitiesLimit },
            ],
            as: "_activities_by_id",
          },
        },
        {
          $lookup: {
            from: "activities",
            let: { deviceName: "$name" },
            pipeline: [
              // device_id: null restricts to legacy name-only records, preventing
              // overlap with the device_id branch and avoiding duplicate fetches.
              { $match: { device_id: null, $expr: { $eq: ["$device", "$$deviceName"] } } },
              { $sort: { createdAt: -1 } },
              {
                $project: {
                  _id: 1, site_id: 1, device_id: 1, device: 1,
                  activityType: 1, maintenanceType: 1, recallType: 1,
                  date: 1, description: 1, nextMaintenance: 1,
                  createdAt: 1, tags: 1,
                },
              },
              { $limit: activitiesLimit },
            ],
            as: "_activities_by_name",
          },
        },
        {
          $addFields: {
            // Both branches are disjoint after the device_id:null constraint above,
            // so $concatArrays is safe (no duplicates). The slice to activitiesLimit
            // is deferred to JS post-processing so the global sort runs first —
            // otherwise the name-branch tail is dropped before sorting, which can
            // exclude newer legacy rows from the latestActivitiesByType derivation.
            activities: {
              $concatArrays: ["$_activities_by_id", "$_activities_by_name"],
            },
          },
        },
        { $unset: ["_activities_by_id", "_activities_by_name"] },
        // Typed-activity fields (latest_deployment_activity, latest_maintenance_activity,
        // latest_recall_activity) are derived in JS post-processing from the merged
        // activities array. Running 6 separate $lookup stages here for each type would
        // add 6 extra DB sub-queries per device (60 extra queries for a page of 10),
        // which is the primary driver of the 504s under concurrent load.
        // total_activities and activities_loaded are handled by the inclusion
        // projection ($project: DEVICES_INCLUSION_PROJECTION):
        //   - total_activities uses cached_total_activities (device doc field) when
        //     present, otherwise falls back to $size(activities).
        //   - activities_loaded is not in the inclusion projection and was never
        //     reaching the response.
        // The separate count $lookup stages that previously computed these values
        // were pure overhead (their results were discarded by the $project stage).
        { $project: inclusionProjection },
        { $project: exclusionProjection },
      ];

      // Mongoose 5.x ignores a plain-object second argument to .aggregate();
      // options must be applied via .option() on the returned Aggregate instance.
      const paginatedResults = await DeviceModel(tenant)
        .aggregate(pipeline)
        .option({ maxTimeMS: 45000 })
        .allowDiskUse(true);

      // Post-processing for consistency
      paginatedResults.forEach((device) => {
        // Sort the merged activities array by most recent first, then trim to
        // activitiesLimit. The $slice was moved out of the pipeline so that both
        // id-branch and name-branch items are considered before any are dropped.
        if (device.activities && device.activities.length > 1) {
          device.activities.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
        }
        if (device.activities && device.activities.length > activitiesLimit) {
          device.activities = device.activities.slice(0, activitiesLimit);
        }

        // Build per-type counts and latest-activity map.
        // Typed-activity fields (latest_deployment_activity etc.) are derived
        // from this map instead of running 6 separate DB lookups per device.
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

          // Derive typed-activity fields from the already-sorted activities array
          device.latest_deployment_activity =
            latestActivitiesByType["deployment"] || null;
          device.latest_maintenance_activity =
            latestActivitiesByType["maintenance"] || null;
          // Pick the more recent of "recall" / "recallment" rather than blindly
          // preferring one key — both can coexist on the same device.
          const _r = latestActivitiesByType["recall"] || null;
          const _rm = latestActivitiesByType["recallment"] || null;
          device.latest_recall_activity =
            _r && _rm
              ? new Date(_r.createdAt) >= new Date(_rm.createdAt)
                ? _r
                : _rm
              : _r || _rm || null;
        } else {
          device.activities_by_type = {};
          device.latest_activities_by_type = {};
          device.latest_deployment_activity = null;
          device.latest_maintenance_activity = null;
          device.latest_recall_activity = null;
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

      const baseUrl =
        typeof request.protocol === "string" &&
        typeof request.get === "function" &&
        typeof request.originalUrl === "string"
          ? `${request.protocol}://${request.get("host")}${
              request.originalUrl.split("?")[0]
            }`
          : "";

      const meta = {
        total,
        limit: _limit,
        skip: _skip,
        page: Math.floor(_skip / _limit) + 1,
        totalPages: Math.ceil(total / _limit),
      };

      if (baseUrl) {
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
      }

      return {
        success: true,
        message: "Successfully retrieved devices for the provided cohorts",
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
          { message: error.message },
        ),
      );
    }
  },
  listSites: async (request, next) => {
    try {
      const { tenant, limit, skip, sortBy, order } = request.query;
      const { cohort_ids } = {
        ...request.body,
        ...request.query,
      };

      // Pagination controls
      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));

      // Sorting controls
      const sortOrder = order === "asc" ? 1 : -1;
      const sortField = sortBy ? sortBy : "createdAt";

      // Convert cohort_ids to ObjectIds
      const cohortObjectIds = cohort_ids.map((id) => ObjectId(id));

      // Search should only apply to sites, not devices
      const deviceFilterRequest = {
        ...request,
        query: {
          ...request.query,
          search: undefined, // Remove search for device filtering
        },
      };

      // Get device filter WITHOUT search parameter
      const baseDeviceFilter = generateFilter.devices(
        deviceFilterRequest,
        next,
      );
      const deviceFilter = {
        ...baseDeviceFilter,
        cohorts: { $in: cohortObjectIds },
      };

      // Find all devices belonging to the provided cohorts
      const devicesInCohorts = await DeviceModel(tenant)
        .find(deviceFilter)
        .select("site_id deployment_type")
        .maxTimeMS(45000)
        .lean();

      // Extract unique site IDs (only for static deployments with sites)
      const siteIds = [
        ...new Set(
          devicesInCohorts
            .filter(
              (device) =>
                device.site_id &&
                (!device.deployment_type ||
                  device.deployment_type === "static"),
            )
            .map((device) => device.site_id.toString()),
        ),
      ].map((id) => ObjectId(id));

      if (siteIds.length === 0) {
        return {
          success: true,
          message:
            "No sites found for the provided cohorts with applied filters",
          data: [],
          status: httpStatus.OK,
          meta: {
            total: 0,
            limit: _limit,
            skip: _skip,
            page: 1,
            totalPages: 0,
          },
        };
      }

      const baseSiteFilter = generateFilter.sites(request, next);
      const siteFilter = {
        ...baseSiteFilter,
        _id: { $in: siteIds },
      };

      // Get total count for pagination
      const total = await SiteModel(tenant)
        .countDocuments(siteFilter)
        .maxTimeMS(45000);

      // Build aggregation pipeline for sites
      const inclusionProjection = constants.SITES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.SITES_EXCLUSION_PROJECTION(
        "summary",
      );

      const pipeline = [
        { $match: siteFilter },
        { $sort: { [sortField]: sortOrder } },
        { $skip: _skip },
        { $limit: _limit },
        {
          $lookup: {
            from: "devices",
            localField: "_id",
            foreignField: "site_id",
            as: "devices",
          },
        },
        {
          $lookup: {
            from: "grids",
            localField: "grids",
            foreignField: "_id",
            as: "grids",
          },
        },
        {
          $lookup: {
            from: "airqlouds",
            localField: "airqlouds",
            foreignField: "_id",
            as: "airqlouds",
          },
        },
        {
          $lookup: {
            from: "activities",
            let: { siteId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$site_id", "$$siteId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 100 },
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
            ],
            as: "activities",
          },
        },
        // Typed-activity fields (latest_deployment_activity, latest_maintenance_activity,
        // latest_recall_activity) are derived in JS post-processing from the merged
        // activities array fetched above. Running 4 separate $lookup stages here
        // (3 typed + 1 count) adds 40 extra DB sub-queries for a page of 10 sites.
        // The Sites inclusion $project already unwraps lookup arrays to single objects
        // via $cond/$arrayElemAt, then the post-processing .length check runs on the
        // resulting plain objects — always evaluating to null. The lookups were dead.
        // Deriving in JS from the top-100 activities window is equivalent for all
        // realistic AirQo site activity histories.
        { $project: inclusionProjection },
        { $project: exclusionProjection },
      ];

      // Mongoose 5.x ignores a plain-object second argument to .aggregate();
      // options must be applied via .option() on the returned Aggregate instance.
      const paginatedResults = await SiteModel(tenant)
        .aggregate(pipeline)
        .option({ maxTimeMS: 45000 })
        .allowDiskUse(true);

      // Post-processing for consistency
      paginatedResults.forEach((site) => {
        if (site.activities && site.activities.length > 0) {
          // No JS sort needed: the activities $lookup pipeline already applies
          // { $sort: { createdAt: -1 } } server-side (single source, no merge).
          const activitiesByType = {};
          const latestActivitiesByType = {};

          site.activities.forEach((activity) => {
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

          site.activities_by_type = activitiesByType;
          site.latest_activities_by_type = latestActivitiesByType;
          // recent_activities_count omitted: total_activities from the inclusion
          // projection already equals $size(activities) — the two fields would
          // always be identical, duplicating the same capped-window count.

          // Derive typed-activity fields from the already-sorted activities array
          site.latest_deployment_activity =
            latestActivitiesByType["deployment"] || null;
          site.latest_maintenance_activity =
            latestActivitiesByType["maintenance"] || null;

          const latestRecall = latestActivitiesByType["recall"] || null;
          const latestRecallment =
            latestActivitiesByType["recallment"] || null;
          site.latest_recall_activity =
            latestRecall && latestRecallment
              ? new Date(latestRecall.createdAt) >=
                new Date(latestRecallment.createdAt)
                ? latestRecall
                : latestRecallment
              : latestRecall || latestRecallment || null;

          // Build separate count maps (O(n)) to avoid an O(n²) nested filter
          // across site.devices × site.activities for every site.
          // Activities with device_id are keyed by id; legacy name-only
          // activities are keyed by name — matching the original OR logic
          // without the risk of double-counting an activity that carries both.
          const activityCountById = {};
          const activityCountByName = {};
          for (const activity of site.activities) {
            if (activity.device_id) {
              const key = activity.device_id.toString();
              activityCountById[key] = (activityCountById[key] || 0) + 1;
            } else if (activity.device) {
              activityCountByName[activity.device] =
                (activityCountByName[activity.device] || 0) + 1;
            }
          }
          const deviceActivitySummary = site.devices.map((device) => ({
            device_id: device._id,
            device_name: device.name,
            activity_count:
              (activityCountById[device._id.toString()] || 0) +
              (activityCountByName[device.name] || 0),
          }));
          site.device_activity_summary = deviceActivitySummary;
        } else {
          site.activities_by_type = {};
          site.latest_activities_by_type = {};
          site.latest_deployment_activity = null;
          site.latest_maintenance_activity = null;
          site.latest_recall_activity = null;
          site.device_activity_summary = site.devices.map((device) => ({
            device_id: device._id,
            device_name: device.name,
            activity_count: 0,
          }));
        }
      });

      // Build pagination metadata
      const baseUrl =
        typeof request.protocol === "string" &&
        typeof request.get === "function" &&
        typeof request.originalUrl === "string"
          ? `${request.protocol}://${request.get("host")}${
              request.originalUrl.split("?")[0]
            }`
          : "";

      const meta = {
        total,
        limit: _limit,
        skip: _skip,
        page: Math.floor(_skip / _limit) + 1,
        totalPages: Math.ceil(total / _limit),
      };

      if (baseUrl) {
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
      }

      return {
        success: true,
        message: "Successfully retrieved sites for the provided cohorts",
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
          { message: error.message },
        ),
      );
    }
  },


  /**
   * listCachedDevices — serve devices from the pre-computed CohortDeviceSnapshot
   * collection. Falls back transparently to the live listDevices aggregation when
   * the snapshot is empty (e.g. new cohort, first run before the job fires).
   *
   * Accepts the same request body / query shape as listDevices so callers need
   * only swap the endpoint URL.
   */
  listCachedDevices: async (request, next) => {
    try {
      const {
        body: { cohort_ids = [] } = {},
        query: {
          tenant,
          skip: rawSkip = 0,
          limit: rawLimit = 10,
          search,
          status,
          category,
          network,
        } = {},
      } = request;

      const _skip = Math.max(0, parseInt(rawSkip, 10) || 0);
      const _limit = Math.min(Math.max(1, parseInt(rawLimit, 10) || 10), 100);

      if (!cohort_ids.length) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "cohort_ids is required",
          errors: { message: "cohort_ids array must not be empty" },
        };
      }

      const cohortObjectIds = cohort_ids
        .filter((id) => ObjectId.isValid(id))
        .map((id) => ObjectId(id));

      if (!cohortObjectIds.length) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "No valid cohort_ids provided",
          errors: { message: "cohort_ids must be valid MongoDB ObjectIds" },
        };
      }

      // Check whether the snapshot collection has data for ALL requested cohorts.
      // distinct() returns one entry per cohort that has at least one snapshot,
      // so comparing the count against cohortObjectIds.length detects partial coverage.
      const coveredCohortIds = await CohortDeviceSnapshotModel(tenant)
        .distinct("cohort_id", { cohort_id: { $in: cohortObjectIds }, tenant })
        .maxTimeMS(5000);

      // Fall back to the live aggregation if any cohort lacks snapshot data
      if (coveredCohortIds.length < cohortObjectIds.length) {
        logger.warn(
          `listCachedDevices -- snapshot incomplete for cohort_ids [${cohort_ids}] (${coveredCohortIds.length}/${cohortObjectIds.length} covered), falling back to live query`
        );
        return createCohort.listDevices(request, next);
      }

      // Build the filter — use top-level indexed fields, not data.*
      const filter = {
        cohort_id: { $in: cohortObjectIds },
        tenant,
      };
      if (search) {
        filter.name = { $regex: search, $options: "i" };
      }
      if (status) {
        filter.status = status;
      }
      if (category) {
        filter.category = category;
      }
      if (network) {
        filter.network = network;
      }

      const [total, snapshots] = await Promise.all([
        CohortDeviceSnapshotModel(tenant)
          .countDocuments(filter)
          .maxTimeMS(10000),
        CohortDeviceSnapshotModel(tenant)
          .find(filter)
          .skip(_skip)
          .limit(_limit)
          .select("device_id data _snapshot_generated_at")
          .lean()
          .maxTimeMS(10000),
      ]);

      // Deduplicate by device_id when a device appears in multiple cohorts
      const seen = new Map();
      for (const s of snapshots) {
        const key = s.device_id.toString();
        if (!seen.has(key)) seen.set(key, s.data);
      }
      const devices = [...seen.values()];

      // Report the oldest snapshot age so the caller knows the cache staleness
      const cacheGeneratedAt =
        snapshots.length > 0
          ? new Date(Math.min(...snapshots.map((s) => +s._snapshot_generated_at)))
          : null;

      const totalPages = Math.ceil(total / _limit);

      return {
        success: true,
        message: "Successfully retrieved cached devices",
        data: devices,
        meta: {
          total,
          skip: _skip,
          limit: _limit,
          page: Math.floor(_skip / _limit) + 1,
          totalPages,
        },
        cache_generated_at: cacheGeneratedAt,
      };
    } catch (error) {
      // Snapshot collection unavailable (connection pool exhausted or collection not yet
      // created by the job) — fall back to the live aggregation transparently.
      if (error.message && error.message.includes("buffering timed out")) {
        logger.warn(
          `listCachedDevices -- snapshot unavailable (${error.message}), falling back to live query`
        );
        return createCohort.listDevices(request, next);
      }
      logger.error(`listCachedDevices -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * listCachedSites — serve sites from the pre-computed CohortSiteSnapshot
   * collection. Falls back to the live listSites aggregation when the snapshot
   * is not yet populated.
   */
  listCachedSites: async (request, next) => {
    try {
      const {
        body: { cohort_ids = [] } = {},
        query: {
          tenant,
          skip: rawSkip = 0,
          limit: rawLimit = 10,
          search,
          country,
        } = {},
      } = request;

      const _skip = Math.max(0, parseInt(rawSkip, 10) || 0);
      const _limit = Math.min(Math.max(1, parseInt(rawLimit, 10) || 10), 100);

      if (!cohort_ids.length) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "cohort_ids is required",
          errors: { message: "cohort_ids array must not be empty" },
        };
      }

      const cohortObjectIds = cohort_ids
        .filter((id) => ObjectId.isValid(id))
        .map((id) => ObjectId(id));

      if (!cohortObjectIds.length) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "No valid cohort_ids provided",
          errors: { message: "cohort_ids must be valid MongoDB ObjectIds" },
        };
      }

      // Check whether the snapshot collection has data for ALL requested cohorts
      const coveredCohortIds = await CohortSiteSnapshotModel(tenant)
        .distinct("cohort_id", { cohort_id: { $in: cohortObjectIds }, tenant })
        .maxTimeMS(5000);

      if (coveredCohortIds.length < cohortObjectIds.length) {
        logger.warn(
          `listCachedSites -- snapshot incomplete for cohort_ids [${cohort_ids}] (${coveredCohortIds.length}/${cohortObjectIds.length} covered), falling back to live query`
        );
        return createCohort.listSites(request, next);
      }

      const filter = {
        cohort_id: { $in: cohortObjectIds },
        tenant,
      };
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { search_name: { $regex: search, $options: "i" } },
        ];
      }
      if (country) {
        filter.country = country;
      }

      const [total, snapshots] = await Promise.all([
        CohortSiteSnapshotModel(tenant)
          .countDocuments(filter)
          .maxTimeMS(10000),
        CohortSiteSnapshotModel(tenant)
          .find(filter)
          .skip(_skip)
          .limit(_limit)
          .select("site_id data _snapshot_generated_at")
          .lean()
          .maxTimeMS(10000),
      ]);

      // Deduplicate by site_id when a site appears in multiple cohorts
      const seen = new Map();
      for (const s of snapshots) {
        const key = s.site_id.toString();
        if (!seen.has(key)) seen.set(key, s.data);
      }
      const sites = [...seen.values()];

      // Report the oldest snapshot age so the caller knows the cache staleness
      const cacheGeneratedAt =
        snapshots.length > 0
          ? new Date(Math.min(...snapshots.map((s) => +s._snapshot_generated_at)))
          : null;

      const totalPages = Math.ceil(total / _limit);

      return {
        success: true,
        message: "Successfully retrieved cached sites",
        data: sites,
        meta: {
          total,
          skip: _skip,
          limit: _limit,
          page: Math.floor(_skip / _limit) + 1,
          totalPages,
        },
        cache_generated_at: cacheGeneratedAt,
      };
    } catch (error) {
      // Snapshot collection unavailable — fall back to the live aggregation transparently.
      if (error.message && error.message.includes("buffering timed out")) {
        logger.warn(
          `listCachedSites -- snapshot unavailable (${error.message}), falling back to live query`
        );
        return createCohort.listSites(request, next);
      }
      logger.error(`listCachedSites -- ${error.message}`);
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
