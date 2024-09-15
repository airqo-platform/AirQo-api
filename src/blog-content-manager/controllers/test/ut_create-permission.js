require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const createPermission = require("@controllers/create-permission");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const controlAccessUtil = require("@utils/control-access");
const { validationResult } = require("express-validator");

describe("createPermission", () => {
  describe("create", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;
    let logTextStub;
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

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(createPermission, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "createPermission");
      logTextStub = sinon.stub(require("@utils/log"), "logText");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logTextStub.restore();
      logObjectStub.restore();
    });

    it("should create permission with default tenant and empty data", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission created successfully.",
        data: [],
      });

      await createPermission.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission created successfully.",
          created_permission: [],
        })
      ).to.be.true;
    });

    it("should create permission with custom tenant and non-empty data", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission created successfully.",
        data: [
          {
            permissionId: "perm1",
            permissionName: "Read",
          },
          {
            permissionId: "perm2",
            permissionName: "Write",
          },
        ],
      });

      await createPermission.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission created successfully.",
          created_permission: [
            {
              permissionId: "perm1",
              permissionName: "Read",
            },
            {
              permissionId: "perm2",
              permissionName: "Write",
            },
          ],
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      const validationError = {
        isEmpty: () => false,
        errors: [
          {
            msg: "Invalid permission data.",
            nestedErrors: null,
          },
        ],
      };
      validationResultStub.returns(validationError);
      require("express-validator").validationResult = validationResultStub;

      await createPermission.create(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle permission creation failure and return internal server error", async () => {
      const error = new Error("Permission creation failed.");
      controlAccessUtilStub.rejects(error);

      await createPermission.create(req, res);

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
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(listFunction, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "listPermission");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should list permissions with default tenant and empty data", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permissions listed successfully.",
        data: [],
      });

      await listFunction.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permissions listed successfully.",
          permissions: [],
        })
      ).to.be.true;
    });

    it("should list permissions with custom tenant and non-empty data", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permissions listed successfully.",
        data: [
          {
            permissionId: "perm1",
            permissionName: "Read",
          },
          {
            permissionId: "perm2",
            permissionName: "Write",
          },
        ],
      });

      await listFunction.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permissions listed successfully.",
          permissions: [
            {
              permissionId: "perm1",
              permissionName: "Read",
            },
            {
              permissionId: "perm2",
              permissionName: "Write",
            },
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

      await listFunction.list(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle permission listing failure and return internal server error", async () => {
      const error = new Error("Permission listing failed.");
      controlAccessUtilStub.rejects(error);

      await listFunction.list(req, res);

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

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(deleteFunction, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "deletePermission");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should delete permission with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission deleted successfully.",
        data: {
          permissionId: "perm1",
          permissionName: "Read",
        },
      });

      await deleteFunction.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission deleted successfully.",
          deleted_permission: {
            permissionId: "perm1",
            permissionName: "Read",
          },
        })
      ).to.be.true;
    });

    it("should delete permission with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission deleted successfully.",
        data: {
          permissionId: "perm2",
          permissionName: "Write",
        },
      });

      await deleteFunction.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission deleted successfully.",
          deleted_permission: {
            permissionId: "perm2",
            permissionName: "Write",
          },
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

      await deleteFunction.delete(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle permission deletion failure and return internal server error", async () => {
      const error = new Error("Permission deletion failed.");
      controlAccessUtilStub.rejects(error);

      await deleteFunction.delete(req, res);

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

      validationResultStub = sinon.stub();
      badRequestStub = sinon.stub(updateFunction, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "updatePermission");
      logObjectStub = sinon.stub(require("@utils/log"), "logObject");
    });

    afterEach(() => {
      badRequestStub.restore();
      controlAccessUtilStub.restore();
      logObjectStub.restore();
    });

    it("should update permission with default tenant", async () => {
      req.query = {}; // Empty query object, default tenant should be used.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission updated successfully.",
        data: {
          permissionId: "perm1",
          permissionName: "Read",
        },
      });

      await updateFunction.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission updated successfully.",
          updated_permission: {
            permissionId: "perm1",
            permissionName: "Read",
          },
        })
      ).to.be.true;
    });

    it("should update permission with custom tenant", async () => {
      req.query = {
        tenant: "custom-tenant",
      };
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission updated successfully.",
        data: {
          permissionId: "perm2",
          permissionName: "Write",
        },
      });

      await updateFunction.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Permission updated successfully.",
          updated_permission: {
            permissionId: "perm2",
            permissionName: "Write",
          },
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

      await updateFunction.update(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(validationError.errors[0].nestedErrors)
        )
      ).to.be.true;
    });

    it("should handle permission update failure and return internal server error", async () => {
      const error = new Error("Permission update failed.");
      controlAccessUtilStub.rejects(error);

      await updateFunction.update(req, res);

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
});
