const { logObject, HttpError } = require("@utils/shared");
const {
  monthsInfront,
  isTimeEmpty,
  generateDateFormatWithoutHrs,
  getDifferenceInWeeks,
  addWeeksToProvideDateTime,
  addDaysToProvideDateTime,
  addDays,
} = require("./date");
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");
const log4js = require("log4js");
const httpStatus = require("http-status");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- generate-filter-util`
);

if (
  typeof constants.JOB_LOOKBACK_WINDOW_MS === "undefined" ||
  constants.JOB_LOOKBACK_WINDOW_MS === null
) {
  logger.error("JOB_LOOKBACK_WINDOW_MS is not defined in constants!");
}
const JOB_LOOKBACK_WINDOW_MS = constants.JOB_LOOKBACK_WINDOW_MS;

const isLowerCase = (str) => {
  return str === str.toLowerCase();
};

const handlePredefinedValueMatch = (
  value,
  allowedValues,
  options = { matchCombinations: false }
) => {
  if (!value || !allowedValues || !Array.isArray(allowedValues))
    return undefined;

  // Ensure value is a string before calling split - THIS IS THE KEY FIX
  const stringValue = typeof value === "string" ? value : String(value);

  // Split input value by commas and trim whitespace
  const inputValues = stringValue.split(",").map((v) => v.trim().toLowerCase());

  // If matchCombinations is false but we received an array of arrays,
  // flatten it to get all possible values
  const flattenedValues =
    !options.matchCombinations && Array.isArray(allowedValues[0])
      ? allowedValues.flat()
      : allowedValues;

  // Handle combinations matching
  if (options.matchCombinations && Array.isArray(allowedValues[0])) {
    const matchedForms = new Set();

    for (const inputValue of inputValues) {
      for (const combination of allowedValues) {
        if (combination.some((term) => term.toLowerCase() === inputValue)) {
          combination.forEach((term) => {
            matchedForms.add(term.toLowerCase());
            matchedForms.add(term.toUpperCase());
          });
        }
      }
    }

    return matchedForms.size > 0 ? { $in: [...matchedForms] } : stringValue;
  }

  // Handle single value matching
  const matchedValues = inputValues.filter((inputValue) =>
    flattenedValues.some((allowed) => allowed.toLowerCase() === inputValue)
  );

  if (matchedValues.length > 0) {
    const allForms = new Set();
    matchedValues.forEach((matchedValue) => {
      const originalValue = flattenedValues.find(
        (allowed) => allowed.toLowerCase() === matchedValue
      );
      allForms.add(originalValue);
      allForms.add(
        isLowerCase(originalValue)
          ? originalValue.toUpperCase()
          : originalValue.toLowerCase()
      );
    });
    return { $in: [...allForms] };
  }

  return stringValue;
};

//startTime=2022-12-20T10:34:15.880Z
const generateFilter = {
  events: (request, next) => {
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
      active,
    } = { ...query, ...params };

    const DEFAULT_QUERY_RANGE_DAYS = 3;
    // Constants for date calculations
    const today = monthsInfront(0);
    const threeDaysBack = addDays(-DEFAULT_QUERY_RANGE_DAYS);

    // Initial filter object
    const filter = {
      day: {
        $gte: generateDateFormatWithoutHrs(threeDaysBack),
        $lte: generateDateFormatWithoutHrs(today),
      },
      "values.time": {
        $gte: threeDaysBack,
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
      const range = constants.AQI_INDEX[index];
      filter["values.pm2_5.value"]["$gte"] = range.min;
      // Only set $lte if max is not null
      if (range.max !== null) {
        filter["values.pm2_5.value"]["$lte"] = range.max;
      }
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
      const end = addDaysToProvideDateTime(startTime, DEFAULT_QUERY_RANGE_DAYS);
      if (!isTimeEmpty(startTime)) {
        filter["values.time"]["$lte"] = end;
      } else {
        delete filter["values.time"];
      }
      filter["day"]["$lte"] = generateDateFormatWithoutHrs(end);
    }

    if (!startTime && endTime) {
      const start = addDaysToProvideDateTime(
        endTime,
        -DEFAULT_QUERY_RANGE_DAYS
      );
      if (!isTimeEmpty(endTime)) {
        filter["values.time"]["$gte"] = start;
      } else {
        delete filter["values.time"];
      }
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(start);
    }

    if (startTime && endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      logObject("the days between provided dates", diffDays);

      if (diffDays > DEFAULT_QUERY_RANGE_DAYS) {
        const start = addDaysToProvideDateTime(
          endTime,
          -DEFAULT_QUERY_RANGE_DAYS
        );
        if (!isTimeEmpty(endTime)) {
          filter["values.time"]["$gte"] = start;
        } else {
          delete filter["values.time"];
        }
        filter["day"]["$gte"] = generateDateFormatWithoutHrs(start);
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
      filter["metadata"] = "site_id";
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
      filter["metadata"] = "site_id";
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
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
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

    if (active) {
      filter["active"] = active;
    }

    return filter;
  },
  readings: (request, next) => {
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
      grid_id,
      limit,
      skip,
      external,
      metadata,
      tenant,
      recent,
      page,
      network,
      index,
      running,
      brief,
      deployment_type,
    } = { ...query, ...params };

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
      const range = constants.AQI_INDEX[index];
      filter["values.pm2_5.value"] = {};
      filter["values.pm2_5.value"]["$gte"] = range.min;
      // Only set $lte if max is not null
      if (range.max !== null) {
        filter["values.pm2_5.value"]["$lte"] = range.max;
      }
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
        filter["values.time"]["$lte"] = addWeeksToProvideDateTime(startTime, 1);
      } else {
        delete filter["values.time"];
      }
      const addedTwoWeeksToProvidedDateTime = addWeeksToProvideDateTime(
        startTime,
        1
      );
      filter["day"]["$lte"] = generateDateFormatWithoutHrs(
        addedTwoWeeksToProvidedDateTime
      );
    }

    if (!startTime && endTime) {
      if (!isTimeEmpty(endTime)) {
        filter["values.time"]["$gte"] = addWeeksToProvideDateTime(endTime, -1);
      } else {
        delete filter["values.time"];
      }
      const removedTwoWeeksFromProvidedDateTime = addWeeksToProvideDateTime(
        endTime,
        -1
      );
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(
        removedTwoWeeksFromProvidedDateTime
      );
    }

    if (startTime && endTime) {
      const weeks = getDifferenceInWeeks(startTime, endTime);
      logObject("the weeks between provided dates", weeks);
      if (weeks > 1) {
        if (!isTimeEmpty(endTime)) {
          filter["values.time"]["$gte"] = addWeeksToProvideDateTime(
            endTime,
            -1
          );
        } else {
          delete filter["values.time"];
        }
        const removedTwoWeeksFromProvidedDateTime = addWeeksToProvideDateTime(
          endTime,
          -1
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

    if (limit) {
      filter["limit"] = limit;
    }

    if (skip) {
      filter["skip"] = skip;
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
      filter["metadata"] = "site_id";
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
      filter["metadata"] = "site_id";
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
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
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

    // Handle deployment type filtering
    if (deployment_type) {
      filter.deployment_type = deployment_type;
    }

    // Handle grid_id for mobile deployments
    if (grid_id) {
      const gridIdArray = grid_id
        .toString()
        .split(",")
        .map((id) => ObjectId(id));
      filter["values.grid_id"] = { $in: gridIdArray };
    }

    return filter;
  },
  telemetry: (request) => {
    const { query, params } = request;
    const { device, device_id, site_id, site, frequency } = {
      ...query,
      ...params,
    };

    const filter = {};

    if (device) {
      const deviceArray = device
        .toString()
        .split(",")
        .map((value) =>
          isLowerCase(value) ? value.toUpperCase() : value.toLowerCase()
        );
      const mergedArray = [...deviceArray, ...device.toString().split(",")];
      filter["device"] = {};
      filter["device"]["$in"] = mergedArray;
    }

    if (device_id) {
      logObject("device_id", device_id);
      const deviceIdArray = device_id
        .toString()
        .split(",")
        .map((id) => id.toString());
      filter["device_id"] = {};
      filter["device_id"]["$in"] = deviceIdArray;
    }

    if (site) {
      const siteArray = site
        .toString()
        .split(",")
        .map((value) =>
          isLowerCase(value) ? value.toUpperCase() : value.toLowerCase()
        );
      const mergedArray = [...siteArray, ...site.toString().split(",")];
      filter["site"] = {};
      filter["site"]["$in"] = mergedArray;
    }

    if (site_id) {
      const siteIdArray = site_id
        .toString()
        .split(",")
        .map((id) => id.toString());
      filter["site_id"] = {};
      filter["site_id"]["$in"] = siteIdArray;
    }

    if (frequency) {
      filter["frequency"] = frequency;
    } else {
      filter["frequency"] = "hourly";
    }

    return filter;
  },

  fetch: (request, next) => {
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
      limit,
      skip,
      external,
      metadata,
      tenant,
      recent,
      page,
      network,
      index,
      active,
      internal,
      running,
      brief,
      isHistorical,
    } = { ...query, ...params };

    // Constants for date calculations
    const today = monthsInfront(0);
    const threeDaysBack = addDays(-3);

    // Initial filter object
    const filter = {
      day: {
        $gte: generateDateFormatWithoutHrs(threeDaysBack),
        $lte: generateDateFormatWithoutHrs(today),
      },
      "values.time": {
        $gte: threeDaysBack,
        $lte: today,
      },
      "values.device": {},
      "values.site": {},
      "values.device_id": {},
      "values.site_id": {},
      "values.device_number": {},
      device_number: {},
    };

    if (isHistorical) {
      filter.isHistorical = isHistorical;
    }

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
      const range = constants.AQI_INDEX[index];
      filter["values.pm2_5.value"] = {};
      filter["values.pm2_5.value"]["$gte"] = range.min;
      // Only set $lte if max is not null
      if (range.max !== null) {
        filter["values.pm2_5.value"]["$lte"] = range.max;
      }
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
        filter["values.time"]["$lte"] = addDaysToProvideDateTime(startTime, 1);
      } else {
        delete filter["values.time"];
      }
      const addedTwoWeeksToProvidedDateTime = addDaysToProvideDateTime(
        startTime,
        1
      );
      filter["day"]["$lte"] = generateDateFormatWithoutHrs(
        addedTwoWeeksToProvidedDateTime
      );
    }

    if (!startTime && endTime) {
      if (!isTimeEmpty(endTime)) {
        filter["values.time"]["$gte"] = addDaysToProvideDateTime(endTime, -1);
      } else {
        delete filter["values.time"];
      }
      const removedTwoWeeksFromProvidedDateTime = addDaysToProvideDateTime(
        endTime,
        -1
      );
      filter["day"]["$gte"] = generateDateFormatWithoutHrs(
        removedTwoWeeksFromProvidedDateTime
      );
    }

    if (startTime && endTime) {
      const weeks = getDifferenceInWeeks(startTime, endTime);
      logObject("the weeks between provided dates", weeks);
      if (weeks > 1) {
        if (!isTimeEmpty(endTime)) {
          filter["values.time"]["$gte"] = addDaysToProvideDateTime(endTime, -1);
        } else {
          delete filter["values.time"];
        }
        const removedTwoWeeksFromProvidedDateTime = addDaysToProvideDateTime(
          endTime,
          -1
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

    if (limit) {
      filter["limit"] = limit;
    }

    if (skip) {
      filter["skip"] = skip;
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
      filter["metadata"] = "site_id";
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
      filter["metadata"] = "site_id";
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
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
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

    if (active) {
      filter["active"] = active;
    }

    if (internal) {
      filter["internal"] = internal;
    }

    // If 'recent=yes' is used by a job, override the time window to be much smaller
    // This is a critical optimization for background jobs.
    // if (recent === "yes" && (active === "yes" || internal === "yes")) {
    //   // Only apply the default lookback if no specific startTime is provided
    //   if (!startTime) {
    //     const twelveHoursBack = new Date(Date.now() - JOB_LOOKBACK_WINDOW_MS);
    //     filter["values.time"] = { $gte: twelveHoursBack, $lte: today };
    //     filter["day"] = {
    //       $gte: generateDateFormatWithoutHrs(twelveHoursBack),
    //       $lte: generateDateFormatWithoutHrs(today),
    //     };
    //   }
    // }

    return filter;
  },

  devices: (req, next) => {
    const {
      search,
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
      device_category,
      path,
      network,
      group,
      visibility,
      deviceName,
      status,
      online_status,
      last_active,
      last_active_before,
      last_active_after,
      serial_number,
      mobility,
      authRequired,
      deployment_type_include_legacy,
    } = { ...req.query, ...req.params };

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { long_name: { $regex: search, $options: "i" } },
        { alias: { $regex: search, $options: "i" } },
        { serial_number: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const toBooleanSafe = (value) => {
      if (value === undefined) return undefined;

      // If already a boolean, return it
      if (typeof value === "boolean") return value;

      // String conversions
      const stringValue = String(value)
        .toLowerCase()
        .trim();
      if (["true", "yes", "1"].includes(stringValue)) return true;
      if (["false", "no", "0"].includes(stringValue)) return false;

      return undefined; // Invalid input
    };

    if (authRequired !== undefined) {
      const boolValue = toBooleanSafe(authRequired);
      if (boolValue !== undefined) {
        filter.authRequired = boolValue;
      }
    }

    if (active !== undefined) {
      const boolValue = toBooleanSafe(active);
      if (boolValue !== undefined) {
        filter.isActive = boolValue;
      }
    }

    if (visibility !== undefined) {
      const boolValue = toBooleanSafe(visibility);
      if (boolValue !== undefined) {
        filter.visibility = boolValue;
      }
    }
    if (
      deployment_type_include_legacy === true ||
      deployment_type_include_legacy === "true"
    ) {
      // Create a separate clause for legacy deployment types
      const legacyDeploymentClause = {
        $or: [
          { deployment_type: "static" },
          { deployment_type: { $exists: false } },
          { deployment_type: null },
        ],
      };

      // If there's already an $or (e.g., from search), preserve it by using $and
      if (filter.$or) {
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = filter.$and || [];
        filter.$and.push({ $or: existingOr });
        filter.$and.push(legacyDeploymentClause);
      } else {
        // No existing $or, just add the legacy clause via $and
        filter.$and = filter.$and || [];
        filter.$and.push(legacyDeploymentClause);
      }

      delete filter.deployment_type;
    }

    if (primary !== undefined) {
      const boolValue = toBooleanSafe(primary);
      if (boolValue !== undefined) {
        filter.primary = boolValue;
      }
    }

    if (mobility !== undefined) {
      const boolValue = toBooleanSafe(mobility);
      if (boolValue !== undefined) {
        filter.mobility = boolValue;
      }
    }

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

    if (last_active) {
      filter.lastActive = {};
      const start = new Date(last_active);
      filter["lastActive"]["$gte"] = start;
    }

    if (last_active_after) {
      filter.lastActive = {};
      const start = new Date(last_active_after);
      filter["lastActive"]["$gte"] = start;
    }

    if (last_active_before) {
      filter.lastActive = {};
      const start = new Date(last_active_before);
      filter["lastActive"]["$lte"] = start;
    }

    if (online_status) {
      if (online_status.toLowerCase() === "online") {
        filter["isOnline"] = true;
      } else if (online_status.toLowerCase() === "offline") {
        filter["isOnline"] = false;
      }
    }

    if (category || device_category) {
      const categoryValue = category || device_category;
      filter["category"] = categoryValue;
    }

    if (!isEmpty(path) && path === "public" && isEmpty(device_id)) {
      filter["visibility"] = true;
    }

    if (network) {
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (serial_number) {
      filter.serial_number = serial_number;
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
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

    const validStatuses = constants.VALID_DEVICE_STATUSES;

    if (status) {
      // Split the status string by commas, but not within quotes
      const statusArray = status.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];

      const validStatusArray = statusArray
        .map((s) => {
          // Remove quotes and trim whitespace
          s = s
            .replace(/^"|"$/g, "")
            .trim()
            .toLowerCase();
          // Replace underscores or dashes with spaces
          s = s.replace(/[_-]/g, " ");
          return s;
        })
        .filter((s) => validStatuses.includes(s));

      if (validStatusArray.length > 0) {
        filter.status = { $in: validStatusArray };
      }
    }
    return filter;
  },
  sites: (req, next) => {
    const {
      search,
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
      path,
      site_codes,
      _id,
      network,
      group,
      google_place_id,
      online_status,
      last_active,
      last_active_before,
      last_active_after,
    } = { ...req.query, ...req.params };
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { generated_name: { $regex: search, $options: "i" } },
        { formatted_name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location_name: { $regex: search, $options: "i" } },
        { search_name: { $regex: search, $options: "i" } },
        { district: { $regex: search, $options: "i" } },
        { region: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } },
      ];
    }

    if (county) {
      filter["county"] = county;
    }

    if (network) {
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
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
      filter["site_category.category"] = category;
    }

    if (!isEmpty(path) && path === "public" && isEmpty(site_id)) {
      filter["visibility"] = true;
    }

    if (last_active) {
      filter.lastActive = {};
      const start = new Date(last_active);
      filter["lastActive"]["$gte"] = start;
    }

    if (last_active_after) {
      filter.lastActive = {};
      const start = new Date(last_active_after);
      filter["lastActive"]["$gte"] = start;
    }

    if (last_active_before) {
      filter.lastActive = {};
      const start = new Date(last_active_before);
      filter["lastActive"]["$lte"] = start;
    }

    if (online_status) {
      if (online_status.toLowerCase() === "online") {
        filter["isOnline"] = true;
      } else if (online_status.toLowerCase() === "offline") {
        filter["isOnline"] = false;
      }
    }

    if (site_codes) {
      const siteCodesArray = site_codes.toString().split(",");
      filter["site_codes"] = { $in: siteCodesArray };
    }

    if (google_place_id) {
      filter["google_place_id"] = google_place_id;
    }

    if (generated_name) {
      console.log("generated_name", generated_name);
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

  airqlouds: (req, next) => {
    const {
      search,
      id,
      airqloud_id,
      admin_level,
      summary,
      dashboard,
      airqloud_codes,
      category,
      path,
      network,
      group,
    } = { ...req.query, ...req.params };

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { long_name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (id) {
      filter._id = ObjectId(id);
    }

    if (airqloud_id) {
      filter._id = ObjectId(airqloud_id);
    }
    if (network) {
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
    }
    if (admin_level) {
      filter.admin_level = admin_level;
    }

    if (summary === "yes") {
      filter.summary = summary;
    }

    if (dashboard === "yes") {
      filter.dashboard = dashboard;
    }

    if (airqloud_codes) {
      const airqloudCodesArray = airqloud_codes.toString().split(",");
      filter.airqloud_codes = { $in: airqloudCodesArray };
    }

    if (category) {
      filter.category = category;
    }

    if (!isEmpty(path) && path === "public" && isEmpty(airqloud_id)) {
      filter.visibility = true;
    }

    return filter;
  },

  // Replace the existing 'grids' function with this one:

  grids: (req, next) => {
    const {
      search,
      id,
      admin_level,
      grid_codes,
      grid_id,
      category,
      path,
      network,
      group,
    } = {
      ...req.query,
      ...req.params,
    };

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { long_name: { $regex: search, $options: "i" } },
      ];
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (grid_id) {
      filter["_id"] = ObjectId(grid_id);
    }

    if (network) {
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
    }

    if (admin_level) {
      // Handle both single value and array of values
      if (Array.isArray(admin_level)) {
        // Multiple admin levels - use $in operator
        filter["admin_level"] = { $in: admin_level };
      } else {
        // Single admin level - direct assignment
        filter["admin_level"] = admin_level;
      }
    }

    if (grid_codes) {
      const geoCodesArray = grid_codes.toString().split(",");
      filter["grid_codes"] = { $in: geoCodesArray };
    }

    if (category) {
      filter["category"] = category;
    }

    if (!isEmpty(path) && path === "public" && isEmpty(grid_id)) {
      filter["visibility"] = true;
    }

    return filter;
  },

  cohorts: (req, next) => {
    const {
      search,
      id,
      cohort_codes,
      name,
      cohort_id,
      category,
      path,
      network,
      group,
    } = {
      ...req.query,
      ...req.params,
    };
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

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
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
    }

    if (cohort_codes) {
      const cohortCodesArray = cohort_codes.toString().split(",");
      filter["cohort_codes"] = { $in: cohortCodesArray };
    }

    if (category) {
      filter["category"] = category;
    }

    if (!isEmpty(path) && path === "public" && isEmpty(cohort_id)) {
      filter["visibility"] = true;
    }

    return filter;
  },

  networks: (req, next) => {
    try {
      const { id, name, network_codes, net_id } = {
        ...req.query,
        ...req.params,
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  admin_levels: (req, next) => {
    try {
      const { id, name, admin_level_codes, level_id } = {
        ...req.query,
        ...req.params,
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  locations: (req, next) => {
    let { id, name, admin_level, summary, network, group } = {
      ...req.query,
      ...req.params,
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
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
    }

    if (admin_level) {
      filter["admin_level"] = admin_level;
    }
    return filter;
  },
  activities: (req, next) => {
    let {
      search,
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
    };

    let filter = {};

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: "i" } },
        { device: { $regex: search, $options: "i" } },
      ];
    }

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
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
    }

    if (activity_codes) {
      const activityCodesArray = activity_codes.toString().split(",");
      filter["activity_codes"] = {};
      filter["activity_codes"]["$in"] = activityCodesArray;
    }

    if (activity_tags) {
      const activityTagsArray = activity_tags.toString().split(",");
      filter["tags"] = {};
      filter["tags"]["$in"] = activityTagsArray;
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

  photos: (req, next) => {
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
      filter.network = handlePredefinedValueMatch(
        network,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.NETWORK_PAIRS,
        { matchCombinations: true }
      );
    }

    if (group) {
      filter.groups = handlePredefinedValueMatch(
        group,
        constants.PREDEFINED_FILTER_VALUES.COMBINATIONS.GROUP_PAIRS,
        { matchCombinations: true }
      );
    }

    return filter;
  },
  tips: (request, next) => {
    let { search, id, pm25, pm10 } = {
      ...request.query,
      ...request.params,
      ...request.body,
    };
    let filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

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

  kyalessons: (request, next) => {
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  kyatasks: (request, next) => {
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  kyaprogress: (request, next) => {
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  kyaquizzes: (request, next) => {
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  kyaquestions: (request, next) => {
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = generateFilter;
