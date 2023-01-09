/**
 * For the device_codes....
 * Fetch the available and get their IDS, store them in an array.
 * 
 * Iterate over each of the IDS and
 just delete all the device_codes accordingly.
 * 
 Repeat the same procedure for the site_codes...
 * 
 */

const getDevices = require("./data-devices");
const getSites = require("./data-sites");
const getAirQlouds = require("./data-airqlouds");
const createDeviceUtil = require("../utils/create-device");
const createSiteUtil = require("../utils/create-site");
const createAirQloudUtil = require("../utils/create-airqloud");
const { logObject, logElement } = require("../utils/log");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const devices = getDevices();
const sites = getSites();
const airqlouds = getAirQlouds();
const isEmpty = require("is-empty");
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
const runDeviceDeletions = async ({ network = "" } = {}) => {
  let count = 0;
  const length = devices.length;
  devices.forEach(async (element) => {
    let request = {};
    request["query"] = {};
    request["query"]["tenant"] = "airqo";
    request["body"] = {};
    request["body"]["network"] = network;
    let device_codes = [];

    if (!isEmpty(element.device_number)) {
      request["query"]["device_number"] = element.device_number;
      device_codes.push(element.device_number.toString());
    }
    if (!isEmpty(element._id)) {
      request["query"]["_id"] = element._id;
      device_codes.push(element._id);
    }
    if (!isEmpty(element.name)) {
      request["query"]["name"] = element.name;
      device_codes.push(element.name);
    }

    request["body"]["device_codes"] = device_codes;

    const responseFromUpdateDevice = await createDeviceUtil.deleteOnPlatform(
      request
    );
    if (responseFromUpdateDevice.success === true) {
      logElement(" the successfull deleted device detail", element._id);
      count += 1;
      if (length === count) {
        return {
          success: true,
          message: "operation finished",
        };
      }
    } else if (responseFromUpdateDevice.success === false) {
      logObject("failed to delete Device", responseFromUpdateDevice);
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

const runSiteDeletions = async () => {
  const length = sites.length;
  let count = 0;
  let success = 0;
  let failures = 0;
  sites.forEach(async (element) => {
    let filter = {};
    // if (!isEmpty(element.generated_name)) {
    //   filter["generated_name"] = element.generated_name;
    // }
    if (!isEmpty(element._id)) {
      filter["_id"] = ObjectId(element._id);
    }
    // if (!isEmpty(element.name)) {
    //   filter["name"] = element.name;
    // }
    // if (!isEmpty(element.lat_long)) {
    //   filter["lat_long"] = element.lat_long;
    // }

    const responseFromUpdateSite = await createSiteUtil.delete("airqo", filter);
    if (responseFromUpdateSite.success === true) {
      logElement("the site detail", element._id);
      count += 1;
      success += 1;
    } else if (responseFromUpdateSite.success === false) {
      logObject("failed to delete Site", responseFromUpdateSite);
      count += 1;
      failures += 1;
    }
  });

  if (length === count && failures > 0) {
    return {
      success: true,
      message: "operation finished with some errors",
      data: { success, failures },
    };
  } else if (length === count && failures === 0) {
    return {
      success: true,
      message: "operation finished without any failures",
      data: { success, failures },
    };
  }
};

const runAirQloudDeletions = async ({ network = "" } = {}) => {
  const length = airqlouds.length;
  let count = 0;
  airqlouds.forEach(async (element) => {
    let request = {};
    request["query"] = {};
    request["body"] = {};
    request["body"]["network"] = network;

    let site_codes = [];
    let filter = {};

    // if (!isEmpty(element.generated_name)) {
    //   request["query"]["generated_name"] = element.generated_name;
    //   site_codes.push(element.generated_name);
    //   filter["generated_name"] = element.generated_name;
    // }
    // if (!isEmpty(element._id)) {
    //   request["query"]["_id"] = element._id;
    //   site_codes.push(element._id);
    //   filter["_id"] = ObjectId(element._id);
    // }
    // if (!isEmpty(element.name)) {
    //   request["query"]["name"] = element.name;
    //   site_codes.push(element.name);
    //   filter["name"] = element.name;
    // }
    if (!isEmpty(element.lat_long)) {
      request["query"]["lat_long"] = element.lat_long;
      site_codes.push(element.lat_long);
      filter["lat_long"] = element.lat_long;
    }

    request["body"]["site_codes"] = site_codes;
    let update = request.body;

    const responseFromUpdateSite = await createAirQloudUtil.delete(request);
    if (responseFromUpdateSite.success === true) {
      logElement("the site detail", element._id);
      count += 1;
      if (length === count) {
        return {
          success: true,
          message: "operation finished",
        };
      }
    } else if (responseFromUpdateSite.success === false) {
      logObject("failed to delete Site", responseFromUpdateSite);
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

module.exports = { runSiteDeletions, runDeviceDeletions, runAirQloudDeletions };
