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
    return {};
  }
};

const extractSecondStringElement = (item) => {
  const str = item;
  const slicingStart = 0;
  const secondItem = str
    .slice(slicingStart)
    .trim()
    .split(" ")[1];
  return secondItem;
};

const generateRegexExpressionFromStringElement = (element) => {
  let regex = `/${element}$/`;
  let slicedSecondRegex = regex.slice(1, -1);
  return slicedSecondRegex;
};

const hasWhiteSpace = (string) => {
  return string.indexOf(" ") >= 0;
};

const generateDeviceFilter = (tenant, name, channel, location) => {
  if (tenant && name && !channel && !location) {
    let filter = {};
    let doesHaveWhiteSpace = hasWhiteSpace(name);
    if (doesHaveWhiteSpace) {
      let extractedDeviceName = extractSecondStringElement(name);
      let regexExpression = generateRegexExpressionFromStringElement(
        extractedDeviceName
      );
      filter = {
        name: { $regex: regexExpression, $options: "i" },
      };
    } else {
      filter = { name };
    }
    return filter;
  } else if (tenant && !name && channel && !location) {
    return {
      channelID: channel,
    };
  } else if (tenant && !name && !channel && location) {
    return {
      locationID: location,
    };
  } else if (tenant && !name && !channel && !location) {
    return {};
  }
};

module.exports = { generateEventsFilter, generateDeviceFilter };
