const getDevices = require("./data-devices");
const getSites = require("./data-sites");
const getActivities = require("./data-activities");
const getAirQlouds = require("./data-airqlouds");
const createDeviceUtil = require("../utils/create-device");
const createSiteUtil = require("../utils/create-site");
const createAirQloudUtil = require("../utils/create-airqloud");
const createActivitiesUtil = require("../utils/create-activity");
const { logObject, logElement } = require("../utils/log");

const devices = getDevices();
const sites = getSites();
const airqlouds = getAirQlouds();
const isEmpty = require("is-empty");
const activities = getActivities();

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

/**
Ensure that you have the following data files:

scripts/data-airqlouds.js
scripts/data-sites.js
scripts/data-devices.js

Within each data file, create an array of entity objects and 
export the data as follows:

const ARRAY_OF_OBJECTS = [
  {},
  {}
]

module.exports = () => {
  return ARRAY_OF_OBJECTS;
};
 */

const runAirQloudAdditions = async ({ network = "" } = {}) => {
  const length = sites.length;
  let count = 0;
  airqlouds.forEach(async (element) => {
    let request = {};
    request["query"] = {};
    request["body"] = element;
    request["body"]["network"] = network;
    request["query"]["tenant"] = "airqo";
    let airqloud_codes = [];
    let filter = {};

    logObject("request[body]", request.body);
    logElement("the name", request.body.name);
    logElement("the center_point", request.body.center_point);
    logElement("admin_level", request.body.admin_level);

    if (!isEmpty(element._id)) {
      request["query"]["_id"] = element._id;
      request["body"]["_id"] = ObjectId(element._id);
      airqloud_codes.push(element._id);
      filter["_id"] = element._id;
    }

    if (!isEmpty(element.name)) {
      request["query"]["name"] = element.name;
      airqloud_codes.push(element.name);
      filter["name"] = element.name;
    }

    request["body"]["airqloud_codes"] = airqloud_codes;

    const responseFromAddSite = await createAirQloudUtil.create(request);
    if (responseFromAddSite.success === true) {
      logElement("the successful airqloud addition detail", element._id);
      count += 1;
      if (length === count) {
        return {
          success: true,
          message: "operation finished",
        };
      }
    } else if (responseFromAddSite.success === false) {
      logObject("failed to add AirQloud", responseFromAddSite);
      logElement("the UNsuccessful airqloud addition detail", element._id);
      count += 1;
      if (length === count) {
        return {
          success: true,
          message: "operation finished with some errors",
        };
      }
    }
  });
};

const runDeviceAdditions = async ({ network = "" } = {}) => {
  let count = 0;
  const length = devices.length;
  devices.forEach(async (element) => {
    let request = {};
    request["query"] = {};
    request["query"]["tenant"] = "airqo";
    request["body"] = element;
    request["body"]["network"] = network;
    request["query"]["tenant"] = "airqo";
    let device_codes = [];

    if (!isEmpty(element.device_number)) {
      request["query"]["device_number"] = element.device_number;
      device_codes.push(element.device_number.toString());
    }
    if (!isEmpty(element._id)) {
      request["query"]["_id"] = element._id;
      device_codes.push(element._id);
      request["body"]["_id"] = ObjectId(element._id);
    }
    if (!isEmpty(element.name)) {
      request["query"]["name"] = element.name;
      device_codes.push(element.name);
    }

    if (!isEmpty(element.site) && !isEmpty(element.site._id)) {
      request["body"]["site_id"] = ObjectId(element.site._id);
    }

    request["body"]["device_codes"] = device_codes;
    /**
     *  errors: {
    device_number: 'device_number is required!',
    generation_count: 'the number of the device in the provided generation is required',
    generation_version: 'the generation is required',
    long_name: 'the Device long name is required'
  }
     */
    request["body"]["long_name"] = element.long_name
      ? element.long_name
      : element.name;

    const responseFromAddDevice = await createDeviceUtil.createOnPlatform(
      request
    );
    logObject("responseFromAddDevice", responseFromAddDevice);
    if (responseFromAddDevice.success === true) {
      logElement("the device detail", element._id);
      count += 1;
      if (length === count) {
        return {
          success: true,
          message: "operation finished",
        };
      }
    } else if (responseFromAddDevice.success === false) {
      logObject("failed to add Device", responseFromAddDevice);
      count += 1;
      if (length === count) {
        return {
          success: true,
          message: "operation finished with some errors",
        };
      }
    }
  });
};

const runSiteAdditions = async ({ network = "" } = {}) => {
  const length = sites.length;
  let count = 0;
  let success = 0;
  let failures = 0;
  sites.forEach(async (element) => {
    let request = {};
    request["query"] = {};
    request["body"] = element;
    request["body"]["network"] = network;
    request["query"]["tenant"] = "airqo";
    let site_codes = [];

    // if (!isEmpty(element.generated_name)) {
    //   request["query"]["generated_name"] = element.generated_name;
    //   site_codes.push(element.generated_name);
    // }
    if (!isEmpty(element._id)) {
      request["query"]["_id"] = element._id;
      site_codes.push(element._id);
      request["body"]["_id"] = ObjectId(element._id);
    }
    if (!isEmpty(element.name)) {
      request["query"]["name"] = element.name;
      site_codes.push(element.name);
    }
    if (!isEmpty(element.lat_long)) {
      request["query"]["lat_long"] = element.lat_long;
      site_codes.push(element.lat_long);
    }

    if (!isEmpty(element.airqlouds) && Array.isArray(element.airqlouds)) {
      for (let a = 0; a < element.airqlouds.length; a++) {
        airqlouds.push(ObjectId(element.airqlouds[a]._id));
      }
    }

    request["body"]["site_codes"] = site_codes;
    request["body"]["airqlouds"] = airqlouds;

    const responseFromAddSite = await createSiteUtil.create("airqo", request);
    if (responseFromAddSite.success === true) {
      logElement("the site detail", element._id);
      count += 1;
      success += 1;
    } else if (responseFromAddSite.success === false) {
      logObject("failed to add Site", responseFromAddSite);
      count += 1;
      failures += 1;
    }
  });
  if (length === count && failures > 0) {
    return {
      success: true,
      message: "operation finished with some errors",
    };
  } else if (length === count && failures === 0) {
    return {
      success: true,
      message: "operation finished",
    };
  }
};

const runActivitiesAdditions = async ({ network = "" } = {}) => {
  try {
    const length = activities.length;
    let successfulCount = 0;
    let unsuccessfulCount = 0;
    let message = "";

    for (let count = 0; count < length; count++) {
      let request = {};
      request["query"] = {};
      request["query"]["tenant"] = "airqo";
      request["body"] = activities[count];
      request["body"]["network"] = network;
      let activity_codes = [];

      if (!isEmpty(activities[count]._id)) {
        request["query"]["_id"] = activities[count]._id;
        activity_codes.push(activities[count]._id);
      }

      request["body"]["activity_codes"] = activity_codes;

      logObject("request", request);

      const responseFromCreateActivity = await createActivitiesUtil.create(
        request
      );

      if (responseFromCreateActivity.success === true) {
        logText("yeah");
        successfulCount += 1;
      } else if (responseFromCreateActivity.success === false) {
        logText("nah");
        unsuccessfulCount += 1;
      }
    }

    if (!isEmpty(unsuccessfulCount)) {
      message = "operation successfully finished but with some internal errors";
    } else {
      message = "entire operation finished successfully";
    }
    logElement("unsuccessfulCount", unsuccessfulCount);
    logElement("successfulCount", successfulCount);

    if (unsuccessfulCount + successfulCount === length) {
      return {
        success: true,
        message,
        data: { unsuccessfulCount, successfulCount },
      };
    } else {
      return {
        success: true,
        message,
        data: { unsuccessfulCount, successfulCount },
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "internal server error",
      errors: { message: error.message },
    };
  }
};

module.exports = {
  runSiteAdditions,
  runDeviceAdditions,
  runAirQloudAdditions,
  runActivitiesAdditions,
};
