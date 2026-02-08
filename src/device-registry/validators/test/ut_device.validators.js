require("module-alias/register");
const { expect } = require("chai");
const { validationResult } = require("express-validator");
const deviceValidator = require("@validators/device.validators");
const mongoose = require("mongoose");
const constants = require("@config/constants");

// Helper function to simulate a request
const mockRequest = (query = {}, body = {}, params = {}) => ({
  query,
  body,
  params,
  get: function(header) {
    return this.headers[header];
  },
  headers: {},
});

describe("Device Validator", () => {
  describe("validateTenant", () => {
    it("should validate tenant correctly", () => {
      const req = mockRequest({ tenant: "airqo" });
      return deviceValidator.validateTenant[0](req, {}, () => {}).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true;
      });
    });

    it("should return an error for an invalid tenant", () => {
      const req = mockRequest({ tenant: "invalidTenant" });
      return deviceValidator.validateTenant[0](req, {}, () => {}).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
        expect(errors.array()[0].msg).to.equal(
          "the tenant value is not among the expected ones",
        );
      });
    });

    it("should return an error for an empty tenant", () => {
      const req = mockRequest({ tenant: "" });
      return deviceValidator.validateTenant[0](req, {}, () => {}).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
        expect(errors.array()[0].msg).to.equal(
          "tenant cannot be empty if provided",
        );
      });
    });

    it("should allow tenant to be optional", () => {
      const req = mockRequest(); // No tenant provided
      return deviceValidator.validateTenant[0](req, {}, () => {}).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true; // No errors expected
      });
    });
  });

  describe("validateDeviceIdentifier", () => {
    it("should validate device_number correctly", () => {
      const req = mockRequest({ device_number: 123 });
      return deviceValidator.validateDeviceIdentifier[0](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return error for invalid device_number", () => {
      const req = mockRequest({ device_number: "abc" });
      return deviceValidator.validateDeviceIdentifier[0](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
        expect(validationResult(req).array()[0].msg).to.equal(
          "the device_number should be an integer value",
        );
      });
    });

    it("should validate id correctly", () => {
      const req = mockRequest({ id: new mongoose.Types.ObjectId().toString() });
      return deviceValidator.validateDeviceIdentifier[1](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return error for invalid id", () => {
      const req = mockRequest({ id: "invalidId" });
      return deviceValidator.validateDeviceIdentifier[1](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
        expect(validationResult(req).array()[0].msg).to.equal(
          "id must be an object ID",
        );
      });
    });

    it("should validate name correctly", () => {
      const req = mockRequest({ name: "device_name" });
      return deviceValidator.validateDeviceIdentifier[2](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return error for invalid name (uppercase)", () => {
      const req = mockRequest({ name: "Device_Name" });
      return deviceValidator.validateDeviceIdentifier[2](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
        expect(validationResult(req).array()[0].msg).to.equal(
          "device name should be lower case",
        );
      });
    });

    it("should return error for invalid name (spaces)", () => {
      const req = mockRequest({ name: "device name" });
      return deviceValidator.validateDeviceIdentifier[2](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
        expect(validationResult(req).array()[0].msg).to.equal(
          "the device names do not have spaces in them",
        );
      });
    });

    it("should return error if none of the identifier parameters exist", () => {
      const req = mockRequest(); //No identifiers provided
      return deviceValidator.validateDeviceIdentifier[0](
        req,
        {},
        () => {},
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
        const errors = validationResult(req).array();
        expect(errors[0].msg).to.equal(
          "the device identifier is missing in request, consider using the device_number",
        );
      });
    });
  });

  describe("validateCreateDevice", () => {
    it("should validate required fields (name, network, lat, lon)", () => {
      const req = mockRequest(
        {},
        {
          name: "Device Name",
          network: "validNetwork",
          latitude: "0.12345",
          longitude: "32.12345",
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return errors for missing name, network, lat, lon", () => {
      const req = mockRequest({}, {});

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });

    it("should pass validation with valid tags", () => {
      const req = mockRequest(
        {},
        {
          name: "device-with-tags",
          network: "airqo",
          tags: ["tag1", "tag2"],
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true;
      });
    });

    it("should return an error if tags is not an array", () => {
      const req = mockRequest(
        {},
        {
          name: "device-with-invalid-tags",
          network: "airqo",
          tags: "not-an-array",
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
        expect(errors.array()[0].msg).to.equal(
          "tags must be an array of strings",
        );
      });
    });

    it("should return an error if tags array contains non-string elements", () => {
      const req = mockRequest(
        {},
        {
          name: "device-with-bad-tags",
          network: "airqo",
          tags: ["valid-tag", 123, true],
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
        const tagErrors = errors
          .array()
          .filter((err) => err.param === "tags[1]" || err.param === "tags[2]");
        expect(tagErrors).to.have.lengthOf(2);
        expect(tagErrors[0].msg).to.equal("Each tag must be a string");
        expect(tagErrors[1].msg).to.equal("Each tag must be a string");
      });
    });

    // Test other optional fields and invalid inputs
  });

  describe("validateUpdateDevice", () => {
    it("should validate update fields correctly", () => {
      const req = mockRequest(
        {},
        {
          visibility: true,
          long_name: "Updated Device Name",
          latitude: "0.12345",
          longitude: "32.12345",
        },
      );
      return Promise.all(
        deviceValidator.validateUpdateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return errors for invalid update fields", () => {
      const req = mockRequest(
        {},
        {
          visibility: 123, // Invalid boolean
          long_name: "", // Empty string
          latitude: "invalidLatitude", //Invalid lat
          longitude: "invalidLongitude", // Invalid lon
        },
      );
      return Promise.all(
        deviceValidator.validateUpdateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });

    // ... Test other optional fields and invalid inputs
  });

  describe("validateListDevices", () => {
    it("should validate list devices query parameters", () => {
      const req = mockRequest({
        device_number: "123",
        online_status: "online",
        category: "lowcost",
      });
      return deviceValidator.validateListDevices[0]
        [0](req, {}, () => {})
        .then(() => {
          expect(validationResult(req).isEmpty()).to.be.true;
        });
    });

    //Test invalid values
    it("should return errors for invalid query parameters", () => {
      const req = mockRequest({
        device_number: "invalid", //Invalid device number
        online_status: "invalidStatus", // Invalid online status
        category: 123, // Invalid category, should be a string
        device_category: "invalidCategory", //Invalid device category
      });
      return deviceValidator.validateListDevices[0]
        [0](req, {}, () => {})
        .then(() => {
          expect(validationResult(req).isEmpty()).to.be.false;
        });
    });

    describe("tags query param validation", () => {
      it("should pass validation with a single valid tag", () => {
        const req = mockRequest({ tags: "school" });
        return Promise.all(
          deviceValidator.validateListDevices.map((validator) =>
            validator(req, {}, () => {}),
          ),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.true;
        });
      });

      it("should pass validation with multiple comma-separated tags", () => {
        const req = mockRequest({ tags: "school, public, urban" });
        return Promise.all(
          deviceValidator.validateListDevices.map((validator) =>
            validator(req, {}, () => {}),
          ),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.true;
        });
      });

      it("should return an error if tags is provided but empty", () => {
        const req = mockRequest({ tags: "" });
        return Promise.all(
          deviceValidator.validateListDevices.map((validator) =>
            validator(req, {}, () => {}),
          ),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.false;
          expect(errors.array()[0].msg).to.equal(
            "tags must not be empty if provided",
          );
        });
      });

      it("should return an error for a trailing comma", () => {
        const req = mockRequest({ tags: "school," });
        return Promise.all(
          deviceValidator.validateListDevices.map((validator) =>
            validator(req, {}, () => {}),
          ),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.false;
          expect(errors.array()[0].msg).to.equal(
            "tags cannot contain empty values. Check for extra commas.",
          );
        });
      });

      it("should return an error for duplicate commas", () => {
        const req = mockRequest({ tags: "school,,public" });
        return Promise.all(
          deviceValidator.validateListDevices.map((validator) =>
            validator(req, {}, () => {}),
          ),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.false;
          expect(errors.array()[0].msg).to.equal(
            "tags cannot contain empty values. Check for extra commas.",
          );
        });
      });
    });
  });

  describe("validateEncryptKeys", () => {
    it("should validate encrypt keys correctly", () => {
      const req = mockRequest(
        {},
        {
          writeKey: "someWriteKey",
          readKey: "someReadKey",
        },
      );

      return deviceValidator.validateEncryptKeys[0]
        [0](req, {}, () => {})
        .then(() => {
          expect(validationResult(req).isEmpty()).to.be.true;
        });
    });

    it("should return errors for missing encrypted keys", () => {
      const req = mockRequest({}, {});

      return deviceValidator.validateEncryptKeys[0]
        [0](req, {}, () => {})
        .then(() => {
          expect(validationResult(req).isEmpty()).to.be.false;
        });
    });
  });

  describe("validateDecryptKeys", () => {
    it("should validate decrypt keys correctly", () => {
      const req = mockRequest(
        {},
        {
          encrypted_key: "someEncryptedKey",
        },
      );
      return deviceValidator.validateDecryptKeys[0](req, {}, () => {}).then(
        () => {
          expect(validationResult(req).isEmpty()).to.be.true;
        },
      );
    });
  });

  describe("validateDecryptManyKeys", () => {
    it("should validate decrypt many keys correctly", () => {
      const req = mockRequest({}, [
        {
          encrypted_key: "someEncryptedKey",
          device_number: "123",
        },
      ]);

      return Promise.all(
        deviceValidator.validateDecryptManyKeys[0].map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true;
      });
    });

    it("should return errors for invalid decrypt many keys", () => {
      const req = mockRequest({}, [
        {
          // encrypted_key: "someEncryptedKey", //Missing key
          device_number: "abc", //Invalid number
        },
      ]);

      return Promise.all(
        deviceValidator.validateDecryptManyKeys[0].map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
      });
    });
  });

  describe("validateArrayBody", () => {
    it("should validate array body correctly", () => {
      const req = mockRequest({}, []);
      return deviceValidator.validateArrayBody[0](req, {}, () => {}).then(
        () => {
          expect(validationResult(req).isEmpty()).to.be.true;
        },
      );
    });
  });

  describe("validateBulkUpdateDevices", () => {
    it("should validate valid device IDs and update data", () => {
      const req = mockRequest(
        {},
        {
          deviceIds: [
            new mongoose.Types.ObjectId(),
            new mongoose.Types.ObjectId(),
          ],
          updateData: { description: "Updated description" },
        },
      );

      return Promise.all(
        deviceValidator.validateBulkUpdateDevices.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true;
      });
    });

    it("should return an error for invalid device IDs", () => {
      const req = mockRequest(
        {},
        {
          deviceIds: ["invalidId1", "invalidId2"],
          updateData: { description: "Updated description" },
        },
      );

      return Promise.all(
        deviceValidator.validateBulkUpdateDevices.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
        expect(errors.array()[0].msg).to.equal(
          "All deviceIds must be valid MongoDB ObjectIds",
        );
      });
    });

    it("should return an error for invalid updateData", () => {
      const req = mockRequest(
        {},
        {
          deviceIds: [
            new mongoose.Types.ObjectId(),
            new mongoose.Types.ObjectId(),
          ],
          updateData: { invalidField: "some value" },
        },
      );
      return Promise.all(
        deviceValidator.validateBulkUpdateDevices.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
        expect(errors.array()[0].msg).to.equal(
          "Invalid fields in updateData: invalidField",
        );
      });
    });

    // ... more tests for validateBulkUpdateDevices
  });
});
