const { boolean } = require("joi");
const {
  generateDateFormat,
  generateDateFormatWithoutHrs,
  monthsBehind,
  monthsInfront,
  removeMonthsFromProvidedDate,
  addMonthsToProvidedDate,
  removeMonthsFromProvideDateTime,
  addMonthsToProvideDateTime,
} = require("./date");

const { logObject, logElement, logText } = require("./log");

const generateEventsFilter = (
  queryStartDay,
  queryEndDay,
  device,
  frequency,
  startTime,
  endTime
) => {
  let oneMonthBack = monthsBehind(1);
  let oneMonthInfront = monthsInfront(1);
  let defaultStartDay = generateDateFormatWithoutHrs(oneMonthBack);
  let defaultEndDay = generateDateFormatWithoutHrs(oneMonthInfront);
  logElement("defaultStartDay", defaultStartDay);
  logElement(" defaultEndDay", defaultEndDay);

  let filter = {
    day: { $gte: defaultStartDay, $lte: defaultEndDay },
    "values.time": { $gte: oneMonthBack, $lte: oneMonthInfront },
  };

  if (queryStartDay && !queryEndDay) {
    filter["day"]["$lte"] = addMonthsToProvidedDate(queryStartDay, 1);
    delete filter["values.time"];
  }

  if (startTime) {
    let start = new Date(startTime);
    filter["values.time"]["$gte"] = start;
    let day = generateDateFormatWithoutHrs(start);
    filter["day"]["$gte"] = day;
  }

  if (endTime) {
    let end = new Date(endTime);
    filter["values.time"]["$lte"] = end;
    let day = generateDateFormatWithoutHrs(end);
    filter["day"]["$lte"] = day;
  }

  if (startTime && !endTime) {
    let start = new Date(startTime);
    filter["values.time"]["$lte"] = addMonthsToProvideDateTime(start, 1);
    let day = generateDateFormatWithoutHrs(start);
    filter["day"]["$lte"] = addMonthsToProvidedDate(day, 1);
  }

  if (!startTime && endTime) {
    let end = new Date(endTime);
    filter["values.time"]["$gte"] = removeMonthsFromProvideDateTime(end, 1);
    let day = generateDateFormatWithoutHrs(end);
    filter["day"]["$gte"] = removeMonthsFromProvidedDate(day, 1);
  }

  if (queryStartDay) {
    filter["day"]["$gte"] = queryStartDay;
    delete filter["values.time"];
  }

  if (queryEndDay) {
    filter["day"]["$lte"] = queryEndDay;
    delete filter["values.time"];
  }

  if (!queryStartDay && queryEndDay) {
    filter["day"]["$gte"] = removeMonthsFromProvidedDate(queryEndDay, 1);
    delete filter["values.time"];
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

module.exports = { generateEventsFilter, generateDeviceFilter };
