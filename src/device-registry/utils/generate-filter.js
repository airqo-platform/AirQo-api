const {
  monthsBehind,
  monthsInfront,
  removeMonthsFromProvideDateTime,
  addMonthsToProvideDateTime,
  isTimeEmpty,
  generateDateFormatWithoutHrs,
} = require("./date");

const { logElement } = require("./log");

const generateEventsFilter = (device, frequency, startTime, endTime) => {
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
      filter["values.time"]["$lte"] = addMonthsToProvideDateTime(startTime, 1);
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

  if (device) {
    filter["values.device"]["$in"] = device;
  }

  if (frequency) {
    filter["values.frequency"] = frequency;
  }

  return filter;
};

const generateRegexExpressionFromStringElement = (element) => {
  let regex = `${element}`;
  return regex;
};

const generateDeviceFilter = (
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
    let regexExpression = generateRegexExpressionFromStringElement(name);
    filter["name"] = { $regex: regexExpression, $options: "i" };
  }

  if (channel) {
    filter["channelID"] = channel;
  }

  if (location) {
    filter["locationID"] = location;
  }

  if (siteName) {
    let regexExpression = generateRegexExpressionFromStringElement(siteName);
    filter["siteName"] = { $regex: regexExpression, $options: "i" };
  }

  if (mapAddress) {
    let regexExpression = generateRegexExpressionFromStringElement(mapAddress);
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
};

const generateSiteFilter = (
  lat_long,
  id,
  generated_name,
  district,
  region,
  city,
  street,
  country,
  parish,
  name
) => {
  let filter = {};

  if (name) {
    let regexExpression = generateRegexExpressionFromStringElement(name);
    filter["name"] = { $regex: regexExpression, $options: "i" };
  }

  if (lat_long) {
    filter["lat_long"] = lat_long;
  }

  if (id) {
    filter["_id"] = id;
  }

  if (generated_name) {
    let regexExpression = generateRegexExpressionFromStringElement(
      generated_name
    );
    filter["generated_name"] = { $regex: regexExpression, $options: "i" };
  }

  if (district) {
    let regexExpression = generateRegexExpressionFromStringElement(district);
    filter["district"] = { $regex: regexExpression, $options: "i" };
  }

  if (region) {
    let regexExpression = generateRegexExpressionFromStringElement(region);
    filter["region"] = { $regex: regexExpression, $options: "i" };
  }

  if (city) {
    let regexExpression = generateRegexExpressionFromStringElement(city);
    filter["city"] = { $regex: regexExpression, $options: "i" };
  }

  if (street) {
    let regexExpression = generateRegexExpressionFromStringElement(street);
    filter["street"] = { $regex: regexExpression, $options: "i" };
  }

  if (country) {
    let regexExpression = generateRegexExpressionFromStringElement(country);
    filter["country"] = { $regex: regexExpression, $options: "i" };
  }

  if (parish) {
    let regexExpression = generateRegexExpressionFromStringElement(parish);
    filter["parish"] = { $regex: regexExpression, $options: "i" };
  }

  return filter;
};

module.exports = {
  generateEventsFilter,
  generateDeviceFilter,
  generateSiteFilter,
};
