require("module-alias/register");
const { expect } = require("chai");
const errors = require("@utils/errors");
const HTTPStatus = require("http-status");

describe("errorUtil", () => {
  describe("convertErrorArrayToObject", () => {
    it("should convert an array of errors to an object", () => {
      const errorArray = [
        { value: "email", msg: "Email is required" },
        { value: "password", msg: "Password must be at least 6 characters" },
      ];

      const result = errors.convertErrorArrayToObject(errorArray);

      expect(result).to.deep.equal({
        email: "Email is required",
        password: "Password must be at least 6 characters",
        message: "Password must be at least 6 characters",
      });
    });
  });
  describe("tryCatchErrors", () => {
    it("should return an error response for try-catch errors", () => {
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };
      const error = new Error("Sample error");
      const message = "Sample error message";

      const result = errors.utillErrors.tryCatchErrors(error, message);

      expect(result).to.deep.equal({
        success: false,
        message: "util server error -- Sample error message",
        error: "Sample error",
      });
    });
  });
  describe("badRequest", () => {
    it("should return a bad request response with custom message and errors", () => {
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };
      const message = "Bad request";
      const errorsList = [
        { field: "email", message: "Invalid email format" },
        { field: "password", message: "Password is required" },
      ];

      const result = errors.utillErrors.badRequest(message, errorsList);

      expect(result).to.deep.equal({
        success: false,
        message: "Bad request",
        errors: [
          { field: "email", message: "Invalid email format" },
          { field: "password", message: "Password is required" },
        ],
      });
    });
  });
  describe("axiosError", () => {
    it("should return an internal server error response with error response data", () => {
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };
      const error = {
        response: {
          data: {
            message: "Sample error message",
            details: {
              field: "email",
              message: "Invalid email format",
            },
          },
        },
      };

      const result = errors.axiosError(error, null, res);

      expect(result).to.deep.equal({
        code: HTTPStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          error: {
            message: "Sample error message",
            details: {
              field: "email",
              message: "Invalid email format",
            },
          },
        },
      });
    });

    it("should return an internal server error response with request details", () => {
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };
      const error = {
        request: "Sample request details",
      };

      const result = errors.axiosError(error, null, res);

      expect(result).to.deep.equal({
        code: HTTPStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          error: "Sample request details",
          message: "The request was made but no response was received",
        },
      });
    });

    it("should return an internal server error response with error message", () => {
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };
      const error = new Error("Sample error message");

      const result = errors.axiosError(error, null, res);

      expect(result).to.deep.equal({
        code: HTTPStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          message: "Server Error",
          error: "Sample error message",
        },
      });
    });
  });
  describe("missingQueryParams", () => {
    it("should return a bad request response for missing query parameters", () => {
      const res = {
        status: (code) => ({
          send: (data) => ({ code, data }),
        }),
      };

      const result = errors.missingQueryParams(res);

      expect(result).to.deep.equal({
        code: HTTPStatus.BAD_REQUEST,
        data: {
          success: false,
          message: "misssing request parameters, please check documentation",
        },
      });
    });
  });
  describe("missingOrInvalidValues", () => {
    it("should return a bad request response for missing or invalid parameter values", () => {
      const res = {
        status: (code) => ({
          send: (data) => ({ code, data }),
        }),
      };

      const result = errors.missingOrInvalidValues(res);

      expect(result).to.deep.equal({
        code: HTTPStatus.BAD_REQUEST,
        data: {
          success: false,
          message:
            "missing or invalid request parameter values, please check documentation",
        },
      });
    });
  });
  describe("invalidParamsValue", () => {
    it("should return a bad request response for invalid request parameter value", () => {
      const res = {
        status: (code) => ({
          send: (data) => ({ code, data }),
        }),
      };

      const result = errors.invalidParamsValue(null, res);

      expect(result).to.deep.equal({
        code: HTTPStatus.BAD_REQUEST,
        data: {
          success: false,
          message:
            "Invalid request parameter value, please check documentation",
        },
      });
    });
  });
  describe("callbackErrors", () => {
    it("should return an internal server error response with the provided error message", () => {
      const error = "Some error message";
      const req = {}; // Mocked request object, not used in the function
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };

      const result = errors.callbackErrors(error, req, res);

      expect(result).to.deep.equal({
        code: HTTPStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          message: "server error",
          error: error,
        },
      });
    });
  });
  describe("unclearError", () => {
    it("should return an internal server error response with 'unclear server error' message", () => {
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };

      const result = errors.unclearError(res);

      expect(result).to.deep.equal({
        code: HTTPStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          message: "unclear server error",
        },
      });
    });
  });
  describe("badRequest", () => {
    it("should return a bad request response with provided message and errors", () => {
      const res = {
        status: (code) => ({
          json: (data) => ({ code, data }),
        }),
      };

      const message = "Invalid data";
      const errors = {
        field1: "Field 1 is required",
        field2: "Field 2 must be a number",
      };

      const result = errors.badRequest(res, message, errors);

      expect(result).to.deep.equal({
        code: HTTPStatus.BAD_REQUEST,
        data: {
          success: false,
          message: message,
          errors: errors,
        },
      });
    });
  });

  // Add more test cases for other functions in the errors module...
});
