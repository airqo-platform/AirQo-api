require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const controlAccessUtil = require("@utils/control-access");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-group-controller`
);
const createGroup = require("@controllers/create-group");

describe("createGroup module", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("list()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should return list of groups if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: [{ group: "group1" }, { group: "group2" }],
      };

      const controlAccessUtilStub = sinon.stub(controlAccessUtil, "listGroup");
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
        params: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          groups: [{ group: "group1" }, { group: "group2" }],
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(controlAccessUtil, "listGroup");
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
        params: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("create()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should create a new group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { group: "new_group" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "createGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          created_group: { group: "new_group" },
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "createGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("update()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should update the group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { updated_group: "updated_group" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "updateGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          updated_group: "updated_group",
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "updateGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("delete()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await removeGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should delete the group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { deleted_group: "deleted_group" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "deleteGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await removeGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          deleted_group: "deleted_group",
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "deleteGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await removeGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("listUsersWithGroup()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await listUsersWithGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should list users with group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { group_members: ["user1", "user2"] },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listUsersWithGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await listUsersWithGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          group_members: ["user1", "user2"],
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listUsersWithGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await listUsersWithGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("listAvailableUsersForGroup()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await listAvailableUsersForGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should list available users for group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { available_users_for_group: ["user1", "user2"] },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listAvailableUsersForGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await listAvailableUsersForGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          available_users_for_group: ["user1", "user2"],
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listAvailableUsersForGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await listAvailableUsersForGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("assignUserToGroup()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await assignUserToGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should assign a user to a group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { assigned_user_to_group: "user1" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "assignUserToGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await assignUserToGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          assigned_user_to_group: "user1",
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "assignUserToGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await assignUserToGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("unAssignUserFromGroup()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await unAssignUserFromGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should unassign a user from a group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { unassigned_user_from_group: "user1" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "unAssignUserFromGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await unAssignUserFromGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          unassigned_user_from_group: "user1",
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "unAssignUserFromGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await unAssignUserFromGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });

  describe("batchAssignUsersToGroup()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request if there are validation errors", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(true);

      const badRequestStub = sinon.stub().returns({
        status: sinon.stub().returns({
          json: sinon.stub().returns({
            success: false,
            message: "bad request errors",
            errors: {},
          }),
        }),
      });

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await batchAssignUsersToGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
    });

    it("should batch assign users to a group if successful", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const successResponse = {
        success: true,
        status: httpStatus.OK,
        message: "success message",
        data: { assigned_users_to_group: ["user1", "user2"] },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "batchAssignUsersToGroup"
      );
      controlAccessUtilStub.returns(successResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await batchAssignUsersToGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: true,
          message: "success message",
          assigned_users_to_group: ["user1", "user2"],
        })
      ).to.be.true;
    });

    it("should handle errors and return internal server error", async () => {
      const validationResultStub = sinon.stub(
        validationResult.prototype,
        "isEmpty"
      );
      validationResultStub.returns(false);

      const errorResponse = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "error message",
        errors: { message: "Internal Server Error" },
      };

      const controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "batchAssignUsersToGroup"
      );
      controlAccessUtilStub.returns(errorResponse);

      const req = {
        query: {},
      };

      const res = {
        status: sinon.stub().returns({
          json: sinon.stub(),
        }),
      };

      await batchAssignUsersToGroup(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.status().json.calledOnce).to.be.true;
      expect(
        res.status().json.calledWithExactly({
          success: false,
          message: "error message",
          errors: { message: "Internal Server Error" },
        })
      ).to.be.true;
    });

    // Add more it blocks for other scenarios if needed
  });
});
