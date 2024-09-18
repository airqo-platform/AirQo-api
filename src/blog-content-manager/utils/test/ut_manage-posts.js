require("module-alias/register");
describe("inquire", () => {
  describe("create method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create an inquiry and send email successfully", async () => {
      const tenant = "sample_tenant";
      const fullName = "John Doe";
      const email = "john@example.com";
      const message = "Sample inquiry message";
      const category = "General Inquiry";
      const firstName = "John";
      const lastName = "Doe";

      // Mock the response from InquiryModel register method (success)
      const mockRegisterResponse = {
        success: true,
        data: {
          // Sample data for created inquiry
        },
      };
      sinon.stub(inquire, "InquiryModel").returns({
        register: sinon.stub().resolves(mockRegisterResponse),
      });

      // Mock the response from mailer inquiry method (success)
      const mockMailerResponse = {
        success: true,
        status: httpStatus.OK,
      };
      sinon.stub(mailer, "inquiry").resolves(mockMailerResponse);

      // Call the create method
      const callback = sinon.stub();
      await inquire.create(
        {
          fullName,
          email,
          message,
          category,
          tenant,
          firstName,
          lastName,
        },
        callback
      );

      // Verify the callback
      sinon.assert.calledWith(callback, {
        success: true,
        message: "inquiry successfully created",
        data: mockRegisterResponse.data,
        status: httpStatus.OK,
      });
    });

    it("should handle errors during create and return failure response", async () => {
      const tenant = "sample_tenant";
      const fullName = "John Doe";
      const email = "john@example.com";
      const message = "Sample inquiry message";
      const category = "General Inquiry";
      const firstName = "John";
      const lastName = "Doe";

      // Mock the response from InquiryModel register method (throws error)
      sinon.stub(inquire, "InquiryModel").returns({
        register: sinon.stub().throws(new Error("Database connection error")),
      });

      // Call the create method
      const callback = sinon.stub();
      await inquire.create(
        {
          fullName,
          email,
          message,
          category,
          tenant,
          firstName,
          lastName,
        },
        callback
      );

      // Verify the callback
      sinon.assert.calledWith(callback, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Database connection error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle email sending failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const fullName = "John Doe";
      const email = "john@example.com";
      const message = "Sample inquiry message";
      const category = "General Inquiry";
      const firstName = "John";
      const lastName = "Doe";

      // Mock the response from InquiryModel register method (success)
      const mockRegisterResponse = {
        success: true,
        data: {
          // Sample data for created inquiry
        },
      };
      sinon.stub(inquire, "InquiryModel").returns({
        register: sinon.stub().resolves(mockRegisterResponse),
      });

      // Mock the response from mailer inquiry method (failure)
      const mockMailerResponse = {
        success: false,
        errors: { message: "Failed to send email" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
      sinon.stub(mailer, "inquiry").resolves(mockMailerResponse);

      // Call the create method
      const callback = sinon.stub();
      await inquire.create(
        {
          fullName,
          email,
          message,
          category,
          tenant,
          firstName,
          lastName,
        },
        callback
      );

      // Verify the callback
      sinon.assert.calledWith(callback, mockMailerResponse);
    });
  });
  describe("list method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list inquiries successfully", async () => {
      const tenant = "sample_tenant";
      const filter = { status: "open" };
      const limit = 10;
      const skip = 0;

      // Mock the response from InquiryModel list method (success)
      const mockListResponse = {
        success: true,
        message: "Inquiries listed successfully",
        data: [
          // Sample data for listed inquiries
        ],
      };
      sinon.stub(inquire, "InquiryModel").returns({
        list: sinon.stub().resolves(mockListResponse),
      });

      // Call the list method
      const response = await inquire.list({
        tenant,
        filter,
        limit,
        skip,
      });

      // Verify the response
      expect(response).to.deep.equal(mockListResponse);
    });

    it("should handle errors during listing and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = { status: "open" };
      const limit = 10;
      const skip = 0;

      // Mock the response from InquiryModel list method (throws error)
      sinon.stub(inquire, "InquiryModel").returns({
        list: sinon.stub().throws(new Error("Database connection error")),
      });

      // Call the list method
      const response = await inquire.list({
        tenant,
        filter,
        limit,
        skip,
      });

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "utils server error",
        error: "Database connection error",
      });
    });

    it("should handle unsuccessful listing and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = { status: "open" };
      const limit = 10;
      const skip = 0;

      // Mock the response from InquiryModel list method (failure)
      const mockListResponse = {
        success: false,
        message: "Error listing inquiries",
        error: "Invalid filter",
      };
      sinon.stub(inquire, "InquiryModel").returns({
        list: sinon.stub().resolves(mockListResponse),
      });

      // Call the list method
      const response = await inquire.list({
        tenant,
        filter,
        limit,
        skip,
      });

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Error listing inquiries",
        error: "Invalid filter",
      });
    });
  });
  describe("update method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update inquiry successfully", async () => {
      const tenant = "sample_tenant";
      const filter = { _id: "sample_id" };
      const update = { status: "resolved" };

      // Mock the response from InquiryModel modify method (success)
      const mockModifyResponse = {
        success: true,
        message: "Inquiry updated successfully",
        data: {
          // Updated inquiry data
        },
      };
      sinon.stub(inquire, "InquiryModel").returns({
        modify: sinon.stub().resolves(mockModifyResponse),
      });

      // Call the update method
      const response = await inquire.update(tenant, filter, update);

      // Verify the response
      expect(response).to.deep.equal(mockModifyResponse);
    });

    it("should handle errors during updating and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = { _id: "sample_id" };
      const update = { status: "resolved" };

      // Mock the response from InquiryModel modify method (throws error)
      sinon.stub(inquire, "InquiryModel").returns({
        modify: sinon.stub().throws(new Error("Database connection error")),
      });

      // Call the update method
      const response = await inquire.update(tenant, filter, update);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "util server error",
        error: "Database connection error",
      });
    });

    it("should handle unsuccessful update and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = { _id: "sample_id" };
      const update = { status: "resolved" };

      // Mock the response from InquiryModel modify method (failure)
      const mockModifyResponse = {
        success: false,
        message: "Error updating inquiry",
        error: "Invalid filter",
      };
      sinon.stub(inquire, "InquiryModel").returns({
        modify: sinon.stub().resolves(mockModifyResponse),
      });

      // Call the update method
      const response = await inquire.update(tenant, filter, update);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Error updating inquiry",
        error: "Invalid filter",
      });
    });
  });
  describe("delete method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete inquiry successfully", async () => {
      const tenant = "sample_tenant";
      const filter = { _id: "sample_id" };

      // Mock the response from InquiryModel remove method (success)
      const mockRemoveResponse = {
        success: true,
        message: "Inquiry deleted successfully",
        data: {
          // Deleted inquiry data
        },
      };
      sinon.stub(inquire, "InquiryModel").returns({
        remove: sinon.stub().resolves(mockRemoveResponse),
      });

      // Call the delete method
      const response = await inquire.delete(tenant, filter);

      // Verify the response
      expect(response).to.deep.equal(mockRemoveResponse);
    });

    it("should handle errors during deletion and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = { _id: "sample_id" };

      // Mock the response from InquiryModel remove method (throws error)
      sinon.stub(inquire, "InquiryModel").returns({
        remove: sinon.stub().throws(new Error("Database connection error")),
      });

      // Call the delete method
      const response = await inquire.delete(tenant, filter);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "util server error",
        error: "Database connection error",
      });
    });

    it("should handle unsuccessful deletion and return failure response", async () => {
      const tenant = "sample_tenant";
      const filter = { _id: "sample_id" };

      // Mock the response from InquiryModel remove method (failure)
      const mockRemoveResponse = {
        success: false,
        message: "Error deleting inquiry",
        error: "Invalid filter",
      };
      sinon.stub(inquire, "InquiryModel").returns({
        remove: sinon.stub().resolves(mockRemoveResponse),
      });

      // Call the delete method
      const response = await inquire.delete(tenant, filter);

      // Verify the response
      expect(response).to.deep.equal({
        success: false,
        message: "Error deleting inquiry",
        error: "Invalid filter",
      });
    });
  });
});
