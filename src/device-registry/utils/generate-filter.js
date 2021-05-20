const {
  generateDateFormat,
  generateDateFormatWithoutHrs,
  generateMonthsBehind,
  generateMonthsInfront,
} = require("./date");

const { logObject, logElement, logText } = require("./log");

const generateComponentsFilter = (id, device) => {
  if (id && !device) {
    return {
      _id: id,
    };
  } else if (!id && device) {
    return {
      deviceID: device,
    };
  } else {
    return {};
  }
};

const generateEventsFilter = (queryStartTime, queryEndTime, device) => {
  if (queryStartTime && queryEndTime && !device) {
    return {
      day: { $gte: queryStartTime, $lte: queryEndTime },
    };
  } else if (queryStartTime && queryEndTime && device) {
    return {
      day: { $gte: queryStartTime, $lte: queryEndTime },
      "values.device": device,
    };
  } else if (!queryStartTime && !queryEndTime && device) {
    return {
      "values.device": device,
    };
  } else if (queryStartTime && !queryEndTime && !device) {
    return {
      day: { $gte: queryStartTime },
    };
  } else if (!queryStartTime && queryEndTime && !device) {
    return {
      day: { $lte: queryEndTime },
    };
  } else if (!queryStartTime && queryEndTime && device) {
    return {
      day: { $lte: queryEndTime },
      "values.device": device,
    };
  } else if (queryStartTime && !queryEndTime && device) {
    return {
      day: { $gte: queryStartTime },
      "values.device": device,
    };
  } else {
    let date = Date.now();
    let oneMonthBack = generateMonthsBehind(date, 1);
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
  id,
  channel,
  location,
  siteName,
  mapAddress
) => {
  if (tenant && id && !channel && !location && !siteName && !mapAddress) {
    let filter = {
      _id: id,
    };
    return filter;
  } else if (
    tenant &&
    !id &&
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
    !id &&
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
    !id &&
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
    !id &&
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
  } else if (tenant && !id && !channel && !location) {
    return {};
  }
};

module.exports = {
  generateEventsFilter,
  generateDeviceFilter,
  generateComponentsFilter,
  generateComponentTypesFilter,
};
