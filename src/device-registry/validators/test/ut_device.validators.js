require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);

const deviceValidator = require("@validators/device.validators");
const NetworkModel = require("@models/Network");
const mongoose = require("mongoose");
const constants = require("@config/constants");

describe("Device Validator", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("validNetworks", () => {
    it("should return a list of valid networks", async () => {
      const mockNetworks = ["network1", "network2"];
      sandbox.stub(NetworkModel("airqo"), "distinct").resolves(mockNetworks);

      const result = await deviceValidator.validNetworks();
      expect(result).to.deep.equal(mockNetworks.map((n) => n.toLowerCase()));
    });
  });

  describe("validateNetwork", () => {
    it("should pass for a valid network", async () => {
      sandbox
        .stub(deviceValidator, "validNetworks")
        .resolves(["network1", "network2"]);
      await expect(deviceValidator.validateNetwork("network1")).to.be.fulfilled;
    });

    it("should throw an error for an invalid network", async () => {
      sandbox
        .stub(deviceValidator, "validNetworks")
        .resolves(["network1", "network2"]);
      await expect(
        deviceValidator.validateNetwork("invalidNetwork")
      ).to.be.rejectedWith("Invalid network");
    });
  });

  describe("validateTenant", () => {
    it("should validate tenant correctly", () => {
      const req = {
        query: { tenant: "validTenant" },
      };
      const validatorFunction = deviceValidator.validateTenant[0].run(req);
      expect(validatorFunction).to.be.a("function");
    });
  });

  describe("validateDeviceIdentifier", () => {
    it("should validate device_number correctly", () => {
      const req = {
        query: { device_number: "123" },
      };
      const validatorFunction = deviceValidator.validateDeviceIdentifier[0].run(
        req
      );
      expect(validatorFunction).to.be.a("function");
    });

    it("should validate id correctly", () => {
      const req = {
        query: { id: new mongoose.Types.ObjectId().toString() },
      };
      const validatorFunction = deviceValidator.validateDeviceIdentifier[1].run(
        req
      );
      expect(validatorFunction).to.be.a("function");
    });

    it("should validate name correctly", () => {
      const req = {
        query: { name: "device_name" },
      };
      const validatorFunction = deviceValidator.validateDeviceIdentifier[2].run(
        req
      );
      expect(validatorFunction).to.be.a("function");
    });
  });

  describe("validateCreateDevice", () => {
    it("should validate required fields", () => {
      const req = {
        body: {
          name: "Device Name",
          network: "validNetwork",
          latitude: "0.12345",
          longitude: "32.12345",
        },
      };
      const validatorFunctions = deviceValidator.validateCreateDevice.map(
        (validator) => validator.run(req)
      );
      validatorFunctions.forEach((func) => expect(func).to.be.a("function"));
    });
  });

  describe("validateUpdateDevice", () => {
    it("should validate update fields correctly", () => {
      const req = {
        body: {
          visibility: true,
          long_name: "Updated Device Name",
          latitude: "0.12345",
          longitude: "32.12345",
        },
      };
      const validatorFunctions = deviceValidator.validateUpdateDevice.map(
        (validator) => validator.run(req)
      );
      validatorFunctions.forEach((func) => expect(func).to.be.a("function"));
    });
  });

  describe("validateListDevices", () => {
    it("should validate list devices query parameters", () => {
      const req = {
        query: {
          device_number: "123",
          online_status: "online",
          category: "lowcost",
        },
      };
      const validatorFunction = deviceValidator.validateListDevices[0][0].run(
        req
      );
      expect(validatorFunction).to.be.a("function");
    });
  });

  describe("validateEncryptKeys", () => {
    it("should validate encrypt keys correctly", () => {
      const req = {
        body: {
          writeKey: "someWriteKey",
          readKey: "someReadKey",
        },
      };
      const validatorFunction = deviceValidator.validateEncryptKeys[0][0].run(
        req
      );
      expect(validatorFunction).to.be.a("function");
    });
  });

  describe("validateDecryptKeys", () => {
    it("should validate decrypt keys correctly", () => {
      const req = {
        body: {
          encrypted_key: "someEncryptedKey",
        },
      };
      const validatorFunction = deviceValidator.validateDecryptKeys[0].run(req);
      expect(validatorFunction).to.be.a("function");
    });
  });

  describe("validateDecryptManyKeys", () => {
    it("should validate decrypt many keys correctly", () => {
      const req = {
        body: [
          {
            encrypted_key: "someEncryptedKey",
            device_number: "123",
          },
        ],
      };
      const validatorFunctions = deviceValidator.validateDecryptManyKeys[0].map(
        (validator) => validator.run(req)
      );
      validatorFunctions.forEach((func) => expect(func).to.be.a("function"));
    });
  });

  describe("validateArrayBody", () => {
    it("should validate array body correctly", () => {
      const req = {
        body: [],
      };
      const validatorFunction = deviceValidator.validateArrayBody[0].run(req);
      expect(validatorFunction).to.be.a("function");
    });
  });
});
