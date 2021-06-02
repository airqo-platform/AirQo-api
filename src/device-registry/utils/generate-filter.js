const { boolean } = require("joi");
const {
  generateDateFormat,
  generateDateFormatWithoutHrs,
  monthsBehind,
  monthsInfront,
  removeMonthsFromProvidedDate,
  addMonthsToProvidedDate,
} = require("./date");

const { logObject, logElement, logText } = require("./log");

const generateEventsFilter = (
  queryStartTime,
  queryEndTime,
  device,
  frequency
) => {
  let oneMonthBack = monthsBehind(1);
  let oneMonthInfront = monthsInfront(1);
  let defaultStartTime = generateDateFormatWithoutHrs(oneMonthBack);
  let defaultEndTime = generateDateFormatWithoutHrs(oneMonthInfront);
  logElement("defaultStartTime", defaultStartTime);
  logElement("defaultEndTime", defaultEndTime);

  let filter = {
    day: { $gte: defaultStartTime, $lte: defaultEndTime },
  };

  if (queryStartTime && !queryEndTime) {
    filter["day"]["$lte"] = addMonthsToProvidedDate(queryStartTime, 1);
  }

  if (queryStartTime) {
    filter["day"]["$gte"] = queryStartTime;
  }

  if (queryEndTime) {
    filter["day"]["$lte"] = queryEndTime;
  }

  if (!queryStartTime && queryEndTime) {
    filter["day"]["$gte"] = removeMonthsFromProvidedDate(queryEndTime, 1);
  }

  if (device) {
    filter["values.device"] = device;
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
