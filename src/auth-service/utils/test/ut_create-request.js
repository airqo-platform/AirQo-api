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
  describe(" requestAccessToGroup()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock request and response objects
      const user = {
        _id: "user_id",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };
      const group_id = "group_id";
      const tenant = "airqo";

      const request = mockRequest({
        user,
        query: { tenant },
        params: { group_id },
      });
      const response = mockResponse();

      // Mock GroupModel and AccessRequestModel functions
      sinon
        .stub(GroupModel(tenant), "findById")
        .resolves({ grp_title: "Test Group" });
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);
      sinon.stub(AccessRequestModel(tenant), "register").resolves({
        success: true,
        data: {
          /* Access Request data */
        },
      });

      // Mock mailer.request function
      sinon.stub(mailer, "request").resolves({
        success: true,
        status: httpStatus.OK,
      });

      // Call the function under test
      await createAccessRequest.requestAccessToGroup(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      GroupModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
      mailer.request.restore();
    });
    it("should handle a request when an access request already exists and return a bad request response", async () => {
      // Mock request and response objects
      const user = {
        _id: "user_id",
      };
      const group_id = "group_id";
      const tenant = "airqo";

      const request = mockRequest({
        user,
        query: { tenant },
        params: { group_id },
      });
      const response = mockResponse();

      // Mock GroupModel and AccessRequestModel functions
      sinon.stub(GroupModel(tenant), "findById").resolves({});
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves({});

      // Call the function under test
      await createAccessRequest.requestAccessToGroup(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      GroupModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
    });
    // Add more test cases for different scenarios as needed
  });
  describe("requestAccessToNetwork()", () => {
    it("should handle a valid request and return a success response", async () => {
      // Mock request and response objects
      const user = {
        _id: "user_id",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };
      const network_id = "network_id";
      const tenant = "airqo";

      const request = mockRequest({
        user,
        query: { tenant },
        params: { network_id },
      });
      const response = mockResponse();

      // Mock NetworkModel and AccessRequestModel functions
      sinon
        .stub(NetworkModel(tenant), "findById")
        .resolves({ net_name: "Test Network" });
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves(null);
      sinon.stub(AccessRequestModel(tenant), "register").resolves({
        success: true,
        data: {
          /* Access Request data */
        },
      });

      // Mock mailer.request function
      sinon.stub(mailer, "request").resolves({
        success: true,
        status: httpStatus.OK,
      });

      // Call the function under test
      await createAccessRequest.requestAccessToNetwork(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      NetworkModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
      AccessRequestModel(tenant).register.restore();
      mailer.request.restore();
    });
    it("should handle a request when an access request already exists and return a bad request response", async () => {
      // Mock request and response objects
      const user = {
        _id: "user_id",
      };
      const network_id = "network_id";
      const tenant = "airqo";

      const request = mockRequest({
        user,
        query: { tenant },
        params: { network_id },
      });
      const response = mockResponse();

      // Mock NetworkModel and AccessRequestModel functions
      sinon.stub(NetworkModel(tenant), "findById").resolves({});
      sinon.stub(AccessRequestModel(tenant), "findOne").resolves({});

      // Call the function under test
      await createAccessRequest.requestAccessToNetwork(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      NetworkModel(tenant).findById.restore();
      AccessRequestModel(tenant).findOne.restore();
    });
    // Add more test cases for different scenarios as needed
  });
  describe("approveAccessRequest()", () => {
    it("should handle a valid request for group access and return a success response", async () => {
      // Mock request and response objects
      const request_id = "request_id";
      const tenant = "airqo";

      const userDetails = {
        _id: "user_id",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const group = {
        grp_title: "Test Group",
      };

      const request = mockRequest({
        query: { tenant },
        params: { request_id },
      });
      const response = mockResponse();

      // Mock AccessRequestModel and UserModel functions
      sinon.stub(AccessRequestModel(tenant), "findById").resolves({
        _id: "request_id",
        user_id: userDetails._id,
        requestType: "group",
        targetId: "group_id",
      });
      sinon.stub(UserModel(tenant), "findById").resolves(userDetails);
      sinon.stub(GroupModel(tenant), "findById").resolves(group);
      sinon.stub(AccessRequestModel(tenant), "modify").resolves({
        success: true,
      });

      // Mock mailer.update function
      sinon.stub(mailer, "update").resolves({
        success: true,
        status: httpStatus.OK,
      });

      // Mock createGroupUtil.assignOneUser function
      sinon.stub(createGroupUtil, "assignOneUser").resolves({
        success: true,
      });

      // Call the function under test
      await createAccessRequest.approveAccessRequest(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      AccessRequestModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
      GroupModel(tenant).findById.restore();
      AccessRequestModel(tenant).modify.restore();
      mailer.update.restore();
      createGroupUtil.assignOneUser.restore();
    });

    it("should handle a valid request for network access and return a success response", async () => {
      // Mock request and response objects
      const request_id = "request_id";
      const tenant = "airqo";

      const userDetails = {
        _id: "user_id",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const network = {
        net_name: "Test Network",
      };

      const request = mockRequest({
        query: { tenant },
        params: { request_id },
      });
      const response = mockResponse();

      // Mock AccessRequestModel and UserModel functions
      sinon.stub(AccessRequestModel(tenant), "findById").resolves({
        _id: "request_id",
        user_id: userDetails._id,
        requestType: "network",
        targetId: "network_id",
      });
      sinon.stub(UserModel(tenant), "findById").resolves(userDetails);
      sinon.stub(NetworkModel(tenant), "findById").resolves(network);
      sinon.stub(AccessRequestModel(tenant), "modify").resolves({
        success: true,
      });

      // Mock mailer.update function
      sinon.stub(mailer, "update").resolves({
        success: true,
        status: httpStatus.OK,
      });

      // Mock createNetworkUtil.assignOneUser function
      sinon.stub(createNetworkUtil, "assignOneUser").resolves({
        success: true,
      });

      // Call the function under test
      await createAccessRequest.approveAccessRequest(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.OK)).to.be.true;
      expect(response.json.calledWithMatch({ success: true })).to.be.true;

      // Restore the stubbed functions
      AccessRequestModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
      NetworkModel(tenant).findById.restore();
      AccessRequestModel(tenant).modify.restore();
      mailer.update.restore();
      createNetworkUtil.assignOneUser.restore();
    });

    it("should handle a request when access request or user details are not found and return a not found response", async () => {
      // Mock request and response objects
      const request_id = "request_id";
      const tenant = "airqo";

      const request = mockRequest({
        query: { tenant },
        params: { request_id },
      });
      const response = mockResponse();

      // Mock AccessRequestModel and UserModel functions to return empty results
      sinon.stub(AccessRequestModel(tenant), "findById").resolves(null);
      sinon.stub(UserModel(tenant), "findById").resolves(null);

      // Call the function under test
      await createAccessRequest.approveAccessRequest(request, response);

      // Assertions
      expect(response.status.calledWith(httpStatus.NOT_FOUND)).to.be.true;
      expect(response.json.calledWithMatch({ success: false })).to.be.true;

      // Restore the stubbed functions
      AccessRequestModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
    });

    // Add more test cases for different scenarios as needed
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
