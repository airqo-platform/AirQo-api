require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const createSimUtil = require("@utils/create-sim");
const createSim = require("@controllers/create-sim");

describe("createSim Controller", () => {
  describe("create()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        create: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should create sim successfully", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const responseFromCreateSim = {
        success: true,
        status: httpStatus.OK,
        message: "Sim created successfully",
        data: { sim_id: "testSimId" },
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.createLocal.resolves(responseFromCreateSim);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.createLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.createLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromCreateSim.message,
          created_sim: responseFromCreateSim.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const validationErrors = [
        {
          location: "body",
          msg: "Field is required",
          param: "msisdn",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.createLocal(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle create failure", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const expectedError = new Error("Sim creation failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.createLocal.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.createLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.createLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("delete()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        delete: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should delete sim successfully", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const responseFromRemoveSim = {
        success: true,
        status: httpStatus.OK,
        message: "Sim deleted successfully",
        data: { sim_id: "testSimId" },
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.deleteLocal.resolves(responseFromRemoveSim);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.deleteLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.deleteLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromRemoveSim.message,
          removed_sim: responseFromRemoveSim.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const validationErrors = [
        {
          location: "body",
          msg: "Field is required",
          param: "msisdn",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.deleteLocal(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle delete failure", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const expectedError = new Error("Sim deletion failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.deleteLocal.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.deleteLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.deleteLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("update()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        update: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should update sim successfully", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const responseFromUpdateSim = {
        success: true,
        status: httpStatus.OK,
        message: "Sim updated successfully",
        data: { sim_id: "testSimId" },
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.updateLocal.resolves(responseFromUpdateSim);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.updateLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.updateLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromUpdateSim.message,
          updated_sim: responseFromUpdateSim.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const validationErrors = [
        {
          location: "body",
          msg: "Field is required",
          param: "msisdn",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.updateLocal(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle update failure", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const expectedError = new Error("Sim update failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.updateLocal.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.updateLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.updateLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("list()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        list: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should list sims successfully", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const responseFromListSims = {
        success: true,
        status: httpStatus.OK,
        message: "Sims listed successfully",
        data: [{ sim_id: "sim1" }, { sim_id: "sim2" }],
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.listLocal.resolves(responseFromListSims);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.listLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.listLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromListSims.message,
          sims: responseFromListSims.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const validationErrors = [
        {
          location: "query",
          msg: "Field is required",
          param: "limit",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.listLocal(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle list failure", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const expectedError = new Error("Sims listing failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.listLocal.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.listLocal(request, fakeResponse);

      expect(fakeCreateSimUtil.listLocal.calledOnceWithExactly(request)).to.be
        .true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("checkStatus()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        checkStatus: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should check status successfully", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const responseFromCheckStatus = {
        success: true,
        status: httpStatus.OK,
        message: "Status checked successfully",
        data: "active",
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.checkStatus.resolves(responseFromCheckStatus);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.checkStatus(request, fakeResponse);

      expect(fakeCreateSimUtil.checkStatus.calledOnceWithExactly(request)).to.be
        .true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromCheckStatus.message,
          status: responseFromCheckStatus.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const validationErrors = [
        {
          location: "query",
          msg: "Field is required",
          param: "sim_id",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.checkStatus(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle check status failure", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const expectedError = new Error("Status check failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.checkStatus.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.checkStatus(request, fakeResponse);

      expect(fakeCreateSimUtil.checkStatus.calledOnceWithExactly(request)).to.be
        .true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("activateSim()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        activateSim: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should activate sim successfully", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const responseFromActivateSim = {
        success: true,
        status: httpStatus.OK,
        message: "Sim activated successfully",
        data: "active",
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.activateSim.resolves(responseFromActivateSim);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.activateSim(request, fakeResponse);

      expect(fakeCreateSimUtil.activateSim.calledOnceWithExactly(request)).to.be
        .true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromActivateSim.message,
          status: responseFromActivateSim.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const validationErrors = [
        {
          location: "query",
          msg: "Field is required",
          param: "sim_id",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.activateSim(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle activate sim failure", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const expectedError = new Error("Sim activation failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.activateSim.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.activateSim(request, fakeResponse);

      expect(fakeCreateSimUtil.activateSim.calledOnceWithExactly(request)).to.be
        .true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("deactivateSim()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        deactivateSim: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should deactivate sim successfully", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const responseFromDeactivateSim = {
        success: true,
        status: httpStatus.OK,
        message: "Sim deactivated successfully",
        data: "inactive",
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.deactivateSim.resolves(responseFromDeactivateSim);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.deactivateSim(request, fakeResponse);

      expect(fakeCreateSimUtil.deactivateSim.calledOnceWithExactly(request)).to
        .be.true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromDeactivateSim.message,
          status: responseFromDeactivateSim.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const validationErrors = [
        {
          location: "query",
          msg: "Field is required",
          param: "sim_id",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.deactivateSim(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle deactivate sim failure", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
      };
      const expectedError = new Error("Sim deactivation failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.deactivateSim.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.deactivateSim(request, fakeResponse);

      expect(fakeCreateSimUtil.deactivateSim.calledOnceWithExactly(request)).to
        .be.true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("updateSimName()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        updateSimName: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should update sim name successfully", async () => {
      const tenant = "testTenant";
      const name = "New Sim Name";
      const request = {
        query: { tenant },
        body: { name },
      };
      const responseFromUpdateSimName = {
        success: true,
        status: httpStatus.OK,
        message: "Sim name updated successfully",
        data: "updated",
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.updateSimName.resolves(responseFromUpdateSimName);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.updateSimName(request, fakeResponse);

      expect(fakeCreateSimUtil.updateSimName.calledOnceWithExactly(request)).to
        .be.true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromUpdateSimName.message,
          status: responseFromUpdateSimName.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
        body: {},
      };
      const validationErrors = [
        {
          location: "body",
          msg: "Field is required",
          param: "name",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.updateSimName(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle update sim name failure", async () => {
      const tenant = "testTenant";
      const name = "New Sim Name";
      const request = {
        query: { tenant },
        body: { name },
      };
      const expectedError = new Error("Sim name update failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.updateSimName.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.updateSimName(request, fakeResponse);

      expect(fakeCreateSimUtil.updateSimName.calledOnceWithExactly(request)).to
        .be.true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
  describe("rechargeSim()", () => {
    let fakeValidationResult;
    let fakeCreateSimUtil;
    let fakeResponse;

    beforeEach(() => {
      // Create fake instances for testing
      fakeValidationResult = {
        isEmpty: sinon.stub(),
      };
      fakeCreateSimUtil = {
        rechargeSim: sinon.stub(),
      };
      fakeResponse = {
        status: sinon.stub(),
        json: sinon.stub(),
      };
    });

    it("should recharge sim successfully", async () => {
      const tenant = "testTenant";
      const amount = 50;
      const request = {
        query: { tenant },
        body: { amount },
      };
      const responseFromRechargeSim = {
        success: true,
        status: httpStatus.OK,
        message: "Sim recharged successfully",
        data: "recharged",
      };

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.rechargeSim.resolves(responseFromRechargeSim);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.rechargeSim(request, fakeResponse);

      expect(fakeCreateSimUtil.rechargeSim.calledOnceWithExactly(request)).to.be
        .true;
      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.OK)).to.be
        .true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: true,
          message: responseFromRechargeSim.message,
          status: responseFromRechargeSim.data,
        })
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      const tenant = "testTenant";
      const request = {
        query: { tenant },
        body: {},
      };
      const validationErrors = [
        {
          location: "body",
          msg: "Field is required",
          param: "amount",
        },
      ];

      fakeValidationResult.isEmpty.returns(false);
      fakeValidationResult.errors = validationErrors;
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.rechargeSim(request, fakeResponse);

      expect(fakeResponse.status.calledOnceWithExactly(httpStatus.BAD_REQUEST))
        .to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "bad request errors",
          errors: validationErrors,
        })
      ).to.be.true;
    });

    it("should handle recharge sim failure", async () => {
      const tenant = "testTenant";
      const amount = 50;
      const request = {
        query: { tenant },
        body: { amount },
      };
      const expectedError = new Error("Sim recharge failed");

      fakeValidationResult.isEmpty.returns(true);
      fakeCreateSimUtil.rechargeSim.rejects(expectedError);
      fakeResponse.status.returns(fakeResponse);
      fakeResponse.json.returns({});

      await createSim.rechargeSim(request, fakeResponse);

      expect(fakeCreateSimUtil.rechargeSim.calledOnceWithExactly(request)).to.be
        .true;
      expect(
        fakeResponse.status.calledOnceWithExactly(
          httpStatus.INTERNAL_SERVER_ERROR
        )
      ).to.be.true;
      expect(
        fakeResponse.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: expectedError.message },
        })
      ).to.be.true;
    });
  });
});
