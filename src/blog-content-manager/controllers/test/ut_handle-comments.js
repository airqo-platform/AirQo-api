require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");

const createDepartment = require("@controllers/create-department");
const controlAccessUtil = require("@utils/control-access");

describe("createDepartment module", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("list()", () => {
    it("should list departments successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Departments listed successfully",
          data: [{ name: "Department A" }, { name: "Department B" }],
        });

      await createDepartment.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Departments listed successfully",
          departments: [{ name: "Department A" }, { name: "Department B" }],
        })
      ).to.be.true;
    });

    it("should handle list failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to list departments",
          errors: { message: "Department listing error" },
        });

      await createDepartment.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to list departments",
          errors: { message: "Department listing error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
  describe("create()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should create a department successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "createDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Department created successfully",
          data: { name: "New Department" },
        });

      await createDepartment.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Department created successfully",
          created_department: { name: "New Department" },
        })
      ).to.be.true;
    });

    it("should handle department creation failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "createDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to create department",
          errors: { message: "Department creation error" },
        });

      await createDepartment.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to create department",
          errors: { message: "Department creation error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
  describe("update()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should update a department successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "updateDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Department updated successfully",
          data: { name: "Updated Department" },
        });

      await createDepartment.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Department updated successfully",
          updated_department: { name: "Updated Department" },
        })
      ).to.be.true;
    });

    it("should handle department update failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "updateDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to update department",
          errors: { message: "Department update error" },
        });

      await createDepartment.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to update department",
          errors: { message: "Department update error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
  describe(" delete()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should delete a department successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "deleteDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Department deleted successfully",
          data: { name: "Deleted Department" },
        });

      await createDepartment.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Department deleted successfully",
          deleted_department: { name: "Deleted Department" },
        })
      ).to.be.true;
    });

    it("should handle department deletion failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "deleteDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to delete department",
          errors: { message: "Department deletion error" },
        });

      await createDepartment.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to delete department",
          errors: { message: "Department deletion error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
  describe("listUsersWithDepartment()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should list users with department successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listUsersWithDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Users with department listed successfully",
          data: [{ name: "User 1" }, { name: "User 2" }],
        });

      await createDepartment.listUsersWithDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Users with department listed successfully",
          users_with_department: [{ name: "User 1" }, { name: "User 2" }],
        })
      ).to.be.true;
    });

    it("should handle listing users with department failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listUsersWithDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to list users with department",
          errors: { message: "List users error" },
        });

      await createDepartment.listUsersWithDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to list users with department",
          errors: { message: "List users error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.listUsersWithDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.listUsersWithDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
  describe("listAvailableUsersForDepartment()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should list available users for department successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listAvailableUsersForDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Available users for department listed successfully",
          data: [{ name: "User 1" }, { name: "User 2" }],
        });

      await createDepartment.listAvailableUsersForDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Available users for department listed successfully",
          available_department_users: [{ name: "User 1" }, { name: "User 2" }],
        })
      ).to.be.true;
    });

    it("should handle listing available users for department failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listAvailableUsersForDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to list available users for department",
          errors: { message: "List available users error" },
        });

      await createDepartment.listAvailableUsersForDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to list available users for department",
          errors: { message: "List available users error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.listAvailableUsersForDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.listAvailableUsersForDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
  describe("assignUserToDepartment()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should assign user to department successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "assignUserToDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "User assigned to department successfully",
          data: { userId: "user123", departmentId: "dept456" },
        });

      await createDepartment.assignUserToDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "User assigned to department successfully",
          assigned_department_user: {
            userId: "user123",
            departmentId: "dept456",
          },
        })
      ).to.be.true;
    });

    it("should handle user assignment failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "assignUserToDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to assign user to department",
          errors: { message: "User assignment error" },
        });

      await createDepartment.assignUserToDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to assign user to department",
          errors: { message: "User assignment error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.assignUserToDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.assignUserToDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
  describe("unAssignUserFromDepartment()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should unassign user from department successfully", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "unAssignUserFromDepartment")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "User unassigned from department successfully",
          data: { userId: "user123", departmentId: "dept456" },
        });

      await createDepartment.unAssignUserFromDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "User unassigned from department successfully",
          unassigned_department_user: {
            userId: "user123",
            departmentId: "dept456",
          },
        })
      ).to.be.true;
    });

    it("should handle user unassignment failure", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "unAssignUserFromDepartment")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to unassign user from department",
          errors: { message: "User unassignment error" },
        });

      await createDepartment.unAssignUserFromDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to unassign user from department",
          errors: { message: "User unassignment error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await createDepartment.unAssignUserFromDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await createDepartment.unAssignUserFromDepartment(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
});
