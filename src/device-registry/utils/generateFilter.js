const generateFilter = (queryStartTime, queryEndTime) => {
  if (queryStartTime && queryEndTime) {
    return {
      day: { $gte: queryStartTime, $lte: queryEndTime },
    };
  } else {
    return {};
  }
};

module.exports = { generateFilter };
