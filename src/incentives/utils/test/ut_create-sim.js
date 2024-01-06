require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;
const httpStatus = require("http-status");
const SimModel = require("@models/Sim");
const createSim = require("@utils/create-sim");
const generateFilter = require("@utils/generate-filter");
const constants = require("@config/constants");
const thingsMobile = require("@config/things-mobile");
const axios = require("axios");
const xml2js = require("xml2js");

describe("create-sim-util", () => {
  describe("createBulkLocal()", () => {
    it("should create SIM cards successfully", async () => {
      const request = {
        body: {
          sims: [241434923144471, "231334544149644"],
        },
        query: {
          tenant: "your-tenant",
        },
      };
      const simData = {
        _id: "653dec7f777af9759688916e",
        msisdn: 241434723144471,
      };
      const simModelStub = sinon.stub(SimModel("your-tenant"), "create");
      simModelStub.resolves(simData);

      const result = await createSim.createBulkLocal(request);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("All SIM cards created successfully");
      expect(result.failedCreations).to.be.an("array").that.is.empty;
      expect(result.data).to.be.an("array").that.is.not.empty;

      simModelStub.restore();
    });
    it("should handle SIM creation errors", async () => {
      const request = {
        body: {
          sims: [241434723144471, "231334544143644"],
        },
        query: {
          tenant: "your-tenant",
        },
      };
      const simModelStub = sinon.stub(SimModel("your-tenant"), "create");
      simModelStub.rejects(new Error("Sim creation failed"));

      const result = await createSim.createBulkLocal(request);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      expect(result.failedCreations).to.be.an("array").that.is.not.empty;
      expect(result.data).to.be.an("array").that.is.empty;

      simModelStub.restore();
    });
  });
  describe("createLocal()", () => {
    let fakeSimModel;

    beforeEach(() => {
      // Create a fake SimModel instance for testing
      fakeSimModel = {
        register: sinon.stub(),
      };
    });

    it("should create a new SIM successfully", async () => {
      const requestBody = {
        // ... mock request body
      };
      const tenant = "testTenant";
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      fakeSimModel.register.resolves(expectedResponse);

      const request = {
        body: requestBody,
        query: { tenant },
      };

      const response = await createSim.createLocal(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(fakeSimModel.register.calledOnceWith(requestBody)).to.be.true;
    });

    it("should handle registration failure", async () => {
      const requestBody = {
        // ... mock request body
      };
      const tenant = "testTenant";
      const expectedError = new Error("Registration failed");

      fakeSimModel.register.rejects(expectedError);

      const request = {
        body: requestBody,
        query: { tenant },
      };

      const response = await createSim.createLocal(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(fakeSimModel.register.calledOnceWith(requestBody)).to.be.true;
    });
  });
  describe("listLocal()", () => {
    let fakeSimModel;

    beforeEach(() => {
      // Create a fake SimModel instance for testing
      fakeSimModel = {
        list: sinon.stub(),
      };
    });

    it("should list SIMs successfully", async () => {
      const query = {
        tenant: "testTenant",
        limit: 10,
        skip: 0,
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
      };

      fakeSimModel.list.resolves(expectedResponse);

      const response = await createSim.listLocal(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.list.calledOnceWithExactly({
          filter: sinon.match.any, // mock filter data
          limit: query.limit,
          skip: query.skip,
        })
      ).to.be.true;
    });

    it("should handle listing failure", async () => {
      const query = {
        tenant: "testTenant",
        limit: 10,
        skip: 0,
      };
      const expectedError = new Error("Listing failed");

      const request = {
        query,
      };

      fakeSimModel.list.rejects(expectedError);

      const response = await createSim.listLocal(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.list.calledOnceWithExactly({
          filter: sinon.match.any, // mock filter data
          limit: query.limit,
          skip: query.skip,
        })
      ).to.be.true;
    });
  });
  describe("deleteLocal()", () => {
    let fakeSimModel;

    beforeEach(() => {
      // Create a fake SimModel instance for testing
      fakeSimModel = {
        remove: sinon.stub(),
      };
    });

    it("should delete SIMs successfully", async () => {
      const query = {
        tenant: "testTenant",
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
      };

      fakeSimModel.remove.resolves(expectedResponse);

      const response = await createSim.deleteLocal(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.remove.calledOnceWithExactly({
          filter: sinon.match.any, // mock filter data
        })
      ).to.be.true;
    });

    it("should handle deletion failure", async () => {
      const query = {
        tenant: "testTenant",
      };
      const expectedError = new Error("Deletion failed");

      const request = {
        query,
      };

      fakeSimModel.remove.rejects(expectedError);

      const response = await createSim.deleteLocal(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.remove.calledOnceWithExactly({
          filter: sinon.match.any, // mock filter data
        })
      ).to.be.true;
    });
  });
  describe("updateLocal()", () => {
    let fakeSimModel;

    beforeEach(() => {
      // Create a fake SimModel instance for testing
      fakeSimModel = {
        modify: sinon.stub(),
      };
    });

    it("should update SIM successfully", async () => {
      const query = {
        tenant: "testTenant",
      };
      const body = {
        // ... mock body data
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
        body,
      };

      fakeSimModel.modify.resolves(expectedResponse);

      const response = await createSim.updateLocal(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.modify.calledOnceWithExactly({
          filter: sinon.match.any, // mock filter data
          update: body,
        })
      ).to.be.true;
    });

    it("should handle update failure", async () => {
      const query = {
        tenant: "testTenant",
      };
      const body = {
        // ... mock body data
      };
      const expectedError = new Error("Update failed");

      const request = {
        query,
        body,
      };

      fakeSimModel.modify.rejects(expectedError);

      const response = await createSim.updateLocal(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.modify.calledOnceWithExactly({
          filter: sinon.match.any, // mock filter data
          update: body,
        })
      ).to.be.true;
    });
  });
  describe("checkStatus()", () => {
    let fakeSimModel;
    let fakeAxios;

    beforeEach(() => {
      // Create fake instances for testing
      fakeSimModel = {
        findById: sinon.stub(),
        findByIdAndUpdate: sinon.stub(),
      };
      fakeAxios = {
        post: sinon.stub(),
      };
    });

    it("should check SIM status and update successfully", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const sim = {
        msisdn: "testMsisdn",
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          sims: {
            sim: {
              balance: "100",
              // ... mock simInfo data
            },
          },
        },
      };

      fakeSimModel.findById.resolves(sim);
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);
      fakeSimModel.findByIdAndUpdate.resolves(sim);

      const response = await createSim.checkStatus(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
      expect(
        fakeSimModel.findByIdAndUpdate.calledOnceWithExactly(
          sinon.match(ObjectId(simId)),
          sinon.match({
            balance: "100",
            // ... mock jsonOutput data
          })
        )
      ).to.be.true;
    });

    it("should handle status check failure", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const expectedError = new Error("Status check failed");

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
      });
      fakeAxios.post.rejects(expectedError);

      const response = await createSim.checkStatus(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });
  });
  describe("activateSim()", () => {
    let fakeSimModel;
    let fakeAxios;

    beforeEach(() => {
      // Create fake instances for testing
      fakeSimModel = {
        findById: sinon.stub(),
      };
      fakeAxios = {
        post: sinon.stub(),
      };
    });

    it("should activate SIM successfully", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const sim = {
        msisdn: "testMsisdn",
        simBarcode: "testSimBarcode",
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: true,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves(sim);
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.activateSim(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle activation failure", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const expectedError = new Error("Activation failed");

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
        simBarcode: "testSimBarcode",
      });
      fakeAxios.post.rejects(expectedError);

      const response = await createSim.activateSim(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle activation failure response", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const expectedResponse = {
        success: false,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: false,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
        simBarcode: "testSimBarcode",
      });
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.activateSim(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });
  });
  describe("deactivateSim()", () => {
    let fakeSimModel;
    let fakeAxios;

    beforeEach(() => {
      // Create fake instances for testing
      fakeSimModel = {
        findById: sinon.stub(),
      };
      fakeAxios = {
        post: sinon.stub(),
      };
    });

    it("should deactivate SIM successfully", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const sim = {
        msisdn: "testMsisdn",
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: true,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves(sim);
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.deactivateSim(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle deactivation failure", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const expectedError = new Error("Deactivation failed");

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
      });
      fakeAxios.post.rejects(expectedError);

      const response = await createSim.deactivateSim(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle deactivation failure response", async () => {
      const query = {
        tenant: "testTenant",
      };
      const simId = "testSimId";
      const expectedResponse = {
        success: false,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: false,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
      });
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.deactivateSim(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });
  });
  describe("updateSimName()", () => {
    let fakeSimModel;
    let fakeAxios;

    beforeEach(() => {
      // Create fake instances for testing
      fakeSimModel = {
        findById: sinon.stub(),
      };
      fakeAxios = {
        post: sinon.stub(),
      };
    });

    it("should update SIM name successfully", async () => {
      const query = {
        tenant: "testTenant",
      };
      const name = "newName";
      const simId = "testSimId";
      const sim = {
        msisdn: "testMsisdn",
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
        body: {
          name,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: true,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves(sim);
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.updateSimName(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle name update failure", async () => {
      const query = {
        tenant: "testTenant",
      };
      const name = "newName";
      const simId = "testSimId";
      const expectedError = new Error("Update failed");

      const request = {
        query,
        params: {
          sim_id: simId,
        },
        body: {
          name,
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
      });
      fakeAxios.post.rejects(expectedError);

      const response = await createSim.updateSimName(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle name update failure response", async () => {
      const query = {
        tenant: "testTenant",
      };
      const name = "newName";
      const simId = "testSimId";
      const expectedResponse = {
        success: false,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
        body: {
          name,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: false,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
      });
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.updateSimName(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });
  });
  describe("rechargeSim()", () => {
    let fakeSimModel;
    let fakeAxios;

    beforeEach(() => {
      // Create fake instances for testing
      fakeSimModel = {
        findById: sinon.stub(),
      };
      fakeAxios = {
        post: sinon.stub(),
      };
    });

    it("should recharge SIM successfully", async () => {
      const query = {
        tenant: "testTenant",
      };
      const amount = 10;
      const simId = "testSimId";
      const sim = {
        msisdn: "testMsisdn",
      };
      const expectedResponse = {
        success: true,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
        body: {
          amount,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: true,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves(sim);
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.rechargeSim(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle recharge failure", async () => {
      const query = {
        tenant: "testTenant",
      };
      const amount = 10;
      const simId = "testSimId";
      const expectedError = new Error("Recharge failed");

      const request = {
        query,
        params: {
          sim_id: simId,
        },
        body: {
          amount,
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
      });
      fakeAxios.post.rejects(expectedError);

      const response = await createSim.rechargeSim(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal(expectedError.message);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });

    it("should handle recharge failure response", async () => {
      const query = {
        tenant: "testTenant",
      };
      const amount = 10;
      const simId = "testSimId";
      const expectedResponse = {
        success: false,
        // ... mock response
      };

      const request = {
        query,
        params: {
          sim_id: simId,
        },
        body: {
          amount,
        },
      };

      const xmlResponse = "<xml>...</xml>";
      const parsedResponse = {
        result: {
          done: false,
          // ... mock parsedResponse data
        },
      };

      fakeSimModel.findById.resolves({
        msisdn: "testMsisdn",
      });
      fakeAxios.post.resolves({ data: xmlResponse });
      xml2js.parseStringPromise.resolves(parsedResponse);

      const response = await createSim.rechargeSim(request);

      expect(response).to.deep.equal(expectedResponse);
      expect(
        fakeSimModel.findById.calledOnceWithExactly(
          sinon.match(ObjectId(simId))
        )
      ).to.be.true;
      expect(fakeAxios.post.calledOnce).to.be.true;
    });
  });
});
