const ComponentSchema = require("../models/Component");
const DeviceSchema = require("../models/Device");
const SiteActivitySchema = require("../models/SiteActivity");
const Site = require("../models/Site");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const isEmpty = require("is-empty");
const client = new iot.v1.DeviceManagerClient();
const device_registry =
  "projects/airqo-250220/locations/europe-west1/registries/device-registry";
const uuidv1 = require("uuid/v1");
const mqtt = require("mqtt");
const projectId = "airqo-250220";
const region = `europe-west1`;
const registryId = `device-registry`;
const algorithm = `RS256`;
// const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;
const fetch = require("node-fetch");
const request = require("request");
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const qs = require("qs");
const redis = require("../config/redis");
const { getModelByTenant } = require("../utils/multitenancy");
const {
  createOnThingSpeak,
  createOnClarity,
} = require("../utils/integrations");

const {
  isDeviceNotDeployed,
  isDeviceNotRecalled,
  locationActivityRequestBodies,
  doLocationActivity,
  getGpsCoordinates,
  doesLocationExist,
  queryFilterOptions,
  bodyFilterOptions,
} = require("../utils/site-activities");

const {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
} = require("../utils/does-device-exist");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const manageSite = {
  doActivity: async (req, res) => {
    try {
      const { type, tenant } = req.query;
      if (tenant && type) {
        const { deviceName } = req.body;

        const deviceExists = await doesDeviceExist(
          deviceName,
          tenant.toLowerCase()
        );
        const isNotDeployed = await isDeviceNotDeployed(
          deviceName,
          tenant.toLowerCase()
        );
        const isNotRecalled = await isDeviceNotRecalled(
          deviceName,
          tenant.toLowerCase()
        );
        const {
          locationActivityBody,
          deviceBody,
        } = locationActivityRequestBodies(req, res);

        doLocationActivity(
          res,
          deviceBody,
          locationActivityBody,
          deviceName,
          type,
          deviceExists,
          isNotDeployed,
          isNotRecalled,
          tenant.toLowerCase()
        );
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  deleteActivity: async (req, res) => {
    try {
      const { tenant, id } = req.query;
      if (tenant && id) {
        const Activity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          SiteActivitySchema
        );
        let filter = { _id: id };

        Activity.findOneAndDelete(filter)
          .exec()
          .then((deletedActivity) => {
            if (!isEmpty(deletedActivity)) {
              return res.status(HTTPStatus.OK).json({
                success: true,
                message: "the log has successfully been deleted",
                deletedActivity,
              });
            } else if (isEmpty(deletedActivity)) {
              return res.status(HTTPStatus.BAD_REQUEST).json({
                success: false,
                message: `there is no log by that id (${id}), please crosscheck`,
              });
            }
          })
          .catch((error) => {
            callbackErrors(error, req, res);
          });
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  updateActivity: async (req, res) => {
    try {
      const { tenant, id } = req.query;
      logElement("tenant", tenant);
      logElement("id", id);
      if (tenant && id) {
        const { activityBody } = await bodyFilterOptions(req, res);
        let filter = { _id: id };

        logObject("activity body", activityBody);

        const updatedActivity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          SiteActivitySchema
        ).findOneAndUpdate(filter, activityBody, {
          new: true,
        });

        if (!isEmpty(updatedActivity)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Activity updated successfully",
            updatedActivity,
          });
        } else if (isEmpty(updatedActivity)) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `An activity log by this ID (${id}) could be missing, please crosscheck`,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  getActivities: async (req, res) => {
    try {
      logText(".....getting logs......................");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant, device, type, location, next, id } = req.query;
      logElement("the tenant", tenant);

      const { activityFilter } = await queryFilterOptions(req, res);
      logObject("activity filter", activityFilter);

      if (tenant) {
        if (!device && !type && !location && !next && !id) {
          const locationActivities = await getModelByTenant(
            tenant.toLowerCase(),
            "activity",
            SiteActivitySchema
          ).list({
            limit,
            skip,
          });
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Activities fetched successfully",
            locationActivities,
          });
        } else {
          const activities = await getModelByTenant(
            tenant.toLowerCase(),
            "activity",
            SiteActivitySchema
          ).find(activityFilter);

          if (!isEmpty(activities)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "Activities fetched successfully",
              activities,
            });
          } else if (isEmpty(activities)) {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: `Your query filters have no results for this organisation (${tenant.toLowerCase()})`,
            });
          }
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
};

module.exports = manageSite;
