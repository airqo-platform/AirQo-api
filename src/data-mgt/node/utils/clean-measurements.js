function clean(obj) {
  let trimmedValues = Object.entries(obj).reduce((acc, [key, value]) => {
    acc[key] = typeof value === "string" ? value.trim() : value;
    return acc;
  }, {});

  for (var propName in trimmedValues) {
    if (
      trimmedValues[propName] === null ||
      trimmedValues[propName] === undefined
    ) {
      delete trimmedValues[propName];
    }

    if (trimmedValues["created_at"]) {
      let date = new Date(trimmedValues["created_at"]);
      if (isNaN(date)) {
        delete trimmedValues["created_at"];
      }
    }

    if (isNaN(trimmedValues["pm10"])) {
      //   delete trimmedValues["pm10"];
    }

    if (trimmedValues["pm2_5"]) {
    }

    if (trimmedValues["s2_pm10"]) {
    }

    if (trimmedValues["s2_pm2_5"]) {
    }
  }
  return trimmedValues;
}

module.exports = clean;
