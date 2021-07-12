const HTTPStatus = require("http-status");
const EventSchema = require("../models/Event");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const constants = require("../config/constants");
const generateFilter = require("./generate-filter");
const { utillErrors } = require("./errors");
const jsonify = require("./jsonify");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("create-event-util");

const createEvent = {
  transformEvents: async (measurements) => {},
  addEvents: async (request) => {
    try {
      const { tenant } = request.query;
      const { body } = request;
      let responseFromTransformEvents = {};

      if (responseFromTransformEvents.success == true) {
        let responseFromAddEvents = {};
        if (responseFromAddEvents.success == true) {
          return {
            success: true,
            message: responseFromAddEvents.message,
          };
        } else {
          let error = responseFromAddEvents.error
            ? responseFromAddEvents.error
            : "";
          return {
            success: false,
            message: responseFromAddEvents.message,
            error,
          };
        }
      }
    } catch (error) {
      logger.error(`addEvents util -- ${error.message}`);
      utillErrors.tryCatchErrors("", error, message);
    }
  },
  getEvents: async (request) => {
    let { tenant } = request.query;

    let responseFromFilter = generateFilter.events(request);
    let filter = {};
    if (responseFromFilter.success == true) {
      filter = responseFromFilter.data;
    }

    if (responseFromFilter.success == false) {
      let error = responseFromFilter.error ? responseFromFilter.error : "";
      return {
        success: false,
        message: responseFromFilter.message,
        error,
      };
    }

    let responseFromListEvents = {};
    if (responseFromListEvents.success == true) {
      return {
        success: true,
        message: responseFromListEvents.message,
        data: responseFromListEvents.data,
      };
    }

    if (responseFromListEvents.success == false) {
      let error = responseFromListEvents.error
        ? responseFromListEvents.error
        : "";
      return {
        success: false,
        message: responseFromListEvents.message,
        error,
      };
    }
  },

  clearEventsOnThingspeak: async (request) => {
    try {
      const { device, tenant } = request.query;

      if (tenant) {
        if (!device) {
          return {
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          };
        }
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          const channelID = await getChannelID(
            request,
            res,
            device,
            tenant.toLowerCase()
          );
          logText("...................................");
          logText("clearing the Thing....");
          logElement("url", constants.CLEAR_THING_URL(channelID));
          await axios
            .delete(constants.CLEAR_THING_URL(channelID))
            .then(async (response) => {
              logText("successfully cleared the device in TS");
              logObject("response from TS", response.data);
              return {
                message: `successfully cleared the data for device ${device}`,
                success: true,
                updatedDevice,
              };
            })
            .catch(function(error) {
              console.log(error);
              return {
                message: `unable to clear the device data, device ${device} does not exist`,
                success: false,
              };
            });
        } else {
          logText(`device ${device} does not exist in the system`);
          return {
            message: `device ${device} does not exist in the system`,
            success: false,
          };
        }
      } else {
        return {
          success: false,
          message: "missing query params, please check documentation",
        };
      }
    } catch (e) {
      logText(`unable to clear device ${device}`);
      utillErrors.tryCatchErrors(e, "create-device util server error");
    }
  },
  clearEventsOnClarity: (request) => {
    return {
      success: false,
      message: "coming soon - unavailable option",
    };
  },
  clearEventsOnPlatform: async (request) => {
    try {
      const { device, name, id, device_number, tenant } = request.query;

      let filter = {};
      let responseFromFilter = generateFilter.events_v2(request);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success == true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        return {
          success: false,
          message: responseFromFilter.message,
          error,
        };
      }

      let responseFromClearEvents = { success: false, message: "coming soon" };

      if (responseFromClearEvents.success == true) {
        return {
          success: true,
          message: responseFromClearEvents.message,
          data: responseFromClearEvents.data,
        };
      } else if (responseFromClearEvents.success == false) {
        let error = responseFromClearEvents.error
          ? responseFromClearEvents.error
          : "";

        return {
          success: false,
          message: responseFromClearEvents.message,
          error: responseFromClearEvents.error,
        };
      }
    } catch (e) {
      logger.error(`server error, clearEventsOnPlatform -- ${e.message}`);
      utillErrors.tryCatchErrors("clearEventsOnPlatform util", e.message);
    }
  },
};

module.exports = createEvent;
