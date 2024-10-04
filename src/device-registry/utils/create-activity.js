const ActivityModel = require("@models/SiteActivity");
const { logObject } = require("./log");
const createDeviceUtil = require("./create-device");
const createSiteUtil = require("./create-site");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const { addMonthsToProvideDateTime } = require("./date");
const generateFilter = require("./generate-filter");
const constants = require("@config/constants");
const distance = require("./distance");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-activity-util`
);
const { HttpError } = require("@utils/errors");
const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const createActivity = {
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.activities(request, next);

      const responseFromListActivity = await ActivityModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListActivity;
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
      const filter = generateFilter.activities(request, next);

      const responseFromModifyActivity = await ActivityModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );

      return responseFromModifyActivity;
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
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.activities(request, next);

      const responseFromRemoveActivity = await ActivityModel(tenant).remove(
        {
          filter,
        },
        next
      );

      return responseFromRemoveActivity;
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
        host_id,
        network,
        user_id,
      } = body;

      const deviceExists = await DeviceModel(tenant).exists({
        name: deviceName,
      });

      const siteExists = await SiteModel(tenant).exists({
        _id: ObjectId(site_id),
      });

      if (!deviceExists || !siteExists) {
        return {
          success: false,
          message: "Device or Site not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Invalid request, Device ${deviceName} or Site ${site_id} not found`,
          },
        };
      }

      let requestForExistenceSearch = {};
      requestForExistenceSearch.filter = {
        name: deviceName,
        isActive: true,
      };

      requestForExistenceSearch.tenant = tenant;
      const responseFromDeviceSearchCheck = await createDeviceUtil.doesDeviceSearchExist(
        requestForExistenceSearch,
        next
      );

      if (responseFromDeviceSearchCheck.success === true) {
        return {
          success: false,
          message: `Device ${deviceName} already deployed`,
          status: httpStatus.CONFLICT,
          errors: { message: `Device ${deviceName} already deployed` },
        };
      } else if (responseFromDeviceSearchCheck.success === false) {
        const responseFromListSite = await createSiteUtil.list(request, next);
        if (responseFromListSite.success === true) {
          if (responseFromListSite.data.length === 1) {
            const { latitude, longitude } = responseFromListSite.data[0];
            const siteActivityBody = {
              device: deviceName,
              date: (date && new Date(date)) || new Date(),
              description: "device deployed",
              activityType: "deployment",
              site_id,
              host_id: host_id ? host_id : null,
              user_id: user_id ? user_id : null,
              network,
              nextMaintenance: addMonthsToProvideDateTime(
                date && new Date(date),
                3,
                next
              ),
            };

            const responseFromCreateApproximateCoordinates = distance.createApproximateCoordinates(
              { latitude, longitude },
              next
            );

            const {
              approximate_latitude,
              approximate_longitude,
              approximate_distance_in_km,
              bearing_in_radians,
            } = responseFromCreateApproximateCoordinates;

            let deviceBody = {};
            deviceBody.body = {};
            deviceBody.query = {};
            deviceBody.body.height = height;
            deviceBody.body.mountType = mountType;
            deviceBody.body.powerType = powerType;
            deviceBody.body.isPrimaryInLocation = isPrimaryInLocation;
            deviceBody.body.nextMaintenance = addMonthsToProvideDateTime(
              date && new Date(date),
              3,
              next
            );
            deviceBody.body.latitude = approximate_latitude
              ? approximate_latitude
              : latitude;
            deviceBody.body.longitude = approximate_longitude
              ? approximate_longitude
              : longitude;
            deviceBody.body.approximate_distance_in_km = approximate_distance_in_km
              ? approximate_distance_in_km
              : 0;
            deviceBody.body.bearing_in_radians = bearing_in_radians
              ? bearing_in_radians
              : 0;
            deviceBody.body.site_id = site_id;
            deviceBody.body.host_id = host_id ? host_id : null;
            deviceBody.body.isActive = true;
            deviceBody.body.deployment_date =
              (date && new Date(date)) || new Date();
            deviceBody.body.status = "deployed";
            deviceBody.query.name = deviceName;
            deviceBody.query.tenant = tenant;

            // Register activity and update the device
            const responseFromRegisterActivity = await ActivityModel(
              tenant
            ).register(siteActivityBody, next);

            if (responseFromRegisterActivity.success === true) {
              const createdActivity = responseFromRegisterActivity.data;

              const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
                deviceBody,
                next
              );

              if (responseFromUpdateDevice.success === true) {
                const updatedDevice = responseFromUpdateDevice.data;
                const data = {
                  createdActivity: {
                    activity_codes: createdActivity.activity_codes,
                    tags: createdActivity.tags,
                    _id: createdActivity._id,
                    device: createdActivity.device,
                    date: createdActivity.date,
                    description: createdActivity.description,
                    activityType: createdActivity.activityType,
                    site_id: createdActivity.site_id,
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
                    latitude: updatedDevice.latitude,
                    longitude: updatedDevice.longitude,
                    mountType: updatedDevice.mountType,
                    powerType: updatedDevice.powerType,
                    site_id: updatedDevice.site_id,
                  },
                  user_id: user_id ? user_id : null,
                };
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
                    `🐛🐛 KAFKA: Internal Server Error -- ${error.message}`
                  );
                }

                // Construct a simplified response structure
                return {
                  success: true,
                  message: "successfully deployed the device",
                  data,
                };
              } else if (responseFromUpdateDevice.success === false) {
                return responseFromUpdateDevice;
              }
            } else if (responseFromRegisterActivity.success === false) {
              return responseFromRegisterActivity;
            }
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
        } else if (responseFromListSite.success === false) {
          return responseFromListSite;
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
  recall: async (request, next) => {
    try {
      const { query, body } = request;
      const { recallType, user_id } = body;
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
        next
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
        const filter = generateFilter.devices(request, next);
        const responseFromListDevice = await DeviceModel(tenant).list(
          {
            filter,
          },
          next
        );

        if (
          responseFromListDevice.success === true &&
          responseFromListDevice.data.length === 1
        ) {
          previousSiteId = responseFromListDevice.data[0].site._id;
        } else if (responseFromListDevice.success === false) {
          return responseFromListDevice;
        } else {
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message: "unable to retrieve one site ID of the current Site",
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
            site_id: null,
            host_id: null,
            previous_sites: [previousSiteId],
            recall_date: new Date(),
          },
          query: {
            name: deviceName,
            tenant,
          },
        };

        const responseFromRegisterActivity = await ActivityModel(
          tenant
        ).register(siteActivityBody, next);

        if (responseFromRegisterActivity.success === true) {
          const createdActivity = responseFromRegisterActivity.data;

          const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
            deviceBody,
            next
          );

          if (responseFromUpdateDevice.success === true) {
            // Extract only necessary fields for response
            const updatedDevice = responseFromUpdateDevice.data;
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
                site_id: updatedDevice.site_id,
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

            // Construct a simplified response structure
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
          { message: error.message }
        )
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
        maintenanceType,
        network,
      } = body;

      const deviceExists = await DeviceModel(tenant).exists({
        name: deviceName,
      });

      if (!deviceExists) {
        logger.error(
          `Maintain Device: Invalid request-- Device ${deviceName} not found`
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

      const siteActivityBody = {
        device: deviceName,
        date: (date && new Date(date)) || new Date(),
        description: description,
        activityType: "maintenance",
        site_id,
        network,
        tags,
        maintenanceType,
        nextMaintenance: addMonthsToProvideDateTime(
          date && new Date(date),
          3,
          next
        ),
      };
      let deviceBody = {};
      deviceBody["body"] = {};
      deviceBody["query"] = {};
      deviceBody["body"]["nextMaintenance"] = addMonthsToProvideDateTime(
        date && new Date(date),
        3,
        next
      );
      deviceBody["body"]["maintenance_date"] =
        (date && new Date(date)) || new Date();
      deviceBody["query"]["name"] = deviceName;
      deviceBody["query"]["tenant"] = tenant;

      const responseFromRegisterActivity = await ActivityModel(tenant).register(
        siteActivityBody,
        next
      );

      if (responseFromRegisterActivity.success === true) {
        const createdActivity = responseFromRegisterActivity.data;
        const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
          deviceBody,
          next
        );
        if (responseFromUpdateDevice.success === true) {
          const updatedDevice = responseFromUpdateDevice.data;
          const data = { createdActivity, updatedDevice };
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
          { message: error.message }
        )
      );
    }
  },
  batchDeployWithCoordinates: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      const successful_deployments = [];
      const failed_deployments = [];
      const existing_sites = [];

      // Create a map to store site IDs based on unique latitude and longitude
      const siteMap = new Map();

      // Create an array of promises for each deployment
      const deploymentPromises = body.map(async (deployment) => {
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
        } = deployment;

        const coordsKey = `${latitude},${longitude}`; // Unique key for coordinates

        let site_id;

        // Check if site already exists in the database using unique fields
        const existingSite = await SiteModel(tenant).findOne({
          $or: [
            { name: site_name },
            { latitude: latitude, longitude: longitude },
          ],
        });

        if (existingSite) {
          // If an existing site is found, use its ID
          site_id = existingSite._id;
          existing_sites.push({
            deviceName,
            site_id,
            message: `Using existing site with name "${existingSite.name}" and coordinates (${latitude}, ${longitude})`,
          });
        } else {
          // Step 1: Create a new site using the coordinates
          const siteRequestBody = {
            name: site_name,
            latitude: latitude,
            longitude: longitude,
          };

          const siteRequest = {
            body: siteRequestBody,
            query: { tenant },
          };

          const responseFromCreateSite = await createSiteUtil.create(
            siteRequest,
            next
          );

          if (responseFromCreateSite.success === false) {
            failed_deployments.push({
              deviceName,
              error: responseFromCreateSite.errors,
              user_id: user_id ? user_id : null,
            });
            return; // Skip to the next deployment if site creation fails
          }

          // Retrieve the newly created site_id
          const createdSite = responseFromCreateSite.data;
          site_id = createdSite._id; // Store new site_id

          // Store in map for future use
          siteMap.set(coordsKey, site_id);
        }

        // Step 3: Proceed with device deployment using the generated or reused site_id
        let deviceRequestBody = {
          date,
          height,
          mountType,
          powerType,
          isPrimaryInLocation,
          site_id, // Use the newly created or reused site_id
          network,
          user_id,
          host_id,
        };

        const deviceRequest = {
          body: deviceRequestBody,
          query: { tenant, deviceName }, // Use deviceName from the current deployment object
        };

        // Call the existing deploy function
        const responseFromDeploy = await createActivity.deploy(
          deviceRequest,
          next
        );

        if (responseFromDeploy.success) {
          const createdActivity = responseFromDeploy.data.createdActivity;
          const updatedDevice = responseFromDeploy.data.updatedDevice;
          successful_deployments.push({
            deviceName,
            createdActivity,
            updatedDevice,
            user_id: user_id ? user_id : null,
          });
        } else {
          failed_deployments.push({
            deviceName,
            error: responseFromDeploy.errors,
            user_id: user_id ? user_id : null,
          });
        }
      });

      // Wait for all deployments to complete
      await Promise.all(deploymentPromises);

      return {
        success: true,
        message: "Batch deployment processed",
        successful_deployments,
        failed_deployments, // Include both successful and failed responses
        existing_sites, // Include information about existing sites used
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

module.exports = createActivity;
