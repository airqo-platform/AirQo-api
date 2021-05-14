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
      day: { $gte: defaultStartTime },
    };
  } else if (queryStartTime && !queryEndTime && !device && !frequency) {
    return {
      day: {
        $gte: queryStartTime,
        $lte: addMonthsToProvidedDate(queryStartTime, 1),
      },
    };
  } else if (!queryStartTime && queryEndTime && !device && !frequency) {
    return {
      day: {
        $lte: queryEndTime,
        $gte: removeMonthsFromProvidedDate(queryEndTime, 1),
      },
    };
  } else if (!queryStartTime && queryEndTime && device && frequency) {
    return {
      day: {
        $lte: queryEndTime,
        $gte: removeMonthsFromProvidedDate(queryEndTime, 1),
      },
      "values.device": device,
      "values.frequency": frequency,
    };
  } else if (queryStartTime && !queryEndTime && device && frequency) {
    return {
      day: {
        $gte: queryStartTime,
        $lte: addMonthsToProvidedDate(queryStartTime, 1),
      },
      "values.device": device,
      "values.frequency": frequency,
    };
  } else if (queryStartTime && queryEndTime && !device && frequency) {
    return {
      day: { $gte: queryStartTime, $lte: queryEndTime },
      "values.frequency": frequency,
    };
  } else if (queryStartTime && queryEndTime && device && !frequency) {
    return {
      day: { $gte: queryStartTime, $lte: queryEndTime },
      "values.device": device,
    };
  } else if (!queryStartTime && !queryEndTime && device && !frequency) {
    return {
      "values.device": device,
      day: { $gte: defaultStartTime, $lte: defaultEndTime },
    };
  } else if (queryStartTime && !queryEndTime && !device && frequency) {
    return {
      day: {
        $gte: queryStartTime,
        $lte: addMonthsToProvidedDate(queryStartTime, 1),
      },
      "values.frequency": frequency,
    };
  } else if (!queryStartTime && queryEndTime && !device && frequency) {
    return {
      day: {
        $lte: queryEndTime,
        $gte: removeMonthsFromProvidedDate(queryEndTime, 1),
      },
      "values.frequency": frequency,
    };
  } else if (!queryStartTime && queryEndTime && device && !frequency) {
    return {
      day: {
        $lte: queryEndTime,
        $gte: removeMonthsFromProvidedDate(queryEndTime, 1),
      },
      "values.device": device,
    };
  } else if (queryStartTime && !queryEndTime && device && !frequency) {
    return {
      day: {
        $gte: queryStartTime,
        $lte: addMonthsToProvidedDate(queryStartTime, 1),
      },
      "values.device": device,
    };
  } else if (!queryStartTime && !queryEndTime && !device && frequency) {
    return {
      "values.frequency": frequency,
      day: { $gte: defaultStartTime },
    };
  } else {
    return {
      day: { $gte: defaultStartTime },
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
