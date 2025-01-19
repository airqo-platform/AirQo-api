require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const createAccessRequest = require("@utils/create-request");
const AccessRequestModel = require("@models/AccessRequest");
const GroupModel = require("@models/Group");
const NetworkModel = require("@models/Network");
const mailer = require("@utils/mailer");
const constants = require("@config/constants");
const { mockRequest, mockResponse } = require("mock-req-res");
const { expect } = chai;

describe("createAccessRequest Util", () => {
  describe("requestAccessToGroup()", () => {
    let requestMock;

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
    });

    it("should request access to a group and send an email", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const groupTitle = "Test Group";

      // Stub the GroupModel.findById method to return the group
      sinon
        .stub(GroupModel(tenant), "findById")
        .resolves({ _id: groupId, grp_title: groupTitle });

      // Stub the AccessRequestModel.findOne method to return null (no existing request)
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);

      // Stub the AccessRequestModel.register method to create a new request
      sinon
        .stub(AccessRequestModel(tenant), "register")
        .resolves({ success: true, data: {} });

      // Stub the mailer.request method to simulate sending an email
      sinon
        .stub(mailer, "request")
        .resolves({ success: true, status: httpStatus.OK });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createAccessRequest.requestAccessToGroup(
        requestMock
      );

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Access Request completed successfully"
      );
      expect(response.data).to.deep.equal({});

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: groupId,
        requestType: "group",
      });
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).register, {
        user_id: "user_id",
        targetId: groupId,
        status: "pending",
        requestType: "group",
      });
      sinon.assert.calledOnceWithExactly(mailer.request, {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        tenant,
        entity_title: groupTitle,
      });

      GroupModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
      mailer.request.restore();
    });

    it("should handle the case where the group does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";

      // Stub the GroupModel.findById method to return null
      sinon.stub(GroupModel(tenant), "findById").resolves(null);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createAccessRequest.requestAccessToGroup(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal("Group or User not found");

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);

      GroupModel(tenant).findById.restore();
    });

    it("should handle the case where an access request already exists", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the AccessRequestModel.findOne method to return an existing request
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves({});

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createAccessRequest.requestAccessToGroup(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Access request already exists for this group"
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: groupId,
        requestType: "group",
      });

      GroupModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the AccessRequestModel.findOne method to return null (no existing request)
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);

      // Stub the AccessRequestModel.register method to throw an error
      sinon
        .stub(AccessRequestModel(tenant), "register")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createAccessRequest.requestAccessToGroup(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: groupId,
        requestType: "group",
      });
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).register, {
        user_id: "user_id",
        targetId: groupId,
        status: "pending",
        requestType: "group",
      });

      GroupModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
    });

    it("should handle the case where user email is missing", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the AccessRequestModel.findOne method to return null (no existing request)
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);

      // Stub the AccessRequestModel.register method to create a new request
      sinon
        .stub(AccessRequestModel(tenant), "register")
        .resolves({ success: true, data: {} });

      // Set user email to null
      requestMock.user._doc.email = null;

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createAccessRequest.requestAccessToGroup(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");
      expect(response.errors.message).to.equal(
        "Unable to retrieve the requester's email address"
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: groupId,
        requestType: "group",
      });
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).register, {
        user_id: "user_id",
        targetId: groupId,
        status: "pending",
        requestType: "group",
      });

      GroupModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
    });
  });
  describe("requestAccessToNetwork()", () => {
    let requestMock;

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
    });

    it("should request access to a network and send an email", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";
      const networkName = "Test Network";

      // Stub the NetworkModel.findById method to return the network
      sinon
        .stub(NetworkModel(tenant), "findById")
        .resolves({ _id: networkId, net_name: networkName });

      // Stub the AccessRequestModel.findOne method to return null (no existing request)
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);

      // Stub the AccessRequestModel.register method to create a new request
      sinon
        .stub(AccessRequestModel(tenant), "register")
        .resolves({ success: true, data: {} });

      // Stub the mailer.request method to simulate sending an email
      sinon
        .stub(mailer, "request")
        .resolves({ success: true, status: httpStatus.OK });

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await createAccessRequest.requestAccessToNetwork(
        requestMock
      );

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Access Request completed successfully"
      );
      expect(response.data).to.deep.equal({});

      sinon.assert.calledOnceWithExactly(
        NetworkModel(tenant).findById,
        networkId
      );
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: networkId,
        requestType: "network",
      });
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).register, {
        user_id: "user_id",
        targetId: networkId,
        status: "pending",
        requestType: "network",
      });
      sinon.assert.calledOnceWithExactly(mailer.request, {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        tenant,
        entity_title: networkName,
      });

      NetworkModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
      mailer.request.restore();
    });

    it("should handle the case where the network does not exist", async () => {
      const tenant = "test_tenant";
      const networkId = "non_existent_network_id";

      // Stub the NetworkModel.findById method to return null
      sinon.stub(NetworkModel(tenant), "findById").resolves(null);

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await createAccessRequest.requestAccessToNetwork(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal("Network or User not found");

      sinon.assert.calledOnceWithExactly(
        NetworkModel(tenant).findById,
        networkId
      );

      NetworkModel(tenant).findById.restore();
    });

    it("should handle the case where an access request already exists", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";

      // Stub the NetworkModel.findById method to return the network
      sinon.stub(NetworkModel(tenant), "findById").resolves({ _id: networkId });

      // Stub the AccessRequestModel.findOne method to return an existing request
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves({});

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await createAccessRequest.requestAccessToNetwork(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Access request already exists for this network"
      );

      sinon.assert.calledOnceWithExactly(
        NetworkModel(tenant).findById,
        networkId
      );
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: networkId,
        requestType: "network",
      });

      NetworkModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";

      // Stub the NetworkModel.findById method to return the network
      sinon.stub(NetworkModel(tenant), "findById").resolves({ _id: networkId });

      // Stub the AccessRequestModel.findOne method to return null (no existing request)
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);

      // Stub the AccessRequestModel.register method to throw an error
      sinon
        .stub(AccessRequestModel(tenant), "register")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await createAccessRequest.requestAccessToNetwork(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(
        NetworkModel(tenant).findById,
        networkId
      );
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: networkId,
        requestType: "network",
      });
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).register, {
        user_id: "user_id",
        targetId: networkId,
        status: "pending",
        requestType: "network",
      });

      NetworkModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
    });

    it("should handle the case where user email is missing", async () => {
      const tenant = "test_tenant";
      const networkId = "test_network_id";

      // Stub the NetworkModel.findById method to return the network
      sinon.stub(NetworkModel(tenant), "findById").resolves({ _id: networkId });

      // Stub the AccessRequestModel.findOne method to return null (no existing request)
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);

      // Stub the AccessRequestModel.register method to create a new request
      sinon
        .stub(AccessRequestModel(tenant), "register")
        .resolves({ success: true, data: {} });

      // Set user email to null
      requestMock.user._doc.email = null;

      requestMock.query.tenant = tenant;
      requestMock.params.net_id = networkId;

      const response = await createAccessRequest.requestAccessToNetwork(
        requestMock
      );

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");
      expect(response.errors.message).to.equal(
        "Unable to retrieve the requester's email address, please crosscheck security token details"
      );

      sinon.assert.calledOnceWithExactly(
        NetworkModel(tenant).findById,
        networkId
      );
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).findOne, {
        user_id: "user_id",
        targetId: networkId,
        requestType: "network",
      });
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).register, {
        user_id: "user_id",
        targetId: networkId,
        status: "pending",
        requestType: "network",
      });

      NetworkModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
    });
  });
  describe("approveAccessRequest()", () => {
    let requestMock;
    let accessRequestMock;
    let userDetailsMock;
    let groupMock;
    let networkMock;

    beforeEach(() => {
      requestMock = {
        query: {},
        params: {},
      };

      accessRequestMock = {
        _id: "access_request_id",
        user_id: "user_id",
        requestType: "group",
        targetId: "group_id",
      };

      userDetailsMock = {
        _id: "user_id",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      groupMock = {
        _id: "group_id",
        grp_title: "Test Group",
      };

      networkMock = {
        _id: "network_id",
        net_name: "Test Network",
      };
    });

    it("should approve a group access request and send an email", async () => {
      const tenant = "test_tenant";

      // Stub AccessRequestModel.findById to return the access request
      sinon
        .stub(AccessRequestModel(tenant), "findById")
        .resolves(accessRequestMock);

      // Stub UserModel.findById to return the user details
      sinon.stub(UserModel(tenant), "findById").resolves(userDetailsMock);

      // Stub AccessRequestModel.modify to update the access request
      sinon
        .stub(AccessRequestModel(tenant), "modify")
        .resolves({ success: true });

      // Stub GroupModel.findById to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves(groupMock);

      // Stub createGroupUtil.assignOneUser to simulate assigning the user to the group
      sinon.stub(createGroupUtil, "assignOneUser").resolves({ success: true });

      // Stub mailer.update to simulate sending an email
      sinon
        .stub(mailer, "update")
        .resolves({ success: true, status: httpStatus.OK });

      requestMock.query.tenant = tenant;
      requestMock.params.request_id = "access_request_id";

      const response = await createAccessRequest.approveAccessRequest(
        requestMock
      );

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("Access request approved successfully");

      sinon.assert.calledOnceWithExactly(
        AccessRequestModel(tenant).findById,
        "access_request_id"
      );
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, "user_id");
      sinon.assert.calledOnceWithExactly(AccessRequestModel(tenant).modify, {
        filter: { _id: "access_request_id" },
        update: { status: "approved" },
      });
      sinon.assert.calledOnceWithExactly(
        GroupModel(tenant).findById,
        "group_id"
      );
      sinon.assert.calledOnceWithExactly(createGroupUtil.assignOneUser, {
        params: { grp_id: "group_id", user_id: "user_id" },
        query: { tenant },
      });
      sinon.assert.calledOnceWithExactly(
        mailer.update,
        "john@example.com",
        "John",
        "Doe",
        "Test Group"
      );

      AccessRequestModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
      AccessRequestModel(tenant).modify.restore();
      GroupModel(tenant).findById.restore();
      createGroupUtil.assignOneUser.restore();
      mailer.update.restore();
    });

    // Additional test cases for network access requests, missing data, errors, etc.
  });
  describe("list()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock request and response objects
      const tenant = "airqo";
      const limit = 10;
      const skip = 0;

      const request = mockRequest({
        query: { tenant, limit, skip },
      });
      const response = mockResponse();

      // Mock generateFilter.requests function
      sinon.stub(generateFilter, "requests").resolves({
        success: true,
        data: {
          /* Filter data */
        },
      });

      // Mock AccessRequestModel.list function
      sinon.stub(AccessRequestModel(tenant.toLowerCase()), "list").resolves({
        success: true,
        /* Response data here */
      });

      // Call the function under test
      await createAccessRequest.list(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
      AccessRequestModel(tenant.toLowerCase()).list.restore();
    });

    it("should handle a valid request with filtering and return a success response", async () => {
      // Mock request and response objects
      const tenant = "airqo";
      const limit = 10;
      const skip = 0;

      const request = mockRequest({
        query: { tenant, limit, skip },
      });
      const response = mockResponse();

      // Mock generateFilter.requests function
      sinon.stub(generateFilter, "requests").resolves({
        success: true,
        data: {
          /* Filter data */
        },
      });

      // Mock AccessRequestModel.list function
      sinon.stub(AccessRequestModel(tenant.toLowerCase()), "list").resolves({
        success: true,
        /* Response data here */
      });

      // Call the function under test
      await createAccessRequest.list(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
      AccessRequestModel(tenant.toLowerCase()).list.restore();
    });

    it("should handle a request with invalid filter data and return an error response", async () => {
      // Mock request and response objects
      const tenant = "airqo";
      const limit = 10;
      const skip = 0;

      const request = mockRequest({
        query: { tenant, limit, skip },
      });
      const response = mockResponse();

      // Mock generateFilter.requests function to return an error response
      sinon.stub(generateFilter, "requests").resolves({
        success: false,
        message: "Invalid filter data",
      });

      // Call the function under test
      await createAccessRequest.list(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
    });

    it("should handle an internal server error and return an error response", async () => {
      // Mock request and response objects
      const tenant = "airqo";
      const limit = 10;
      const skip = 0;

      const request = mockRequest({
        query: { tenant, limit, skip },
      });
      const response = mockResponse();

      // Mock generateFilter.requests function to throw an error
      sinon
        .stub(generateFilter, "requests")
        .throws(new Error("Internal Server Error"));

      // Call the function under test
      await createAccessRequest.list(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
    });

    // Add more test cases for different scenarios as needed
  });
  describe("update()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock request and response objects
      const tenant = "airqo";
      const requestBody = {
        /* Update data */
      };

      const request = mockRequest({
        query: { tenant },
        body: requestBody,
      });
      const response = mockResponse();

      // Mock generateFilter.requests function
      sinon.stub(generateFilter, "requests").resolves({
        success: true,
        data: {
          /* Filter data */
        },
      });

      // Mock AccessRequestModel.modify function
      sinon.stub(AccessRequestModel(tenant.toLowerCase()), "modify").resolves({
        success: true,
        /* Response data here */
      });

      // Call the function under test
      await createAccessRequest.update(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
      AccessRequestModel(tenant.toLowerCase()).modify.restore();
    });

    it("should handle a request with invalid filter data and return an error response", async () => {
      // Mock request and response objects
      const tenant = "airqo";
      const requestBody = {
        /* Update data */
      };

      const request = mockRequest({
        query: { tenant },
        body: requestBody,
      });
      const response = mockResponse();

      // Mock generateFilter.requests function to return an error response
      sinon.stub(generateFilter, "requests").resolves({
        success: false,
        message: "Invalid filter data",
      });

      // Call the function under test
      await createAccessRequest.update(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
    });

    it("should handle an internal server error and return an error response", async () => {
      // Mock request and response objects
      const tenant = "airqo";
      const requestBody = {
        /* Update data */
      };

      const request = mockRequest({
        query: { tenant },
        body: requestBody,
      });
      const response = mockResponse();

      // Mock generateFilter.requests function to throw an error
      sinon
        .stub(generateFilter, "requests")
        .throws(new Error("Internal Server Error"));

      // Call the function under test
      await createAccessRequest.update(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
    });

    // Add more test cases for different scenarios as needed
  });
  describe("delete()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock request and response objects
      const tenant = "airqo";

      const request = mockRequest({
        query: { tenant },
      });
      const response = mockResponse();

      // Mock generateFilter.requests function
      sinon.stub(generateFilter, "requests").resolves({
        success: true,
        data: {
          /* Filter data */
        },
      });

      // Mock AccessRequestModel.remove function
      sinon.stub(AccessRequestModel(tenant.toLowerCase()), "remove").resolves({
        success: true,
        /* Response data here */
      });

      // Call the function under test
      await createAccessRequest.delete(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
      AccessRequestModel(tenant.toLowerCase()).remove.restore();
    });

    it("should handle a request with invalid filter data and return an error response", async () => {
      // Mock request and response objects
      const tenant = "airqo";

      const request = mockRequest({
        query: { tenant },
      });
      const response = mockResponse();

      // Mock generateFilter.requests function to return an error response
      sinon.stub(generateFilter, "requests").resolves({
        success: false,
        message: "Invalid filter data",
      });

      // Call the function under test
      await createAccessRequest.delete(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
    });

    it("should handle an internal server error and return an error response", async () => {
      // Mock request and response objects
      const tenant = "airqo";

      const request = mockRequest({
        query: { tenant },
      });
      const response = mockResponse();

      // Mock generateFilter.requests function to throw an error
      sinon
        .stub(generateFilter, "requests")
        .throws(new Error("Internal Server Error"));

      // Call the function under test
      await createAccessRequest.delete(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      generateFilter.requests.restore();
    });

    // Add more test cases for different scenarios as needed
  });
});
