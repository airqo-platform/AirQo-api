require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const createCandidateUtil = require("@utils/create-candidate");
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
const createCandidateController = require("@controllers/create-candidate");

describe("createCandidateController", () => {
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await createCandidateController.create(req, res);

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
      createCandidateController.validationResult.restore();
    });

    it("should return a success response if createCandidateUtil.create is successful", async () => {
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the createCandidateUtil.create function
      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate created successfully",
        data: {
          /* insert candidate data here */
        },
      };
      sinon
        .stub(createCandidateUtil, "create")
        .callsFake((request, callback) => {
          callback(successResponse);
        });

      await createCandidateController.create(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.create.restore();
    });

    it("should return an error response if createCandidateUtil.create returns an error", async () => {
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the createCandidateUtil.create function
      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon
        .stub(createCandidateUtil, "create")
        .callsFake((request, callback) => {
          callback(errorResponse);
        });

      await createCandidateController.create(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.create.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the createCandidateUtil.create function to throw an exception
      sinon
        .stub(createCandidateUtil, "create")
        .throws(new Error("Some unexpected error"));

      await createCandidateController.create(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.create.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await createCandidateController.list(req, res);

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
      createCandidateController.validationResult.restore();
    });

    it("should return a success response if createCandidateUtil.list is successful", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the createCandidateUtil.list function
      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "Candidates listed successfully",
        data: [
          /* insert candidate data here */
        ],
      };
      sinon.stub(createCandidateUtil, "list").resolves(successResponse);

      await createCandidateController.list(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.list.restore();
    });

    it("should return an error response if createCandidateUtil.list returns an error", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the createCandidateUtil.list function
      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon.stub(createCandidateUtil, "list").resolves(errorResponse);

      await createCandidateController.list(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.list.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub the createCandidateUtil.list function to throw an exception
      sinon
        .stub(createCandidateUtil, "list")
        .throws(new Error("Some unexpected error"));

      await createCandidateController.list(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.list.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await createCandidateController.confirm(req, res);

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
      createCandidateController.validationResult.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
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

      await createCandidateController.confirm(req, res);

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
      createCandidateController.validationResult.restore();
      generateFilter.candidates.restore();
    });

    it("should return a success response if createCandidateUtil.confirm is successful", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
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

      // Stub createCandidateUtil.confirm to return a success response
      const successResponseFromConfirm = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate confirmed successfully",
        data: [
          /* insert confirmed candidate data here */
        ],
      };
      sinon
        .stub(createCandidateUtil, "confirm")
        .resolves(successResponseFromConfirm);

      await createCandidateController.confirm(req, res);

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
      createCandidateController.validationResult.restore();
      generateFilter.candidates.restore();
      createCandidateUtil.confirm.restore();
    });

    it("should return an error response if createCandidateUtil.confirm returns an error", async () => {
      const req = {
        body: {},
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
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

      // Stub createCandidateUtil.confirm to return an error response
      const errorResponseFromConfirm = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon
        .stub(createCandidateUtil, "confirm")
        .resolves(errorResponseFromConfirm);

      await createCandidateController.confirm(req, res);

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
      createCandidateController.validationResult.restore();
      generateFilter.candidates.restore();
      createCandidateUtil.confirm.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
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

      // Stub createCandidateUtil.confirm to throw an exception
      sinon
        .stub(createCandidateUtil, "confirm")
        .throws(new Error("Some unexpected error"));

      await createCandidateController.confirm(req, res);

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
      createCandidateController.validationResult.restore();
      generateFilter.candidates.restore();
      createCandidateUtil.confirm.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await createCandidateController.delete(req, res);

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
      createCandidateController.validationResult.restore();
    });

    it("should return a success response if createCandidateUtil.delete is successful", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub createCandidateUtil.delete to return a success response
      const successResponseFromDelete = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate deleted successfully",
        data: [
          /* insert deleted candidate data here */
        ],
      };
      sinon
        .stub(createCandidateUtil, "delete")
        .resolves(successResponseFromDelete);

      await createCandidateController.delete(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.delete.restore();
    });

    it("should return an error response if createCandidateUtil.delete returns an error", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub createCandidateUtil.delete to return an error response
      const errorResponseFromDelete = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon
        .stub(createCandidateUtil, "delete")
        .resolves(errorResponseFromDelete);

      await createCandidateController.delete(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.delete.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub createCandidateUtil.delete to throw an exception
      sinon
        .stub(createCandidateUtil, "delete")
        .throws(new Error("Some unexpected error"));

      await createCandidateController.delete(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.delete.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(false),
        errors: [
          {
            nestedErrors: [
              /* insert nested errors here */
            ],
          },
        ],
      });

      await createCandidateController.update(req, res);

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
      createCandidateController.validationResult.restore();
    });

    it("should return a success response if createCandidateUtil.update is successful", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub createCandidateUtil.update to return a success response
      const successResponseFromUpdate = {
        success: true,
        status: httpStatus.OK,
        message: "Candidate updated successfully",
        data: [
          /* insert updated candidate data here */
        ],
      };
      sinon
        .stub(createCandidateUtil, "update")
        .resolves(successResponseFromUpdate);

      await createCandidateController.update(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.update.restore();
    });

    it("should return an error response if createCandidateUtil.update returns an error", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Force no validation errors
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub createCandidateUtil.update to return an error response
      const errorResponseFromUpdate = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "Some error occurred" },
      };
      sinon
        .stub(createCandidateUtil, "update")
        .resolves(errorResponseFromUpdate);

      await createCandidateController.update(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.update.restore();
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
      sinon.stub(createCandidateController, "validationResult").returns({
        isEmpty: sinon.stub().returns(true),
      });

      // Stub createCandidateUtil.update to throw an exception
      sinon
        .stub(createCandidateUtil, "update")
        .throws(new Error("Some unexpected error"));

      await createCandidateController.update(req, res);

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
      createCandidateController.validationResult.restore();
      createCandidateUtil.update.restore();
    });
  });

  // Add more describe blocks and test cases as needed for other functions...
});
