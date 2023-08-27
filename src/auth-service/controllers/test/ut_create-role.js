require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const createRole = require("@controllers/create-role");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const controlAccessUtil = require("@utils/control-access");
const { validationResult } = require("express-validator");

describe("createRole", () => {
  describe("list", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(createRole, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "listRole");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should list roles with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Roles listed successfully.",
        data: [
          { roleId: "role1", roleName: "Admin" },
          { roleId: "role2", roleName: "User" },
        ],
      });

      await createRole.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Roles listed successfully.",
          roles: [
            { roleId: "role1", roleName: "Admin" },
            { roleId: "role2", roleName: "User" },
          ],
        })
      ).to.be.true;
    });

    it("should list roles with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Roles listed successfully.",
        data: [
          { roleId: "role3", roleName: "Manager" },
          { roleId: "role4", roleName: "Guest" },
        ],
      });

      await createRole.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Roles listed successfully.",
          roles: [
            { roleId: "role3", roleName: "Manager" },
            { roleId: "role4", roleName: "Guest" },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid query parameters.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await createRole.list(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle role list failure and return internal server error", async () => {
      const error = new Error("Role list failed.");
      controlAccessUtilStub.rejects(error);

      await createRole.list(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("listSummary", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;
    const defaultTenant = "airqo";

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(listSummary, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "listRole");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should list summary roles with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Summary roles listed successfully.",
        data: [
          { roleId: "role1", roleName: "Admin" },
          { roleId: "role2", roleName: "User" },
        ],
      });

      await listSummary(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Summary roles listed successfully.",
          roles: [
            { roleId: "role1", roleName: "Admin" },
            { roleId: "role2", roleName: "User" },
          ],
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(defaultTenant);
      expect(req.query.category).to.equal("summary");
    });

    it("should list summary roles with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Summary roles listed successfully.",
        data: [
          { roleId: "role3", roleName: "Manager" },
          { roleId: "role4", roleName: "Guest" },
        ],
      });

      await listSummary(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Summary roles listed successfully.",
          roles: [
            { roleId: "role3", roleName: "Manager" },
            { roleId: "role4", roleName: "Guest" },
          ],
        })
      ).to.be.true;
      expect(req.query.category).to.equal("summary");
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await listSummary(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle role list failure and return internal server error", async () => {
      const error = new Error("Role list failed.");
      controlAccessUtilStub.rejects(error);

      await listSummary(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("create", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(createRole, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "createRole");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should create role with default tenant", async () => {
      req.body = {
        // Set the required properties for role creation.
        roleName: "Administrator",
        permissions: ["read", "write"],
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role created successfully.",
        data: {
          roleId: "role1",
          roleName: "Administrator",
          permissions: ["read", "write"],
        },
      });

      await createRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Role created successfully.",
          created_role: {
            roleId: "role1",
            roleName: "Administrator",
            permissions: ["read", "write"],
          },
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should create role with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      req.body = {
        // Set the required properties for role creation.
        roleName: "Manager",
        permissions: ["read"],
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role created successfully.",
        data: {
          roleId: "role2",
          roleName: "Manager",
          permissions: ["read"],
        },
      });

      await createRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Role created successfully.",
          created_role: {
            roleId: "role2",
            roleName: "Manager",
            permissions: ["read"],
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await createRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle role creation failure and return internal server error", async () => {
      const error = new Error("Role creation failed.");
      controlAccessUtilStub.rejects(error);

      await createRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
  describe("update", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(updateRole, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "updateRole");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should update role with default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId to update the role.
      req.body = {
        // Set the properties to update for the role.
        roleName: "Administrator",
        permissions: ["read", "write"],
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role updated successfully.",
        data: {
          roleId: "role1",
          roleName: "Administrator",
          permissions: ["read", "write"],
        },
      });

      await updateRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Role updated successfully.",
          updated_role: {
            roleId: "role1",
            roleName: "Administrator",
            permissions: ["read", "write"],
          },
          success: true,
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should update role with custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId to update the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      req.body = {
        // Set the properties to update for the role.
        roleName: "Manager",
        permissions: ["read"],
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role updated successfully.",
        data: {
          roleId: "role2",
          roleName: "Manager",
          permissions: ["read"],
        },
      });

      await updateRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Role updated successfully.",
          updated_role: {
            roleId: "role2",
            roleName: "Manager",
            permissions: ["read"],
          },
          success: true,
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await updateRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle role update failure and return internal server error", async () => {
      const error = new Error("Role update failed.");
      controlAccessUtilStub.rejects(error);

      await updateRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("delete", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(deleteRole, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "deleteRole");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should delete role with default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId to delete the role.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role deleted successfully.",
        data: {
          roleId: "role1",
          roleName: "Administrator",
          permissions: ["read", "write"],
        },
      });

      await deleteRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Role deleted successfully.",
          deleted_role: {
            roleId: "role1",
            roleName: "Administrator",
            permissions: ["read", "write"],
          },
          success: true,
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should delete role with custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId to delete the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role deleted successfully.",
        data: {
          roleId: "role2",
          roleName: "Manager",
          permissions: ["read"],
        },
      });

      await deleteRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Role deleted successfully.",
          deleted_role: {
            roleId: "role2",
            roleName: "Manager",
            permissions: ["read"],
          },
          success: true,
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await deleteRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle role deletion failure and return internal server error", async () => {
      const error = new Error("Role deletion failed.");
      controlAccessUtilStub.rejects(error);

      await deleteRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("listUsersWithRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(listUsersWithRole, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listUsersWithRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should list users with role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId to list users with the role.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users with role listed successfully.",
        data: [
          {
            userId: "user1",
            username: "user1@example.com",
            role: "Administrator",
          },
          { userId: "user2", username: "user2@example.com", role: "Manager" },
        ],
      });

      await listUsersWithRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Users with role listed successfully.",
          users_with_role: [
            {
              userId: "user1",
              username: "user1@example.com",
              role: "Administrator",
            },
            { userId: "user2", username: "user2@example.com", role: "Manager" },
          ],
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should list users with role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId to list users with the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users with role listed successfully.",
        data: [
          { userId: "user3", username: "user3@example.com", role: "Viewer" },
        ],
      });

      await listUsersWithRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Users with role listed successfully.",
          users_with_role: [
            { userId: "user3", username: "user3@example.com", role: "Viewer" },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await listUsersWithRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle listing users with role failure and return internal server error", async () => {
      const error = new Error("Failed to list users with role.");
      controlAccessUtilStub.rejects(error);

      await listUsersWithRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("listAvailableUsersForRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(listAvailableUsersForRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listAvailableUsersForRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should list available users for role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId to list available users for the role.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Available users listed successfully.",
        data: [
          { userId: "user1", username: "user1@example.com", role: "Viewer" },
          { userId: "user2", username: "user2@example.com", role: "Manager" },
        ],
      });

      await listAvailableUsersForRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Available users listed successfully.",
          available_users: [
            { userId: "user1", username: "user1@example.com", role: "Viewer" },
            { userId: "user2", username: "user2@example.com", role: "Manager" },
          ],
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should list available users for role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId to list available users for the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Available users listed successfully.",
        data: [
          {
            userId: "user3",
            username: "user3@example.com",
            role: "Administrator",
          },
        ],
      });

      await listAvailableUsersForRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Available users listed successfully.",
          available_users: [
            {
              userId: "user3",
              username: "user3@example.com",
              role: "Administrator",
            },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await listAvailableUsersForRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle listing available users for role failure and return internal server error", async () => {
      const error = new Error("Failed to list available users for role.");
      controlAccessUtilStub.rejects(error);

      await listAvailableUsersForRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("assignUserToRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;
    let logTextStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(assignUserToRole, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "assignUserToRole");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
      logTextStub = sinon.stub(require("@utils/log"), "logText");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
      logTextStub.restore();
    });

    it("should assign user to role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId for user assignment.
      req.body.userId = "user1"; // Set the userId to be assigned to the role.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: { updatedRoleId: "role1", userId: "user1" },
      });

      await assignUserToRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          updated_records: { updatedRoleId: "role1", userId: "user1" },
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
      expect(logTextStub.calledOnceWith("assignUserToRole...")).to.be.true;
    });

    it("should assign user to role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId for user assignment.
      req.body.userId = "user2"; // Set the userId to be assigned to the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: { updatedRoleId: "role2", userId: "user2" },
      });

      await assignUserToRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          updated_records: { updatedRoleId: "role2", userId: "user2" },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await assignUserToRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle assigning user to role failure and return internal server error", async () => {
      const error = new Error("Failed to assign user to role.");
      controlAccessUtilStub.rejects(error);

      await assignUserToRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("assignManyUsersToRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;
    let logTextStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(assignManyUsersToRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "assignManyUsersToRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
      logTextStub = sinon.stub(require("@utils/log"), "logText");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
      logTextStub.restore();
    });

    it("should assign many users to role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId for user assignment.
      req.body.userIds = ["user1", "user2"]; // Set the userIds to be assigned to the role.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: { updatedRoleIds: ["role1"], userIds: ["user1", "user2"] },
      });

      await assignManyUsersToRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully assigned many users to the role",
          updated_records: {
            updatedRoleIds: ["role1"],
            userIds: ["user1", "user2"],
          },
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
      expect(logTextStub.calledOnceWith("assignManyUsersToRole...")).to.be.true;
    });

    it("should assign many users to role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId for user assignment.
      req.body.userIds = ["user3", "user4"]; // Set the userIds to be assigned to the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: { updatedRoleIds: ["role2"], userIds: ["user3", "user4"] },
      });

      await assignManyUsersToRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully assigned many users to the role",
          updated_records: {
            updatedRoleIds: ["role2"],
            userIds: ["user3", "user4"],
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await assignManyUsersToRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle assigning many users to role failure and return internal server error", async () => {
      const error = new Error("Failed to assign many users to role.");
      controlAccessUtilStub.rejects(error);

      await assignManyUsersToRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("unAssignUserFromRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(unAssignUserFromRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "unAssignUserFromRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should unassign user from role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId from which to unassign the user.
      req.query.userId = "user1"; // Set the userId to unassign from the role.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: { unassignedRoleId: "role1", userId: "user1" },
      });

      await unAssignUserFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully unassigned user from the role",
          user_unassigned: { unassignedRoleId: "role1", userId: "user1" },
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should unassign user from role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId from which to unassign the user.
      req.query.userId = "user2"; // Set the userId to unassign from the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: { unassignedRoleId: "role2", userId: "user2" },
      });

      await unAssignUserFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully unassigned user from the role",
          user_unassigned: { unassignedRoleId: "role2", userId: "user2" },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await unAssignUserFromRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle unassigning user from role failure and return internal server error", async () => {
      const error = new Error("Failed to unassign user from role.");
      controlAccessUtilStub.rejects(error);

      await unAssignUserFromRole(req, res);

      expect(logObjectStub.calledOnceWith("zi error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("unAssignManyUsersFromRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(unAssignManyUsersFromRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "unAssignManyUsersFromRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should unassign many users from role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId from which to unassign many users.
      req.body.userIds = ["user1", "user2", "user3"]; // Set an array of userIds to unassign from the role.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: {
          unassignedRoleId: "role1",
          userIds: ["user1", "user2", "user3"],
        },
      });

      await unAssignManyUsersFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully unassigned many users from the role",
          updated_records: {
            unassignedRoleId: "role1",
            userIds: ["user1", "user2", "user3"],
          },
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should unassign many users from role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId from which to unassign many users.
      req.body.userIds = ["user4", "user5"]; // Set an array of userIds to unassign from the role.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: { unassignedRoleId: "role2", userIds: ["user4", "user5"] },
      });

      await unAssignManyUsersFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully unassigned many users from the role",
          updated_records: {
            unassignedRoleId: "role2",
            userIds: ["user4", "user5"],
          },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await unAssignManyUsersFromRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle unassigning many users from role failure and return internal server error", async () => {
      const error = new Error("Failed to unassign many users from role.");
      controlAccessUtilStub.rejects(error);

      await unAssignManyUsersFromRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("listPermissionsForRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(listPermissionsForRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listPermissionsForRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should list permissions for role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId for which to list permissions.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["permission1", "permission2", "permission3"], // Set the list of permissions returned by the controlAccessUtil.
      });

      await listPermissionsForRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully listed the permissions for the role",
          permissions_list: ["permission1", "permission2", "permission3"],
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should list permissions for role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId for which to list permissions.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["permission4", "permission5"], // Set the list of permissions returned by the controlAccessUtil.
      });

      await listPermissionsForRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully listed the permissions for the role",
          permissions_list: ["permission4", "permission5"],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await listPermissionsForRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle listing permissions for role failure and return internal server error", async () => {
      const error = new Error("Failed to list permissions for role.");
      controlAccessUtilStub.rejects(error);

      await listPermissionsForRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("listAvailablePermissionsForRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(listAvailablePermissionsForRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "listAvailablePermissionsForRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should list available permissions for role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId for which to list available permissions.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["permission1", "permission2", "permission3"], // Set the list of available permissions returned by the controlAccessUtil.
      });

      await listAvailablePermissionsForRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully listed the available permissions for the role",
          available_permissions: ["permission1", "permission2", "permission3"],
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should list available permissions for role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId for which to list available permissions.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["permission4", "permission5"], // Set the list of available permissions returned by the controlAccessUtil.
      });

      await listAvailablePermissionsForRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "successfully listed the available permissions for the role",
          available_permissions: ["permission4", "permission5"],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await listAvailablePermissionsForRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle listing available permissions for role failure and return internal server error", async () => {
      const error = new Error("Failed to list available permissions for role.");
      controlAccessUtilStub.rejects(error);

      await listAvailablePermissionsForRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("assignPermissionToRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(assignPermissionToRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "assignPermissionsToRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should assign permissions to role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId to which permissions need to be assigned.
      req.body.permissions = ["permission1", "permission2"]; // Set the permissions to be assigned.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "updatedRole1", // Set the updated role returned by the controlAccessUtil.
      });

      await assignPermissionToRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permissions assigned to the role successfully",
          updated_role: "updatedRole1",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should assign permissions to role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId to which permissions need to be assigned.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      req.body.permissions = ["permission3"]; // Set the permissions to be assigned.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "updatedRole2", // Set the updated role returned by the controlAccessUtil.
      });

      await assignPermissionToRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permissions assigned to the role successfully",
          updated_role: "updatedRole2",
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await assignPermissionToRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle assigning permissions to role failure and return internal server error", async () => {
      const error = new Error("Failed to assign permissions to role.");
      controlAccessUtilStub.rejects(error);

      await assignPermissionToRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("unAssignPermissionFromRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(unAssignPermissionFromRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "unAssignPermissionFromRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should unassign permission from role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId from which the permission needs to be unassigned.
      req.query.permissionId = "permission1"; // Set the permissionId to be unassigned.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "modifiedRole1", // Set the modified role returned by the controlAccessUtil.
      });

      await unAssignPermissionFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission unassigned from the role successfully",
          modified_role: "modifiedRole1",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should unassign permission from role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId from which the permission needs to be unassigned.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      req.query.permissionId = "permission2"; // Set the permissionId to be unassigned.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "modifiedRole2", // Set the modified role returned by the controlAccessUtil.
      });

      await unAssignPermissionFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission unassigned from the role successfully",
          modified_role: "modifiedRole2",
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await unAssignPermissionFromRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle unassigning permission from role failure and return internal server error", async () => {
      const error = new Error("Failed to unassign permission from role.");
      controlAccessUtilStub.rejects(error);

      await unAssignPermissionFromRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("unAssignManyPermissionsFromRole", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(unAssignManyPermissionsFromRole, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "unAssignManyPermissionsFromRole"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should unassign many permissions from role for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId from which the permissions need to be unassigned.
      req.body.permissionIds = ["permission1", "permission2"]; // Set the array of permissionIds to be unassigned.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "modifiedRole1", // Set the modified role returned by the controlAccessUtil.
      });

      await unAssignManyPermissionsFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permissions unassigned from the role successfully",
          modified_role: "modifiedRole1",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should unassign many permissions from role for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId from which the permissions need to be unassigned.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      req.body.permissionIds = ["permission3", "permission4"]; // Set the array of permissionIds to be unassigned.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "modifiedRole2", // Set the modified role returned by the controlAccessUtil.
      });

      await unAssignManyPermissionsFromRole(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permissions unassigned from the role successfully",
          modified_role: "modifiedRole2",
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await unAssignManyPermissionsFromRole(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle unassigning many permissions from role failure and return internal server error", async () => {
      const error = new Error("Failed to unassign permissions from role.");
      controlAccessUtilStub.rejects(error);

      await unAssignManyPermissionsFromRole(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
  describe("updateRolePermissions", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logObjectStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon
        .stub(updateRolePermissions, "badRequest")
        .returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "updateRolePermissions"
      );
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should update role permissions for default tenant", async () => {
      req.query.roleId = "role1"; // Set the roleId for which the permissions need to be updated.
      req.body.permissionIds = ["permission1", "permission2"]; // Set the array of permissionIds to be updated.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "modifiedRole1", // Set the modified role returned by the controlAccessUtil.
      });

      await updateRolePermissions(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Role permissions updated successfully",
          modified_role: "modifiedRole1",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should update role permissions for custom tenant", async () => {
      req.query.roleId = "role2"; // Set the roleId for which the permissions need to be updated.
      req.query.tenant = "custom-tenant"; // Set the custom tenant for the request.
      req.body.permissionIds = ["permission3", "permission4"]; // Set the array of permissionIds to be updated.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "modifiedRole2", // Set the modified role returned by the controlAccessUtil.
      });

      await updateRolePermissions(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Role permissions updated successfully",
          modified_role: "modifiedRole2",
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await updateRolePermissions(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle updating role permissions failure and return internal server error", async () => {
      const error = new Error("Failed to update role permissions.");
      controlAccessUtilStub.rejects(error);

      await updateRolePermissions(req, res);

      expect(logObjectStub.calledOnceWith("error", error)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
});
