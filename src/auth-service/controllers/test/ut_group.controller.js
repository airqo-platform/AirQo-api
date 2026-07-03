require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const createGroupUtil = require("@utils/group.util");

const createGroup = rewire("@controllers/group.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createGroup Module", () => {
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
    createGroup.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("removeUniqueConstraint", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "removeUniqueConstraint").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Unique constraints removed",
        data: {},
      });

      await createGroup.removeUniqueConstraint(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.removeUniqueConstraint(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "removeUniqueConstraint").rejects(new Error("Internal error"));

      await createGroup.removeUniqueConstraint(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Groups listed successfully",
        data: [{ grp_title: "Group 1" }],
      });

      await createGroup.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, groups: sinon.match.array })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "list").rejects(new Error("Internal error"));

      await createGroup.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Group created successfully",
        data: { grp_title: "New Group" },
      });

      await createGroup.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "create").rejects(new Error("Internal error"));

      await createGroup.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Group updated successfully",
        data: { grp_title: "Updated Group" },
      });

      await createGroup.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "update").rejects(new Error("Internal error"));

      await createGroup.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Group deleted successfully",
        data: {},
      });

      await createGroup.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "delete").rejects(new Error("Internal error"));

      await createGroup.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("assignUsers Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "assignUsersHybrid").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users assigned successfully",
        data: {},
      });

      await createGroup.assignUsers(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.assignUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "assignUsersHybrid").rejects(new Error("Internal error"));

      await createGroup.assignUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("assignOneUser Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "assignOneUser").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User assigned successfully",
        data: {},
      });

      await createGroup.assignOneUser(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.assignOneUser(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "assignOneUser").rejects(new Error("Internal error"));

      await createGroup.assignOneUser(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("unAssignUser Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "unAssignUser").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User unassigned successfully",
        data: {},
      });

      await createGroup.unAssignUser(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.unAssignUser(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "unAssignUser").rejects(new Error("Internal error"));

      await createGroup.unAssignUser(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("unAssignManyUsers Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "unAssignManyUsers").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Users unassigned successfully",
        data: {},
      });

      await createGroup.unAssignManyUsers(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.unAssignManyUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "unAssignManyUsers").rejects(new Error("Internal error"));

      await createGroup.unAssignManyUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listAssignedUsers Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "listAssignedUsers").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Assigned users listed successfully",
        data: [],
      });

      await createGroup.listAssignedUsers(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.listAssignedUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "listAssignedUsers").rejects(new Error("Internal error"));

      await createGroup.listAssignedUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listAvailableUsers Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "listAvailableUsers").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Available users listed successfully",
        data: [],
      });

      await createGroup.listAvailableUsers(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.listAvailableUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "listAvailableUsers").rejects(new Error("Internal error"));

      await createGroup.listAvailableUsers(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listSummary Function", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createGroupUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Groups summary listed successfully",
        data: [{ grp_title: "Group 1" }],
      });

      await createGroup.listSummary(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, groups: sinon.match.array })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createGroup.__set__("extractErrorsFromRequest", mockBadRequest);

      await createGroup.listSummary(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(createGroupUtil, "list").rejects(new Error("Internal error"));

      await createGroup.listSummary(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
