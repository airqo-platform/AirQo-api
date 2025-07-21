require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");

const HostModel = require("@models/Host");
const createHost = require("@utils/create-host");

describe("createHost", () => {
  let request;

  beforeEach(() => {
    request = {
      query: {
        tenant: "example-tenant",
      },
      body: {
        // mock request body
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("create", () => {
    it("should call HostModel.register with the correct arguments and return the response", async () => {
      const registerStub = sinon
        .stub(HostModel("example-tenant"), "register")
        .resolves({ success: true });

      const response = await createHost.create(request);

      expect(registerStub.calledOnce).to.be.true;
      expect(registerStub.firstCall.args[0]).to.deep.equal(request.body);
      expect(response).to.deep.equal({ success: true });
    });

    it("should return an error response when an exception occurs", async () => {
      sinon
        .stub(HostModel("example-tenant"), "register")
        .throws(new Error("Test error"));

      const response = await createHost.create(request);

      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Test error" },
      });
    });
  });

  describe("update", () => {
    // Add unit tests for the update method
  });

  describe("delete", () => {
    // Add unit tests for the delete method
  });

  describe("list", () => {
    // Add unit tests for the list method
  });
});
