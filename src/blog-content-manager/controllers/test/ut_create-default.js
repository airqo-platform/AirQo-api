require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const createDefaultUtil = require("@utils/create-default");
const generateFilter = require("@utils/generate-filter");
const {
  badRequest,
  convertErrorArrayToObject,
  tryCatchErrors,
} = require("@utils/errors");
const constants = require("@config/constants");
const defaults = require("@controllers/create-default");

describe("defaults controller", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("update()", () => {
    it("should update default successfully", async () => {
      const req = { query: { tenant: "airqo" }, body: { key: "value" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResultStub, "isEmpty")
        .returns(true);
      const generateFilterStub = sinon
        .stub(generateFilter, "defaults")
        .returns({
          success: true,
          data: { key: "value" },
        });
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "update")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Default updated successfully",
          data: { key: "value" },
        });

      await defaults.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(generateFilterStub.calledOnceWith(req)).to.be.true;
      expect(
        createDefaultUtilStub.calledOnceWith(
          "airqo",
          { key: "value" },
          { key: "value" }
        )
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Default updated successfully",
          default: { key: "value" },
        })
      ).to.be.true;
    });

    it("should handle default update failure", async () => {
      const req = { query: { tenant: "airqo" }, body: { key: "value" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResultStub, "isEmpty")
        .returns(true);
      const generateFilterStub = sinon
        .stub(generateFilter, "defaults")
        .returns({
          success: true,
          data: { key: "value" },
        });
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "update")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to update default",
          errors: { message: "Default update error" },
        });

      await defaults.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(generateFilterStub.calledOnceWith(req)).to.be.true;
      expect(
        createDefaultUtilStub.calledOnceWith(
          "airqo",
          { key: "value" },
          { key: "value" }
        )
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to update default",
          default: { key: "value" },
          errors: { message: "Default update error" },
        })
      ).to.be.true;
    });

    it("should handle filter generation failure", async () => {
      const req = { query: { tenant: "airqo" }, body: { key: "value" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResultStub, "isEmpty")
        .returns(true);
      const generateFilterStub = sinon
        .stub(generateFilter, "defaults")
        .returns({
          success: false,
          message: "Failed to generate filter",
          errors: { message: "Filter generation error" },
        });

      await defaults.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(generateFilterStub.calledOnceWith(req)).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to generate filter",
          errors: { message: "Filter generation error" },
        })
      ).to.be.true;
    });
  });

  describe("create()", () => {
    it("should create default successfully", async () => {
      const req = { query: { tenant: "airqo" }, body: { key: "value" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "create")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Default created successfully",
          data: { key: "value" },
        });

      await defaults.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        createDefaultUtilStub.calledOnceWith({
          body: { key: "value" },
          query: { tenant: "airqo" },
        })
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Default created successfully",
          default: { key: "value" },
        })
      ).to.be.true;
    });

    it("should handle default creation failure", async () => {
      const req = { query: { tenant: "airqo" }, body: { key: "value" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "create")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to create default",
          errors: { message: "Default creation error" },
        });

      await defaults.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        createDefaultUtilStub.calledOnceWith({
          body: { key: "value" },
          query: { tenant: "airqo" },
        })
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to create default",
          default: { key: "value" },
          errors: { message: "Default creation error" },
        })
      ).to.be.true;
    });
  });

  describe("list()", () => {
    it("should list all defaults by query params provided", async () => {
      const req = {
        query: { tenant: "airqo", limit: 10, skip: 0 },
        body: { key: "value" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const generateFilterDefaultsStub = sinon
        .stub(generateFilter, "defaults")
        .returns({
          success: true,
          data: { field: "value" },
        });
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "list")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Defaults listed successfully",
          data: [{ key: "value" }],
        });

      await defaults.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        generateFilterDefaultsStub.calledOnceWith({
          body: { key: "value" },
          query: { tenant: "airqo", limit: 10, skip: 0 },
        })
      ).to.be.true;
      expect(
        createDefaultUtilStub.calledOnceWith("airqo", { field: "value" }, 10, 0)
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Defaults listed successfully",
          defaults: [{ key: "value" }],
        })
      ).to.be.true;
    });

    it("should handle listing defaults failure", async () => {
      const req = {
        query: { tenant: "airqo", limit: 10, skip: 0 },
        body: { key: "value" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const generateFilterDefaultsStub = sinon
        .stub(generateFilter, "defaults")
        .returns({
          success: true,
          data: { field: "value" },
        });
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "list")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to list defaults",
          errors: { message: "Defaults listing error" },
        });

      await defaults.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        generateFilterDefaultsStub.calledOnceWith({
          body: { key: "value" },
          query: { tenant: "airqo", limit: 10, skip: 0 },
        })
      ).to.be.true;
      expect(
        createDefaultUtilStub.calledOnceWith("airqo", { field: "value" }, 10, 0)
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to list defaults",
          errors: { message: "Defaults listing error" },
        })
      ).to.be.true;
    });

    it("should handle filter generation failure", async () => {
      const req = {
        query: { tenant: "airqo", limit: 10, skip: 0 },
        body: { key: "value" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const generateFilterDefaultsStub = sinon
        .stub(generateFilter, "defaults")
        .returns({
          success: false,
          errors: { message: "Filter generation error" },
        });

      await defaults.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        generateFilterDefaultsStub.calledOnceWith({
          body: { key: "value" },
          query: { tenant: "airqo", limit: 10, skip: 0 },
        })
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Filter generation error",
        })
      ).to.be.true;
    });
  });

  describe("delete()", () => {
    it("should delete the default", async () => {
      const req = {
        query: { tenant: "airqo" },
        body: { key: "value" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "delete")
        .resolves({
          success: true,
          status: httpStatus.OK,
          message: "Default deleted successfully",
          data: { key: "value" },
        });

      await defaults.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.called).to.be.false;
      expect(
        createDefaultUtilStub.calledOnceWith({
          body: { key: "value" },
          query: { tenant: "airqo" },
        })
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Default deleted successfully",
          default: { key: "value" },
        })
      ).to.be.true;
    });

    it("should handle delete failure", async () => {
      const req = {
        query: { tenant: "airqo" },
        body: { key: "value" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });
      const createDefaultUtilStub = sinon
        .stub(createDefaultUtil, "delete")
        .resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to delete default",
          errors: { message: "Default deletion error" },
        });

      await defaults.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.called).to.be.false;
      expect(
        createDefaultUtilStub.calledOnceWith({
          body: { key: "value" },
          query: { tenant: "airqo" },
        })
      ).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Failed to delete default",
          errors: { message: "Default deletion error" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "airqo" },
        body: { key: "value" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub().returns({
        badRequest: sinon.stub(),
      });

      await defaults.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWith(res, "bad request errors", {
          nestedErrors: [],
        })
      ).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const req = {
        query: { tenant: "airqo" },
        body: { key: "value" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .throws(new Error("Some unexpected error"));

      await defaults.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some unexpected error" },
        })
      ).to.be.true;
    });
  });
});
