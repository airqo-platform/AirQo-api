require("module-alias/register");
const request = require("supertest");
const app = require("@bin/index");
const expect = chai.expect;
const sinon = require("sinon");

describe("Router Tests", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {};
    res = {
      json: sinon.spy(),
      status: sinon.stub().returns(res),
      send: sinon.spy(),
    };
  });

  afterEach(() => {
    sinon.restore();
  });
});

const express = require("express");
const router = express.Router();

// Mock the deviceController
const deviceController = {
  decryptKey: sinon.spy(),
  encryptKeys: sinon.spy(),
  getDevicesCount: sinon.spy(),
  list: sinon.spy(),
  listSummary: sinon.spy(),
  create: sinon.spy(),
  delete: sinon.spy(),
  update: sinon.spy(),
  refresh: sinon.spy(),
  listAllByNearestCoordinates: sinon.spy(),
  createOnPlatform: sinon.spy(),
  deleteOnPlatform: sinon.spy(),
  updateOnPlatform: sinon.spy(),
  generateQRCode: sinon.spy(),
};

// Mock the validators
const validateTenant = sinon.spy();
const validateDeviceIdentifier = sinon.spy();
const validateCreateDevice = sinon.spy();
const validateUpdateDevice = sinon.spy();
const validateEncryptKeys = sinon.spy();
const validateDecryptKeys = sinon.spy();
const validateDecryptManyKeys = sinon.spy();
const validateListDevices = sinon.spy();
const validateArrayBody = sinon.spy();

// Mock the middleware
const headers = sinon.spy();
const validatePagination = sinon.spy();

// Replace the actual router with our mocked one
router.post("/decrypt", validateDecryptKeys, deviceController.decryptKey);
router.post(
  "/decrypt/bulk",
  validateArrayBody,
  validateDecryptManyKeys,
  deviceController.decryptManyKeys
);
router.put(
  "/encrypt",
  validateTenant,
  validateDeviceIdentifier,
  validateEncryptKeys,
  deviceController.encryptKeys
);
router.get("/count", validateTenant, deviceController.getDevicesCount);
router.get("/", validateTenant, validateListDevices, deviceController.list);
router.get(
  "/summary",
  validateTenant,
  validateListDevices,
  deviceController.listSummary
);
router.post("/", validateTenant, validateCreateDevice, deviceController.create);
router.delete(
  "/",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.delete
);
router.put(
  "/",
  validateTenant,
  validateDeviceIdentifier,
  validateUpdateDevice,
  deviceController.update
);
router.put(
  "/refresh",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.refresh
);
router.get(
  "/by/nearest-coordinates",
  deviceController.listAllByNearestCoordinates
);
router.post(
  "/soft",
  validateTenant,
  validateCreateDevice,
  deviceController.createOnPlatform
);
router.delete(
  "/soft",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.deleteOnPlatform
);
router.put(
  "/soft",
  validateTenant,
  validateDeviceIdentifier,
  validateUpdateDevice,
  deviceController.updateOnPlatform
);
router.get(
  "/qrcode",
  validateTenant,
  validateDeviceIdentifier,
  deviceController.generateQRCode
);

describe("GET /count", () => {
  it("should call getDevicesCount with tenant validation", async () => {
    await request(app)
      .get("/count")
      .expect(200);
    expect(deviceController.getDevicesCount).to.have.been.calledWith(
      sinon.match.object
    );
  });
});

describe("GET /", () => {
  it("should call list with tenant validation and listDevices validation", async () => {
    await request(app)
      .get("/")
      .expect(200);
    expect(deviceController.list).to.have.been.calledWith(sinon.match.object);
  });
});

describe("GET /summary", () => {
  it("should call listSummary with tenant validation and listDevices validation", async () => {
    await request(app)
      .get("/summary")
      .expect(200);
    expect(deviceController.listSummary).to.have.been.calledWith(
      sinon.match.object
    );
  });
});

describe("POST /", () => {
  it("should call create with tenant validation and createDevice validation", async () => {
    const body = {
      /* sample device data */
    };
    await request(app)
      .post("/")
      .send(body)
      .expect(201);
    expect(deviceController.create).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});

describe("DELETE /", () => {
  it("should call delete with tenant validation, deviceIdentifier validation, and delete method", async () => {
    const deviceId = "12345";
    await request(app)
      .delete("/")
      .query({ id: deviceId })
      .expect(204);
    expect(deviceController.delete).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});

describe("PUT /", () => {
  it("should call update with tenant validation, deviceIdentifier validation, updateDevice validation, and update method", async () => {
    const deviceId = "12345";
    const body = {
      /* sample device update data */
    };
    await request(app)
      .put("/")
      .query({ id: deviceId })
      .send(body)
      .expect(200);
    expect(deviceController.update).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});

describe("PUT /refresh", () => {
  it("should call refresh with tenant validation, deviceIdentifier validation", async () => {
    const deviceId = "12345";
    await request(app)
      .put("/refresh")
      .query({ id: deviceId })
      .expect(200);
    expect(deviceController.refresh).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});

describe("GET /by/nearest-coordinates", () => {
  it("should call listAllByNearestCoordinates without any validations", async () => {
    await request(app)
      .get("/by/nearest-coordinates")
      .expect(200);
    expect(deviceController.listAllByNearestCoordinates).to.have.been
      .calledOnce;
  });
});

describe("POST /soft", () => {
  it("should call createOnPlatform with tenant validation and createDevice validation", async () => {
    const body = {
      /* sample soft create device data */
    };
    await request(app)
      .post("/soft")
      .send(body)
      .expect(201);
    expect(deviceController.createOnPlatform).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});

describe("DELETE /soft", () => {
  it("should call deleteOnPlatform with tenant validation, deviceIdentifier validation", async () => {
    const deviceId = "67890";
    await request(app)
      .delete("/soft")
      .query({ id: deviceId })
      .expect(204);
    expect(deviceController.deleteOnPlatform).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});

describe("PUT /soft", () => {
  it("should call updateOnPlatform with tenant validation, deviceIdentifier validation, updateDevice validation, and updateOnPlatform method", async () => {
    const deviceId = "67890";
    const body = {
      /* sample soft update device data */
    };
    await request(app)
      .put("/soft")
      .query({ id: deviceId })
      .send(body)
      .expect(200);
    expect(deviceController.updateOnPlatform).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});

describe("GET /qrcode", () => {
  it("should call generateQRCode with tenant validation and deviceIdentifier validation", async () => {
    const deviceId = "11111";
    await request(app)
      .get("/qrcode")
      .query({ id: deviceId })
      .expect(200);
    expect(deviceController.generateQRCode).to.have.been.calledWith(
      sinon.match.object,
      sinon.match.object
    );
  });
});
