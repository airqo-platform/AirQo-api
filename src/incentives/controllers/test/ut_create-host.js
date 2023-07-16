require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const createHostUtil = require("@utils/create-host");
const createHost = require("./createHost");

describe("createHost", () => {
  describe("create", () => {
    it("should create a host", async () => {
      const req = {
        query: {},
        body: { firstName: "John", lastName: "Doe", email: "john@example.com" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createHostUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Host created",
        data: {
          id: "123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      });

      await createHost.create(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createHostUtil.create.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Host created",
          created_host: {
            id: "123",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createHostUtil.create.restore();
    });

    it("should handle validation errors", async () => {
      const req = {
        query: {},
        body: { firstName: "", lastName: "", email: "" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon.stub().returns({
        isEmpty: () => false,
        errors: [
          {
            nestedErrors: [
              { param: "firstName", msg: "First name is required" },
            ],
          },
        ],
      });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);

      await createHost.create(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "bad request errors",
          errors: { firstName: "First name is required" },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
    });

    it("should handle create host errors", async () => {
      const req = {
        query: {},
        body: { firstName: "John", lastName: "Doe", email: "john@example.com" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createHostUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: "An error occurred while creating the host" },
      });

      await createHost.create(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createHostUtil.create.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "An error occurred while creating the host" },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createHostUtil.create.restore();
    });

    // Add more test cases for the create method if needed
  });

  describe("delete", () => {
    it("should delete a host", async () => {
      const req = {
        query: {},
        body: { hostId: "123" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createHostUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Host deleted",
        data: {
          id: "123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      });

      await createHost.delete(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createHostUtil.delete.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Host deleted",
          removed_host: {
            id: "123",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createHostUtil.delete.restore();
    });

    // Add more test cases for the delete method if needed
  });

  describe("update", () => {
    it("should update a host", async () => {
      const req = {
        query: {},
        body: {
          hostId: "123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createHostUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Host updated",
        data: {
          id: "123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      });

      await createHost.update(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createHostUtil.update.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Host updated",
          updated_host: {
            id: "123",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createHostUtil.update.restore();
    });

    // Add more test cases for the update method if needed
  });

  describe("list", () => {
    it("should list all hosts", async () => {
      const req = {
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon
        .stub(validationResult, "withDefaults")
        .returns(validationResultStub);
      sinon.stub(createHostUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Hosts listed",
        data: [
          {
            id: "123",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          {
            id: "456",
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@example.com",
          },
        ],
      });

      await createHost.list(req, res);

      expect(validationResultStub.calledOnceWith(req)).to.be.true;
      expect(createHostUtil.list.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Hosts listed",
          hosts: [
            {
              id: "123",
              firstName: "John",
              lastName: "Doe",
              email: "john@example.com",
            },
            {
              id: "456",
              firstName: "Jane",
              lastName: "Doe",
              email: "jane@example.com",
            },
          ],
        })
      ).to.be.true;

      validationResult.withDefaults.restore();
      createHostUtil.list.restore();
    });

    // Add more test cases for the list method if needed
  });
});
