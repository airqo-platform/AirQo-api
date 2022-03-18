const ActivitySchema = require("../models/SiteActivity");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const ActivityModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "activity", ActivitySchema);
};
const createDeviceUtil = require("./create-device");
const createSiteUtil = require("./create-site");
const httpStatus = require("http-status");
const { addMonthsToProvideDateTime } = require("./date");
const { kafkaProducer } = require("../config/kafkajs");
const generateFilter = require("./generate-filter");
const constants = require("../config/constants");

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
            status: httpStatus.CONFLICT,
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
            status: httpStatus.CONFLICT,
          };
        }
      } else if (type === "maintain") {
        const responseFromMaintainDevice = await createActivity.maintain(
          request
        );
        return responseFromMaintainDevice;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      let filter = generateFilter.activities_v0(request);

      let responseFromListActivity = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        ActivitySchema
      ).list({
        filter,
        limit,
        skip,
      });

      if (responseFromListActivity.success === false) {
        let errors = responseFromListActivity.errors
          ? responseFromListActivity.errors
          : "";

        let status = responseFromListActivity.status
          ? responseFromListActivity.status
          : "";
        return {
          success: false,
          message: responseFromListActivity.message,
          errors,
          status,
        };
      }

      if (responseFromListActivity.success === true) {
        let status = responseFromListActivity.status
          ? responseFromListActivity.status
          : "";
        let data = responseFromListActivity.data;
        return {
          success: true,
          message: responseFromListActivity.message,
          data,
          status,
        };
      }
    } catch (error) {
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  update: async (request) => {
    try {
      let { query, body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.activities_v0(request);

      let responseFromModifyActivity = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        ActivitySchema
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyActivity.success === true) {
        let status = responseFromModifyActivity.status
          ? responseFromModifyActivity.status
          : "";
        return {
          success: true,
          message: responseFromModifyActivity.message,
          data: responseFromModifyActivity.data,
          status,
        };
      } else if (responseFromModifyActivity.success === false) {
        let errors = responseFromModifyActivity.errors
          ? responseFromModifyActivity.errors
          : "";

        let status = responseFromModifyActivity.status
          ? responseFromModifyActivity.status
          : "";

        return {
          success: false,
          message: responseFromModifyActivity.message,
          errors,
          status,
        };
      }
    } catch (error) {
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.activities_v0(request);
      let responseFromRemoveActivity = await getModelByTenant(
        tenant.toLowerCase(),
        "activity",
        ActivitySchema
      ).remove({
        filter,
      });

      if (responseFromRemoveActivity.success === true) {
        let status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : "";
        return {
          success: true,
          message: responseFromRemoveActivity.message,
          data: responseFromRemoveActivity.data,
          status,
        };
      } else if (responseFromRemoveActivity.success === false) {
        let errors = responseFromRemoveActivity.errors
          ? responseFromRemoveActivity.errors
          : "";

        let status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : "";

        return {
          success: false,
          message: responseFromRemoveActivity.message,
          errors,
          status,
        };
      }
    } catch (error) {
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
            nextMaintenance: addMonthsToProvideDateTime(
              date && new Date(date),
              3
            ),
          };
          let deviceBody = {};
          deviceBody["body"] = {};
          deviceBody["query"] = {};
          deviceBody["body"]["height"] = height;
          deviceBody["body"][" mountType"] = mountType;
          deviceBody["body"][" powerType"] = powerType;
          deviceBody["body"][" isPrimaryInLocation"] = isPrimaryInLocation;
          deviceBody["body"][" nextMaintenance"] = addMonthsToProvideDateTime(
            date && new Date(date),
            3
          );
          deviceBody["body"]["latitude"] = latitude;
          deviceBody["body"]["longitude"] = longitude;
          deviceBody["body"]["site_id"] = site_id;
          deviceBody["body"]["isActive"] = true;
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
                logObject("error on kafka", error);
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
            status: httpStatus.NOT_FOUND,
            errors: {
              message: "unable to find the provided site",
            },
          };
        }
      } else if (responseFromListSite.success === false) {
        return responseFromListSite;
      }
    } catch (error) {
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
      deviceBody["body"][" mountType"] = "";
      deviceBody["body"][" powerType"] = "";
      deviceBody["body"][" isPrimaryInLocation"] = false;
      deviceBody["body"][" nextMaintenance"] = "";
      deviceBody["body"]["latitude"] = "";
      deviceBody["body"]["longitude"] = "";
      deviceBody["body"]["isActive"] = false;
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
            logObject("error on kafka", error);
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
      const { date, tags, description, site_id, maintenanceType } = body;
      const siteActivityBody = {
        device: deviceName,
        date: (date && new Date(date)) || new Date(),
        description: description,
        activityType: "maintenance",
        site_id,
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
            logObject("error on kafka", error);
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
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createActivity;
