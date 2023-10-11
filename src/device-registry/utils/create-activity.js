const ActivityModel = require("@models/SiteActivity");
const { logObject, logElement, logText } = require("./log");
const createDeviceUtil = require("./create-device");
const createSiteUtil = require("./create-site");
const HTTPStatus = require("http-status");
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

const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const createActivity = {
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.activities(request);

      const responseFromListActivity = await ActivityModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListActivity;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  update: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const update = body;
      const filter = generateFilter.activities(request);

      const responseFromModifyActivity = await ActivityModel(tenant).modify({
        filter,
        update,
      });

      return responseFromModifyActivity;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        success: false,
      };
    }
  },

  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.activities(request);

      const responseFromRemoveActivity = await ActivityModel(tenant).remove({
        filter,
      });

      return responseFromRemoveActivity;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deploy: async (request) => {
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
        requestForExistenceSearch
      );

      if (responseFromDeviceSearchCheck.success === true) {
        return {
          success: false,
          message: `Device ${deviceName} already deployed`,
          status: HTTPStatus.CONFLICT,
        };
      } else if (responseFromDeviceSearchCheck.success === false) {
        const filter = { _id: ObjectId(site_id) };
        const responseFromListSite = await createSiteUtil.list(request);
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
              network,
              nextMaintenance: addMonthsToProvideDateTime(
                date && new Date(date),
                3
              ),
            };

            const responseFromCreateApproximateCoordinates = distance.createApproximateCoordinates(
              { latitude, longitude }
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
              3
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

            const responseFromRegisterActivity = await ActivityModel(
              tenant
            ).register(siteActivityBody);

            if (responseFromRegisterActivity.success === true) {
              const createdActivity = responseFromRegisterActivity.data;
              const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
                deviceBody
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
                    topic: constants.ACTIVITIES_TOPIC,
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
              status: HTTPStatus.NOT_FOUND,
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  recall: async (request) => {
    try {
      const { query, body } = request;
      const { recallType } = body;
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
        requestForExistenceSearch
      );

      logObject("isDeviceRecalled", isDeviceRecalled);

      if (isDeviceRecalled.success === true) {
        return {
          success: false,
          message: `Device ${deviceName} already recalled`,
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: `Device ${deviceName} already recalled` },
        };
      } else if (isDeviceRecalled.success === false) {
        let previousSiteId = {};
        const filter = generateFilter.devices(request);
        const responseFromListDevice = await DeviceModel(tenant).list({
          filter,
        });
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
        logObject("previousSiteId", previousSiteId);
        const siteActivityBody = {
          device: deviceName,
          date: new Date(),
          description: "device recalled",
          activityType: "recallment",
          recallType,
        };
        let deviceBody = {};
        deviceBody.body = {};
        deviceBody.query = {};
        deviceBody.body.height = 0;
        deviceBody.body.mountType = "";
        deviceBody.body.powerType = "";
        deviceBody.body.isPrimaryInLocation = false;
        deviceBody.body.nextMaintenance = "";
        deviceBody.body.latitude = "";
        deviceBody.body.longitude = "";
        deviceBody.body.isActive = false;
        deviceBody.body.status = "recalled";
        deviceBody.body.site_id = null;
        deviceBody.body.host_id = null;
        deviceBody.body.previous_sites = [previousSiteId];
        deviceBody.body.recall_date = new Date();
        deviceBody.query.name = deviceName;
        deviceBody.query.tenant = tenant;

        const responseFromRegisterActivity = await ActivityModel(
          tenant
        ).register(siteActivityBody);

        if (responseFromRegisterActivity.success === true) {
          const createdActivity = responseFromRegisterActivity.data;
          const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
            deviceBody
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  maintain: async (request) => {
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
        nextMaintenance: addMonthsToProvideDateTime(date && new Date(date), 3),
      };
      let deviceBody = {};
      deviceBody["body"] = {};
      deviceBody["query"] = {};
      deviceBody["body"]["nextMaintenance"] = addMonthsToProvideDateTime(
        date && new Date(date),
        3
      );
      deviceBody["body"]["maintenance_date"] =
        (date && new Date(date)) || new Date();
      deviceBody["query"]["name"] = deviceName;
      deviceBody["query"]["tenant"] = tenant;

      const responseFromRegisterActivity = await ActivityModel(tenant).register(
        siteActivityBody
      );

      if (responseFromRegisterActivity.success === true) {
        const createdActivity = responseFromRegisterActivity.data;
        const responseFromUpdateDevice = await createDeviceUtil.updateOnPlatform(
          deviceBody
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createActivity;
