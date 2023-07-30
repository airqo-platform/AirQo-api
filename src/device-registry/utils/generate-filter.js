const {
  monthsInfront,
  addMonthsToProvideDateTime,
  isTimeEmpty,
  generateDateFormatWithoutHrs,
  getDifferenceInMonths,
  addDays,
  addHours,
} = require("./date");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logObject, logText } = require("./log");
const constants = require("@config/constants");
const log4js = require("log4js");
const httpStatus = require("http-status");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- generate-filter-util`
);

const isLowerCase = (str) => {
  return str === str.toLowerCase();
};

const generateFilter = {
  events: (request) => {
    try {
      const { query } = request;
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
        external,
        metadata,
        tenant,
        recent,
        page,
        network,
        index,
        running,
        brief,
      } = query;

      let today = monthsInfront(0);
      let oneWeekBack = addDays(-7);
      let oneMonthBack = monthsInfront(-1);
      let threeHoursBack = addHours(-3);

      let filter = {
        day: {
          $gte: generateDateFormatWithoutHrs(oneWeekBack),
          $lte: generateDateFormatWithoutHrs(today),
        },
        "values.time": {
          $gte: oneWeekBack,
          $lte: today,
        },
        "values.device": {},
        "values.site": {},
        "values.device_id": {},
        "values.site_id": {},
        "values.device_number": {},
        "values.pm2_5.value": {},
        device_number: {},
      };

      if (metadata) {
        filter["metadata"] = metadata;
      }

      if (external) {
        filter["external"] = external;
      }

      if (!index) {
        delete filter["values.pm2_5.value"];
      } else if (index === "good") {
        filter["values.pm2_5.value"]["$gte"] = constants.AQI_INDEX.good[0];
        filter["values.pm2_5.value"]["$lte"] = constants.AQI_INDEX.good[1];
        filter["index"] = index;
      } else if (index === "moderate") {
        filter["values.pm2_5.value"]["$gte"] = constants.AQI_INDEX.moderate[0];
        filter["values.pm2_5.value"]["$lte"] = constants.AQI_INDEX.moderate[1];
        filter["index"] = index;
      } else if (index === "u4sg") {
        filter["values.pm2_5.value"]["$gte"] = constants.AQI_INDEX.u4sg[0];
        filter["values.pm2_5.value"]["$lte"] = constants.AQI_INDEX.u4sg[1];
        filter["index"] = index;
      } else if (index === "unhealthy") {
        filter["values.pm2_5.value"]["$gte"] = constants.AQI_INDEX.unhealthy[0];
        filter["values.pm2_5.value"]["$lte"] = constants.AQI_INDEX.unhealthy[1];
        filter["index"] = index;
      } else if (index === "very_unhealthy") {
        filter["values.pm2_5.value"]["$gte"] =
          constants.AQI_INDEX.very_unhealthy[0];
        filter["values.pm2_5.value"]["$lte"] =
          constants.AQI_INDEX.very_unhealthy[1];
        filter["index"] = index;
      } else if (index === "hazardous") {
        filter["values.pm2_5.value"]["$gte"] = constants.AQI_INDEX.hazardous[0];
        filter["index"] = index;
      } else {
        delete filter["values.pm2_5.value"];
      }

      if (!external) {
        filter["external"] = "yes";
      }
      if (network) {
        filter["network"] = network;
      }
      if (tenant) {
        filter["tenant"] = tenant;
      }

      if (startTime) {
        if (isTimeEmpty(startTime) == false) {
          let start = new Date(startTime);
          filter["values.time"]["$gte"] = start;
        } else {
          delete filter["values.time"];
        }
        filter["day"]["$gte"] = generateDateFormatWithoutHrs(startTime);
      }

      if (running) {
        filter["running"] = running;
      }

      if (brief) {
        filter["brief"] = brief;
      }

      if (endTime) {
        if (isTimeEmpty(endTime) === false) {
          let end = new Date(endTime);
          filter["values.time"]["$lte"] = end;
        } else {
          delete filter["values.time"];
        }
        filter["day"]["$lte"] = generateDateFormatWithoutHrs(endTime);
      }

      if (startTime && !endTime) {
        if (isTimeEmpty(startTime) === false) {
          filter["values.time"]["$lte"] = addMonthsToProvideDateTime(
            startTime,
            1
          );
        } else {
          delete filter["values.time"];
        }
        let addedOneMonthToProvidedDateTime = addMonthsToProvideDateTime(
          startTime,
          1
        );
        filter["day"]["$lte"] = generateDateFormatWithoutHrs(
          addedOneMonthToProvidedDateTime
        );
      }

      if (!startTime && endTime) {
        if (isTimeEmpty(endTime) === false) {
          filter["values.time"]["$gte"] = addMonthsToProvideDateTime(
            endTime,
            -1
          );
        } else {
          delete filter["values.time"];
        }
        let removedOneMonthFromProvidedDateTime = addMonthsToProvideDateTime(
          endTime,
          -1
        );
        filter["day"]["$gte"] = generateDateFormatWithoutHrs(
          removedOneMonthFromProvidedDateTime
        );
      }

      if (startTime && endTime) {
        let months = getDifferenceInMonths(startTime, endTime);
        logElement("the number of months", months);
        if (months > 1) {
          if (isTimeEmpty(endTime) === false) {
            filter["values.time"]["$gte"] = addMonthsToProvideDateTime(
              endTime,
              -1
            );
          } else {
            delete filter["values.time"];
          }
          let removedOneMonthFromProvidedDateTime = addMonthsToProvideDateTime(
            endTime,
            -1
          );
          filter["day"]["$gte"] = generateDateFormatWithoutHrs(
            removedOneMonthFromProvidedDateTime
          );
        }
      }
      /**
       * unique names for sites and devices
       */
      if (device) {
        let deviceArray = device.split(",");
        let modifiedDeviceArray = deviceArray.map((value) => {
          if (isLowerCase(value)) {
            return value.toUpperCase();
          }
          if (!isLowerCase(value)) {
            return value.toLowerCase();
          }
          return value;
        });
        let mergedArray = [].concat(modifiedDeviceArray, deviceArray);
        filter["values.device"]["$in"] = mergedArray;
        filter["device"] = true;
      }

      if (!device) {
        delete filter["values.device"];
        filter["device"] = false;
      }

      if (device && !recent && (!external || external === "yes")) {
        filter["recent"] = "no";
      }

      if (page) {
        filter["page"] = page;
      }

      if (device_number) {
        let deviceArray = device_number.split(",");
        filter["device_number"]["$in"] = deviceArray;
        filter["values.device_number"]["$in"] = deviceArray;
      }

      if (!device_number) {
        delete filter["device_number"];
        delete filter["values.device_number"];
      }

      if (site) {
        let deviceArray = site.split(",");
        filter["values.site"]["$in"] = deviceArray;
      }

      if (!site) {
        delete filter["values.site"];
      }

      /**
       * unique ids for devices and sites
       */
      if (device_id) {
        let deviceIdArray = device_id.split(",");
        let modifiedDeviceIdArray = deviceIdArray.map((device_id) => {
          return ObjectId(device_id);
        });
        filter["values.device_id"]["$in"] = modifiedDeviceIdArray;
      }
      if (!device_id) {
        delete filter["values.device_id"];
      }
      if (site_id) {
        let siteIdArray = site_id.split(",");
        let modifiedSiteIdArray = siteIdArray.map((site_id) => {
          return ObjectId(site_id);
        });
        filter["values.site_id"]["$in"] = modifiedSiteIdArray;
      }
      if (!site_id) {
        delete filter["values.site_id"];
      }
      /**
       * ends unique site and device ids
       */

      if (frequency) {
        filter["values.frequency"] = frequency;
        filter["frequency"] = frequency;
      }
      if (!frequency) {
        filter["values.frequency"] = "hourly";
        filter["frequency"] = "hourly";
      }

      if (recent) {
        filter["recent"] = recent;
      }

      return {
        success: true,
        data: filter,
        message: "filter successfully generated",
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "unable to generate the filter",
        errors: { message: error.message },
      };
    }
  },

  generateRegexExpressionFromStringElement: (element) => {
    let regex = `${element}`;
    return regex;
  },
  devices: (req) => {
    try {
      let filter = { name: {} };
      let {
        name,
        channel,
        location,
        siteName,
        mapAddress,
        primary,
        active,
        chid,
        loc,
        map,
        site,
        site_id,
        id,
        device_name,
        device_id,
        device,
        device_codes,
        device_number,
        category,
        network,
        visibility,
      } = req.query;

      if (name) {
        let deviceArray = name.split(",");
        let modifiedDeviceArray = deviceArray.map((value) => {
          if (isLowerCase(value)) {
            return value.toUpperCase();
          }
          if (!isLowerCase(value)) {
            return value.toLowerCase();
          }
          return value;
        });
        let mergedArray = [].concat(modifiedDeviceArray, deviceArray);
        filter["name"]["$in"] = mergedArray;
      } else if (device) {
        let deviceArray = device.split(",");
        let modifiedDeviceArray = deviceArray.map((value) => {
          if (isLowerCase(value)) {
            return value.toUpperCase();
          }
          if (!isLowerCase(value)) {
            return value.toLowerCase();
          }
          return value;
        });
        let mergedArray = [].concat(modifiedDeviceArray, deviceArray);
        filter["name"]["$in"] = mergedArray;
      } else if (device_name) {
        let deviceArray = device_name.split(",");
        let modifiedDeviceArray = deviceArray.map((value) => {
          if (isLowerCase(value)) {
            return value.toUpperCase();
          }
          if (!isLowerCase(value)) {
            return value.toLowerCase();
          }
          return value;
        });
        let mergedArray = [].concat(modifiedDeviceArray, deviceArray);
        filter["name"]["$in"] = mergedArray;
      } else {
        delete filter["name"];
      }

      if (channel) {
        filter["device_number"] = parseInt(channel);
      }

      if (category) {
        filter["category"] = category;
      }

      if (network) {
        filter["network"] = network;
      }

      if (device_number) {
        filter["device_number"] = parseInt(device_number);
      }

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (device_id) {
        filter["_id"] = ObjectId(device_id);
      }

      if (device_codes) {
        let deviceCodesArray = device_codes.split(",");
        filter["device_codes"] = {};
        filter["device_codes"]["$in"] = deviceCodesArray;
      }

      if (chid) {
        filter["device_number"] = parseInt(chid);
      }

      if (location) {
        filter["locationID"] = location;
      }
      if (loc) {
        filter["locationID"] = loc;
      }
      if (site) {
        filter["site_id"] = site;
      }

      if (site_id) {
        filter["site_id"] = site_id;
      }

      if (siteName) {
        filter["siteName"] = siteName;
      }

      if (mapAddress) {
        filter["locationName"] = mapAddress;
      }

      if (map) {
        filter["locationName"] = map;
      }

      if (primary) {
        const primaryStr = primary + "";
        if (primaryStr.toLowerCase() == "yes") {
          filter["isPrimaryInLocation"] = true;
        } else if (primaryStr.toLowerCase() == "no") {
          filter["isPrimaryInLocation"] = false;
        } else {
        }
      }

      if (active) {
        const activeStr = active + "";
        if (activeStr.toLowerCase() === "yes") {
          filter["isActive"] = true;
        } else if (activeStr.toLowerCase() === "no") {
          filter["isActive"] = false;
        }
      }

      if (visibility) {
        const visibilityStr = visibility + "";
        if (visibilityStr.toLowerCase() === "yes") {
          filter["visibility"] = true;
        } else if (visibilityStr.toLowerCase() === "no") {
          filter["visibility"] = false;
        }
      }

      // logger.info(`the filter  -- ${JSON.stringify(filter)}`);
      return {
        success: true,
        message: "successfully generated the filter",
        data: filter,
      };
    } catch (error) {
      logger.error(
        `internal server error - generate device filter -- ${error.message}`
      );
      return {
        success: false,
        message: "server error - generate device filter",
        errors: { message: error.message },
      };
    }
  },
  sites: (req) => {
    let {
      lat_long,
      id,
      generated_name,
      district,
      region,
      city,
      street,
      country,
      county,
      parish,
      name,
      site_codes,
      _id,
      network,
      google_place_id,
    } = req.query;
    let filter = {};

    if (name) {
      filter["name"] = name;
    }

    if (county) {
      filter["county"] = county;
    }

    if (network) {
      filter["network"] = network;
    }

    if (lat_long) {
      filter["lat_long"] = lat_long;
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (_id) {
      filter["_id"] = ObjectId(_id);
    }

    if (site_codes) {
      let siteCodesArray = site_codes.split(",");
      filter["site_codes"] = {};
      filter["site_codes"]["$in"] = siteCodesArray;
    }

    if (google_place_id) {
      filter["google_place_id"] = google_place_id;
    }

    if (generated_name) {
      filter["generated_name"] = generated_name;
    }

    if (district) {
      filter["district"] = district;
    }

    if (region) {
      filter["region"] = region;
    }

    if (city) {
      filter["city"] = city;
    }

    if (street) {
      filter["street"] = street;
    }

    if (country) {
      filter["country"] = country;
    }

    if (parish) {
      filter["parish"] = parish;
    }

    return filter;
  },
  airqlouds: (req) => {
    const {
      id,
      name,
      admin_level,
      summary,
      dashboard,
      airqloud_id,
      network,
      airqloud,
      airqloud_codes,
    } = req.query;
    let filter = {};

    if (name) {
      filter["name"] = name;
    } else if (airqloud) {
      filter["name"] = airqloud;
    }

    if (network) {
      filter["network"] = network;
    }

    if (summary === "yes") {
      filter["summary"] = summary;
    }

    if (dashboard === "yes") {
      filter["dashboard"] = dashboard;
    }

    if (airqloud_codes) {
      let airqloudCodesArray = airqloud_codes.split(",");
      filter["airqloud_codes"] = {};
      filter["airqloud_codes"]["$in"] = airqloudCodesArray;
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (airqloud_id) {
      filter["_id"] = ObjectId(airqloud_id);
    }

    if (admin_level) {
      filter["admin_level"] = admin_level;
    }

    return filter;
  },

  grids: (req) => {
    try {
      const { id, name, admin_level, grid_codes } = req.query;
      const { grid_id } = req.params;
      let filter = {};
      if (name) {
        filter["name"] = name;
      }

      if (grid_codes) {
        let geoCodesArray = grid_codes.split(",");
        filter["grid_codes"] = {};
        filter["grid_codes"]["$in"] = geoCodesArray;
      }

      if (grid_id) {
        filter["_id"] = ObjectId(grid_id);
      }

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (admin_level) {
        filter["admin_level"] = admin_level;
      }

      return filter;
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  cohorts: (req) => {
    try {
      const { id, name, cohort_codes, network_id } = req.query;
      const { cohort_id } = req.params;
      let filter = {};
      if (name) {
        filter["name"] = name;
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }

      if (cohort_id) {
        filter["_id"] = ObjectId(cohort_id);
      }

      if (cohort_codes) {
        let cohortCodesArray = cohort_codes.split(",");
        filter["cohort_codes"] = {};
        filter["cohort_codes"]["$in"] = cohortCodesArray;
      }

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      return filter;
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  networks: (req) => {
    try {
      const { id, name, network_codes } = req.query;
      const { net_id } = req.params;
      let filter = {};
      if (name) {
        filter["name"] = name;
      }

      if (net_id) {
        filter["_id"] = ObjectId(net_id);
      }

      if (network_codes) {
        let networkCodesArray = network_codes.split(",");
        filter["network_codes"] = {};
        filter["network_codes"]["$in"] = networkCodesArray;
      }

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      return filter;
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  admin_levels: (req) => {
    try {
      const { id, name, admin_level_codes } = req.query;
      const { level_id } = req.params;
      let filter = {};
      if (name) {
        filter["name"] = name;
      }

      if (admin_level_codes) {
        let adminLevelCodesArray = admin_level_codes.split(",");
        filter["admin_level_codes"] = {};
        filter["admin_level_codes"]["$in"] = adminLevelCodesArray;
      }

      if (level_id) {
        filter["_id"] = ObjectId(level_id);
      }

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      return filter;
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  locations: (req) => {
    let { id, name, admin_level, summary, network } = req.query;
    let filter = {};

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (summary === "yes") {
      filter["summary"] = summary;
    }

    if (name) {
      filter["name"] = name;
    }

    if (network) {
      filter["network"] = network;
    }

    if (admin_level) {
      filter["admin_level"] = admin_level;
    }
    return filter;
  },

  activities: (req) => {
    let {
      device,
      id,
      activity_type,
      activity_tags,
      maintenance_type,
      recall_type,
      site_id,
      network,
      activity_codes,
      _id,
    } = req.query;

    let filter = {};

    if (maintenance_type) {
      filter["maintenanceType"] = maintenance_type;
    }

    if (recall_type) {
      filter["recallType"] = recall_type;
    }

    if (activity_type) {
      filter["activityType"] = activity_type;
    }
    if (site_id) {
      filter["site_id"] = ObjectId(site_id);
    }
    if (network) {
      filter["network"] = network;
    }

    if (activity_codes) {
      const activityCodesArray = activity_codes.split(",");
      filter["activity_codes"] = {};
      filter["activity_codes"]["$in"] = activityCodesArray;
    }

    if (activity_tags) {
      filter["tags"] = {};
      filter["tags"]["$in"] = activity_tags;
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (_id) {
      filter["_id"] = ObjectId(_id);
    }

    if (device) {
      filter["device"] = device;
    }

    return filter;
  },

  photos: (request) => {
    let {
      id,
      device_id,
      airqloud_id,
      site_id,
      device_number,
      device_name,
      network,
      tags,
    } = request.query;
    let filter = {};
    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (device_id) {
      filter["device_id"] = ObjectId(device_id);
    }

    if (airqloud_id) {
      filter["airqloud_id"] = ObjectId(airqloud_id);
    }

    if (site_id) {
      filter["site_id"] = ObjectId(site_id);
    }

    if (tags) {
      let tagsArray = tags.split(",");
      filter["tags"] = {};
      filter["tags"]["$in"] = tagsArray;
    }

    if (device_number) {
      filter["device_number"] = device_number;
    }

    if (device_name) {
      filter["device_name"] = device_name;
    }

    if (network) {
      filter["network"] = network;
    }

    return filter;
  },

  tips: (request) => {
    let { id, pm25, pm10 } = request.query;
    let filter = {};
    if (id) {
      filter["_id"] = ObjectId(id);
    }
    if (pm25) {
      filter["$and"] = [
        { "aqi_category.min": { $lte: parseInt(pm25) } },
        { "aqi_category.max": { $gte: parseInt(pm25) } },
      ];
    }
    return filter;
  },

  kyalessons: (request) => {
    try {
      const { query, body, params } = request;
      const { id } = query;
      const { task_id, lesson_id } = params;
      let filter = {};
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (lesson_id) {
        filter["_id"] = ObjectId(lesson_id);
      }
      return filter;
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  kyatasks: (request) => {
    try {
      const { query, params } = request;
      const { id } = query;
      const { task_id, lesson_id } = params;
      let filter = {};
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (task_id) {
        filter["_id"] = ObjectId(task_id);
      }
      if (lesson_id) {
        filter["kya_lesson"] = ObjectId(lesson_id);
      }
      return filter;
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  kyaprogress: (request) => {
    try {
      const { query, params } = request;
      const { id } = query;
      const { user_id, lesson_id, progress_id } = params;
      logObject("user_id", user_id && user_id.toString());
      logObject("lesson_id ", lesson_id && lesson_id.toString());
      let filter = {};
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (progress_id) {
        filter["_id"] = ObjectId(progress_id);
      }
      if (user_id) {
        filter["user_id"] = user_id;
      }
      if (lesson_id) {
        filter["lesson_id"] = ObjectId(lesson_id);
      }
      return filter;
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = generateFilter;
