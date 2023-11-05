const {
  monthsInfront,
  isTimeEmpty,
  generateDateFormatWithoutHrs,
  getDifferenceInWeeks,
  addWeeksToProvideDateTime,
  addDays,
} = require("./date");
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const ObjectId = mongoose.Types.ObjectId;
const { logObject } = require("./log");
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
    const { query, params } = request;
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
    } = { ...params, ...query };

    // Constants for date calculations
    const today = monthsInfront(0);
    const oneWeekBack = addDays(-7);

    // Initial filter object
    const filter = {
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
      device_number: {},
    };

    // Handle metadata and external properties
    if (metadata) {
      filter["metadata"] = metadata;
    }

    if (external) {
      filter["external"] = external;
    }

    // Handle index filtering
    if (!index) {
      delete filter["values.pm2_5.value"];
    } else if (Object.keys(constants.AQI_INDEX).includes(index)) {
      filter["values.pm2_5.value"]["$gte"] = constants.AQI_INDEX[index][0];
      filter["values.pm2_5.value"]["$lte"] = constants.AQI_INDEX[index][1];
      filter["index"] = index;
    } else {
      delete filter["values.pm2_5.value"];
    }

    // Handle startTime and endTime filtering
    if (startTime) {
      if (!isTimeEmpty(startTime)) {
        const start = new Date(startTime);
        filter["values.time"]["$gte"] = start;
      } else {
        delete filter["values.time"];
      }
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(startTime);
    }

    if (endTime) {
      if (!isTimeEmpty(endTime)) {
        const end = new Date(endTime);
        filter["values.time"]["$lte"] = end;
      } else {
        delete filter["values.time"];
      }
      filter["day"]["$lte"] = generateDateFormatWithoutHrs(endTime);
    }

    // Handle startTime and endTime corner cases
    if (startTime && !endTime) {
      if (!isTimeEmpty(startTime)) {
        filter["values.time"]["$lte"] = addWeeksToProvideDateTime(startTime, 2);
      } else {
        delete filter["values.time"];
      }
      const addedTwoWeeksToProvidedDateTime = addWeeksToProvideDateTime(
        startTime,
        2
      );
      filter["day"]["$lte"] = generateDateFormatWithoutHrs(
        addedTwoWeeksToProvidedDateTime
      );
    }

    if (!startTime && endTime) {
      if (!isTimeEmpty(endTime)) {
        filter["values.time"]["$gte"] = addWeeksToProvideDateTime(endTime, -2);
      } else {
        delete filter["values.time"];
      }
      const removedTwoWeeksFromProvidedDateTime = addWeeksToProvideDateTime(
        endTime,
        -2
      );
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(
        removedTwoWeeksFromProvidedDateTime
      );
    }

    if (startTime && endTime) {
      const weeks = getDifferenceInWeeks(startTime, endTime);
      logObject("the weeks between provided dates", weeks);
      if (weeks > 2) {
        if (!isTimeEmpty(endTime)) {
          filter["values.time"]["$gte"] = addWeeksToProvideDateTime(
            endTime,
            -2
          );
        } else {
          delete filter["values.time"];
        }
        const removedTwoWeeksFromProvidedDateTime = addWeeksToProvideDateTime(
          endTime,
          -2
        );
        filter["day"]["$gte"] = generateDateFormatWithoutHrs(
          removedTwoWeeksFromProvidedDateTime
        );
      }
    }

    // Handle unique names for sites and devices
    if (device) {
      const deviceArray = device
        .toString()
        .split(",")
        .map((value) =>
          isLowerCase(value) ? value.toUpperCase() : value.toLowerCase()
        );
      const mergedArray = [...deviceArray, ...device.toString().split(",")];
      filter["values.device"]["$in"] = mergedArray;
      filter["device"] = true;
    } else {
      delete filter["values.device"];
      filter["device"] = false;
    }

    if (device && !recent && (!external || external === "yes")) {
      filter["recent"] = "no";
    }

    if (page) {
      filter["page"] = page;
    }

    // Handle device_number filtering
    if (device_number) {
      const deviceArray = device_number.toString().split(",");
      filter["device_number"]["$in"] = deviceArray;
      filter["values.device_number"]["$in"] = deviceArray;
    }

    if (device_number && !recent && (!external || external === "yes")) {
      filter["recent"] = "no";
    }

    if (!device_number) {
      delete filter["device_number"];
      delete filter["values.device_number"];
    }

    // Handle site filtering
    if (site) {
      filter["values.site"]["$in"] = site.toString().split(",");
    }

    if (site && !recent && (!external || external === "yes")) {
      filter["recent"] = "no";
    }

    if (!site) {
      delete filter["values.site"];
    }

    // Handle unique ids for devices and sites
    if (device_id) {
      logObject("device_id", device_id);
      const deviceIdArray = device_id
        .toString()
        .split(",")
        .map((id) => ObjectId(id));
      filter["values.device_id"]["$in"] = deviceIdArray;
    }

    if (device_id && !recent && (!external || external === "yes")) {
      filter["recent"] = "no";
    }

    if (!device_id) {
      delete filter["values.device_id"];
    }

    if (site_id) {
      const siteIdArray = site_id
        .toString()
        .split(",")
        .map((id) => ObjectId(id));
      filter["values.site_id"]["$in"] = siteIdArray;
    }

    if (site_id && !recent && (!external || external === "yes")) {
      filter["recent"] = "no";
    }

    if (!site_id) {
      delete filter["values.site_id"];
    }

    // Handle frequency, recent, network, and tenant
    if (frequency) {
      filter["values.frequency"] = frequency;
      filter["frequency"] = frequency;
    } else {
      filter["values.frequency"] = "hourly";
      filter["frequency"] = "hourly";
    }

    if (recent) {
      filter["recent"] = recent;
    }

    if (network) {
      filter["network"] = network;
    }

    if (tenant) {
      filter["tenant"] = tenant;
    }

    // Handle running and brief properties
    if (running) {
      filter["running"] = running;
    }

    if (brief) {
      filter["brief"] = brief;
    }

    return filter;
  },

  devices: (req) => {
    const {
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
      group,
      visibility,
      deviceName,
    } = { ...req.query, ...req.params };

    const filter = {};

    const modifyAndConcatArray = (value) => {
      const deviceArray = value.toString().split(",");
      const modifiedDeviceArray = deviceArray.map((value) =>
        isLowerCase(value) ? value.toUpperCase() : value.toLowerCase()
      );
      return [...modifiedDeviceArray, ...deviceArray];
    };

    if (name || device || device_name || deviceName) {
      filter.name = {
        $in: modifyAndConcatArray(name || device || device_name || deviceName),
      };
    }

    if (channel) {
      filter.device_number = parseInt(channel);
    }

    if (category) {
      filter.category = category;
    }

    if (!isEmpty(category) && category === "public" && isEmpty(device_id)) {
      filter["visibility"] = true;
    }

    if (network) {
      filter.network = network;
    }

    if (group) {
      filter["group"] = group;
    }

    if (device_number) {
      filter.device_number = parseInt(device_number);
    }

    if (id) {
      filter._id = ObjectId(id);
    }

    if (device_id) {
      filter._id = ObjectId(device_id);
    }

    if (device_codes) {
      filter.device_codes = { $in: device_codes.toString().split(",") };
    }

    if (chid) {
      filter.device_number = parseInt(chid);
    }

    if (location || loc) {
      filter.locationID = location || loc;
    }

    if (site || site_id) {
      filter.site_id = site || site_id;
    }

    if (siteName) {
      filter.siteName = siteName;
    }

    if (mapAddress || map) {
      filter.locationName = mapAddress || map;
    }

    if (primary) {
      filter.isPrimaryInLocation = primary.toLowerCase() === "yes";
    }

    if (active) {
      filter.isActive = active.toLowerCase() === "yes";
    }

    if (visibility) {
      filter.visibility = visibility.toLowerCase() === "yes";
    }

    return filter;
  },

  sites: (req) => {
    const {
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
      site_id,
      category,
      name,
      site_codes,
      _id,
      network,
      group,
      google_place_id,
    } = { ...req.query, ...req.params, ...req.body };
    const filter = {};

    if (name) {
      filter["name"] = name;
    }

    if (county) {
      filter["county"] = county;
    }

    if (network) {
      filter["network"] = network;
    }

    if (group) {
      filter["group"] = group;
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

    if (site_id) {
      filter["_id"] = ObjectId(site_id);
    }

    if (category) {
      filter["category"] = category;
    }

    if (!isEmpty(category) && category === "public" && isEmpty(site_id)) {
      filter["visibility"] = true;
    }

    if (site_codes) {
      const siteCodesArray = site_codes.toString().split(",");
      filter["site_codes"] = { $in: siteCodesArray };
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
      airqloud_id,
      admin_level,
      summary,
      dashboard,
      airqloud_codes,
      category,
      network,
      group,
    } = { ...req.query, ...req.params };

    const filter = {};

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (airqloud_id) {
      filter["_id"] = ObjectId(airqloud_id);
    }
    if (network) {
      filter["network"] = network;
    }

    if (group) {
      filter["group"] = group;
    }
    if (admin_level) {
      filter["admin_level"] = admin_level;
    }

    if (summary === "yes") {
      filter["summary"] = summary;
    }

    if (dashboard === "yes") {
      filter["dashboard"] = dashboard;
    }

    if (airqloud_codes) {
      const airqloudCodesArray = airqloud_codes.toString().split(",");
      filter["airqloud_codes"] = { $in: airqloudCodesArray };
    }

    if (category) {
      filter["category"] = category;
    }

    if (!isEmpty(category) && category === "public" && isEmpty(airqloud_id)) {
      filter["visibility"] = true;
    }

    return filter;
  },

  grids: (req) => {
    const { id, admin_level, grid_codes, grid_id, category, network, group } = {
      ...req.query,
      ...req.params,
    };

    const filter = {};

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (grid_id) {
      filter["_id"] = ObjectId(grid_id);
    }

    if (network) {
      filter["network"] = network;
    }

    if (group) {
      filter["group"] = group;
    }

    if (admin_level) {
      filter["admin_level"] = admin_level;
    }

    if (grid_codes) {
      const geoCodesArray = grid_codes.toString().split(",");
      filter["grid_codes"] = { $in: geoCodesArray };
    }

    if (category) {
      filter["category"] = category;
    }

    if (!isEmpty(category) && category === "public" && isEmpty(grid_id)) {
      filter["visibility"] = true;
    }

    return filter;
  },

  cohorts: (req) => {
    const { id, cohort_codes, name, cohort_id, category, network, group } = {
      ...req.query,
      ...req.params,
    };
    const filter = {};

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (cohort_id) {
      filter["_id"] = ObjectId(cohort_id);
    }

    if (name) {
      filter["name"] = name;
    }

    if (network) {
      filter["network"] = network;
    }

    if (group) {
      filter["group"] = group;
    }

    if (cohort_codes) {
      const cohortCodesArray = cohort_codes.toString().split(",");
      filter["cohort_codes"] = { $in: cohortCodesArray };
    }

    if (category) {
      filter["category"] = category;
    }

    if (!isEmpty(category) && category === "public" && isEmpty(cohort_id)) {
      filter["visibility"] = true;
    }

    return filter;
  },

  networks: (req) => {
    try {
      const { id, name, network_codes, net_id } = {
        ...req.query,
        ...req.params,
        ...req.body,
      };
      let filter = {};
      if (name) {
        filter["name"] = name;
      }

      if (net_id) {
        filter["_id"] = ObjectId(net_id);
      }

      if (network_codes) {
        let networkCodesArray = network_codes.toString().split(",");
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
      const { id, name, admin_level_codes, level_id } = {
        ...req.query,
        ...req.params,
        ...req.body,
      };

      let filter = {};
      if (name) {
        filter["name"] = name;
      }

      if (admin_level_codes) {
        let adminLevelCodesArray = admin_level_codes.toString().split(",");
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
    let { id, name, admin_level, summary, network } = {
      ...req.query,
      ...req.params,
      ...req.body,
    };
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
      group,
      activity_codes,
      _id,
    } = {
      ...req.query,
      ...req.params,
      ...req.body,
    };

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

    if (group) {
      filter["group"] = group;
    }

    if (activity_codes) {
      const activityCodesArray = activity_codes.toString().split(",");
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

  photos: (req) => {
    let {
      id,
      device_id,
      airqloud_id,
      site_id,
      device_number,
      device_name,
      network,
      group,
      tags,
    } = {
      ...req.query,
      ...req.params,
      ...req.body,
    };
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
      let tagsArray = tags.toString().split(",");
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

    if (group) {
      filter["group"] = group;
    }

    return filter;
  },

  tips: (request) => {
    let { id, pm25, pm10 } = {
      ...request.query,
      ...request.params,
      ...request.body,
    };
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
      const { id, task_id, lesson_id } = {
        ...request.query,
        ...request.params,
        ...request.body,
      };
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
      const { id, task_id, lesson_id } = {
        ...request.query,
        ...request.params,
        ...request.body,
      };
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
      const { id, user_id, lesson_id, progress_id, quiz_id } = {
        ...request.query,
        ...request.params,
        ...request.body,
      };
      logObject("user_id", user_id && user_id.toString());
      logObject("lesson_id ", lesson_id && lesson_id.toString());
      logObject("quiz_id ", quiz_id && quiz_id.toString());
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
      if (quiz_id) {
        filter["quiz_id"] = ObjectId(quiz_id);
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

  kyaquizzes: (request) => {
    try {
      const { id, quiz_id } = {
        ...request.query,
        ...request.params,
        ...request.body,
      };
      let filter = {};
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (quiz_id) {
        filter["_id"] = ObjectId(quiz_id);
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

  kyaquestions: (request) => {
    try {
      const { id, quiz_id, question_id, answer_id } = {
        ...request.query,
        ...request.params,
        ...request.body,
      };
      let filter = {};
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (quiz_id) {
        filter["_id"] = ObjectId(quiz_id);
      }
      if (question_id) {
        filter["_id"] = ObjectId(question_id);
      }
      if (answer_id) {
        filter["_id"] = ObjectId(answer_id);
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
