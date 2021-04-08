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

const generateDeviceFilter = (tenant, name, channel, location) => {
  if (tenant && name && !channel && !location) {
    return {
      name: name,
    };
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
