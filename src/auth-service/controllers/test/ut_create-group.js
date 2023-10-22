require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-group-controller`
);
const createGroup = require("@controllers/create-group");
const createGroupUtil = require("@utils/create-group");

describe("createGroup module", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("removeUniqueConstraint", () => {
    let req, res;

    beforeEach(() => {
      // Initialize req and res for each test
      req = {
        query: {},
      };
      res = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should remove unique constraints and return a success response", async () => {
      // Mock your validation library function to return an empty validation result
      sinon.stub(validationResult(req), "isEmpty").returns(true);

      // Mock the createGroupUtil.removeUniqueConstraint function to return a success response
      sinon.stub(createGroupUtil, "removeUniqueConstraint").resolves({
        success: true,
        status: 200,
      });

      // Call the function
      await createGroupUtil.removeUniqueConstraint(req, res);

      // Assertions
      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message:
          "successfully removed all the unique constraints in this migration",
      });

      // Restore the stubbed functions to their original implementations
      validationResult(req).isEmpty.restore();
      createGroupUtil.removeUniqueConstraint.restore();
    });

    it("should handle validation errors and return a bad request response", async () => {
      // Mock your validation library function to return a non-empty validation result
      sinon.stub(validationResult(req), "isEmpty").returns(false);
      sinon.stub(validationResult(req), "errors").value([
        {
          nestedErrors: [{ msg: "First error" }, { msg: "Second error" }],
        },
      ]);

      // Call the function
      await createGroupUtil.removeUniqueConstraint(req, res);

      // Assertions
      expect(res.status).to.have.been.calledWith(400);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "bad request errors",
        errors: {
          0: "First error",
          1: "Second error",
        },
      });

      // Restore the stubbed functions to their original implementations
      validationResult(req).isEmpty.restore();
    });

    it("should handle errors from removeUniqueConstraint and return an error response", async () => {
      // Mock your validation library function to return an empty validation result
      sinon.stub(validationResult(req), "isEmpty").returns(true);

      // Mock the createGroupUtil.removeUniqueConstraint function to return an error response
      sinon
        .stub(createGroupUtil, "removeUniqueConstraint")
        .rejects(new Error("Test error"));

      // Call the function
      await createGroupUtil.removeUniqueConstraint(req, res);

      // Assertions
      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Test error",
        },
      });

      // Restore the stubbed functions to their original implementations
      validationResult(req).isEmpty.restore();
      createGroupUtil.removeUniqueConstraint.restore();
    });
  });

  describe("list Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the list function
      const response = await createGroup.list(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.list to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "list");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the list function
      const response = await createGroup.list(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.list to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "list");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the list function
      const response = await createGroup.list(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("create Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the create function
      const response = await createGroup.create(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.create to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "create");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the create function
      const response = await createGroup.create(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.create to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "create");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the create function
      const response = await createGroup.create(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("update Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the update function
      const response = await createGroup.update(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.update to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "update");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the update function
      const response = await createGroup.update(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.update to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "update");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the update function
      const response = await createGroup.update(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("delete Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the delete function
      const response = await createGroup.delete(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.delete to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "delete");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the delete function
      const response = await createGroup.delete(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.delete to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "delete");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the delete function
      const response = await createGroup.delete(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("assignUsers Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the assignUsers function
      const response = await createGroup.assignUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.assignUsers to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "assignUsers");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the assignUsers function
      const response = await createGroup.assignUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.assignUsers to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "assignUsers");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the assignUsers function
      const response = await createGroup.assignUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("assignOneUser Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the assignOneUser function
      const response = await createGroup.assignOneUser(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.assignOneUser to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "assignOneUser");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the assignOneUser function
      const response = await createGroup.assignOneUser(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.assignOneUser to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "assignOneUser");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the assignOneUser function
      const response = await createGroup.assignOneUser(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("unAssignUser Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the unAssignUser function
      const response = await createGroup.unAssignUser(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.unAssignUser to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "unAssignUser");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the unAssignUser function
      const response = await createGroup.unAssignUser(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.unAssignUser to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "unAssignUser");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the unAssignUser function
      const response = await createGroup.unAssignUser(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("unAssignManyUsers Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the unAssignManyUsers function
      const response = await createGroup.unAssignManyUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.unAssignManyUsers to return a successful response
      const createGroupUtilStub = sinon.stub(
        createGroupUtil,
        "unAssignManyUsers"
      );
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the unAssignManyUsers function
      const response = await createGroup.unAssignManyUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.unAssignManyUsers to throw an error
      const createGroupUtilStub = sinon.stub(
        createGroupUtil,
        "unAssignManyUsers"
      );
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the unAssignManyUsers function
      const response = await createGroup.unAssignManyUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("listAssignedUsers Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listAssignedUsers function
      const response = await createGroup.listAssignedUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.listUsersWithGroup to return a successful response
      const createGroupUtilStub = sinon.stub(
        createGroupUtil,
        "listUsersWithGroup"
      );
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listAssignedUsers function
      const response = await createGroup.listAssignedUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.listUsersWithGroup to throw an error
      const createGroupUtilStub = sinon.stub(
        createGroupUtil,
        "listUsersWithGroup"
      );
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listAssignedUsers function
      const response = await createGroup.listAssignedUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("listAvailableUsers Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listAvailableUsers function
      const response = await createGroup.listAvailableUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.listAvailableUsersForGroup to return a successful response
      const createGroupUtilStub = sinon.stub(
        createGroupUtil,
        "listAvailableUsersForGroup"
      );
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listAvailableUsers function
      const response = await createGroup.listAvailableUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.listAvailableUsersForGroup to throw an error
      const createGroupUtilStub = sinon.stub(
        createGroupUtil,
        "listAvailableUsersForGroup"
      );
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listAvailableUsers function
      const response = await createGroup.listAvailableUsers(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });

  describe("listSummary Function", () => {
    it("should return a bad request response when validation errors occur", async () => {
      // Mock validationResult to return validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(false);
      validationResultStub.onCall(0).returns(true); // Simulate non-empty validationResult

      // Mock the request object
      const req = {
        /* Mocked request object with validation errors */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listSummary function
      const response = await createGroup.listSummary(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
    });

    it("should return a success response when the request is valid", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.list to return a successful response
      const createGroupUtilStub = sinon.stub(createGroupUtil, "list");
      createGroupUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Success Message",
        data: [
          {
            /* Mocked data */
          },
        ],
      });

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listSummary function
      const response = await createGroup.listSummary(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.success).to.equal(true);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock validationResult to return no validation errors
      const validationResultStub = sinon.stub(validationResult, "isEmpty");
      validationResultStub.returns(true);

      // Mock createGroupUtil.list to throw an error
      const createGroupUtilStub = sinon.stub(createGroupUtil, "list");
      createGroupUtilStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const req = {
        /* Mocked request object */
      };
      const res = {
        /* Mocked response object */
      };

      // Call the listSummary function
      const response = await createGroup.listSummary(req, res);

      // Assertions
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.success).to.equal(false);
      // Add more assertions as needed
      // ...

      // Restore stubs
      validationResultStub.restore();
      createGroupUtilStub.restore();
    });

    // Add more test cases for different scenarios
  });
});
