require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");

// Mocking dependencies
const validationResult = sinon.stub();
const controlAccessUtil = require("@utils/control-access");
const constants = require("@config/constants");
const httpStatus = require("http-status");

// Require the module to test
const createClient = require("@controllers/create-client");

// Sample request and response objects
const req = {
  query: { tenant: "airqo" },
};
const res = {
  status: sinon.stub().returnsThis(),
  json: sinon.stub(),
};

describe("createClient", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("create()", () => {
    it("should create a client successfully", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "createClient")
        .resolves({
          success: true,
          status: httpStatus.CREATED,
          message: "Client created successfully",
          data: { clientId: "client123" },
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.create(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.CREATED)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Client created successfully",
          created_client: { clientId: "client123" },
        })
      ).to.be.true;
    });

    it("should handle client creation failure", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "createClient")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to create client",
          errors: { message: "Client creation error" },
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.create(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to create client",
          errors: { message: "Client creation error" },
        })
      ).to.be.true;
    });

    // Add more test cases for different scenarios and validations
  });

  // Add separate `describe` blocks for other functions (list, delete, update)
  describe("list()", () => {
    it("should list clients successfully", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listClient")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Clients listed successfully",
          data: [{ clientId: "client123" }, { clientId: "client456" }],
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.list(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Clients listed successfully",
          clients: [{ clientId: "client123" }, { clientId: "client456" }],
        })
      ).to.be.true;
    });

    it("should handle client listing failure", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "listClient")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to list clients",
          errors: { message: "Client listing error" },
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.list(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to list clients",
          errors: { message: "Client listing error" },
        })
      ).to.be.true;
    });

    // Add more test cases for different scenarios and validations
  });

  describe("delete()", () => {
    it("should delete client successfully", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "deleteClient")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Client deleted successfully",
          data: { clientId: "client123" },
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.delete(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Client deleted successfully",
          deleted_client: { clientId: "client123" },
        })
      ).to.be.true;
    });

    it("should handle client deletion failure", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "deleteClient")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to delete client",
          errors: { message: "Client deletion error" },
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.delete(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to delete client",
          errors: { message: "Client deletion error" },
        })
      ).to.be.true;
    });

    // Add more test cases for different scenarios and validations
  });

  describe("update()", () => {
    it("should update client successfully", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "updateClient")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Client updated successfully",
          data: { clientId: "client123" },
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.update(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Client updated successfully",
          updated_client: { clientId: "client123" },
        })
      ).to.be.true;
    });

    it("should handle client update failure", async () => {
      const controlAccessUtilStub = sinon
        .stub(controlAccessUtil, "updateClient")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to update client",
          errors: { message: "Client update error" },
        });

      validationResult.returns({ isEmpty: () => true });

      await createClient.update(req, res);

      expect(validationResult.calledOnce).to.be.true;
      expect(controlAccessUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to update client",
          errors: { message: "Client update error" },
        })
      ).to.be.true;
    });

    // Add more test cases for different scenarios and validations
  });
});
