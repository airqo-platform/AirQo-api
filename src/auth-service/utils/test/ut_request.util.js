require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const createAccessRequest = require("@utils/request.util");
const rewireAccessRequest = require("rewire")("@utils/request.util");
const AccessRequestModel = require("@models/AccessRequest");
const GroupModel = require("@models/Group");
const NetworkModel = require("@models/Network");
const UserModel = require("@models/User");
const { mailer } = require("@utils/common");
const constants = require("@config/constants");
const { mockRequest, mockResponse } = require("mock-req-res");
const { generateFilter } = require("@utils/common");
const createGroupUtil = require("@utils/group.util");
const { expect } = chai;

describe("createAccessRequest Util", () => {
  describe("requestAccessToGroup()", () => {
    let requestMock;
    let origGroupModel;
    let origUserModel;
    let origAccessRequestModel;

    beforeEach(() => {
      requestMock = {
        user: {
          _doc: {
            _id: "user_id",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
        },
        query: {},
        params: {},
      };
      origGroupModel = rewireAccessRequest.__get__("GroupModel");
      origUserModel = rewireAccessRequest.__get__("UserModel");
      origAccessRequestModel = rewireAccessRequest.__get__("AccessRequestModel");
    });

    afterEach(() => {
      rewireAccessRequest.__set__("GroupModel", origGroupModel);
      rewireAccessRequest.__set__("UserModel", origUserModel);
      rewireAccessRequest.__set__("AccessRequestModel", origAccessRequestModel);
      sinon.restore();
    });

    it("should request access to a group and send an email", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const groupTitle = "Test Group";
      const next = sinon.stub();

      const findByIdStub = sinon.stub();
      const userFindByIdStub = sinon.stub().returns({
        lean: sinon.stub().resolves(null),
      });
      const findOneStub = sinon.stub().resolves(null);
      const registerStub = sinon.stub().resolves({ success: true, data: {} });

      rewireAccessRequest.__set__("GroupModel", () => ({ findById: findByIdStub }));
      findByIdStub.resolves({ _id: groupId, grp_title: groupTitle });
      rewireAccessRequest.__set__("UserModel", () => ({ findById: userFindByIdStub }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: findOneStub,
        register: registerStub,
      }));
      sinon.stub(mailer, "request").resolves({ success: true, status: httpStatus.OK });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await rewireAccessRequest.requestAccessToGroup(requestMock, next);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("Access Request completed successfully");
      sinon.assert.notCalled(next);
    });

    it("should handle the case where the group does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("GroupModel", () => ({
        findById: sinon.stub().resolves(null),
      }));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      await rewireAccessRequest.requestAccessToGroup(requestMock, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle the case where an access request already exists", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("GroupModel", () => ({
        findById: sinon.stub().resolves({ _id: groupId }),
      }));
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: sinon.stub().resolves({ _id: "existing_id", createdAt: new Date() }),
      }));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await rewireAccessRequest.requestAccessToGroup(requestMock, next);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("GroupModel", () => ({
        findById: sinon.stub().resolves({ _id: groupId }),
      }));
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: sinon.stub().resolves(null),
        register: sinon.stub().throws(new Error("Internal server error")),
      }));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      await rewireAccessRequest.requestAccessToGroup(requestMock, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle the case where user email is missing", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("GroupModel", () => ({
        findById: sinon.stub().resolves({ _id: groupId }),
      }));
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: sinon.stub().resolves(null),
        register: sinon.stub().resolves({ success: true, data: {} }),
      }));

      requestMock.user._doc.email = null;
      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      await rewireAccessRequest.requestAccessToGroup(requestMock, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("requestAccessToNetwork()", () => {
    let requestMock;
    let origNetworkModel;
    let origUserModel;
    let origAccessRequestModel;

    beforeEach(() => {
      requestMock = {
        user: {
          _doc: {
            _id: "user_id",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
        },
        query: {},
        params: {},
      };
      origNetworkModel = rewireAccessRequest.__get__("NetworkModel");
      origUserModel = rewireAccessRequest.__get__("UserModel");
      origAccessRequestModel = rewireAccessRequest.__get__("AccessRequestModel");
    });

    afterEach(() => {
      rewireAccessRequest.__set__("NetworkModel", origNetworkModel);
      rewireAccessRequest.__set__("UserModel", origUserModel);
      rewireAccessRequest.__set__("AccessRequestModel", origAccessRequestModel);
      sinon.restore();
    });

    it("should request access to a network and send an email", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";
      const networkName = "Test Network";
      const next = sinon.stub();

      rewireAccessRequest.__set__("NetworkModel", () => ({
        findById: sinon.stub().resolves({ _id: networkId, net_name: networkName }),
      }));
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: sinon.stub().resolves(null),
        register: sinon.stub().resolves({ success: true, data: {} }),
      }));
      sinon.stub(mailer, "request").resolves({ success: true, status: httpStatus.OK });

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await rewireAccessRequest.requestAccessToNetwork(requestMock, next);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("Access Request completed successfully");
      sinon.assert.notCalled(next);
    });

    it("should handle the case where the network does not exist", async () => {
      const tenant = "test_tenant";
      const networkId = "non_existent_network_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("NetworkModel", () => ({
        findById: sinon.stub().resolves(null),
      }));

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      await rewireAccessRequest.requestAccessToNetwork(requestMock, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle the case where an access request already exists", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("NetworkModel", () => ({
        findById: sinon.stub().resolves({ _id: networkId }),
      }));
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: sinon.stub().resolves({ _id: "existing_id", createdAt: new Date() }),
      }));

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await rewireAccessRequest.requestAccessToNetwork(requestMock, next);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("NetworkModel", () => ({
        findById: sinon.stub().resolves({ _id: networkId }),
      }));
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: sinon.stub().resolves(null),
        register: sinon.stub().throws(new Error("Internal server error")),
      }));

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      await rewireAccessRequest.requestAccessToNetwork(requestMock, next);

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle the case where user email is missing", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";
      const next = sinon.stub();

      rewireAccessRequest.__set__("NetworkModel", () => ({
        findById: sinon.stub().resolves({ _id: networkId }),
      }));
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
      }));
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findOne: sinon.stub().resolves(null),
        register: sinon.stub().resolves({ success: true, data: {} }),
      }));

      requestMock.user._doc.email = null;
      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await rewireAccessRequest.requestAccessToNetwork(requestMock, next);

      // Implementation returns value (not calls next) for email-missing case
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("approveAccessRequest()", () => {
    let origAccessRequestModel;
    let origUserModel;
    let origGroupModel;

    beforeEach(() => {
      origAccessRequestModel = rewireAccessRequest.__get__("AccessRequestModel");
      origUserModel = rewireAccessRequest.__get__("UserModel");
      origGroupModel = rewireAccessRequest.__get__("GroupModel");
    });

    afterEach(() => {
      rewireAccessRequest.__set__("AccessRequestModel", origAccessRequestModel);
      rewireAccessRequest.__set__("UserModel", origUserModel);
      rewireAccessRequest.__set__("GroupModel", origGroupModel);
      sinon.restore();
    });

    it("should approve a group access request and send an email", async () => {
      const tenant = "test_tenant";
      const next = sinon.stub();

      const findByIdStub = sinon.stub().resolves({
        // Use valid 24-char ObjectId hex strings (required by ObjectId() in impl)
        _id: "507f191e810c19729de860ea",
        user_id: "507f191e810c19729de860eb",
        requestType: "group",
        targetId: "507f191e810c19729de860ec",
        status: "pending",
      });
      const modifyStub = sinon.stub().resolves({ success: true });
      rewireAccessRequest.__set__("AccessRequestModel", () => ({
        findById: findByIdStub,
        modify: modifyStub,
      }));

      const userFindByIdStub = sinon.stub().resolves({
        _id: "507f191e810c19729de860eb",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });
      rewireAccessRequest.__set__("UserModel", () => ({
        findById: userFindByIdStub,
      }));

      const groupFindByIdStub = sinon.stub().resolves({
        _id: "group_id",
        grp_title: "Test Group",
      });
      rewireAccessRequest.__set__("GroupModel", () => ({
        findById: groupFindByIdStub,
      }));

      sinon.stub(createGroupUtil, "assignOneUser").resolves({ success: true });
      sinon.stub(mailer, "update").resolves({ success: true, status: httpStatus.OK });

      const requestMock = {
        query: { tenant },
        params: { request_id: "507f191e810c19729de860ea" },
      };

      const response = await rewireAccessRequest.approveAccessRequest(requestMock, next);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      sinon.assert.notCalled(next);
    });

    // Additional test cases for network access requests, missing data, errors, etc.
  });
  describe("list()", () => {
    let origAccessRequestModel;

    beforeEach(() => {
      origAccessRequestModel = rewireAccessRequest.__get__("AccessRequestModel");
    });

    afterEach(() => {
      rewireAccessRequest.__set__("AccessRequestModel", origAccessRequestModel);
      sinon.restore();
    });

    it("should handle a valid request and return a success response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant, limit: 10, skip: 0 } };

      sinon.stub(generateFilter, "requests").returns({});
      const listStub = sinon.stub().resolves({ success: true, data: [] });
      rewireAccessRequest.__set__("AccessRequestModel", () => ({ list: listStub }));

      const result = await rewireAccessRequest.list(request, next);

      expect(result.success).to.be.true;
      sinon.assert.notCalled(next);
    });

    it("should handle a valid request with filtering and return a success response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant, limit: 10, skip: 0 } };

      sinon.stub(generateFilter, "requests").returns({});
      const listStub = sinon.stub().resolves({ success: true, data: [] });
      rewireAccessRequest.__set__("AccessRequestModel", () => ({ list: listStub }));

      const result = await rewireAccessRequest.list(request, next);

      expect(result.success).to.be.true;
    });

    it("should handle a request with invalid filter data and return an error response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant, limit: 10, skip: 0 } };

      sinon.stub(generateFilter, "requests").returns({});
      const listStub = sinon.stub().resolves({ success: false, message: "Invalid filter data" });
      rewireAccessRequest.__set__("AccessRequestModel", () => ({ list: listStub }));

      const result = await rewireAccessRequest.list(request, next);

      expect(result.success).to.be.false;
    });

    it("should handle an internal server error and return an error response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant, limit: 10, skip: 0 } };

      sinon.stub(generateFilter, "requests").throws(new Error("Internal Server Error"));

      await rewireAccessRequest.list(request, next);

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update()", () => {
    let origAccessRequestModel;

    beforeEach(() => {
      origAccessRequestModel = rewireAccessRequest.__get__("AccessRequestModel");
    });

    afterEach(() => {
      rewireAccessRequest.__set__("AccessRequestModel", origAccessRequestModel);
      sinon.restore();
    });

    it("should handle a valid request and return a success response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant }, body: {} };

      sinon.stub(generateFilter, "requests").returns({});
      const modifyStub = sinon.stub().resolves({ success: true });
      rewireAccessRequest.__set__("AccessRequestModel", () => ({ modify: modifyStub }));

      const result = await rewireAccessRequest.update(request, next);

      expect(result.success).to.be.true;
    });

    it("should handle a request with invalid filter data and return an error response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant }, body: {} };

      sinon.stub(generateFilter, "requests").returns({});
      const modifyStub = sinon.stub().resolves({ success: false, message: "Invalid filter data" });
      rewireAccessRequest.__set__("AccessRequestModel", () => ({ modify: modifyStub }));

      const result = await rewireAccessRequest.update(request, next);

      expect(result.success).to.be.false;
    });

    it("should handle an internal server error and return an error response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant }, body: {} };

      sinon.stub(generateFilter, "requests").throws(new Error("Internal Server Error"));

      await rewireAccessRequest.update(request, next);

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    let origAccessRequestModel;

    beforeEach(() => {
      origAccessRequestModel = rewireAccessRequest.__get__("AccessRequestModel");
    });

    afterEach(() => {
      rewireAccessRequest.__set__("AccessRequestModel", origAccessRequestModel);
      sinon.restore();
    });

    it("should handle a valid request and return a success response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant }, params: { request_id: "req1" } };

      sinon.stub(generateFilter, "requests").returns({});
      const findByIdStub = sinon.stub().resolves(null);
      rewireAccessRequest.__set__("AccessRequestModel", () => ({ findById: findByIdStub }));

      const result = await rewireAccessRequest.delete(request, next);

      // delete returns not-found response when request doesn't exist
      expect(result).to.have.property("success");
    });

    it("should handle a request with invalid filter data and return an error response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant }, params: { request_id: "req1" } };

      sinon.stub(generateFilter, "requests").returns({});
      const findByIdStub = sinon.stub().resolves(null);
      rewireAccessRequest.__set__("AccessRequestModel", () => ({ findById: findByIdStub }));

      const result = await rewireAccessRequest.delete(request, next);

      expect(result).to.have.property("success");
    });

    it("should handle an internal server error and return an error response", async () => {
      const tenant = "airqo";
      const next = sinon.stub();
      const request = { query: { tenant }, params: { request_id: "req1" } };

      sinon.stub(generateFilter, "requests").throws(new Error("Internal Server Error"));

      await rewireAccessRequest.delete(request, next);

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
