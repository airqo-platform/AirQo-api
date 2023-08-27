const chai = require("chai");
const chaiHttp = require("chai-http");
const express = require("express");
const { describe, it, beforeEach } = require("mocha");
const router = require("@routes/sims");
const createSimController = require("@controllers/create-sim");
const { validationResult } = require("express-validator");
const { expect } = chai;
chai.use(chaiHttp);

describe("sims route", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use("/", router);
  });

  describe("POST /", () => {
    it("should call createSimController.create", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.create
      };
      sinon
        .stub(createSimController, "create")
        .callsFake(createSimControllerMock);

      const response = await chai.request(app).post("/");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.create.calledOnce).to.be.true;

      createSimController.create.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai.request(app).post("/");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("GET /", () => {
    it("should call createSimController.list", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.list
      };
      sinon
        .stub(createSimController, "list")
        .callsFake(createSimControllerMock);

      const response = await chai.request(app).get("/");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.list.calledOnce).to.be.true;

      createSimController.list.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai.request(app).get("/");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("PUT /:sim_id", () => {
    it("should call createSimController.update", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.update
      };
      sinon
        .stub(createSimController, "update")
        .callsFake(createSimControllerMock);

      const response = await chai.request(app).put("/your_sim_id_here");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.update.calledOnce).to.be.true;

      createSimController.update.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai.request(app).put("/your_sim_id_here");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("DELETE /:sim_id", () => {
    it("should call createSimController.delete", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.delete
      };
      sinon
        .stub(createSimController, "delete")
        .callsFake(createSimControllerMock);

      const response = await chai.request(app).delete("/your_sim_id_here");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.delete.calledOnce).to.be.true;

      createSimController.delete.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai.request(app).delete("/your_sim_id_here");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("GET /:sim_id/status", () => {
    it("should call createSimController.checkStatus", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.checkStatus
      };
      sinon
        .stub(createSimController, "checkStatus")
        .callsFake(createSimControllerMock);

      const response = await chai.request(app).get("/your_sim_id_here/status");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.checkStatus.calledOnce).to.be.true;

      createSimController.checkStatus.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai.request(app).get("/your_sim_id_here/status");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("GET /:sim_id/activate", () => {
    it("should call createSimController.checkStatus", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.checkStatus
      };
      sinon
        .stub(createSimController, "checkStatus")
        .callsFake(createSimControllerMock);

      const response = await chai
        .request(app)
        .get("/your_sim_id_here/activate");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.checkStatus.calledOnce).to.be.true;

      createSimController.checkStatus.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai
        .request(app)
        .get("/your_sim_id_here/activate");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("DELETE /:sim_id/deactivate", () => {
    it("should call createSimController.deactivateSim", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.deactivateSim
      };
      sinon
        .stub(createSimController, "deactivateSim")
        .callsFake(createSimControllerMock);

      const response = await chai
        .request(app)
        .delete("/your_sim_id_here/deactivate");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.deactivateSim.calledOnce).to.be.true;

      createSimController.deactivateSim.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai
        .request(app)
        .delete("/your_sim_id_here/deactivate");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("PUT /:sim_id/update", () => {
    it("should call createSimController.updateSimName", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.updateSimName
      };
      sinon
        .stub(createSimController, "updateSimName")
        .callsFake(createSimControllerMock);

      const response = await chai
        .request(app)
        .put("/your_sim_id_here/update")
        .send({ name: "New Name" }); // Provide required request body data

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.updateSimName.calledOnce).to.be.true;

      createSimController.updateSimName.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai.request(app).put("/your_sim_id_here/update");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("POST /:sim_id/recharge", () => {
    it("should call createSimController.rechargeSim", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.rechargeSim
      };
      sinon
        .stub(createSimController, "rechargeSim")
        .callsFake(createSimControllerMock);

      const response = await chai
        .request(app)
        .post("/your_sim_id_here/recharge")
        .send({ amount: 100 }); // Provide required request body data

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.rechargeSim.calledOnce).to.be.true;

      createSimController.rechargeSim.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai
        .request(app)
        .post("/your_sim_id_here/recharge");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases
  });
  describe("GET /:sim_id", () => {
    it("should call createSimController.list", async () => {
      const createSimControllerMock = (req, res, next) => {
        // Your mock implementation of createSimController.list
      };
      sinon
        .stub(createSimController, "list")
        .callsFake(createSimControllerMock);

      const response = await chai.request(app).get("/your_sim_id_here");

      expect(response.status).to.equal(200); // Adjust status code as needed
      expect(createSimController.list.calledOnce).to.be.true;

      createSimController.list.restore();
    });

    it("should return 400 if validation fails", async () => {
      const response = await chai.request(app).get("/your_sim_id_here");

      expect(response.status).to.equal(400); // Adjust status code as needed
      expect(validationResult.called).to.be.true;
    });

    // Add more tests for specific validation cases and response expectations
  });
});
