const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");

const errors = require("./errors");

describe("errors", () => {
  describe("convertErrorArrayToObject", () => {
    it("should convert error array to object", () => {
      const array = [
        { value: "field1", msg: "Error message 1" },
        { value: "field2", msg: "Error message 2" },
      ];

      const result = errors.convertErrorArrayToObject(array);

      expect(result).to.be.an("object");
      expect(result).to.have.property("field1", "Error message 1");
      expect(result).to.have.property("field2", "Error message 2");
      expect(result).to.have.property("message", "Error message 1");
    });
  });

  describe("axiosError", () => {
    it("should handle axios error with response", () => {
      const error = {
        response: {
          data: "Error response data",
        },
      };
      const req = {};
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      errors.axiosError(error, req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          error: "Error response data",
        })
      ).to.be.true;
    });

    it("should handle axios error without response", () => {
      const error = {
        request: "Error request data",
      };
      const req = {};
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      errors.axiosError(error, req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          error: "Error request data",
          message: "The request was made but no response was received",
        })
      ).to.be.true;
    });

    it("should handle other types of errors", () => {
      const error = {
        message: "Error message",
      };
      const req = {};
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      errors.axiosError(error, req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Server Error",
          error: "Error message",
        })
      ).to.be.true;
    });
  });

  // Add test cases for other methods in the errors module
});
