require("module-alias/register");
const { expect } = require("chai");
const httpStatus = require("http-status");
const sinon = require("sinon");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  badRequest,
  callbackErrors,
  convertErrorArrayToObject,
} = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");

describe("errors-util", () => {
  describe("axiosError", () => {
    let req;
    let res;
    let statusStub;
    let jsonStub;

    beforeEach(() => {
      req = {};
      res = {
        status: function () {
          return this;
        },
        json: function () {
          return this;
        },
      };
      statusStub = sinon.stub(res, "status");
      jsonStub = sinon.stub(res, "json");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return INTERNAL_SERVER_ERROR with response data if error has response", () => {
      const error = {
        response: {
          data: {
            message: "Internal Server Error",
          },
        },
        request: null,
        config: {},
        message: "Request failed",
      };

      axiosError(error, req, res);

      sinon.assert.calledOnceWithExactly(
        statusStub,
        httpStatus.INTERNAL_SERVER_ERROR
      );
      sinon.assert.calledOnceWithExactly(jsonStub, {
        success: false,
        error: error.response.data,
      });
    });

    it("should return INTERNAL_SERVER_ERROR with request details if error has no response", () => {
      const error = {
        response: null,
        request: "Request details",
        config: {},
        message: "Request failed",
      };

      axiosError(error, req, res);

      sinon.assert.calledOnceWithExactly(
        statusStub,
        httpStatus.INTERNAL_SERVER_ERROR
      );
      sinon.assert.calledOnceWithExactly(jsonStub, {
        success: false,
        error: error.request,
      });
    });

    it("should return INTERNAL_SERVER_ERROR with general message and error details if neither response nor request exists", () => {
      const error = {
        response: null,
        request: null,
        config: {},
        message: "Request failed",
      };

      axiosError(error, req, res);

      sinon.assert.calledOnceWithExactly(
        statusStub,
        httpStatus.INTERNAL_SERVER_ERROR
      );
      sinon.assert.calledOnceWithExactly(jsonStub, {
        success: false,
        message: "Server Error",
        error: error.message,
      });
    });
  });
  describe("tryCatchErrors", () => {
    let res;
    let statusStub;
    let jsonStub;

    beforeEach(() => {
      res = {
        status: function () {
          return this;
        },
        json: function () {
          return this;
        },
      };
      statusStub = sinon.stub(res, "status");
      jsonStub = sinon.stub(res, "json");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return INTERNAL_SERVER_ERROR with the given message and error details", () => {
      const error = new Error("Internal Server Error");
      const type = "Custom";

      tryCatchErrors(res, error, type);

      sinon.assert.calledOnceWithExactly(
        statusStub,
        httpStatus.INTERNAL_SERVER_ERROR
      );
      sinon.assert.calledOnceWithExactly(jsonStub, {
        success: false,
        message: `${type} server error`,
        error: error.message,
      });
    });
  });
  describe("missingQueryParams", () => {
    let req;
    let res;
    let statusStub;
    let sendStub;

    beforeEach(() => {
      req = {};
      res = {
        status: function () {
          return this;
        },
        send: function () {
          return this;
        },
      };
      statusStub = sinon.stub(res, "status");
      sendStub = sinon.stub(res, "send");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return BAD_REQUEST with the appropriate message", () => {
      missingQueryParams(req, res);

      sinon.assert.calledOnceWithExactly(statusStub, httpStatus.BAD_REQUEST);
      sinon.assert.calledOnceWithExactly(sendStub, {
        success: false,
        message: "missing request parameters, please check documentation",
      });
    });
  });
  describe("badRequest", () => {
    let res;
    let statusStub;
    let jsonStub;

    beforeEach(() => {
      res = {
        status: function () {
          return this;
        },
        json: function () {
          return this;
        },
      };
      statusStub = sinon.stub(res, "status");
      jsonStub = sinon.stub(res, "json");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return BAD_REQUEST with the appropriate message and errors", () => {
      const message = "Bad request";
      const errors = { field: "Field is required" };

      badRequest(res, message, errors);

      sinon.assert.calledOnceWithExactly(statusStub, httpStatus.BAD_REQUEST);
      sinon.assert.calledOnceWithExactly(jsonStub, {
        success: false,
        message,
        errors,
      });
    });
  });
  describe("callbackErrors", () => {
    let res;
    let statusStub;
    let jsonStub;

    beforeEach(() => {
      res = {
        status: function () {
          return this;
        },
        json: function () {
          return this;
        },
      };
      statusStub = sinon.stub(res, "status");
      jsonStub = sinon.stub(res, "json");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return INTERNAL_SERVER_ERROR with the appropriate message and error object", () => {
      const errorMessage = "An internal server error occurred";
      const error = new Error(errorMessage);

      callbackErrors(error, null, res);

      sinon.assert.calledOnceWithExactly(
        statusStub,
        httpStatus.INTERNAL_SERVER_ERROR
      );
      sinon.assert.calledOnceWithExactly(jsonStub, {
        success: false,
        message: "server error",
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
    });
  });
  describe("convertErrorArrayToObject", () => {
    it("should convert an array of errors to an object", () => {
      const errors = [
        { param: "username", msg: "Username is required" },
        {
          param: "password",
          msg: "Password must be at least 8 characters long",
        },
        { param: "email", msg: "Invalid email format" },
      ];

      const result = convertErrorArrayToObject(errors);

      expect(result).to.deep.equal({
        username: "Username is required",
        password: "Password must be at least 8 characters long",
        email: "Invalid email format",
      });
    });

    it("should return an empty object for an empty array", () => {
      const errors = [];

      const result = convertErrorArrayToObject(errors);

      expect(result).to.deep.equal({});
    });
  });
});
