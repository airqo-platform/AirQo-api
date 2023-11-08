require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const createChecklistController = require("@controllers/create-checklist");
const { validationResult } = require("express-validator");

describe("create preference controller", () => {
  describe("update()", () => {
    it("should update a checklist and return a success response", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.update to return a success response
      const createChecklistUtil = {
        update: sinon.stub().resolves({
          success: true,
          status: 200,
          message: "Update successful",
          data: { checklist: {} },
        }),
      };

      // Mock request and response objects
      const req = {
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the update function
      await createChecklistController.update(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with the correct status and data
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        success: true,
        message: "Update successful",
        default: { checklist: {} },
      });
    });

    it("should handle bad request errors", async () => {
      // Stub validationResult to return validation errors
      const validationResultStub = sinon.stub().returns({
        isEmpty: () => false,
        errors: [{ nestedErrors: ["Validation Error"] }],
      });

      // Mock request and response objects
      const req = {
        query: { tenant: "" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the update function
      await createChecklistController.update(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with a bad request status and errors
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "bad request errors",
        default: {},
        errors: { message: "Validation Error" },
      });
    });

    it("should handle an error from createChecklistUtil.update", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.update to return an error response
      const createChecklistUtil = {
        update: sinon.stub().rejects(new Error("Update Error")),
      };

      // Mock request and response objects
      const req = {
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the update function
      await createChecklistController.update(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with an internal server error status and error message
      sinon.assert.calledWith(res.status, 500);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Update Error" },
      });
    });
  });
  describe("create()", () => {
    it("should create a checklist and return a success response", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.create to return a success response
      const createChecklistUtil = {
        create: sinon.stub().resolves({
          success: true,
          status: 200,
          message: "Create successful",
          data: { checklist: {} },
        }),
      };

      // Mock request and response objects
      const req = {
        body: {},
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the create function
      await createChecklistController.create(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with the correct status and data
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        success: true,
        message: "Create successful",
        default: { checklist: {} },
      });
    });

    it("should handle bad request errors", async () => {
      // Stub validationResult to return validation errors
      const validationResultStub = sinon.stub().returns({
        isEmpty: () => false,
        errors: [{ nestedErrors: ["Validation Error"] }],
      });

      // Mock request and response objects
      const req = {
        body: {},
        query: { tenant: "" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the create function
      await createChecklistController.create(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with a bad request status and errors
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "bad request errors",
        default: {},
        errors: { message: "Validation Error" },
      });
    });

    it("should handle an error from createChecklistUtil.create", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.create to return an error response
      const createChecklistUtil = {
        create: sinon.stub().rejects(new Error("Create Error")),
      };

      // Mock request and response objects
      const req = {
        body: {},
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the create function
      await createChecklistController.create(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with an internal server error status and error message
      sinon.assert.calledWith(res.status, 500);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Create Error" },
      });
    });
  });
  describe("upsert()", () => {
    it("should upsert a checklist and return a success response", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.upsert to return a success response
      const createChecklistUtil = {
        upsert: sinon.stub().resolves({
          success: true,
          status: 200,
          message: "Upsert successful",
          data: { checklist: {} },
        }),
      };

      // Mock request and response objects
      const req = {
        body: {},
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the upsert function
      await createChecklistController.upsert(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with the correct status and data
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        success: true,
        message: "Upsert successful",
        default: { checklist: {} },
      });
    });

    it("should handle bad request errors", async () => {
      // Stub validationResult to return validation errors
      const validationResultStub = sinon.stub().returns({
        isEmpty: () => false,
        errors: [{ nestedErrors: ["Validation Error"] }],
      });

      // Mock request and response objects
      const req = {
        body: {},
        query: { tenant: "" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the upsert function
      await createChecklistController.upsert(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with a bad request status and errors
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "bad request errors",
        default: {},
        errors: { message: "Validation Error" },
      });
    });

    it("should handle an error from createChecklistUtil.upsert", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.upsert to return an error response
      const createChecklistUtil = {
        upsert: sinon.stub().rejects(new Error("Upsert Error")),
      };

      // Mock request and response objects
      const req = {
        body: {},
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the upsert function
      await createChecklistController.upsert(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with an internal server error status and error message
      sinon.assert.calledWith(res.status, 500);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Upsert Error" },
      });
    });
  });
  describe("list()", () => {
    it("should list all checklists and return a success response", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.list to return a success response
      const createChecklistUtil = {
        list: sinon.stub().resolves({
          success: true,
          status: 200,
          message: "List successful",
          data: { checklists: [] },
        }),
      };

      // Mock request and response objects
      const req = {
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the list function
      await createChecklistController.list(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with the correct status and data
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        success: true,
        message: "List successful",
        checklists: [],
      });
    });

    it("should handle bad request errors", async () => {
      // Stub validationResult to return validation errors
      const validationResultStub = sinon.stub().returns({
        isEmpty: () => false,
        errors: [{ nestedErrors: ["Validation Error"] }],
      });

      // Mock request and response objects
      const req = {
        query: { tenant: "" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the list function
      await createChecklistController.list(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with a bad request status and errors
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "bad request errors",
        errors: { message: "Validation Error" },
      });
    });

    it("should handle an error from createChecklistUtil.list", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.list to return an error response
      const createChecklistUtil = {
        list: sinon.stub().rejects(new Error("List Error")),
      };

      // Mock request and response objects
      const req = {
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the list function
      await createChecklistController.list(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with an internal server error status and error message
      sinon.assert.calledWith(res.status, 500);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "List Error" },
      });
    });
  });
  describe("delete()", () => {
    it("should delete a default and return a success response", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.delete to return a success response
      const createChecklistUtil = {
        delete: sinon.stub().resolves({
          success: true,
          status: 200,
          message: "Delete successful",
          data: { default: {} },
        }),
      };

      // Mock request and response objects
      const req = {
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the delete function
      await createChecklistController.delete(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with the correct status and data
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        success: true,
        message: "Delete successful",
        default: { default: {} },
      });
    });

    it("should handle bad request errors", async () => {
      // Stub validationResult to return validation errors
      const validationResultStub = sinon.stub().returns({
        isEmpty: () => false,
        errors: [{ nestedErrors: ["Validation Error"] }],
      });

      // Mock request and response objects
      const req = {
        query: { tenant: "" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the delete function
      await createChecklistController.delete(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with a bad request status and errors
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "bad request errors",
        errors: { message: "Validation Error" },
      });
    });

    it("should handle an error from createChecklistUtil.delete", async () => {
      // Stub validationResult to return an empty result
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      // Stub createChecklistUtil.delete to return an error response
      const createChecklistUtil = {
        delete: sinon.stub().rejects(new Error("Delete Error")),
      };

      // Mock request and response objects
      const req = {
        query: { tenant: "sampleTenant" },
      };
      const res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };

      // Call the delete function
      await createChecklistController.delete(
        req,
        res,
        validationResultStub,
        createChecklistUtil
      );

      // Assert that the response was sent with an internal server error status and error message
      sinon.assert.calledWith(res.status, 500);
      sinon.assert.calledWith(res.json, {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Delete Error" },
      });
    });
  });
});
