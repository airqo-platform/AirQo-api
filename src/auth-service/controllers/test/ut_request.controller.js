require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const createAccessRequestUtil = require("@utils/create-request");
const constants = require("@config/constants");
const createAccessRequest = require("@controllers/create-request");

describe("createAccessRequest()", () => {
  describe("requestAccessToGroup", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.requestAccessToGroup to return a success response
      sinon.stub(createAccessRequestUtil, "requestAccessToGroup").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request successful",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequest.requestAccessToGroup(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.requestAccessToGroup.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "field1",
              msg: "Field 1 is required",
            },
            {
              param: "field2",
              msg: "Field 2 is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequest.requestAccessToGroup(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.requestAccessToGroup to throw an error
      sinon
        .stub(createAccessRequestUtil, "requestAccessToGroup")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequest.requestAccessToGroup(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.requestAccessToGroup.restore();
    });
  });
  describe("requestAccessToNetwork()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.requestAccessToNetwork to return a success response
      sinon.stub(createAccessRequestUtil, "requestAccessToNetwork").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request successful",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequest.requestAccessToNetwork(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.requestAccessToNetwork.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "field1",
              msg: "Field 1 is required",
            },
            {
              param: "field2",
              msg: "Field 2 is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequest.requestAccessToNetwork(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.requestAccessToNetwork to throw an error
      sinon
        .stub(createAccessRequestUtil, "requestAccessToNetwork")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequest.requestAccessToNetwork(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.requestAccessToNetwork.restore();
    });
  });
  describe("approveAccessRequest()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.approveAccessRequest to return a success response
      sinon.stub(createAccessRequestUtil, "approveAccessRequest").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request approved",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequest.approveAccessRequest(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.approveAccessRequest.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "field1",
              msg: "Field 1 is required",
            },
            {
              param: "field2",
              msg: "Field 2 is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequest.approveAccessRequest(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.approveAccessRequest to throw an error
      sinon
        .stub(createAccessRequestUtil, "approveAccessRequest")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequest.approveAccessRequest(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.approveAccessRequest.restore();
    });
  });
  describe("rejectAccessRequest()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
        body: {
          status: "rejected",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.update to return a success response
      sinon.stub(createAccessRequestUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request rejected",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequest.rejectAccessRequest(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.update.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
        body: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "field1",
              msg: "Field 1 is required",
            },
            {
              param: "field2",
              msg: "Field 2 is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequest.rejectAccessRequest(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
        body: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.update to throw an error
      sinon
        .stub(createAccessRequestUtil, "update")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequest.rejectAccessRequest(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.update.restore();
    });
  });
  describe("listPendingAccessRequests()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to return a success response
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "List of pending access requests",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequest.listPendingAccessRequests(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "field1",
              msg: "Field 1 is required",
            },
            {
              param: "field2",
              msg: "Field 2 is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequest.listPendingAccessRequests(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to throw an error
      sinon
        .stub(createAccessRequestUtil, "list")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequest.listPendingAccessRequests(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });
  });
  describe("listAccessRequestsForGroup()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
          grp_id: "group123",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to return a success response
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "List of access requests for the group",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequest.listAccessRequestsForGroup(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "tenant",
              msg: "Tenant is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequest.listAccessRequestsForGroup(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to throw an error
      sinon
        .stub(createAccessRequestUtil, "list")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequest.listAccessRequestsForGroup(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });
  });
  describe("listAccessRequestsForNetwork()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
          net_id: "network123",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to return a success response
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "List of access requests for the network",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequest.listAccessRequestsForNetwork(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "tenant",
              msg: "Tenant is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequest.listAccessRequestsForNetwork(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to throw an error
      sinon
        .stub(createAccessRequestUtil, "list")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequest.listAccessRequestsForNetwork(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });
  });
  describe("list()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to return a success response
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "List of access requests",
        data: { candidates: [] },
      });

      // Call the function under test
      await createAccessRequestUtil.list(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "tenant",
              msg: "Tenant is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequestUtil.list(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.list to throw an error
      sinon
        .stub(createAccessRequestUtil, "list")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequestUtil.list(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.list.restore();
    });
  });
  describe("delete()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.delete to return a success response
      sinon.stub(createAccessRequestUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request deleted successfully",
        data: { request: {} },
      });

      // Call the function under test
      await createAccessRequestUtil.delete(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.delete.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "tenant",
              msg: "Tenant is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequestUtil.delete(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil.delete and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.delete to throw an error
      sinon
        .stub(createAccessRequestUtil, "delete")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequestUtil.delete(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.delete.restore();
    });
  });
  describe("update()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {
          tenant: "airqo",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.update to return a success response
      sinon.stub(createAccessRequestUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request updated successfully",
        data: { request: {} },
      });

      // Call the function under test
      await createAccessRequestUtil.update(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.update.restore();
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return validation errors
      sinon.stub(validationResult, "isEmpty").returns(false);
      sinon.stub(validationResult, "errors").value([
        {
          nestedErrors: [
            {
              param: "tenant",
              msg: "Tenant is required",
            },
          ],
        },
      ]);

      // Call the function under test
      await createAccessRequestUtil.update(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
    });

    it("should handle an error from createAccessRequestUtil.update and return an internal server error response", async () => {
      // Mock Express Request and Response objects
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      // Mock validationResult to return an empty error array
      sinon.stub(validationResult, "isEmpty").returns(true);

      // Mock createAccessRequestUtil.update to throw an error
      sinon
        .stub(createAccessRequestUtil, "update")
        .throws(new Error("Test error"));

      // Call the function under test
      await createAccessRequestUtil.update(req, res);

      // Assertions
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      validationResult.isEmpty.restore();
      createAccessRequestUtil.update.restore();
    });
  });
});
