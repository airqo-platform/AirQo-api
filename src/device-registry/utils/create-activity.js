const ActivitySchema = require("@models/SiteActivity");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("@config/database");
const ActivityModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "activity", ActivitySchema);
};
const createDeviceUtil = require("./create-device");
const createSiteUtil = require("./create-site");
const HTTPStatus = require("http-status");
const DeviceSchema = require("@models/Device");
const { addMonthsToProvideDateTime } = require("./date");
const generateFilter = require("./generate-filter");
const constants = require("@config/constants");
const distance = require("./distance");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-activity-util`
);

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const devicesModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "device", DeviceSchema);
};

const createActivity = {
  create: async (request) => {
    try {
      const { query } = request;
      const { type, deviceName, tenant } = query;
      if (type === "recall") {
        let requestForExistenceSearch = {};
        requestForExistenceSearch["filter"] = {
          name: deviceName,
          isActive: false,
        };
        requestForExistenceSearch["tenant"] = tenant;
        const isDeviceRecalled = await createDeviceUtil.doesDeviceSearchExist(
          requestForExistenceSearch
        );
        if (isDeviceRecalled.success === false) {
          const responseFromRecallDevice = await createActivity.recall(request);
          return responseFromRecallDevice;
        } else if (isDeviceRecalled.success === true) {
          return {
            success: false,
            message: `Device ${deviceName} already recalled`,
            status: HTTPStatus.CONFLICT,
          };
        }
      } else if (type === "deploy") {
        let requestForExistenceSearch = {};
        requestForExistenceSearch["filter"] = {
          name: deviceName,
          isActive: true,
        };
        requestForExistenceSearch["tenant"] = tenant;
        const responseFromDeviceSearchCheck = await createDeviceUtil.doesDeviceSearchExist(
          requestForExistenceSearch
        );

        if (responseFromDeviceSearchCheck.success === false) {
          const responseFromDeployDevice = await createActivity.deploy(request);
          return responseFromDeployDevice;
        } else {
          return {
            success: false,
            message: `Device ${deviceName} already deployed`,
            status: HTTPStatus.CONFLICT,
          };
        }
      } else if (type === "maintain") {
        const responseFromMaintainDevice = await createActivity.maintain(
          request
        );
        return responseFromMaintainDevice;
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

  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      const filter = generateFilter.activities(request);

      let responseFromListActivity = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        ActivitySchema
      ).list({
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

      const responseFromModifyActivity = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        ActivitySchema
      ).modify({
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

      const responseFromRemoveActivity = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        ActivitySchema
      ).remove({
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
        network,
      } = body;
      let requestForFilter = {};
      requestForFilter["query"] = {};
      requestForFilter["query"]["id"] = site_id;
      const filter = generateFilter.sites(requestForFilter);
      const responseFromListSite = await createSiteUtil.list({
        tenant,
        filter,
      });
      if (responseFromListSite.success === true) {
        if (responseFromListSite.data.length === 1) {
          const { latitude, longitude } = responseFromListSite.data[0];
          const siteActivityBody = {
            device: deviceName,
            date: (date && new Date(date)) || new Date(),
            description: "device deployed",
            activityType: "deployment",
            site_id,
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
          deviceBody["body"] = {};
          deviceBody["query"] = {};
          deviceBody["body"]["height"] = height;
          deviceBody["body"]["mountType"] = mountType;
          deviceBody["body"]["powerType"] = powerType;
          deviceBody["body"]["isPrimaryInLocation"] = isPrimaryInLocation;
          deviceBody["body"]["nextMaintenance"] = addMonthsToProvideDateTime(
            date && new Date(date),
            3
          );
          deviceBody["body"]["latitude"] = approximate_latitude
            ? approximate_latitude
            : latitude;
          deviceBody["body"]["longitude"] = approximate_longitude
            ? approximate_longitude
            : longitude;
          deviceBody["body"][
            "approximate_distance_in_km"
          ] = approximate_distance_in_km ? approximate_distance_in_km : 0;
          deviceBody["body"]["bearing_in_radians"] = bearing_in_radians
            ? bearing_in_radians
            : 0;
          deviceBody["body"]["site_id"] = site_id;
          deviceBody["body"]["isActive"] = true;
          deviceBody["body"]["deployment_date"] =
            (date && new Date(date)) || new Date();
          deviceBody["body"]["status"] = "deployed";
          deviceBody["query"]["name"] = deviceName;
          deviceBody["query"]["tenant"] = tenant;

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
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  recall: async (request) => {
    try {
      const { query } = request;
      const { tenant, deviceName } = query;

      let requestForFilter = {};
      let previousSiteId = {};
      requestForFilter["query"] = {};
      requestForFilter["query"]["device"] = deviceName;
      let filter = {};
      const responseFromGenerateFilter = generateFilter.devices(
        requestForFilter
      );
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter.data;
      }

      const responseFromListDevice = await devicesModel(tenant).list({
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
      };
      let deviceBody = {};
      deviceBody["body"] = {};
      deviceBody["query"] = {};
      deviceBody["body"]["height"] = 0;
      deviceBody["body"]["mountType"] = "";
      deviceBody["body"]["powerType"] = "";
      deviceBody["body"]["isPrimaryInLocation"] = false;
      deviceBody["body"]["nextMaintenance"] = "";
      deviceBody["body"]["latitude"] = "";
      deviceBody["body"]["longitude"] = "";
      deviceBody["body"]["isActive"] = false;
      deviceBody["body"]["status"] = "recalled";
      deviceBody["body"]["site_id"] = null;
      deviceBody["body"]["previous_sites"] = [previousSiteId];
      deviceBody["body"]["recall_date"] = new Date();
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
            message: "successfully recalled the device",
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
