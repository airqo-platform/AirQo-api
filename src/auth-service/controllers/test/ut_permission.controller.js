require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const httpStatus = require("http-status");
const rewire = require("rewire");
const rolePermissionsUtil = require("@utils/role-permissions.util");

const createPermission = rewire("@controllers/permission.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createPermission", () => {
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
    createPermission.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create()", () => {
    it("should create permission successfully", async () => {
      sinon.stub(rolePermissionsUtil, "createPermission").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission created successfully.",
        data: { permissionId: "perm1", permissionName: "Read" },
      });

      await createPermission.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_permission: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createPermission.__set__("extractErrorsFromRequest", mockBadRequest);

      await createPermission.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle creation failure", async () => {
      sinon.stub(rolePermissionsUtil, "createPermission").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Creation failed",
        errors: { message: "Error" },
      });

      await createPermission.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(rolePermissionsUtil, "createPermission").rejects(new Error("Unexpected error"));

      await createPermission.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list()", () => {
    it("should list permissions successfully", async () => {
      sinon.stub(rolePermissionsUtil, "listPermission").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permissions listed successfully.",
        data: [{ permissionId: "perm1", permissionName: "Read" }],
      });

      await createPermission.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, permissions: sinon.match.array })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createPermission.__set__("extractErrorsFromRequest", mockBadRequest);

      await createPermission.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle listing failure", async () => {
      sinon.stub(rolePermissionsUtil, "listPermission").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Listing failed",
        errors: { message: "Error" },
      });

      await createPermission.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(rolePermissionsUtil, "listPermission").rejects(new Error("Unexpected error"));

      await createPermission.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    it("should delete permission successfully", async () => {
      sinon.stub(rolePermissionsUtil, "deletePermission").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission deleted successfully.",
        data: { permissionId: "perm1", permissionName: "Read" },
      });

      await createPermission.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_permission: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createPermission.__set__("extractErrorsFromRequest", mockBadRequest);

      await createPermission.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle deletion failure", async () => {
      sinon.stub(rolePermissionsUtil, "deletePermission").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Deletion failed",
        errors: { message: "Error" },
      });

      await createPermission.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(rolePermissionsUtil, "deletePermission").rejects(new Error("Unexpected error"));

      await createPermission.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update()", () => {
    it("should update permission successfully", async () => {
      sinon.stub(rolePermissionsUtil, "updatePermission").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission updated successfully.",
        data: { permissionId: "perm1", permissionName: "Write" },
      });

      await createPermission.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_permission: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createPermission.__set__("extractErrorsFromRequest", mockBadRequest);

      await createPermission.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle update failure", async () => {
      sinon.stub(rolePermissionsUtil, "updatePermission").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Update failed",
        errors: { message: "Error" },
      });

      await createPermission.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(rolePermissionsUtil, "updatePermission").rejects(new Error("Unexpected error"));

      await createPermission.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
