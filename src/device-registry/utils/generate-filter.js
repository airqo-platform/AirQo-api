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
    filter["day"]["$gte"] = queryStartTime;
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
    filter["day"]["$lte"] = queryEndTime;
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
  tenant,
  name,
  channel,
  location,
  siteName,
  mapAddress
) => {
  if (tenant && name && !channel && !location && !siteName && !mapAddress) {
    let regexExpression = generateRegexExpressionFromStringElement(name);
    let filter = {
      name: { $regex: regexExpression, $options: "i" },
    };
    return filter;
  } else if (
    tenant &&
    !name &&
    channel &&
    !location &&
    !siteName &&
    !mapAddress
  ) {
    return {
      channelID: channel,
    };
  } else if (
    tenant &&
    !name &&
    !channel &&
    location &&
    !siteName &&
    !mapAddress
  ) {
    return {
      locationID: location,
    };
  } else if (
    tenant &&
    !name &&
    !channel &&
    !location &&
    siteName &&
    !mapAddress
  ) {
    let regexExpression = generateRegexExpressionFromStringElement(siteName);
    let filter = {
      siteName: { $regex: regexExpression, $options: "i" },
    };
    return filter;
  } else if (
    tenant &&
    !name &&
    !channel &&
    !location &&
    !siteName &&
    mapAddress
  ) {
    let regexExpression = generateRegexExpressionFromStringElement(mapAddress);
    let filter = {
      locationName: { $regex: regexExpression, $options: "i" },
    };
    return filter;
  } else if (tenant && !name && !channel && !location) {
    return {};
  }
};

module.exports = { generateEventsFilter, generateDeviceFilter };
