const {
  monthsBehind,
  monthsInfront,
  removeMonthsFromProvideDateTime,
  addMonthsToProvideDateTime,
  isTimeEmpty,
  generateDateFormatWithoutHrs,
  getDifferenceInMonths,
} = require("./date");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const { logElement, logObject } = require("./log");

const generateFilter = {
  events: (device, frequency, startTime, endTime) => {
    let oneMonthBack = monthsBehind(1);
    let oneMonthInfront = monthsInfront(1);
    logElement("defaultStartTime", oneMonthBack);
    logElement(" defaultEndTime", oneMonthInfront);

    let filter = {
      day: {
        $gte: generateDateFormatWithoutHrs(oneMonthBack),
        $lte: generateDateFormatWithoutHrs(oneMonthInfront),
      },
      "values.time": { $gte: oneMonthBack, $lte: oneMonthInfront },
      "values.device": {},
    };

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
        filter["values.time"]["$gte"] = removeMonthsFromProvideDateTime(
          endTime,
          1
        );
      } else {
        delete filter["values.time"];
      }
      let removedOneMonthFromProvidedDateTime = removeMonthsFromProvideDateTime(
        endTime,
        1
      );
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(
        removedOneMonthFromProvidedDateTime
      );
    }

    if (startTime && endTime) {
      let months = getDifferenceInMonths(startTime, endTime);
      logElement("the number of months", months);
      if (months > 2) {
        if (isTimeEmpty(endTime) == false) {
          filter["values.time"]["$gte"] = removeMonthsFromProvideDateTime(
            endTime,
            1
          );
        } else {
          delete filter["values.time"];
        }
        let removedOneMonthFromProvidedDateTime = removeMonthsFromProvideDateTime(
          endTime,
          1
        );
        filter["day"]["$gte"] = generateDateFormatWithoutHrs(
          removedOneMonthFromProvidedDateTime
        );
      }
    }

    if (device) {
      deviceArray = device.split(",");
      filter["values.device"]["$in"] = deviceArray;
    }

    if (!device) {
      delete filter["values.device"];
    }

    if (frequency) {
      filter["values.frequency"] = frequency;
    }

    return filter;
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
    } = req.query;

    if (name) {
      let regexExpression = generateFilter.generateRegexExpressionFromStringElement(
        name
      );
      filter["name"] = { $regex: regexExpression, $options: "i" };
    }

    if (channel) {
      filter["channelID"] = channel;
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

    return filter;
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
    let oneMonthBack = monthsBehind(1);
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
        filter["logs.time"]["$gte"] = removeMonthsFromProvideDateTime(
          endTime,
          1
        );
      } else {
        delete filter["logs.time"];
      }
      let removedOneMonthFromProvidedDateTime = removeMonthsFromProvideDateTime(
        endTime,
        1
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
