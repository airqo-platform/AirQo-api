const { validationResult } = require("express-validator");
const isEmpty = require("is-empty");

class HttpError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

class BadRequestError extends Error {
  constructor({ message, errors }) {
    super(message);
    this.name = "BadRequestError";
    this.statusCode = 400;
    this.errors = errors;
  }
}

const extractErrorsFromRequest = (req) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    if (errors.mapped) {
      return errors.mapped();
    } else {
      const extractedErrors = {};
      errors.array().forEach((err) => {
        const param = err.param || "general"; // Fallback key

        // Handle nested errors recursively:
        if (!isEmpty(err.nestedErrors)) {
          extractedErrors[param] = extractNestedErrors(err.nestedErrors);
        } else {
          extractedErrors[param] = err.msg;
        }
      });
      return extractedErrors;
    }
  }

  return null;
};

const extractNestedErrors = (nestedErrors, depth = 0) => {
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) {
    return "Maximum error nesting depth exceeded";
  }
  if (Array.isArray(nestedErrors)) {
    return nestedErrors.map((err) => extractNestedErrors(err, depth + 1)); // Recursively handle nested arrays
  } else if (typeof nestedErrors === "object" && nestedErrors !== null) {
    //check if object
    const extracted = {};
    for (const key in nestedErrors) {
      extracted[key] = extractNestedErrors(nestedErrors[key], depth + 1); // Recursively handle nested objects
    }
    return extracted;
  } else {
    return nestedErrors; // Base case: return the error message or value
  }
};

module.exports = {
  HttpError,
  BadRequestError,
  extractErrorsFromRequest,
};
