const { boolean } = require("joi");
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
  mapAddress,
  primary,
  active
) => {
  if (!tenant) {
    return {};
  }

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

module.exports = {
  generateEventsFilter,
  generateDeviceFilter,
  generateComponentsFilter,
};
