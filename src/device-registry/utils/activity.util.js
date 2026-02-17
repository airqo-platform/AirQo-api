const ActivityModel = require("@models/Activity");
const qs = require("qs");
const { HttpError, logObject, logText } = require("@utils/shared");
const createDeviceUtil = require("@utils/device.util");
const createSiteUtil = require("@utils/site.util");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const GridModel = require("@models/Grid");
const constants = require("@config/constants");
const moment = require("moment");

const {
  distance,
  generateFilter,
  addMonthsToProvideDateTime,
} = require("@utils/common");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-activity-util`,
);
const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const BACK_FILL_BATCH_SIZE = 1000;
const UPDATE_DEVICE_NAMES_CACHE_BATCH_SIZE = 50;
const FETCH_DEVICES_WITH_ACTIVITIES_LIMIT = 100;

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

/**
 * Updates the cached activity fields for sites and devices
 * Race-condition safe: Only updates if cache is older than snapshot time
 * @param {string} tenant - The tenant identifier
 * @param {ObjectId} site_id - The site ID to update cache for
 * @param {ObjectId} device_id - The device ID to update cache for
 * @param {string} deviceName - The device name (for legacy lookup)
 * @param {function} next - Error handler
 */
const updateActivityCache = async (
  tenant,
  site_id,
  device_id,
  deviceName,
  next,
) => {
  try {
    const updatePromises = [];

    // Update site cache if site_id exists
    if (site_id) {
      updatePromises.push(
        (async () => {
          try {
            const cacheStamp = new Date();

            const siteActivities = await ActivityModel(tenant)
              .find({ site_id: ObjectId(site_id) })
              .sort({ createdAt: -1 })
              .lean();

            if (!siteActivities || siteActivities.length === 0) {
              return;
            }

            const activitiesByType = {};
            const latestActivitiesByType = {};

            siteActivities.forEach((activity) => {
              const type = activity.activityType || "unknown";
              activitiesByType[type] = (activitiesByType[type] || 0) + 1;

              if (
                !latestActivitiesByType[type] ||
                new Date(activity.createdAt) >
                  new Date(latestActivitiesByType[type].createdAt)
              ) {
                latestActivitiesByType[type] = {
                  _id: activity._id,
                  activityType: activity.activityType,
                  maintenanceType: activity.maintenanceType,
                  recallType: activity.recallType,
                  date: activity.date,
                  description: activity.description,
                  nextMaintenance: activity.nextMaintenance,
                  createdAt: activity.createdAt,
                  device_id: activity.device_id,
                  device: activity.device,
                  site_id: activity.site_id,
                };
              }
            });

            const latestDeployment = latestActivitiesByType.deployment || null;
            const latestMaintenance =
              latestActivitiesByType.maintenance || null;
            const latestRecall =
              latestActivitiesByType.recall ||
              latestActivitiesByType.recallment ||
              null;
            const siteCreation =
              latestActivitiesByType["site-creation"] || null;

            const result = await SiteModel(tenant).findOneAndUpdate(
              {
                _id: ObjectId(site_id),
                $or: [
                  { activities_cache_updated_at: { $exists: false } },
                  { activities_cache_updated_at: { $lt: cacheStamp } },
                  {
                    activities_cache_updated_at: cacheStamp,
                    $or: [
                      { cached_total_activities: { $exists: false } },
                      {
                        cached_total_activities: { $lt: siteActivities.length },
                      },
                    ],
                  },
                ],
              },
              {
                $set: {
                  cached_total_activities: siteActivities.length,
                  cached_activities_by_type: activitiesByType,
                  cached_latest_activities_by_type: latestActivitiesByType,
                  cached_latest_deployment_activity: latestDeployment,
                  cached_latest_maintenance_activity: latestMaintenance,
                  cached_latest_recall_activity: latestRecall,
                  cached_site_creation_activity: siteCreation,
                  activities_cache_updated_at: cacheStamp,
                },
              },
              { new: true },
            );

            if (result) {
              logText(
                `Updated cache for site ${site_id}: ${siteActivities.length} activities`,
              );
            }
          } catch (error) {
            logger.error(
              `Failed to update site cache for ${site_id}: ${error.message}`,
            );
          }
        })(),
      );
    }

    // Update device cache if device_id or deviceName exists
    if (device_id || deviceName) {
      updatePromises.push(
        (async () => {
          try {
            const cacheStamp = new Date();

            // Build comprehensive query that handles missing device_id
            const deviceQuery = {};

            if (device_id && deviceName) {
              deviceQuery.$or = [
                { device_id: ObjectId(device_id) },
                { device_id: device_id.toString() },
                { device: deviceName },
                {
                  $and: [
                    { device: deviceName },
                    {
                      $or: [
                        { device_id: null },
                        { device_id: { $exists: false } },
                      ],
                    },
                  ],
                },
              ];
            } else if (device_id) {
              deviceQuery.$or = [
                { device_id: ObjectId(device_id) },
                { device_id: device_id.toString() },
              ];
            } else if (deviceName) {
              deviceQuery.device = deviceName;
            }

            const deviceActivities = await ActivityModel(tenant)
              .find(deviceQuery)
              .sort({ createdAt: -1 })
              .lean();

            if (!deviceActivities || deviceActivities.length === 0) {
              return;
            }

            const activitiesByType = {};
            const latestActivitiesByType = {};

            deviceActivities.forEach((activity) => {
              const type = activity.activityType || "unknown";
              activitiesByType[type] = (activitiesByType[type] || 0) + 1;

              if (
                !latestActivitiesByType[type] ||
                new Date(activity.createdAt) >
                  new Date(latestActivitiesByType[type].createdAt)
              ) {
                latestActivitiesByType[type] = {
                  _id: activity._id,
                  activityType: activity.activityType,
                  maintenanceType: activity.maintenanceType,
                  recallType: activity.recallType,
                  date: activity.date,
                  description: activity.description,
                  nextMaintenance: activity.nextMaintenance,
                  createdAt: activity.createdAt,
                  device_id: activity.device_id,
                  device: activity.device,
                  site_id: activity.site_id,
                };
              }
            });

            const latestDeployment = latestActivitiesByType.deployment || null;
            const latestMaintenance =
              latestActivitiesByType.maintenance || null;
            const latestRecall =
              latestActivitiesByType.recall ||
              latestActivitiesByType.recallment ||
              null;

            let deviceFilter = {};
            if (device_id) {
              deviceFilter._id = ObjectId(device_id);
            } else if (deviceName) {
              deviceFilter.name = deviceName;
            }

            const result = await DeviceModel(tenant).findOneAndUpdate(
              {
                ...deviceFilter,
                $or: [
                  { activities_cache_updated_at: { $exists: false } },
                  { activities_cache_updated_at: { $lt: cacheStamp } },
                  {
                    activities_cache_updated_at: cacheStamp,
                    $or: [
                      { cached_total_activities: { $exists: false } },
                      {
                        cached_total_activities: {
                          $lt: deviceActivities.length,
                        },
                      },
                    ],
                  },
                ],
              },
              {
                $set: {
                  cached_total_activities: deviceActivities.length,
                  cached_activities_by_type: activitiesByType,
                  cached_latest_activities_by_type: latestActivitiesByType,
                  cached_latest_deployment_activity: latestDeployment,
                  cached_latest_maintenance_activity: latestMaintenance,
                  cached_latest_recall_activity: latestRecall,
                  activities_cache_updated_at: cacheStamp,
                },
              },
              { new: true },
            );

            if (result) {
              logText(
                `Updated cache for device ${device_id || deviceName}: ${
                  deviceActivities.length
                } activities`,
              );
            }
          } catch (error) {
            logger.error(
              `Failed to update device cache for ${device_id || deviceName}: ${
                error.message
              }`,
            );
          }
        })(),
      );
    }

    await Promise.all(updatePromises);
  } catch (error) {
    logger.error(`updateActivityCache failed: ${error.message}`);
  }
};

const getValidDate = (dateInput) => {
  // If no date is provided, return null.
  if (!dateInput) {
    return null;
  }

  const parsedDate = new Date(dateInput);

  // If the provided date string is invalid, return null.
  if (isNaN(parsedDate.getTime())) {
    logger.warn(`Invalid date string provided: "${dateInput}". Skipping.`);
    return null;
  }

  // Otherwise, return the valid Date object.
  return parsedDate;
};

const getNextMaintenanceDate = (dateInput, months = 3) => {
  try {
    const baseDate = getValidDate(dateInput);
    const nextMaintenance = addMonthsToProvideDateTime(baseDate, months);

    // Ensure we get back a valid Date object
    if (!nextMaintenance || isNaN(new Date(nextMaintenance).getTime())) {
      console.warn(
        "addMonthsToProvideDateTime returned invalid date, using fallback",
      );
      const fallback = new Date(baseDate);
      fallback.setMonth(fallback.getMonth() + months);
      return fallback;
    }

    return nextMaintenance;
  } catch (error) {
    console.error("Error calculating next maintenance date:", error);
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + months);
    return fallback;
  }
};

const createActivity = {
  list: async (request, next) => {
    try {
      const { tenant, limit, skip, path, sortBy, order } = request.query;
      const filter = generateFilter.activities(request, next);
      if (!isEmpty(path)) {
        filter.path = path;
      }

      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));
      const sortOrder = order === "asc" ? 1 : -1;
      const sortField = sortBy ? sortBy : "createdAt";

      const pipeline = [
        { $match: filter },
        {
          $project: {
            _id: 1,
            device: 1,
            device_id: 1,
            activityType: 1,
            maintenanceType: 1,
            recallType: 1,
            date: 1,
            description: 1,
            nextMaintenance: 1,
            createdAt: 1,
            site_id: 1,
            grid_id: 1,
            deployment_type: 1,
            host_id: 1,
            network: 1,
            tags: 1,
            activity_by: {
              $cond: {
                if: { $or: ["$firstName", "$lastName", "$email", "$userName"] },
                then: {
                  name: {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ["$firstName", ""] },
                          " ",
                          { $ifNull: ["$lastName", ""] },
                        ],
                      },
                    },
                  },
                  email: "$email",
                  userName: "$userName",
                },
                else: "$$REMOVE",
              },
            },
          },
        },
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

      const results = await ActivityModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      const paginatedResults = results[0].paginatedResults;
      const total = results[0].totalCount[0]
        ? results[0].totalCount[0].count
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
        message: "Successfully retrieved activities",
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

  update: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const update = body;
      const filter = generateFilter.activities(request, next);

      const responseFromModifyActivity = await ActivityModel(tenant).modify(
        {
          filter,
          update,
        },
        next,
      );

      return responseFromModifyActivity;
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
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.activities(request, next);

      const responseFromRemoveActivity = await ActivityModel(tenant).remove(
        {
          filter,
        },
        next,
      );

      return responseFromRemoveActivity;
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

  // ENHANCED: Deploy function supporting both static and mobile deployments
  deploy: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant, deviceName } = query;
      const {
        date,
        height,
        mountType,
        powerType,
        isPrimaryInLocation,
        site_id,
        grid_id,
        deployment_type,
        host_id,
        network,
        user_id,
        firstName,
        lastName,
        userName,
        email,
        mobility_metadata,
      } = body;

      // Determine deployment type
      const actualDeploymentType =
        deployment_type || (grid_id ? "mobile" : "static");

      // Validate device exists
      const deviceExists = await DeviceModel(tenant).exists({
        name: deviceName,
      });

      if (!deviceExists) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Invalid request, Device ${deviceName} not found`,
          },
        };
      }

      // Validate location reference based on deployment type
      if (actualDeploymentType === "static") {
        if (!site_id) {
          return {
            success: false,
            message: "site_id is required for static deployments",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "site_id is required for static deployments" },
          };
        }

        const siteExists = await SiteModel(tenant).exists({
          _id: ObjectId(site_id),
        });

        if (!siteExists) {
          return {
            success: false,
            message: "Site not found",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `Site ${site_id} not found` },
          };
        }
      } else if (actualDeploymentType === "mobile") {
        if (!grid_id) {
          return {
            success: false,
            message: "grid_id is required for mobile deployments",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "grid_id is required for mobile deployments" },
          };
        }

        const gridExists = await GridModel(tenant).exists({
          _id: ObjectId(grid_id),
        });

        if (!gridExists) {
          return {
            success: false,
            message: "Grid not found",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `Grid ${grid_id} not found` },
          };
        }
      }

      // Check if device is already deployed
      let requestForExistenceSearch = {};
      requestForExistenceSearch.filter = {
        name: deviceName,
        isActive: true,
      };
      requestForExistenceSearch.tenant = tenant;

      const responseFromDeviceSearchCheck = await createDeviceUtil.doesDeviceSearchExist(
        requestForExistenceSearch,
        next,
      );

      if (responseFromDeviceSearchCheck.success === true) {
        return {
          success: false,
          message: `Device ${deviceName} already deployed`,
          status: httpStatus.CONFLICT,
          errors: { message: `Device ${deviceName} already deployed` },
        };
      }

      // Handle deployment based on type
      if (actualDeploymentType === "static") {
        return await createActivity._deployStatic(request, next);
      } else {
        return await createActivity._deployMobile(request, next);
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

  _deployStatic: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant, deviceName } = query;
      const {
        date,
        height,
        mountType,
        powerType,
        isPrimaryInLocation,
        site_id,
        host_id,
        network,
        user_id,
        firstName,
        lastName,
        userName,
        email,
      } = body;

      // Get site details for coordinates
      const siteListRequest = {
        query: {
          site_id,
          tenant,
        },
      };

      const responseFromListSite = await createSiteUtil.list(
        siteListRequest,
        next,
      );

      if (responseFromListSite.success === true) {
        if (responseFromListSite.data.length === 1) {
          const { latitude, longitude } = responseFromListSite.data[0];

          // Create activity record
          const siteActivityBody = {
            device: deviceName,
            date: (date && new Date(date)) || new Date(),
            description: "device deployed",
            activityType: "deployment",
            deployment_type: "static",
            site_id,
            host_id: host_id ? host_id : null,
            user_id: user_id ? user_id : null,
            network,
            firstName,
            lastName,
            userName,
            email,
            nextMaintenance: getNextMaintenanceDate(date, 3),
          };

          // Calculate approximate coordinates
          const responseFromCreateApproximateCoordinates = distance.createApproximateCoordinates(
            { latitude, longitude },
            next,
          );

          const {
            approximate_latitude,
            approximate_longitude,
            approximate_distance_in_km,
            bearing_in_radians,
          } = responseFromCreateApproximateCoordinates;

          // Prepare device update
          let deviceBody = {};
          deviceBody.body = {};
          deviceBody.query = {};
          deviceBody.body.height = height;
          deviceBody.body.mountType = mountType;
          deviceBody.body.powerType = powerType;
          deviceBody.body.isPrimaryInLocation = isPrimaryInLocation;
          deviceBody.body.deployment_type = "static";
          deviceBody.body.mobility = false;
          deviceBody.body.nextMaintenance = getNextMaintenanceDate(date, 3);
          deviceBody.body.latitude = approximate_latitude || latitude;
          deviceBody.body.longitude = approximate_longitude || longitude;
          deviceBody.body.approximate_distance_in_km =
            approximate_distance_in_km || 0;
          deviceBody.body.bearing_in_radians = bearing_in_radians || 0;
          deviceBody.body.site_id = site_id;
          deviceBody.body.host_id = host_id ? host_id : null;
          deviceBody.body.grid_id = null; // Clear any existing grid_id
          deviceBody.body.isActive = true;
          deviceBody.body.deployment_date =
            (date && new Date(date)) || new Date();
          deviceBody.body.status = "deployed";
          deviceBody.query.name = deviceName;
          deviceBody.query.tenant = tenant;

          return await createActivity._processDeployment(
            siteActivityBody,
            deviceBody,
            user_id,
            tenant,
            next,
          );
        } else {
          return {
            success: false,
            message: "unable to find one site record for this operation",
            status: httpStatus.NOT_FOUND,
            errors: {
              message: "unable to find the provided site",
            },
          };
        }
      } else {
        return responseFromListSite;
      }
    } catch (error) {
      logger.error(`🐛🐛 Static Deploy Error ${error.message}`);
      throw error;
    }
  },

  _deployMobile: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant, deviceName } = query;
      const {
        date,
        height,
        mountType,
        powerType,
        isPrimaryInLocation,
        grid_id,
        host_id,
        network,
        user_id,
        firstName,
        lastName,
        userName,
        email,
        mobility_metadata,
      } = body;

      // Get grid details
      const gridFilter = { _id: ObjectId(grid_id) };
      const responseFromListGrid = await GridModel(tenant).list(
        { filter: gridFilter },
        next,
      );

      if (
        responseFromListGrid.success === true &&
        responseFromListGrid.data.length === 1
      ) {
        const gridData = responseFromListGrid.data[0];

        // For mobile deployments, we'll use the grid's center point as initial coordinates
        // This can be updated as the device moves
        let initialLatitude = null;
        let initialLongitude = null;

        // Try to get coordinates from grid centers
        if (gridData.centers && gridData.centers.length > 0) {
          initialLatitude = gridData.centers[0].latitude;
          initialLongitude = gridData.centers[0].longitude;
        } else if (gridData.shape && gridData.shape.coordinates) {
          // Calculate centroid from shape if centers not available
          const coordinates = gridData.shape.coordinates[0];
          if (coordinates && coordinates.length > 0) {
            const latSum = coordinates.reduce(
              (sum, coord) => sum + coord[1],
              0,
            );
            const lngSum = coordinates.reduce(
              (sum, coord) => sum + coord[0],
              0,
            );
            initialLatitude = latSum / coordinates.length;
            initialLongitude = lngSum / coordinates.length;
          }
        }

        // Create activity record for mobile deployment
        const siteActivityBody = {
          device: deviceName,
          date: (date && new Date(date)) || new Date(),
          description: "mobile device deployed",
          activityType: "deployment",
          deployment_type: "mobile",
          grid_id,
          host_id: host_id ? host_id : null,
          user_id: user_id ? user_id : null,
          network,
          firstName,
          lastName,
          userName,
          email,
          mobility_metadata,
          nextMaintenance: getNextMaintenanceDate(date, 3),
        };

        // Prepare device update for mobile deployment
        let deviceBody = {};
        deviceBody.body = {};
        deviceBody.query = {};
        deviceBody.body.height = height;
        deviceBody.body.mountType = mountType;
        deviceBody.body.powerType = powerType;
        deviceBody.body.isPrimaryInLocation = isPrimaryInLocation;
        deviceBody.body.deployment_type = "mobile";
        deviceBody.body.mobility = true;
        deviceBody.body.nextMaintenance = getNextMaintenanceDate(date, 3);

        // Set initial coordinates if available
        if (initialLatitude && initialLongitude) {
          deviceBody.body.latitude = initialLatitude;
          deviceBody.body.longitude = initialLongitude;
        }

        deviceBody.body.grid_id = grid_id;
        deviceBody.body.site_id = null; // Clear any existing site_id
        deviceBody.body.host_id = host_id ? host_id : null;
        deviceBody.body.isActive = true;
        deviceBody.body.deployment_date =
          (date && new Date(date)) || new Date();
        deviceBody.body.status = "deployed";
        deviceBody.body.mobility_metadata = mobility_metadata;
        deviceBody.query.name = deviceName;
        deviceBody.query.tenant = tenant;

        return await createActivity._processDeployment(
          siteActivityBody,
          deviceBody,
          user_id,
          tenant,
          next,
        );
      } else {
        return {
          success: false,
          message: "unable to find grid for mobile deployment",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: "unable to find the provided grid",
          },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Mobile Deploy Error ${error.message}`);
      throw error;
    }
  },

  _processDeployment: async (
    activityBody,
    deviceBody,
    user_id,
    tenant,
    next,
  ) => {
    try {
      // **STEP 1**: Get device first to capture device_id BEFORE creating activity
      const filter = generateFilter.devices(
        { query: { tenant, name: deviceBody.query.name } },
        next,
      );
      const existingDevice = await DeviceModel(tenant)
        .findOne(filter)
        .lean();

      if (!existingDevice) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device does not exist" },
        };
      }

      // **CRITICAL**: Add device_id to activity body BEFORE creating
      activityBody.device_id = existingDevice._id;

      // **STEP 2**: Register activity WITH device_id
      const responseFromRegisterActivity = await ActivityModel(tenant).register(
        activityBody,
        next,
      );

      if (responseFromRegisterActivity.success === true) {
        const createdActivity = responseFromRegisterActivity.data;

        // **STEP 3**: Update device
        const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
          deviceBody,
          next,
        );

        if (responseFromUpdateDevice.success === true) {
          const updatedDevice = responseFromUpdateDevice.data;

          // **STEP 4**: Update activity cache immediately with correct device_id
          await updateActivityCache(
            tenant,
            activityBody.site_id,
            existingDevice._id, // Use the device_id we retrieved
            activityBody.device,
            next,
          );

          const data = {
            createdActivity: {
              activity_codes: createdActivity.activity_codes,
              tags: createdActivity.tags,
              _id: createdActivity._id,
              device: createdActivity.device,
              device_id: createdActivity.device_id, // Now populated!
              date: createdActivity.date,
              description: createdActivity.description,
              activityType: createdActivity.activityType,
              site_id: createdActivity.site_id,
              grid_id: createdActivity.grid_id,
              deployment_type: createdActivity.deployment_type,
              host_id: createdActivity.host_id,
              network: createdActivity.network,
              nextMaintenance: createdActivity.nextMaintenance,
              createdAt: createdActivity.createdAt,
            },
            updatedDevice: {
              status: updatedDevice.status,
              category: updatedDevice.category,
              isActive: updatedDevice.isActive,
              _id: updatedDevice._id,
              long_name: updatedDevice.long_name,
              network: updatedDevice.network,
              device_number: updatedDevice.device_number,
              name: updatedDevice.name,
              deployment_date: updatedDevice.deployment_date,
              deployment_type: updatedDevice.deployment_type,
              mobility: updatedDevice.mobility,
              latitude: updatedDevice.latitude,
              longitude: updatedDevice.longitude,
              mountType: updatedDevice.mountType,
              powerType: updatedDevice.powerType,
              site_id: updatedDevice.site_id,
              grid_id: updatedDevice.grid_id,
            },
            user_id: user_id ? user_id : null,
          };

          // Send Kafka notification
          try {
            const deployTopic = constants.DEPLOY_TOPIC || "deploy-topic";
            const kafkaProducer = kafka.producer({
              groupId: constants.UNIQUE_PRODUCER_GROUP,
            });
            await kafkaProducer.connect();
            await kafkaProducer.send({
              topic: deployTopic,
              messages: [
                {
                  action: "create",
                  value: JSON.stringify(data),
                },
              ],
            });
            await kafkaProducer.disconnect();
          } catch (error) {
            logger.error(
              `🐛🐛 KAFKA: Internal Server Error -- ${error.message}`,
            );
          }

          return {
            success: true,
            message: "successfully deployed the device",
            data,
          };
        } else {
          return responseFromUpdateDevice;
        }
      } else {
        return responseFromRegisterActivity;
      }
    } catch (error) {
      logger.error(`🐛🐛 Process Deployment Error ${error.message}`);
      throw error;
    }
  },

  // ENHANCED: Deploy with ownership supporting both static and mobile
  deployWithOwnership: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant, deviceName } = query;
      const {
        date,
        height,
        mountType,
        powerType,
        isPrimaryInLocation,
        site_id,
        grid_id,
        deployment_type,
        host_id,
        network,
        user_id,
        mobility_metadata,
      } = body;

      // Determine deployment type
      const actualDeploymentType =
        deployment_type || (grid_id ? "mobile" : "static");

      // Step 1: Get device with ownership info
      const device = await DeviceModel(tenant).findOne({
        name: deviceName,
      });

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Device ${deviceName} not found` },
        };
      }

      // Step 2: Verify device ownership
      if (device.claim_status === "unclaimed") {
        return {
          success: false,
          message: "Device must be claimed before deployment",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Device not claimed by any user" },
        };
      }

      if (!device.owner_id || device.owner_id.toString() !== user_id) {
        return {
          success: false,
          message: "Access denied: You don't own this device",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Device owned by different user" },
        };
      }

      // Step 3: Check if already deployed
      if (device.isActive) {
        return {
          success: false,
          message: `Device ${deviceName} already deployed`,
          status: httpStatus.CONFLICT,
          errors: { message: `Device ${deviceName} already deployed` },
        };
      }

      // Step 4: Validate location reference
      if (actualDeploymentType === "static") {
        if (!site_id) {
          return {
            success: false,
            message: "site_id is required for static deployments",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "site_id is required for static deployments" },
          };
        }

        const siteExists = await SiteModel(tenant).exists({
          _id: ObjectId(site_id),
        });

        if (!siteExists) {
          return {
            success: false,
            message: "Site not found",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `Site ${site_id} not found` },
          };
        }
      } else {
        if (!grid_id) {
          return {
            success: false,
            message: "grid_id is required for mobile deployments",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "grid_id is required for mobile deployments" },
          };
        }

        const gridExists = await GridModel(tenant).exists({
          _id: ObjectId(grid_id),
        });

        if (!gridExists) {
          return {
            success: false,
            message: "Grid not found",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `Grid ${grid_id} not found` },
          };
        }
      }

      // Continue with deployment logic based on type
      if (actualDeploymentType === "static") {
        return await createActivity._deployOwnedStatic(request, next);
      } else {
        return await createActivity._deployOwnedMobile(request, next);
      }
    } catch (error) {
      logger.error(`🐛🐛 Deploy Owned Device Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  // Helper functions for owned device deployments
  _deployOwnedStatic: async (request, next) => {
    // Similar to _deployStatic but with ownership validation and claim_status update
    const result = await createActivity._deployStatic(request, next);

    if (result.success) {
      // Update claim status to deployed
      const { deviceName } = request.query;
      const { tenant } = request.query;

      await DeviceModel(tenant).findOneAndUpdate(
        { name: deviceName },
        { claim_status: "deployed" },
      );

      result.data.updatedDevice.claim_status = "deployed";
    }

    return result;
  },

  _deployOwnedMobile: async (request, next) => {
    // Similar to _deployMobile but with ownership validation and claim_status update
    const result = await createActivity._deployMobile(request, next);

    if (result.success) {
      // Update claim status to deployed
      const { deviceName } = request.query;
      const { tenant } = request.query;

      await DeviceModel(tenant).findOneAndUpdate(
        { name: deviceName },
        { claim_status: "deployed" },
      );

      result.data.updatedDevice.claim_status = "deployed";
    }

    return result;
  },

  batchDeployWithCoordinates: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      const successful_deployments = [];
      const failed_deployments = [];
      const existing_sites = [];
      let static_count = 0;
      let mobile_count = 0;

      // Create a map to store site IDs based on unique latitude and longitude
      const siteMap = new Map();

      // Maps for bulk operations
      const deviceNameToDeployment = new Map();
      const activitiesToInsert = [];
      const deviceBulkOps = [];
      const deviceIdMap = new Map(); // device name -> device_id
      const siteDataCache = new Map(); // site_id -> {latitude, longitude}

      // PHASE 1: Validate and prepare data
      for (const deployment of body) {
        const {
          date,
          height,
          mountType,
          powerType,
          isPrimaryInLocation,
          latitude,
          longitude,
          site_name,
          network,
          deviceName,
          user_id,
          host_id,
          deployment_type,
          grid_id,
          mobility_metadata,
          firstName,
          lastName,
          userName,
          email,
        } = deployment;

        // Determine deployment type
        const actualDeploymentType =
          deployment_type || (grid_id ? "mobile" : "static");

        try {
          // Check for duplicate deviceName
          if (deviceNameToDeployment.has(deviceName)) {
            failed_deployments.push({
              deviceName,
              deployment_type: actualDeploymentType,
              error: {
                message:
                  "Duplicate deviceName in batch - each device can only be deployed once per batch",
              },
              user_id: user_id || null,
            });
            continue;
          }

          // Validate the date for this specific deployment
          const inputDate = moment(date);
          if (!inputDate.isValid()) {
            failed_deployments.push({
              deviceName,
              deployment_type: actualDeploymentType,
              error: { message: "invalid date format" },
            });
            continue;
          }

          if (inputDate.isAfter(moment())) {
            failed_deployments.push({
              deviceName,
              deployment_type: actualDeploymentType,
              error: { message: "date cannot be in the future" },
            });
            continue;
          }

          if (inputDate.isBefore(moment().subtract(1, "month"))) {
            failed_deployments.push({
              deviceName,
              deployment_type: actualDeploymentType,
              error: {
                message: "date cannot be more than one month in the past",
              },
            });
            continue;
          }

          // Type-specific validation
          if (actualDeploymentType === "static") {
            const hasValidLatitude =
              latitude !== null &&
              latitude !== undefined &&
              Number.isFinite(Number(latitude));
            const hasValidLongitude =
              longitude !== null &&
              longitude !== undefined &&
              Number.isFinite(Number(longitude));
            const hasSiteName =
              typeof site_name === "string"
                ? site_name.trim().length > 0
                : Boolean(site_name);

            if (!hasValidLatitude || !hasValidLongitude || !hasSiteName) {
              failed_deployments.push({
                deviceName,
                deployment_type: "static",
                message:
                  "latitude, longitude, and site_name are required for static deployments",
                error: {
                  message:
                    "latitude, longitude, and site_name are required for static deployments",
                },
              });
              continue;
            }
            static_count++;
          } else {
            if (!grid_id) {
              failed_deployments.push({
                deviceName,
                deployment_type: "mobile",
                message: "grid_id is required for mobile deployments",
                error: {
                  message: "grid_id is required for mobile deployments",
                },
                user_id: user_id ? user_id : null,
              });
              continue;
            }
            mobile_count++;
          }

          // Store for processing
          deviceNameToDeployment.set(deviceName, {
            ...deployment,
            actualDeploymentType,
          });
        } catch (error) {
          failed_deployments.push({
            deviceName,
            deployment_type: actualDeploymentType,
            error: { message: error.message },
            user_id: user_id ? user_id : null,
          });
        }
      }

      // PHASE 2: Fetch all devices in bulk
      const deviceNames = Array.from(deviceNameToDeployment.keys());

      if (deviceNames.length === 0) {
        return {
          success: failed_deployments.length === 0,
          message: "No valid deployments to process",
          successful_deployments: [],
          failed_deployments,
          existing_sites: [],
          deployment_summary: {
            total_requested: body.length,
            total_successful: 0,
            total_failed: failed_deployments.length,
            static_deployments: static_count,
            mobile_deployments: mobile_count,
            successful_static: 0,
            successful_mobile: 0,
            sites_created: 0,
            sites_reused: 0,
          },
        };
      }

      const existingDevices = await DeviceModel(tenant)
        .find({ name: { $in: deviceNames } })
        .lean();

      // Create device lookup map
      const existingDeviceMap = new Map();
      existingDevices.forEach((device) => {
        existingDeviceMap.set(device.name, device);
        deviceIdMap.set(device.name, device._id);
      });

      // Filter out non-existent and already deployed devices
      for (const [deviceName, deployment] of deviceNameToDeployment) {
        const device = existingDeviceMap.get(deviceName);

        if (!device) {
          failed_deployments.push({
            deviceName,
            deployment_type: deployment.actualDeploymentType,
            error: { message: `Device ${deviceName} not found` },
            user_id: deployment.user_id || null,
          });
          deviceNameToDeployment.delete(deviceName);
          continue;
        }

        if (device.isActive) {
          failed_deployments.push({
            deviceName,
            deployment_type: deployment.actualDeploymentType,
            error: { message: `Device ${deviceName} already deployed` },
            user_id: deployment.user_id || null,
          });
          deviceNameToDeployment.delete(deviceName);
          continue;
        }
      }

      // PHASE 3: Handle sites and grids in bulk
      const uniqueSites = new Map();
      const uniqueGrids = new Set();

      for (const [deviceName, deployment] of deviceNameToDeployment) {
        if (deployment.actualDeploymentType === "static") {
          const coordsKey = `${deployment.latitude},${deployment.longitude}`;
          if (!uniqueSites.has(coordsKey)) {
            uniqueSites.set(coordsKey, {
              name: deployment.site_name,
              latitude: deployment.latitude,
              longitude: deployment.longitude,
            });
          }
        } else {
          uniqueGrids.add(deployment.grid_id);
        }
      }

      // Atomic site creation using findOneAndUpdate with upsert
      const sitePromises = [];
      for (const [coordsKey, siteData] of uniqueSites) {
        sitePromises.push(
          (async () => {
            try {
              // Atomic upsert to prevent race conditions
              const site = await SiteModel(tenant).findOneAndUpdate(
                {
                  name: siteData.name,
                },
                {
                  $setOnInsert: {
                    name: siteData.name,
                    latitude: siteData.latitude,
                    longitude: siteData.longitude,
                  },
                },
                {
                  upsert: true,
                  new: true,
                  setDefaultsOnInsert: true,
                },
              );

              const wasExisting = !site.$isNew;

              // Cache site data
              siteMap.set(coordsKey, site._id);
              siteDataCache.set(site._id.toString(), {
                latitude: site.latitude,
                longitude: site.longitude,
              });

              return {
                coordsKey,
                site_id: site._id,
                existing: wasExisting,
              };
            } catch (error) {
              logger.error(
                `Site creation failed for ${coordsKey}: ${error.message}`,
              );
              return { coordsKey, error: { message: error.message } };
            }
          })(),
        );
      }

      const siteResults = await Promise.all(sitePromises);

      // Track existing vs created sites
      siteResults.forEach((result) => {
        if (result.existing) {
          existing_sites.push({
            site_id: result.site_id,
            message: "Using existing site",
          });
        }
      });

      // Fetch all grids
      const gridIds = Array.from(uniqueGrids).map((id) => ObjectId(id));
      const existingGrids =
        gridIds.length > 0
          ? await GridModel(tenant)
              .find({ _id: { $in: gridIds } })
              .lean()
          : [];

      // Normalize grid map keys to strings for consistent lookup
      const gridMap = new Map();
      existingGrids.forEach((grid) => {
        gridMap.set(grid._id.toString(), grid);
      });

      // PHASE 4: Prepare bulk operations
      for (const [deviceName, deployment] of deviceNameToDeployment) {
        const {
          date,
          height,
          mountType,
          powerType,
          isPrimaryInLocation,
          latitude,
          longitude,
          network,
          user_id,
          host_id,
          mobility_metadata,
          actualDeploymentType,
          firstName,
          lastName,
          userName,
          email,
        } = deployment;

        const device_id = deviceIdMap.get(deviceName);

        try {
          if (actualDeploymentType === "static") {
            const coordsKey = `${latitude},${longitude}`;
            const site_id = siteMap.get(coordsKey);

            if (!site_id) {
              failed_deployments.push({
                deviceName,
                deployment_type: "static",
                error: { message: "Failed to create or find site" },
                user_id: user_id || null,
              });
              continue;
            }

            // Use cached site data instead of fetching from DB
            const siteData = siteDataCache.get(site_id.toString());

            if (!siteData) {
              failed_deployments.push({
                deviceName,
                deployment_type: "static",
                error: { message: "Site data not found in cache" },
                user_id: user_id || null,
              });
              continue;
            }

            const responseFromCreateApproximateCoordinates = distance.createApproximateCoordinates(
              {
                latitude: siteData.latitude,
                longitude: siteData.longitude,
              },
              next,
            );

            const {
              approximate_latitude,
              approximate_longitude,
              approximate_distance_in_km,
              bearing_in_radians,
            } = responseFromCreateApproximateCoordinates;

            // Activity with user details and device_id
            activitiesToInsert.push({
              device: deviceName,
              device_id: device_id,
              date: (date && new Date(date)) || new Date(),
              description: "device deployed",
              activityType: "deployment",
              deployment_type: "static",
              site_id,
              host_id: host_id || null,
              user_id: user_id || null,
              network,
              firstName,
              lastName,
              userName,
              email,
              nextMaintenance: getNextMaintenanceDate(date, 3),
            });

            // Device bulk update
            deviceBulkOps.push({
              updateOne: {
                filter: { name: deviceName },
                update: {
                  $set: {
                    height,
                    mountType,
                    powerType,
                    isPrimaryInLocation,
                    deployment_type: "static",
                    mobility: false,
                    nextMaintenance: getNextMaintenanceDate(date, 3),
                    latitude: approximate_latitude || siteData.latitude,
                    longitude: approximate_longitude || siteData.longitude,
                    approximate_distance_in_km: approximate_distance_in_km || 0,
                    bearing_in_radians: bearing_in_radians || 0,
                    site_id,
                    host_id: host_id || null,
                    grid_id: null,
                    isActive: true,
                    deployment_date: (date && new Date(date)) || new Date(),
                    status: "deployed",
                  },
                },
              },
            });
          } else {
            // Mobile deployment (mobile_count already incremented in Phase 1)
            const grid_id_obj = ObjectId(deployment.grid_id);
            // Convert to string for consistent map lookup
            const gridData = gridMap.get(deployment.grid_id.toString());

            if (!gridData) {
              failed_deployments.push({
                deviceName,
                deployment_type: "mobile",
                error: { message: "Grid not found" },
                user_id: user_id || null,
              });
              continue;
            }

            let initialLatitude = null;
            let initialLongitude = null;

            if (gridData.centers && gridData.centers.length > 0) {
              initialLatitude = gridData.centers[0].latitude;
              initialLongitude = gridData.centers[0].longitude;
            } else if (gridData.shape && gridData.shape.coordinates) {
              const coordinates = gridData.shape.coordinates[0];
              if (coordinates && coordinates.length > 0) {
                const latSum = coordinates.reduce(
                  (sum, coord) => sum + coord[1],
                  0,
                );
                const lngSum = coordinates.reduce(
                  (sum, coord) => sum + coord[0],
                  0,
                );
                initialLatitude = latSum / coordinates.length;
                initialLongitude = lngSum / coordinates.length;
              }
            }

            // Activity with user details and device_id
            activitiesToInsert.push({
              device: deviceName,
              device_id: device_id,
              date: (date && new Date(date)) || new Date(),
              description: "mobile device deployed",
              activityType: "deployment",
              deployment_type: "mobile",
              grid_id: grid_id_obj,
              host_id: host_id || null,
              user_id: user_id || null,
              network,
              firstName,
              lastName,
              userName,
              email,
              mobility_metadata,
              nextMaintenance: getNextMaintenanceDate(date, 3),
            });

            // Device bulk update
            const deviceUpdate = {
              height,
              mountType,
              powerType,
              isPrimaryInLocation,
              deployment_type: "mobile",
              mobility: true,
              nextMaintenance: getNextMaintenanceDate(date, 3),
              grid_id: grid_id_obj,
              site_id: null,
              host_id: host_id || null,
              isActive: true,
              deployment_date: (date && new Date(date)) || new Date(),
              status: "deployed",
              mobility_metadata,
            };

            if (initialLatitude && initialLongitude) {
              deviceUpdate.latitude = initialLatitude;
              deviceUpdate.longitude = initialLongitude;
            }

            deviceBulkOps.push({
              updateOne: {
                filter: { name: deviceName },
                update: { $set: deviceUpdate },
              },
            });
          }
        } catch (error) {
          failed_deployments.push({
            deviceName,
            deployment_type: actualDeploymentType,
            error: { message: error.message },
            user_id: deployment.user_id || null,
          });
        }
      }

      // PHASE 5: Execute bulk operations WITHOUT transactions
      let createdActivities = [];
      let updatedDevices = [];

      if (activitiesToInsert.length > 0) {
        try {
          // Use .create() to trigger pre-save middleware (validates deployment invariants)
          createdActivities = await ActivityModel(tenant).create(
            activitiesToInsert,
          );

          // Bulk update devices
          await DeviceModel(tenant).bulkWrite(deviceBulkOps, {
            ordered: false,
          });

          // Fetch updated devices for response
          const updatedDeviceNames = deviceBulkOps.map(
            (op) => op.updateOne.filter.name,
          );
          updatedDevices = await DeviceModel(tenant)
            .find({ name: { $in: updatedDeviceNames } })
            .lean();
        } catch (error) {
          logger.error(`Bulk operation error: ${error.message}`);

          // Mark all remaining deployments as failed
          for (const [deviceName, deployment] of deviceNameToDeployment) {
            if (!failed_deployments.find((f) => f.deviceName === deviceName)) {
              failed_deployments.push({
                deviceName,
                deployment_type: deployment.actualDeploymentType,
                error: { message: `Bulk operation failed: ${error.message}` },
                user_id: deployment.user_id || null,
              });
            }
          }
        }
      }

      // PHASE 6: Build success responses and trigger cache updates
      const deviceUpdateMap = new Map();
      updatedDevices.forEach((device) => {
        deviceUpdateMap.set(device.name, device);
      });

      // Trigger cache updates asynchronously (don't await)
      const cacheUpdatePromises = [];

      for (const activity of createdActivities) {
        const deployment = deviceNameToDeployment.get(activity.device);
        const updatedDevice = deviceUpdateMap.get(activity.device);

        if (updatedDevice) {
          successful_deployments.push({
            deviceName: activity.device,
            deployment_type: activity.deployment_type,
            createdActivity: {
              activity_codes: activity.activity_codes,
              tags: activity.tags,
              _id: activity._id,
              device: activity.device,
              device_id: activity.device_id,
              date: activity.date,
              description: activity.description,
              activityType: activity.activityType,
              site_id: activity.site_id,
              grid_id: activity.grid_id,
              deployment_type: activity.deployment_type,
              host_id: activity.host_id,
              network: activity.network,
              nextMaintenance: activity.nextMaintenance,
              createdAt: activity.createdAt,
              firstName: activity.firstName,
              lastName: activity.lastName,
              userName: activity.userName,
              email: activity.email,
            },
            updatedDevice: {
              status: updatedDevice.status,
              category: updatedDevice.category,
              isActive: updatedDevice.isActive,
              _id: updatedDevice._id,
              long_name: updatedDevice.long_name,
              network: updatedDevice.network,
              device_number: updatedDevice.device_number,
              name: updatedDevice.name,
              deployment_date: updatedDevice.deployment_date,
              deployment_type: updatedDevice.deployment_type,
              mobility: updatedDevice.mobility,
              latitude: updatedDevice.latitude,
              longitude: updatedDevice.longitude,
              mountType: updatedDevice.mountType,
              powerType: updatedDevice.powerType,
              site_id: updatedDevice.site_id,
              grid_id: updatedDevice.grid_id,
            },
            user_id: deployment.user_id || null,
          });

          // Queue cache update without individual .catch()
          cacheUpdatePromises.push(
            updateActivityCache(
              tenant,
              activity.site_id,
              activity.device_id,
              activity.device,
              next,
            ),
          );
        } else {
          failed_deployments.push({
            deviceName: activity.device,
            deployment_type: activity.deployment_type,
            error: { message: "Device update verification failed" },
            user_id: deployment.user_id || null,
          });
        }
      }

      // Use Promise.allSettled instead of Promise.all with redundant catch
      Promise.allSettled(cacheUpdatePromises).then((results) => {
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          failures.forEach((failure) => {
            logger.error(
              `Cache update failed: ${failure.reason?.message ||
                failure.reason}`,
            );
          });
        }
      });

      // PHASE 7: Send Kafka notifications (fire and forget)
      if (successful_deployments.length > 0) {
        (async () => {
          try {
            const deployTopic = constants.DEPLOY_TOPIC || "deploy-topic";
            const kafkaProducer = kafka.producer({
              groupId: constants.UNIQUE_PRODUCER_GROUP,
            });
            await kafkaProducer.connect();

            const messages = successful_deployments.map((deployment) => ({
              action: "create",
              value: JSON.stringify({
                createdActivity: deployment.createdActivity,
                updatedDevice: deployment.updatedDevice,
                user_id: deployment.user_id,
              }),
            }));

            await kafkaProducer.send({
              topic: deployTopic,
              messages,
            });

            await kafkaProducer.disconnect();
          } catch (error) {
            logger.error(`Kafka notification failed: ${error.message}`);
          }
        })();
      }

      // Create deployment summary
      const deployment_summary = {
        total_requested: body.length,
        total_successful: successful_deployments.length,
        total_failed: failed_deployments.length,
        static_deployments: static_count,
        mobile_deployments: mobile_count,
        successful_static: successful_deployments.filter(
          (d) => d.deployment_type === "static",
        ).length,
        successful_mobile: successful_deployments.filter(
          (d) => d.deployment_type === "mobile",
        ).length,
        sites_created: siteMap.size - existing_sites.length,
        sites_reused: existing_sites.length,
      };

      const overallSuccess =
        failed_deployments.length === 0 && successful_deployments.length > 0;
      const message =
        failed_deployments.length === 0
          ? "Batch deployment completed successfully"
          : `Batch deployment processed with ${failed_deployments.length} failure(s)`;

      return {
        success: overallSuccess,
        message,
        successful_deployments,
        failed_deployments,
        existing_sites,
        deployment_summary,
        status: overallSuccess ? httpStatus.OK : httpStatus.BAD_REQUEST,
      };
    } catch (error) {
      logger.error(`🐛🐛 Batch Deploy Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  recall: async (request, next) => {
    try {
      const { query, body } = request;
      const {
        recallType,
        user_id,
        firstName,
        lastName,
        email,
        userName,
      } = body;
      const { tenant, deviceName } = query;

      const deviceExists = await DeviceModel(tenant).exists({
        name: deviceName,
      });

      if (!deviceExists) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Invalid request, Device ${deviceName} not found`,
          },
        };
      }

      let requestForExistenceSearch = {};
      requestForExistenceSearch["filter"] = {
        name: deviceName,
        isActive: false,
      };
      requestForExistenceSearch["tenant"] = tenant;
      const isDeviceRecalled = await createDeviceUtil.doesDeviceSearchExist(
        requestForExistenceSearch,
        next,
      );

      if (isDeviceRecalled.success === true) {
        return {
          success: false,
          message: `Device ${deviceName} already recalled`,
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Device ${deviceName} already recalled` },
        };
      } else if (isDeviceRecalled.success === false) {
        let previousSiteId = null;
        let previousGridId = null;
        const filter = generateFilter.devices(request, next);
        const responseFromListDevice = await DeviceModel(tenant).list(
          {
            filter,
          },
          next,
        );

        if (
          responseFromListDevice.success === true &&
          responseFromListDevice.data.length === 1
        ) {
          const deviceData = responseFromListDevice.data[0];
          previousSiteId = deviceData.site
            ? deviceData.site._id
            : deviceData.site_id;
          previousGridId = deviceData.assigned_grid
            ? deviceData.assigned_grid[0]._id
            : deviceData.grid_id;
        } else if (responseFromListDevice.success === false) {
          return responseFromListDevice;
        } else {
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message: "unable to retrieve device information",
            },
          };
        }

        const siteActivityBody = {
          device: deviceName,
          user_id: user_id ? user_id : null,
          date: new Date(),
          description: "device recalled",
          activityType: "recallment",
          recallType,
          firstName,
          lastName,
          email,
          userName,
          site_id: previousSiteId, // Keep for cache update
        };

        let deviceBody = {
          body: {
            height: 0,
            mountType: "",
            powerType: "",
            isPrimaryInLocation: false,
            nextMaintenance: "",
            latitude: "",
            longitude: "",
            isActive: false,
            status: "recalled",
            deployment_type: "static",
            mobility: false,
            site_id: null,
            grid_id: null,
            host_id: null,
            previous_sites: previousSiteId ? [previousSiteId] : [],
            recall_date: new Date(),
          },
          query: {
            name: deviceName,
            tenant,
          },
        };

        if (previousGridId) {
          deviceBody.body.previous_grids = [previousGridId];
        }

        const responseFromRegisterActivity = await ActivityModel(
          tenant,
        ).register(siteActivityBody, next);

        if (responseFromRegisterActivity.success === true) {
          const createdActivity = responseFromRegisterActivity.data;

          const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
            deviceBody,
            next,
          );

          if (responseFromUpdateDevice.success === true) {
            const updatedDevice = responseFromUpdateDevice.data;

            // **NEW: Update activity cache immediately**
            // Use previousSiteId since device is being unassigned
            await updateActivityCache(
              tenant,
              previousSiteId,
              updatedDevice._id,
              deviceName,
              next,
            );

            const data = {
              createdActivity: {
                _id: createdActivity._id,
                device: createdActivity.device,
                date: createdActivity.date,
                description: createdActivity.description,
                activityType: createdActivity.activityType,
                recallType,
              },
              updatedDevice: {
                height: updatedDevice.height,
                category: updatedDevice.category,
                _id: updatedDevice._id,
                long_name: updatedDevice.long_name,
                network: updatedDevice.network,
                device_number: updatedDevice.device_number,
                name: updatedDevice.name,
                mountType: updatedDevice.mountType,
                powerType: updatedDevice.powerType,
                isPrimaryInLocation: updatedDevice.isPrimaryInLocation,
                nextMaintenance: updatedDevice.nextMaintenance,
                latitude: updatedDevice.latitude,
                longitude: updatedDevice.longitude,
                isActive: updatedDevice.isActive,
                status: updatedDevice.status,
                deployment_type: updatedDevice.deployment_type,
                mobility: updatedDevice.mobility,
                site_id: updatedDevice.site_id,
                grid_id: updatedDevice.grid_id,
                host_id: updatedDevice.host_id,
                previous_sites: updatedDevice.previous_sites,
                recall_date: updatedDevice.recall_date,
              },
              user_id: user_id ? user_id : null,
            };

            try {
              const recallTopic = constants.RECALL_TOPIC || "recall-topic";
              const kafkaProducer = kafka.producer({
                groupId: constants.UNIQUE_PRODUCER_GROUP,
              });
              await kafkaProducer.connect();
              await kafkaProducer.send({
                topic: recallTopic,
                messages: [
                  {
                    action: "create",
                    value: JSON.stringify(data),
                  },
                ],
              });

              await kafkaProducer.disconnect();
            } catch (error) {
              logger.error(`internal server error -- ${error.message}`);
            }

            return {
              success: true,
              message: "successfully recalled the device",
              data,
            };
          } else if (responseFromUpdateDevice.success === false) {
            return responseFromUpdateDevice;
          }
        } else if (responseFromRegisterActivity.success === false) {
          return responseFromRegisterActivity;
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

  maintain: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant, deviceName } = query;
      const {
        date,
        tags,
        description,
        site_id,
        grid_id,
        maintenanceType,
        network,
        user_id,
        firstName,
        lastName,
        email,
        userName,
      } = body;

      const deviceExists = await DeviceModel(tenant).exists({
        name: deviceName,
      });

      if (!deviceExists) {
        logger.error(
          `Maintain Device: Invalid request-- Device ${deviceName} not found`,
        );
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Invalid request, Device ${deviceName} not found`,
          },
        };
      }

      // **CRITICAL**: Get full device details to capture device_id
      const deviceDetails = await DeviceModel(tenant)
        .findOne({
          name: deviceName,
        })
        .lean();

      if (!deviceDetails || deviceDetails.status !== "deployed") {
        return {
          success: false,
          message: "Maintenance can only be recorded for deployed devices",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Device ${deviceName} is not currently deployed.`,
          },
        };
      }

      // **CRITICAL**: Include device_id in activity body
      const siteActivityBody = {
        device: deviceName,
        device_id: deviceDetails._id, // Add device_id!
        user_id: user_id ? user_id : null,
        date: (date && new Date(date)) || new Date(),
        description: description,
        activityType: "maintenance",
        site_id: site_id || null,
        grid_id: grid_id || null,
        network,
        tags,
        firstName,
        lastName,
        email,
        userName,
        maintenanceType,
        nextMaintenance: getNextMaintenanceDate(date, 3),
      };

      let deviceBody = {};
      deviceBody["body"] = {};
      deviceBody["query"] = {};
      deviceBody["body"]["nextMaintenance"] = getNextMaintenanceDate(date, 3);
      deviceBody["body"]["maintenance_date"] =
        (date && new Date(date)) || new Date();
      deviceBody["query"]["name"] = deviceName;
      deviceBody["query"]["tenant"] = tenant;

      const responseFromRegisterActivity = await ActivityModel(tenant).register(
        siteActivityBody,
        next,
      );

      if (responseFromRegisterActivity.success === true) {
        const createdActivity = responseFromRegisterActivity.data;

        const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
          deviceBody,
          next,
        );

        if (responseFromUpdateDevice.success === true) {
          const updatedDevice = responseFromUpdateDevice.data;

          // **NEW: Update activity cache immediately**
          await updateActivityCache(
            tenant,
            siteActivityBody.site_id,
            deviceDetails._id,
            deviceName,
            next,
          );

          const data = {
            createdActivity: {
              activity_codes: createdActivity.activity_codes,
              tags: createdActivity.tags,
              _id: createdActivity._id,
              device: createdActivity.device,
              device_id: createdActivity.device_id, // Now populated!
              date: createdActivity.date,
              description: createdActivity.description,
              activityType: createdActivity.activityType,
              site_id: createdActivity.site_id,
              grid_id: createdActivity.grid_id,
              deployment_type: createdActivity.deployment_type,
              host_id: createdActivity.host_id,
              network: createdActivity.network,
              nextMaintenance: createdActivity.nextMaintenance,
              createdAt: createdActivity.createdAt,
            },
            updatedDevice: {
              _id: updatedDevice._id,
              long_name: updatedDevice.long_name,
              status: updatedDevice.status,
              device_number: updatedDevice.device_number,
              name: updatedDevice.name,
              maintenance_date: updatedDevice.maintenance_date,
              nextMaintenance: updatedDevice.nextMaintenance,
            },
            user_id: user_id ? user_id : null,
          };

          try {
            const kafkaProducer = kafka.producer({
              groupId: constants.UNIQUE_PRODUCER_GROUP,
            });
            await kafkaProducer.connect();
            await kafkaProducer.send({
              topic: "activities-topic",
              messages: [
                {
                  action: "create",
                  value: JSON.stringify(data),
                },
              ],
            });

            await kafkaProducer.disconnect();
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }

          return {
            success: true,
            message: "successfully maintained the device",
            data,
          };
        } else if (responseFromUpdateDevice.success === false) {
          return responseFromUpdateDevice;
        }
      } else if (responseFromRegisterActivity.success === false) {
        return responseFromRegisterActivity;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

  getDeploymentStatistics: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const [
        totalDeployments,
        staticDeployments,
        mobileDeployments,
        activeDevices,
        staticActiveDevices,
        mobileActiveDevices,
        totalDevices,
      ] = await Promise.all([
        ActivityModel(tenant).countDocuments({ activityType: "deployment" }),
        ActivityModel(tenant).countDocuments({
          activityType: "deployment",
          deployment_type: "static",
        }),
        ActivityModel(tenant).countDocuments({
          activityType: "deployment",
          deployment_type: "mobile",
        }),
        DeviceModel(tenant).countDocuments({ isActive: true }),
        DeviceModel(tenant).countDocuments({
          isActive: true,
          deployment_type: "static",
        }),
        DeviceModel(tenant).countDocuments({
          isActive: true,
          deployment_type: "mobile",
        }),
        DeviceModel(tenant).countDocuments({}),
      ]);

      const stats = {
        deployments: {
          total: totalDeployments,
          static: staticDeployments,
          mobile: mobileDeployments,
          static_percentage:
            totalDeployments > 0
              ? ((staticDeployments / totalDeployments) * 100).toFixed(2)
              : "0.00",
          mobile_percentage:
            totalDeployments > 0
              ? ((mobileDeployments / totalDeployments) * 100).toFixed(2)
              : "0.00",
        },
        active_devices: {
          total: activeDevices,
          static: staticActiveDevices,
          mobile: mobileActiveDevices,
          static_percentage:
            activeDevices > 0
              ? ((staticActiveDevices / activeDevices) * 100).toFixed(2)
              : "0.00",
          mobile_percentage:
            activeDevices > 0
              ? ((mobileActiveDevices / activeDevices) * 100).toFixed(2)
              : "0.00",
        },
        all_devices: {
          total: totalDevices,
          active_rate:
            totalDevices > 0
              ? ((activeDevices / totalDevices) * 100).toFixed(2)
              : "0.00",
        },
        generated_at: new Date().toISOString(),
      };

      return {
        success: true,
        message: "Deployment statistics retrieved successfully",
        data: stats,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Get Deployment Statistics Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  getDevicesByDeploymentType: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = query;
      const { deploymentType } = params;

      // Validate deployment type
      if (!["static", "mobile"].includes(deploymentType)) {
        return {
          success: false,
          message: "Invalid deployment type",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "deploymentType must be 'static' or 'mobile'" },
        };
      }

      const filter = {
        deployment_type: deploymentType,
        isActive: true,
      };

      // Build the aggregation pipeline
      let pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: deploymentType === "static" ? "sites" : "grids",
            localField: deploymentType === "static" ? "site_id" : "grid_id",
            foreignField: "_id",
            as: deploymentType === "static" ? "site_temp" : "grid_temp",
          },
        },
        // Convert array to single object using $unwind (with preserveNullAndEmptyArrays to handle missing references)
        {
          $unwind: {
            path: deploymentType === "static" ? "$site_temp" : "$grid_temp",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            name: 1,
            long_name: 1,
            status: 1,
            isActive: 1,
            deployment_date: 1,
            deployment_type: 1,
            mobility: 1,
            latitude: 1,
            longitude: 1,
            height: 1,
            mountType: 1,
            powerType: 1,
            network: 1,
            device_number: 1,
            ...(deploymentType === "static"
              ? {
                  site_id: 1,
                  site: {
                    _id: "$site_temp._id",
                    name: "$site_temp.name",
                    admin_level: "$site_temp.admin_level",
                    long_name: "$site_temp.long_name",
                  },
                }
              : {
                  grid_id: 1,
                  grid: {
                    _id: "$grid_temp._id",
                    name: "$grid_temp.name",
                    admin_level: "$grid_temp.admin_level",
                    long_name: "$grid_temp.long_name",
                  },
                  mobility_metadata: 1,
                }),
          },
        },
        { $sort: { deployment_date: -1 } },
        { $skip: parseInt(skip) || 0 },
        { $limit: parseInt(limit) || 100 },
      ];

      const devices = await DeviceModel(tenant).aggregate(pipeline);

      return {
        success: true,
        message: `${deploymentType} devices retrieved successfully`,
        data: devices,
        deployment_type: deploymentType,
        total_count: devices.length,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Get Devices By Deployment Type Error ${error.message}`,
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
  recalculateNextMaintenance: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { dry_run = false } = request.body;

      const maintenanceActivities = await ActivityModel(tenant)
        .find({ activityType: "maintenance" })
        .select("_id device date nextMaintenance")
        .lean();

      if (isEmpty(maintenanceActivities)) {
        return {
          success: true,
          message: "No maintenance activities found to process.",
          data: {
            total_maintenance_activities_checked: 0,
            activities_to_update: 0,
            updated_activities: 0,
            updated_devices: 0,
            dry_run,
            changes: [],
          },
          status: httpStatus.OK,
        };
      }

      let updatedActivitiesCount = 0;
      let updatedDevicesCount = 0;
      const changes = [];
      const activityBulkOps = [];
      // Validate dates and track invalid rows
      const isValidDate = (d) => !!d && !isNaN(new Date(d).getTime());
      const invalidActivities = [];
      // Build latest maintenance date per device across ALL maintenance activities
      const latestMaintenanceDateByDevice = new Map();
      for (const a of maintenanceActivities) {
        if (!isValidDate(a.date)) {
          invalidActivities.push(a);
          continue; // Skip invalid activities from being processed
        }
        const prev = latestMaintenanceDateByDevice.get(a.device);
        const currDate = new Date(a.date);
        if (!prev || currDate > new Date(prev)) {
          latestMaintenanceDateByDevice.set(a.device, a.date);
        }
      }
      const devicesWithChangedActivities = new Set();

      for (const activity of maintenanceActivities) {
        if (!isValidDate(activity.date)) {
          // Already tracked above, just skip processing
          continue;
        }
        const correctNextMaintenance = getNextMaintenanceDate(activity.date, 3);

        if (
          !activity.nextMaintenance ||
          new Date(activity.nextMaintenance).getTime() !==
            correctNextMaintenance.getTime()
        ) {
          changes.push({
            activity_id: activity._id,
            device_name: activity.device,
            activity_date: activity.date,
            old_next_maintenance: activity.nextMaintenance,
            new_next_maintenance: correctNextMaintenance,
          });

          activityBulkOps.push({
            updateOne: {
              filter: { _id: activity._id },
              update: { $set: { nextMaintenance: correctNextMaintenance } },
            },
          });
          // Mark device as needing nextMaintenance re-evaluation
          devicesWithChangedActivities.add(activity.device);
        }
      }

      if (!dry_run && activityBulkOps.length > 0) {
        const activityResult = await ActivityModel(tenant).bulkWrite(
          activityBulkOps,
          { ordered: false },
        );
        updatedActivitiesCount = activityResult.modifiedCount;

        // Prepare bulk operations for devices
        const deviceBulkOps = [];
        const deviceNamesToUpdate = Array.from(devicesWithChangedActivities);

        if (deviceNamesToUpdate.length > 0) {
          const devices = await DeviceModel(tenant)
            .find({ name: { $in: deviceNamesToUpdate } })
            .select("_id name nextMaintenance")
            .lean();

          for (const device of devices) {
            const latestMaintenanceDate = latestMaintenanceDateByDevice.get(
              device.name,
            );
            if (!latestMaintenanceDate) continue;
            const latestCorrectNextMaintenance = getNextMaintenanceDate(
              latestMaintenanceDate,
              3,
            );
            // Only update when it actually changes
            if (
              !device.nextMaintenance ||
              new Date(device.nextMaintenance).getTime() !==
                latestCorrectNextMaintenance.getTime()
            ) {
              deviceBulkOps.push({
                updateOne: {
                  filter: { _id: device._id },
                  update: {
                    $set: { nextMaintenance: latestCorrectNextMaintenance },
                  },
                },
              });
            }
          }

          if (deviceBulkOps.length > 0) {
            const deviceResult = await DeviceModel(tenant).bulkWrite(
              deviceBulkOps,
              { ordered: false },
            );
            updatedDevicesCount = deviceResult.modifiedCount || 0;
          }
        }
      }

      const summary = {
        total_maintenance_activities_checked: maintenanceActivities.length,
        activities_to_update: changes.length,
        updated_activities: updatedActivitiesCount,
        updated_devices: dry_run ? 0 : updatedDevicesCount,
        invalid_activities_skipped: invalidActivities.length,
        dry_run,
        changes: changes,
        invalid_activities: invalidActivities.map((a) => ({
          activity_id: a._id,
          device_name: a.device,
          invalid_date: a.date,
        })),
      };

      return {
        success: true,
        message: dry_run
          ? "Dry run completed. No changes were made."
          : "Recalculation completed successfully.",
        data: summary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  backfillDeviceIds: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { dry_run = false, batch_size = 100 } = request.body;

      logText(`Starting device_id backfill for tenant: ${tenant}`);

      // Build filter for activities without device_id but WITH a valid device name
      const filter = {
        $or: [{ device_id: null }, { device_id: { $exists: false } }],
        device: { $exists: true, $nin: [null, ""] },
      };

      // Get total count for reporting
      const totalCount = await ActivityModel(tenant).countDocuments(filter);

      logText(`Found ${totalCount} activities needing backfill`);

      if (dry_run) {
        // For dry run, get a small sample with minimal projection
        const sampleActivities = await ActivityModel(tenant)
          .find(filter)
          .select("_id device activityType date device_id")
          .limit(10)
          .lean();

        const sampleDeviceNames = [
          ...new Set(sampleActivities.map((a) => a.device)),
        ];

        return {
          success: true,
          message: "Dry run completed - no changes made",
          data: {
            total_activities_needing_backfill: totalCount,
            sample_device_names: sampleDeviceNames,
            sample_activities: sampleActivities.map((a) => ({
              _id: a._id,
              device: a.device,
              activityType: a.activityType,
              date: a.date,
              device_id: a.device_id,
            })),
            batch_size: batch_size,
            estimated_batches: Math.ceil(totalCount / batch_size),
            dry_run: true,
          },
          status: httpStatus.OK,
        };
      }

      // Actual backfill using cursor-based batching
      let processedCount = 0;
      let totalBackfilled = 0;
      const notFound = [];
      const deviceCache = new Map();
      let batchNumber = 0;

      // Process in batches - NO SKIP, filter naturally shrinks as we update
      while (true) {
        batchNumber++;
        logText(`Processing batch #${batchNumber} (batch_size=${batch_size})`);

        // Fetch batch with minimal projection
        // No skip needed - updated documents automatically drop out of filter
        const batchActivities = await ActivityModel(tenant)
          .find(filter)
          .select("_id device activityType date")
          .limit(batch_size)
          .lean();

        // Exit loop when no more activities match the filter
        if (batchActivities.length === 0) {
          logText("No more activities to process - backfill complete");
          break;
        }

        const bulkOps = [];

        // Process each activity in the batch
        for (const activity of batchActivities) {
          try {
            let device;

            // Check cache first
            if (deviceCache.has(activity.device)) {
              device = deviceCache.get(activity.device);
            } else {
              // Find the device by name with minimal projection
              device = await DeviceModel(tenant)
                .findOne({ name: activity.device })
                .select("_id name")
                .lean();

              // Cache the result (even if null)
              deviceCache.set(activity.device, device);
            }

            if (device) {
              bulkOps.push({
                updateOne: {
                  filter: { _id: activity._id },
                  update: { $set: { device_id: device._id } },
                },
              });
            } else {
              notFound.push({
                activity_id: activity._id,
                device_name: activity.device,
                activityType: activity.activityType,
                date: activity.date,
                reason: "Device not found in database",
              });
            }
          } catch (error) {
            notFound.push({
              activity_id: activity._id,
              device_name: activity.device,
              error: error.message,
            });
          }
        }

        // Execute bulk update for this batch
        if (bulkOps.length > 0) {
          const batchResult = await ActivityModel(tenant).bulkWrite(bulkOps, {
            ordered: false,
          });
          totalBackfilled += batchResult.modifiedCount;
          logText(
            `Batch #${batchNumber} updated: ${batchResult.modifiedCount} activities`,
          );
        }

        processedCount += batchActivities.length;

        // Log progress
        const progressPercent = Math.round((processedCount / totalCount) * 100);
        logText(
          `Progress: ${processedCount}/${totalCount} activities processed (${progressPercent}%)`,
        );

        // Safety check: prevent infinite loops
        if (batchNumber > BACK_FILL_BATCH_SIZE) {
          logger.warn(
            `Safety limit reached (${BACK_FILL_BATCH_SIZE} batches), stopping backfill`,
          );
          break;
        }
      }

      // After successful backfill, trigger cache recalculation for affected devices
      if (totalBackfilled > 0) {
        logText("Triggering cache updates for affected devices...");

        // Get unique device names that were updated
        const updatedDeviceNames = [...deviceCache.keys()].filter(
          (name) => deviceCache.get(name) !== null,
        );

        // Update cache for devices (limit to first 50 to avoid timeout)
        const devicesToUpdate = updatedDeviceNames.slice(
          0,
          UPDATE_DEVICE_NAMES_CACHE_BATCH_SIZE,
        );

        Promise.all(
          devicesToUpdate.map(async (deviceName) => {
            try {
              const device = deviceCache.get(deviceName);
              if (device) {
                await updateActivityCache(
                  tenant,
                  null,
                  device._id,
                  deviceName,
                  next,
                );
              }
            } catch (error) {
              logger.error(
                `Failed to update cache for ${deviceName}: ${error.message}`,
              );
            }
          }),
        )
          .then(() => {
            logText(
              `Cache updates completed for ${devicesToUpdate.length} devices`,
            );
          })
          .catch((error) => {
            logger.error(`Cache update error: ${error.message}`);
          });
      }

      return {
        success: true,
        message: "Device ID backfill completed successfully",
        data: {
          total_activities_processed: processedCount,
          activities_backfilled: totalBackfilled,
          devices_not_found: notFound.length,
          not_found_details: notFound.slice(0, 20),
          total_not_found: notFound.length,
          unique_devices_cached: deviceCache.size,
          batches_processed: batchNumber,
          batch_size: batch_size,
          tenant: tenant,
          backfill_completed_at: new Date(),
          cache_update_triggered: totalBackfilled > 0,
          cache_updates_queued: Math.min(
            [...deviceCache.keys()].filter(
              (name) => deviceCache.get(name) !== null,
            ).length,
            UPDATE_DEVICE_NAMES_CACHE_BATCH_SIZE,
          ),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Backfill Error ${error.message}`);
      next(
        new HttpError("Backfill Failed", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        }),
      );
    }
  },
  refreshActivityCaches: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { device_names, site_ids, refresh_all = false } = request.body;

      logText(`Starting manual cache refresh for tenant: ${tenant}`);

      const refreshedDevices = [];
      const refreshedSites = [];
      const errors = [];

      // Refresh specific devices
      if (device_names && device_names.length > 0) {
        for (const deviceName of device_names) {
          try {
            const device = await DeviceModel(tenant)
              .findOne({ name: deviceName })
              .lean();

            if (device) {
              await updateActivityCache(
                tenant,
                device.site_id,
                device._id,
                deviceName,
                next,
              );
              refreshedDevices.push(deviceName);
            } else {
              errors.push({
                device_name: deviceName,
                error: "Device not found",
              });
            }
          } catch (error) {
            errors.push({ device_name: deviceName, error: error.message });
          }
        }
      }

      // Refresh specific sites
      if (site_ids && site_ids.length > 0) {
        for (const site_id of site_ids) {
          try {
            await updateActivityCache(
              tenant,
              ObjectId(site_id),
              null,
              null,
              next,
            );
            refreshedSites.push(site_id);
          } catch (error) {
            errors.push({ site_id: site_id, error: error.message });
          }
        }
      }

      // Refresh all (use with caution for large datasets)
      if (refresh_all) {
        // Get all devices with activities
        const devicesWithActivities = await DeviceModel(tenant)
          .find({ cached_total_activities: { $gte: 0 } })
          .limit(FETCH_DEVICES_WITH_ACTIVITIES_LIMIT) // Safety limit
          .lean();

        for (const device of devicesWithActivities) {
          try {
            await updateActivityCache(
              tenant,
              device.site_id,
              device._id,
              device.name,
              next,
            );
            refreshedDevices.push(device.name);
          } catch (error) {
            errors.push({ device_name: device.name, error: error.message });
          }
        }
      }

      return {
        success: true,
        message: "Cache refresh completed",
        data: {
          devices_refreshed: refreshedDevices.length,
          sites_refreshed: refreshedSites.length,
          errors: errors.length,
          error_details: errors,
          tenant: tenant,
          refreshed_at: new Date(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Cache Refresh Error ${error.message}`);
      next(
        new HttpError(
          "Cache Refresh Failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
    }
  },
};

module.exports = createActivity;
