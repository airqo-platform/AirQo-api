require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const rolePermissionsUtil = require("@utils/role-permissions.util");

const createRole = rewire("@controllers/role.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createRole", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: {}, params: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    createRole.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("list", () => {
    it("should list roles with default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "listRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Roles listed",
        data: [{ role: "Admin" }],
      });

      await createRole.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, roles: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle role list failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "listRole").rejects(new Error("List failed"));

      await createRole.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listSummary", () => {
    it("should list summary roles with default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "listRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Summary roles listed",
        data: [{ role: "Admin" }],
      });

      await createRole.listSummary(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, roles: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.listSummary(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle role list failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "listRole").rejects(new Error("List failed"));

      await createRole.listSummary(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create", () => {
    it("should create role with default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "createRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role created",
        data: { role: "Admin" },
      });

      await createRole.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_role: { role: "Admin" } })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle role creation failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "createRole").rejects(new Error("Create failed"));

      await createRole.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update", () => {
    it("should update role with default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "updateRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role updated",
        data: { role: "Admin" },
      });

      await createRole.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_role: { role: "Admin" } })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle role update failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "updateRole").rejects(new Error("Update failed"));

      await createRole.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete", () => {
    it("should delete role with default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "deleteRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role deleted",
        data: { role: "Admin" },
      });

      await createRole.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_role: { role: "Admin" } })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle role deletion failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "deleteRole").rejects(new Error("Delete failed"));

      await createRole.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listUsersWithRole", () => {
    it("should list users with role for default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "listUsersWithRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users with role listed",
        data: [{ user: "user1" }],
      });

      await createRole.listUsersWithRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, users_with_role: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.listUsersWithRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "listUsersWithRole").rejects(new Error("Failed"));

      await createRole.listUsersWithRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listAvailableUsersForRole", () => {
    it("should list available users for role for default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "listAvailableUsersForRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Available users listed",
        data: [{ user: "user1" }],
      });

      await createRole.listAvailableUsersForRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, available_users: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.listAvailableUsersForRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "listAvailableUsersForRole").rejects(new Error("Failed"));

      await createRole.listAvailableUsersForRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("assignUserToRole", () => {
    it("should assign user to role for default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "assignUserToRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User assigned to role",
        data: { updated: 1 },
      });

      await createRole.assignUserToRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.assignUserToRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "assignUserToRole").rejects(new Error("Failed"));

      await createRole.assignUserToRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("assignManyUsersToRole", () => {
    it("should assign many users to role for default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "assignManyUsersToRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Many users assigned to role",
        data: { updated: 3 },
      });

      await createRole.assignManyUsersToRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.assignManyUsersToRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "assignManyUsersToRole").rejects(new Error("Failed"));

      await createRole.assignManyUsersToRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("unAssignUserFromRole", () => {
    it("should unassign user from role for default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignUserFromRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User unassigned from role",
        data: { unassigned: true },
      });

      await createRole.unAssignUserFromRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.unAssignUserFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignUserFromRole").rejects(new Error("Failed"));

      await createRole.unAssignUserFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("unAssignManyUsersFromRole", () => {
    it("should unassign many users from role for default tenant", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignManyUsersFromRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Many users unassigned from role",
        data: { unassigned: 3 },
      });

      await createRole.unAssignManyUsersFromRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.unAssignManyUsersFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignManyUsersFromRole").rejects(new Error("Failed"));

      await createRole.unAssignManyUsersFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listPermissionsForRole", () => {
    it("should list permissions for role successfully", async () => {
      sinon.stub(rolePermissionsUtil, "listPermissionsForRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permissions listed",
        data: [{ permission: "read" }],
      });

      await createRole.listPermissionsForRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, permissions_list: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.listPermissionsForRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "listPermissionsForRole").rejects(new Error("Failed"));

      await createRole.listPermissionsForRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listAvailablePermissionsForRole", () => {
    it("should list available permissions for role successfully", async () => {
      sinon.stub(rolePermissionsUtil, "listAvailablePermissionsForRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Available permissions listed",
        data: [{ permission: "read" }],
      });

      await createRole.listAvailablePermissionsForRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, available_permissions: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.listAvailablePermissionsForRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "listAvailablePermissionsForRole").rejects(new Error("Failed"));

      await createRole.listAvailablePermissionsForRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("assignPermissionToRole", () => {
    it("should assign permission to role successfully", async () => {
      sinon.stub(rolePermissionsUtil, "assignPermissionsToRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission assigned to role",
        data: { updated: 1 },
      });

      await createRole.assignPermissionToRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.assignPermissionToRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "assignPermissionsToRole").rejects(new Error("Failed"));

      await createRole.assignPermissionToRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("unAssignPermissionFromRole", () => {
    it("should unassign permission from role successfully", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignPermissionFromRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission unassigned from role",
        data: { updated: 1 },
      });

      await createRole.unAssignPermissionFromRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.unAssignPermissionFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignPermissionFromRole").rejects(new Error("Failed"));

      await createRole.unAssignPermissionFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("unAssignManyPermissionsFromRole", () => {
    it("should unassign many permissions from role successfully", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignManyPermissionsFromRole").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Many permissions unassigned from role",
        data: { updated: 3 },
      });

      await createRole.unAssignManyPermissionsFromRole(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.unAssignManyPermissionsFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "unAssignManyPermissionsFromRole").rejects(new Error("Failed"));

      await createRole.unAssignManyPermissionsFromRole(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("updateRolePermissions", () => {
    it("should update role permissions successfully", async () => {
      sinon.stub(rolePermissionsUtil, "updateRolePermissions").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role permissions updated",
        data: { updated: 1 },
      });

      await createRole.updateRolePermissions(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      createRole.__set__("extractErrorsFromRequest", mockBadRequest);

      await createRole.updateRolePermissions(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle failure and return internal server error", async () => {
      sinon.stub(rolePermissionsUtil, "updateRolePermissions").rejects(new Error("Failed"));

      await createRole.updateRolePermissions(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
