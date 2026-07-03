require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const departmentUtil = require("@utils/department.util");

const createDepartment = rewire("@controllers/department.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createDepartment module", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    createDepartment.__set__("extractErrorsFromRequest", realExtractErrors);
    // Clean up methods we may have added dynamically
    delete departmentUtil.listUsersWithDepartment;
    delete departmentUtil.listAvailableUsersForDepartment;
    delete departmentUtil.assignUserToDepartment;
    delete departmentUtil.unAssignUserFromDepartment;
  });

  describe("list()", () => {
    it("should list departments successfully", async () => {
      sinon.stub(departmentUtil, "listDepartment").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Departments listed successfully",
        data: [{ name: "Department A" }],
      });

      await createDepartment.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Departments listed successfully",
        departments: [{ name: "Department A" }],
      })).to.be.true;
    });

    it("should handle list failure", async () => {
      sinon.stub(departmentUtil, "listDepartment").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to list departments",
        errors: { message: "List error" },
      });

      await createDepartment.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(departmentUtil, "listDepartment").rejects(new Error("Unexpected error"));

      await createDepartment.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create()", () => {
    it("should create a department successfully", async () => {
      sinon.stub(departmentUtil, "createDepartment").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Department created successfully",
        data: { name: "New Department" },
      });

      await createDepartment.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Department created successfully",
        created_department: { name: "New Department" },
      })).to.be.true;
    });

    it("should handle department creation failure", async () => {
      sinon.stub(departmentUtil, "createDepartment").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to create department",
        errors: { message: "Create error" },
      });

      await createDepartment.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(departmentUtil, "createDepartment").rejects(new Error("Unexpected error"));

      await createDepartment.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update()", () => {
    it("should update a department successfully", async () => {
      sinon.stub(departmentUtil, "updateDepartment").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Department updated successfully",
        data: { name: "Updated Department" },
      });

      await createDepartment.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Department updated successfully",
        updated_department: { name: "Updated Department" },
      })).to.be.true;
    });

    it("should handle department update failure", async () => {
      sinon.stub(departmentUtil, "updateDepartment").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to update department",
        errors: { message: "Update error" },
      });

      await createDepartment.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(departmentUtil, "updateDepartment").rejects(new Error("Unexpected error"));

      await createDepartment.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    it("should delete a department successfully", async () => {
      sinon.stub(departmentUtil, "deleteDepartment").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Department deleted successfully",
        data: { name: "Deleted Department" },
      });

      await createDepartment.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Department deleted successfully",
        deleted_department: { name: "Deleted Department" },
      })).to.be.true;
    });

    it("should handle department deletion failure", async () => {
      sinon.stub(departmentUtil, "deleteDepartment").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to delete department",
        errors: { message: "Delete error" },
      });

      await createDepartment.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(departmentUtil, "deleteDepartment").rejects(new Error("Unexpected error"));

      await createDepartment.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listUsersWithDepartment()", () => {
    it("should list users with department successfully", async () => {
      departmentUtil.listUsersWithDepartment = sinon.stub().resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users listed successfully",
        data: [{ user: "user1" }],
      });

      await createDepartment.listUsersWithDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Users listed successfully",
        users_with_department: [{ user: "user1" }],
      })).to.be.true;
    });

    it("should handle listing users with department failure", async () => {
      departmentUtil.listUsersWithDepartment = sinon.stub().resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to list users",
        errors: { message: "Error" },
      });

      await createDepartment.listUsersWithDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.listUsersWithDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      await createDepartment.listUsersWithDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listAvailableUsersForDepartment()", () => {
    it("should list available users for department successfully", async () => {
      departmentUtil.listAvailableUsersForDepartment = sinon.stub().resolves({
        success: true,
        status: httpStatus.OK,
        message: "Available users listed successfully",
        data: [{ user: "user1" }],
      });

      await createDepartment.listAvailableUsersForDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Available users listed successfully",
        available_department_users: [{ user: "user1" }],
      })).to.be.true;
    });

    it("should handle listing available users for department failure", async () => {
      departmentUtil.listAvailableUsersForDepartment = sinon.stub().resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Error" },
      });

      await createDepartment.listAvailableUsersForDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.listAvailableUsersForDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      await createDepartment.listAvailableUsersForDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("assignUserToDepartment()", () => {
    it("should assign user to department successfully", async () => {
      departmentUtil.assignUserToDepartment = sinon.stub().resolves({
        success: true,
        status: httpStatus.OK,
        message: "User assigned successfully",
        data: { user: "user1" },
      });

      await createDepartment.assignUserToDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "User assigned successfully",
        assigned_department_user: { user: "user1" },
      })).to.be.true;
    });

    it("should handle user assignment failure", async () => {
      departmentUtil.assignUserToDepartment = sinon.stub().resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to assign user",
        errors: { message: "Assignment error" },
      });

      await createDepartment.assignUserToDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.assignUserToDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      await createDepartment.assignUserToDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("unAssignUserFromDepartment()", () => {
    it("should unassign user from department successfully", async () => {
      departmentUtil.unAssignUserFromDepartment = sinon.stub().resolves({
        success: true,
        status: httpStatus.OK,
        message: "User unassigned successfully",
        data: { user: "user1" },
      });

      await createDepartment.unAssignUserFromDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "User unassigned successfully",
        unassigned_department_user: { user: "user1" },
      })).to.be.true;
    });

    it("should handle user unassignment failure", async () => {
      departmentUtil.unAssignUserFromDepartment = sinon.stub().resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to unassign user",
        errors: { message: "Unassignment error" },
      });

      await createDepartment.unAssignUserFromDepartment(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createDepartment.__set__("extractErrorsFromRequest", mockBadRequest);

      await createDepartment.unAssignUserFromDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      await createDepartment.unAssignUserFromDepartment(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
