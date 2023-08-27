require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const requestAccessUtil = require("@utils/create-candidate");
const generateFilter = require("@utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-candidate-controller`
);
const { logText, logObject, logElement } = require("@utils/log");
const requestAccessController = require("@controllers/create-candidate");

describe("requestAccessController", () => {
  describe("create", () => {
    it("should return a bad request response if validation errors exist", async () => {
      const req = {
        body: {
          /* insert invalid request body here */
        },
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force validation errors to exist
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await requestAccessController.create(req, res);

      // Expect a bad request response
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          errors: {} /* insert expected errors here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
    });

    it("should return a success response if requestAccessUtil.create is successful", async () => {
      const req = {
        body: {
          /* insert valid request body here */
        },
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the requestAccessUtil.create function
      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate created successfully",
        data: {
          /* insert candidate data here */
        },
      };
      sinon.stub(requestAccessUtil, "create").callsFake((request, callback) => {
        callback(successResponse);
      });

      await requestAccessController.create(req, res);

      // Expect a success response
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Candidate created successfully",
          candidate: {}, //insert expected candidate data here
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.create.restore();
    });

    it("should return an error response if requestAccessUtil.create returns an error", async () => {
      const req = {
        body: {
          /* insert valid request body here */
        },
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the requestAccessUtil.create function
      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon.stub(requestAccessUtil, "create").callsFake((request, callback) => {
        callback(errorResponse);
      });

      await requestAccessController.create(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.create.restore();
    });

    it("should return an error response if an exception is thrown", async () => {
      const req = {
        body: {
          /* insert valid request body here */
        },
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the requestAccessUtil.create function to throw an exception
      sinon
        .stub(requestAccessUtil, "create")
        .throws(new Error("Some unexpected error"));

      await requestAccessController.create(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.create.restore();
    });
  });
  describe("list", () => {
    it("should return a bad request response if validation errors exist", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force validation errors to exist
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await requestAccessController.list(req, res);

      // Expect a bad request response
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          errors: {} /* insert expected errors here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
    });

    it("should return a success response if requestAccessUtil.list is successful", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the requestAccessUtil.list function
      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "Candidates listed successfully",
        data: [
          /* insert candidate data here */
        ],
      };
      sinon.stub(requestAccessUtil, "list").resolves(successResponse);

      await requestAccessController.list(req, res);

      // Expect a success response
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Candidates listed successfully",
          candidates: [] /* insert expected candidate data here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.list.restore();
    });

    it("should return an error response if requestAccessUtil.list returns an error", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the requestAccessUtil.list function
      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon.stub(requestAccessUtil, "list").resolves(errorResponse);

      await requestAccessController.list(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.list.restore();
    });

    it("should return an error response if an exception is thrown", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the requestAccessUtil.list function to throw an exception
      sinon
        .stub(requestAccessUtil, "list")
        .throws(new Error("Some unexpected error"));

      await requestAccessController.list(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.list.restore();
    });
  });
  describe("confirm", () => {
    it("should return a bad request response if validation errors exist", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force validation errors to exist
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await requestAccessController.confirm(req, res);

      // Expect a bad request response
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          errors: {} /* insert expected errors here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
    });

    it("should return an error response if generateFilter.candidates returns an error", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub generateFilter.candidates to return an error
      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon.stub(generateFilter, "candidates").resolves(errorResponse);

      await requestAccessController.confirm(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      generateFilter.candidates.restore();
    });

    it("should return a success response if requestAccessUtil.confirm is successful", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub generateFilter.candidates to return a success response
      const successResponseFromFilter = {
        success: true,
        data: [
          /* insert filter data here */
        ],
      };
      sinon
        .stub(generateFilter, "candidates")
        .resolves(successResponseFromFilter);

      // Stub requestAccessUtil.confirm to return a success response
      const successResponseFromConfirm = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate confirmed successfully",
        data: [
          /* insert confirmed candidate data here */
        ],
      };
      sinon
        .stub(requestAccessUtil, "confirm")
        .resolves(successResponseFromConfirm);

      await requestAccessController.confirm(req, res);

      // Expect a success response
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Candidate confirmed successfully",
          user: {} /* insert expected confirmed candidate data here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      generateFilter.candidates.restore();
      requestAccessUtil.confirm.restore();
    });

    it("should return an error response if requestAccessUtil.confirm returns an error", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub generateFilter.candidates to return a success response
      const successResponseFromFilter = {
        success: true,
        data: [
          /* insert filter data here */
        ],
      };
      sinon
        .stub(generateFilter, "candidates")
        .resolves(successResponseFromFilter);

      // Stub requestAccessUtil.confirm to return an error response
      const errorResponseFromConfirm = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon
        .stub(requestAccessUtil, "confirm")
        .resolves(errorResponseFromConfirm);

      await requestAccessController.confirm(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      generateFilter.candidates.restore();
      requestAccessUtil.confirm.restore();
    });

    it("should return an error response if an exception is thrown", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub generateFilter.candidates to return a success response
      const successResponseFromFilter = {
        success: true,
        data: [
          /* insert filter data here */
        ],
      };
      sinon
        .stub(generateFilter, "candidates")
        .resolves(successResponseFromFilter);

      // Stub requestAccessUtil.confirm to throw an exception
      sinon
        .stub(requestAccessUtil, "confirm")
        .throws(new Error("Some unexpected error"));

      await requestAccessController.confirm(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      generateFilter.candidates.restore();
      requestAccessUtil.confirm.restore();
    });
  });
  describe("delete", () => {
    it("should return a bad request response if validation errors exist", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force validation errors to exist
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await requestAccessController.delete(req, res);

      // Expect a bad request response
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          errors: {} /* insert expected errors here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
    });

    it("should return a success response if requestAccessUtil.delete is successful", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub requestAccessUtil.delete to return a success response
      const successResponseFromDelete = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate deleted successfully",
        data: [
          /* insert deleted candidate data here */
        ],
      };
      sinon
        .stub(requestAccessUtil, "delete")
        .resolves(successResponseFromDelete);

      await requestAccessController.delete(req, res);

      // Expect a success response
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Candidate deleted successfully",
          candidate: {} /* insert expected deleted candidate data here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.delete.restore();
    });

    it("should return an error response if requestAccessUtil.delete returns an error", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub requestAccessUtil.delete to return an error response
      const errorResponseFromDelete = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon.stub(requestAccessUtil, "delete").resolves(errorResponseFromDelete);

      await requestAccessController.delete(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          candidate: {} /* insert expected deleted candidate data here */,
          error: "Some error occurred",
          errors: { message: "Some error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.delete.restore();
    });

    it("should return an error response if an exception is thrown", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub requestAccessUtil.delete to throw an exception
      sinon
        .stub(requestAccessUtil, "delete")
        .throws(new Error("Some unexpected error"));

      await requestAccessController.delete(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          candidate: {} /* insert expected deleted candidate data here */,
          error: "Some unexpected error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.delete.restore();
    });
  });
  describe("update", () => {
    it("should return a bad request response if validation errors exist", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force validation errors to exist
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await requestAccessController.update(req, res);

      // Expect a bad request response
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledWith({
          success: false,
          message: "bad request errors",
          errors: {} /* insert expected errors here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
    });

    it("should return a success response if requestAccessUtil.update is successful", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub requestAccessUtil.update to return a success response
      const successResponseFromUpdate = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate updated successfully",
        data: [
          /* insert updated candidate data here */
        ],
      };
      sinon
        .stub(requestAccessUtil, "update")
        .resolves(successResponseFromUpdate);

      await requestAccessController.update(req, res);

      // Expect a success response
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledWith({
          success: true,
          message: "Candidate updated successfully",
          candidate: {} /* insert expected updated candidate data here */,
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.update.restore();
    });

    it("should return an error response if requestAccessUtil.update returns an error", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub requestAccessUtil.update to return an error response
      const errorResponseFromUpdate = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon.stub(requestAccessUtil, "update").resolves(errorResponseFromUpdate);

      await requestAccessController.update(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          candidate: {} /* insert expected updated candidate data here */,
          error: "Some error occurred",
          errors: { message: "Some error occurred" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.update.restore();
    });

    it("should return an error response if an exception is thrown", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(requestAccessController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub requestAccessUtil.update to throw an exception
      sinon
        .stub(requestAccessUtil, "update")
        .throws(new Error("Some unexpected error"));

      await requestAccessController.update(req, res);

      // Expect an error response
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledWith({
          success: false,
          message: "Internal Server Error",
          candidate: {} /* insert expected updated candidate data here */,
          error: "Some unexpected error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;

      // Restore the stubbed functions
      requestAccessController.validationResult.restore();
      requestAccessUtil.update.restore();
    });
  });

  // Add more describe blocks and test cases as needed for other functions...
});
