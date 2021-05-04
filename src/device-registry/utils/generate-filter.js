const {
  generateDateFormat,
  generateDateFormatWithoutHrs,
  threeMonthsBehind,
  twoMonthsBehind,
  oneMonthBehind,
  threeMonthsInfront,
} = require("./date");

const { logObject, logElement, logText } = require("./log");

const generateEventsFilter = (
  queryStartTime,
  queryEndTime,
  device,
  frequency
) => {
  if (queryStartTime && queryEndTime && !device && !frequency) {
    return {
      day: { $gte: queryStartTime, $lte: queryEndTime },
    };
  } else if (queryStartTime && queryEndTime && device && frequency) {
    return {
      day: { $gte: queryStartTime, $lte: queryEndTime },
      "values.device": device,
      "values.frequency": frequency,
    };
  } else if (!queryStartTime && !queryEndTime && device && frequency) {
    return {
      "values.device": device,
      "values.frequency": frequency,
    };
  } else if (queryStartTime && !queryEndTime && !device && !frequency) {
    return {
      day: { $gte: queryStartTime },
      "values.frequency": frequency,
    };
  } else if (!queryStartTime && queryEndTime && !device && !frequency) {
    return {
      day: { $lte: queryEndTime },
    };
  } else if (!queryStartTime && queryEndTime && device && frequency) {
    return {
      day: { $lte: queryEndTime },
      "values.device": device,
      "values.frequency": frequency,
    };
  } else if (queryStartTime && !queryEndTime && device && frequency) {
    return {
      day: { $gte: queryStartTime },
      "values.device": device,
      "values.frequency": frequency,
    };
  } else {
    let oneMonthBack = oneMonthBehind();
    let startTime = generateDateFormatWithoutHrs(oneMonthBack);
    logElement("startTime", startTime);
    return {
      day: { $gte: startTime },
    };
  }
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
