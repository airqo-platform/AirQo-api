function replacer(key, value) {
  // Check for circular references
  if (typeof value === "object" && value !== null) {
    if (this.seen.has(value)) {
      return;
    }
    this.seen.add(value);
  }

  // Handle non-serializable values
  if (value instanceof Error) {
    var error = {};
    Object.getOwnPropertyNames(value).forEach(function (propName) {
      error[propName] = value[propName];
    });
    return error;
  }

  // Ensure direct assignment of properties
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    return value[key];
  }

  return value;
}

function stringify(obj) {
  var seen = new Set();
  try {
    return JSON.stringify(obj, replacer.bind({ seen }));
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
}

module.exports = stringify;
