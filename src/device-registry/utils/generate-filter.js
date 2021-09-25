const {
  monthsInfront,
  addMonthsToProvideDateTime,
  isTimeEmpty,
  generateDateFormatWithoutHrs,
  getDifferenceInMonths,
  addDays,
} = require("./date");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const { logElement, logObject, logText } = require("./log");
const log4js = require("log4js");
const logger = log4js.getLogger("generate-filter-util");

const isLowerCase = (str) => {
  return str === str.toLowerCase();
};

const generateFilter = {
  events: (
    device,
    device_number,
    device_id,
    site,
    site_id,
    frequency,
    startTime,
    endTime,
    metadata
  ) => {
    let oneMonthBack = monthsInfront(-1);
    let oneMonthInfront = monthsInfront(1);
    let today = monthsInfront(0);
    let oneWeekBack = addDays(-7);
    let oneWeekInfront = addDays(7);
    let filter = {
      day: {
        $gte: generateDateFormatWithoutHrs(oneWeekBack),
        $lte: generateDateFormatWithoutHrs(today),
      },
      "values.time": { $gte: oneWeekBack, $lte: today },
      "values.device": {},
      "values.site": {},
      "values.device_id": {},
      "values.site_id": {},
      "values.device_number": {},
      device_number: {},
    };

    if (metadata) {
      filter["metadata"] = metadata;
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

    if (endTime) {
      if (isTimeEmpty(endTime) == false) {
        let end = new Date(endTime);
        filter["values.time"]["$lte"] = end;
      } else {
        delete filter["values.time"];
      }
      filter["day"]["$lte"] = generateDateFormatWithoutHrs(endTime);
    }

    if (startTime && !endTime) {
      if (isTimeEmpty(startTime) == false) {
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
      if (isTimeEmpty(endTime) == false) {
        filter["values.time"]["$gte"] = addMonthsToProvideDateTime(endTime, -1);
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
        if (isTimeEmpty(endTime) == false) {
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
      logObject("the modifiedDeviceArray ", modifiedDeviceArray);
      let mergedArray = [].concat(modifiedDeviceArray, deviceArray);
      filter["values.device"]["$in"] = mergedArray;
    }

    if (!device) {
      delete filter["values.device"];
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
    }

    return filter;
  },

  events_v2: (request) => {
    try {
      const {
        device,
        device_number,
        site,
        frequency,
        startTime,
        endTime,
        device_id,
        site_id,
      } = request.query;
      let oneMonthBack = monthsInfront(-1);
      let oneMonthInfront = monthsInfront(1);
      let today = monthsInfront(0);
      let oneWeekBack = addDays(-7);
      let oneWeekInfront = addDays(7);
      let filter = {
        "values.time": { $gte: oneWeekBack, $lte: today },
        device_id: {},
        site_id: {},
        site: {},
        device: {},
        device_number: {},
        "values.device_number": {},
      };

      if (startTime) {
        if (isTimeEmpty(startTime) == false) {
          let start = new Date(startTime);
          filter["values.time"]["$gte"] = start;
        } else {
          delete filter["values.time"];
        }
      }

      if (endTime) {
        if (isTimeEmpty(endTime) == false) {
          let end = new Date(endTime);
          filter["values.time"]["$lte"] = end;
        } else {
          delete filter["values.time"];
        }
      }

      if (startTime && !endTime) {
        if (isTimeEmpty(startTime) == false) {
          filter["values.time"]["$lte"] = addMonthsToProvideDateTime(
            startTime,
            1
          );
        } else {
          delete filter["values.time"];
        }
      }

      if (!startTime && endTime) {
        if (isTimeEmpty(endTime) == false) {
          filter["values.time"]["$gte"] = addMonthsToProvideDateTime(
            endTime,
            -1
          );
        } else {
          delete filter["values.time"];
        }
      }

      if (startTime && endTime) {
        let months = getDifferenceInMonths(startTime, endTime);
        logElement("the number of months", months);
        if (months > 1) {
          if (isTimeEmpty(endTime) == false) {
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
       * the unique site and device ids
       */
      if (device_id) {
        let deviceIdArray = device_id.split(",");
        let modifiedDeviceIdArray = deviceIdArray.map((device_id) => {
          return ObjectId(device_id);
        });
        filter["device_id"]["$in"] = modifiedDeviceIdArray;
      }

      if (!device_id) {
        delete filter["device_id"];
      }

      if (site_id) {
        let siteIdArray = site_id.split(",");
        let modifiedSiteIdArray = siteIdArray.map((site_id) => {
          return ObjectId(site_id);
        });
        filter["site_id"]["$in"] = modifiedSiteIdArray;
      }

      if (!site_id) {
        delete filter["site_id"];
      }
      /**
       * the unique site and device names
       */
      if (device) {
        let deviceArray = device.split(",");
        filter["device"]["$in"] = deviceArray;
      }

      if (!device) {
        delete filter["device"];
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
        let siteArray = site.split(",");
        filter["site"]["$in"] = siteArray;
      }

      if (!site) {
        delete filter["site"];
      }
      /**
       * end unique site and device names
       */

      if (frequency) {
        filter["frequency"] = frequency;
      }

      return {
        success: true,
        data: filter,
        message: "filter successfully generated",
      };
    } catch (error) {
      return {
        success: false,
        message: "unable to generate the filter",
        error: error.message,
      };
    }
  },

  generateRegexExpressionFromStringElement: (element) => {
    let regex = `${element}`;
    return regex;
  },
  devices_v0: (
    name,
    channel,
    location,
    siteName,
    mapAddress,
    primary,
    active
  ) => {
    let filter = {};

    if (name) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        name
      );
      filter["name"] = { $regex: regexExpression, $options: "i" };
    }

    if (channel) {
      filter["channelID"] = channel;
    }

    if (location) {
      filter["locationID"] = location;
    }

    if (siteName) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        siteName
      );
      filter["siteName"] = { $regex: regexExpression, $options: "i" };
    }

    if (mapAddress) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        mapAddress
      );
      filter["locationName"] = { $regex: regexExpression, $options: "i" };
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
      if (activeStr.toLowerCase() == "yes") {
        filter["isActive"] = true;
      } else if (activeStr.toLowerCase() == "no") {
        filter["isActive"] = false;
      } else {
      }
    }

    return filter;
  },
  devices: (req) => {
    try {
      let filter = {};
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
        device_id,
        device_number,
      } = req.query;

      if (name) {
        // let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        //   name
        // );
        filter["name"] = name;
      }

      if (channel) {
        filter["channelID"] = channel;
      }

      if (device_number) {
        filter["device_number"] = device_number;
      }

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (device_id) {
        filter["_id"] = ObjectId(device_id);
      }

      if (chid) {
        filter["channelID"] = chid;
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
        let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
          siteName
        );
        filter["siteName"] = { $regex: regexExpression, $options: "i" };
      }

      if (mapAddress) {
        let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
          mapAddress
        );
        filter["locationName"] = { $regex: regexExpression, $options: "i" };
      }

      if (map) {
        let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
          map
        );
        filter["locationName"] = { $regex: regexExpression, $options: "i" };
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
        if (activeStr.toLowerCase() == "yes") {
          filter["isActive"] = true;
        } else if (activeStr.toLowerCase() == "no") {
          filter["isActive"] = false;
        } else {
        }
      }

      logger.info(`the filter  -- ${JSON.stringify(filter)}`);
      return {
        success: true,
        message: "successfully generated the filter",
        data: filter,
      };
    } catch (error) {
      logger.error(`server error - generate device filter -- ${error.message}`);
      return {
        success: false,
        message: "server error - generate device filter",
        errors: error.message,
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
    } = req.query;
    let filter = {};

    if (name) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        name
      );
      filter["name"] = { $regex: regexExpression, $options: "i" };
    }

    if (county) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        county
      );
      filter["county"] = { $regex: regexExpression, $options: "i" };
    }

    if (lat_long) {
      filter["lat_long"] = lat_long;
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (generated_name) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        generated_name
      );
      filter["generated_name"] = { $regex: regexExpression, $options: "i" };
    }

    if (district) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        district
      );
      filter["district"] = { $regex: regexExpression, $options: "i" };
    }

    if (region) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        region
      );
      filter["region"] = { $regex: regexExpression, $options: "i" };
    }

    if (city) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        city
      );
      filter["city"] = { $regex: regexExpression, $options: "i" };
    }

    if (street) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        street
      );
      filter["street"] = { $regex: regexExpression, $options: "i" };
    }

    if (country) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        country
      );
      filter["country"] = { $regex: regexExpression, $options: "i" };
    }

    if (parish) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        parish
      );
      filter["parish"] = { $regex: regexExpression, $options: "i" };
    }

    return filter;
  },
  airqlouds: (req) => {
    let { id, name } = req.query;
    let filter = {};

    if (name) {
      filter["name"] = name;
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    return filter;
  },

  locations: (req) => {
    let { id } = req.query;
    let filter = {};

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    return filter;
  },

  activities: (req) => {
    let {
      device,
      id,
      site_id,
      activity_type,
      activity_tags,
      next_maintenance,
      maintenance_type,
      startTime,
      endTime,
      generated_name,
    } = req.query;
    let oneMonthBack = monthsInfront(-1);
    let oneMonthInfront = monthsInfront(1);
    logElement("defaultStartTime", oneMonthBack);
    logElement(" defaultEndTime", oneMonthInfront);
    let filter = {
      day: {
        $gte: generateDateFormatWithoutHrs(oneMonthBack),
        $lte: generateDateFormatWithoutHrs(oneMonthInfront),
      },
      "logs.time": { $gte: oneMonthBack, $lte: oneMonthInfront },
      "logs.site": {},
    };

    if (site_id) {
      filter["logs.site_id"]["$in"] = site_id;
    }

    if (generated_name) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        generated_name
      );
      filter["generated_name"] = { $regex: regexExpression, $options: "i" };
    }

    if (maintenance_type) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        maintenance_type
      );
      filter["maintenance_type"] = { $regex: regexExpression, $options: "i" };
    }
    if (activity_type) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        activity_type
      );
      filter["activity_type"] = { $regex: regexExpression, $options: "i" };
    }
    if (activity_tags) {
    }

    if (next_maintenance) {
    }

    if (startTime) {
      if (isTimeEmpty(startTime) == false) {
        let start = new Date(startTime);
        filter["logs.time"]["$gte"] = start;
      } else {
        delete filter["logs.time"];
      }
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(startTime);
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (generated_name) {
      filter[" generated_name"] = generated_name;
    }

    if (endTime) {
      if (isTimeEmpty(endTime) == false) {
        let end = new Date(endTime);
        filter["logs.time"]["$lte"] = end;
      } else {
        delete filter["logs.time"];
      }
      filter["day"]["$lte"] = generateDateFormatWithoutHrs(endTime);
    }

    if (startTime && !endTime) {
      if (isTimeEmpty(startTime) == false) {
        filter["logs.time"]["$lte"] = addMonthsToProvideDateTime(startTime, 1);
      } else {
        delete filter["logs.time"];
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
      if (isTimeEmpty(endTime) == false) {
        filter["logs.time"]["$gte"] = addMonthsToProvideDateTime(endTime, -1);
      } else {
        delete filter["logs.time"];
      }
      let removedOneMonthFromProvidedDateTime = addMonthsToProvideDateTime(
        endTime,
        -1
      );
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(
        removedOneMonthFromProvidedDateTime
      );
    }

    if (device) {
      filter["logs.device"]["$in"] = device;
    }

    return filter;
  },

  activities_v0: (req) => {
    let {
      device,
      id,
      activity_type,
      activity_tags,
      maintenance_type,
      site_id,
    } = req.query;

    let filter = {
      tags: {},
    };

    if (maintenance_type) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        maintenance_type
      );
      filter["maintenanceType"] = { $regex: regexExpression, $options: "i" };
    }
    if (activity_type) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        activity_type
      );
      filter["activityType"] = { $regex: regexExpression, $options: "i" };
    }
    if (site_id) {
      filter["site_id"] = ObjectId(site_id);
    }
    if (activity_tags) {
      filter["tags"]["$in"] = activity_tags;
    }
    if (!activity_tags) {
      delete filter["tags"];
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (device) {
      filter["device"] = device;
    }

    return filter;
  },
};

module.exports = generateFilter;
