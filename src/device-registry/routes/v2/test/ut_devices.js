require("module-alias/register");
const request = require("supertest");
const express = require("express");
const { expect } = require("chai");
const sinon = require("sinon");

// Import the device router and controller
const deviceRouter = require("@routes/v2/devices");
const deviceController = require("@controllers/create-device");

describe("Device Router", () => {
  let app;

  before(() => {
    app = express();
    app.use(express.json());
    app.use(deviceRouter);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("POST /decrypt", () => {
    it("should call deviceController.decryptKey", async () => {
      const decryptKeyStub = sinon.stub(deviceController, "decryptKey");
      const response = await request(app)
        .post("/decrypt")
        .send({
          encrypted_key: "encrypted_value",
        });
      expect(decryptKeyStub.calledOnce).to.be.true;
      expect(response.status).to.equal(200);
      // Add more assertions as needed
    });
  });

  describe("PUT /encrypt", () => {
    it("should call deviceController.encryptKeys", async () => {
      const encryptKeysStub = sinon.stub(deviceController, "encryptKeys");
      const response = await request(app)
        .put("/encrypt?tenant=example")
        .query({
          device_number: 12345,
        });
      expect(encryptKeysStub.calledOnce).to.be.true;
      expect(response.status).to.equal(200);
      // Add more assertions as needed
    });
  });

  describe("GET /count", () => {
    it("should call deviceController.getDevicesCount", async () => {
      const getDevicesCountStub = sinon.stub(
        deviceController,
        "getDevicesCount"
      );
      const response = await request(app).get("/count?tenant=example");
      expect(getDevicesCountStub.calledOnce).to.be.true;
      expect(response.status).to.equal(200);
      // Add more assertions as needed
    });
  });

  describe("GET /", () => {
    it("should call deviceController.list", async () => {
      const listStub = sinon.stub(deviceController, "list");
      const response = await request(app).get("/?tenant=example");
      expect(listStub.calledOnce).to.be.true;
      expect(response.status).to.equal(200);
      // Add more assertions as needed
    });
  });

  describe("POST /", () => {
    it("should call deviceController.create", async () => {
      const createStub = sinon.stub(deviceController, "create");
      const response = await request(app)
        .post("/?tenant=example")
        .send({
          device_number: 12345,
          long_name: "Device 1",
          // Add other required fields for device creation
        });
      expect(createStub.calledOnce).to.be.true;
      expect(response.status).to.equal(200);
      // Add more assertions as needed
    });
  });

  describe("DELETE /", () => {
    it("should call deviceController.delete", async () => {
      const deleteStub = sinon.stub(deviceController, "delete");
      const response = await request(app)
        .delete("/?tenant=example")
        .query({
          device_number: 12345,
        });
      expect(deleteStub.calledOnce).to.be.true;
      expect(response.status).to.equal(200);
      // Add more assertions as needed
    });
  });

  describe("PUT /", () => {
    it("should call deviceController.update", async () => {
      const updateStub = sinon.stub(deviceController, "update");
      const response = await request(app)
        .put("/?tenant=example")
        .query({
          device_number: 12345,
        });
      expect(updateStub.calledOnce).to.be.true;
      expect(response.status).to.equal(200);
      // Add more assertions as needed
    });
  });
});
