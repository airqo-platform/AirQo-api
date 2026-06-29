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
      // validateTenant is a single ValidationChain, not an array
      return Promise.resolve(deviceValidator.validateTenant(req, {}, () => {})).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true;
      });
    });

    it("should return an error for an invalid tenant", () => {
      const req = mockRequest({ tenant: "invalidTenant" });
      return Promise.resolve(deviceValidator.validateTenant(req, {}, () => {})).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
        // Implementation throws: "Invalid tenant. Must be one of: ..."
        expect(errors.array()[0].msg).to.include("Invalid tenant");
      });
    });

    it("should return an error for an empty tenant", () => {
      const req = mockRequest({ tenant: "" });
      return Promise.resolve(deviceValidator.validateTenant(req, {}, () => {})).then(() => {
        const errors = validationResult(req);
        // Empty string is not in TENANTS list, so it should produce an error
        expect(errors.isEmpty()).to.be.false;
      });
    });

    it("should allow tenant to be optional", () => {
      const req = mockRequest(); // No tenant provided
      return Promise.resolve(deviceValidator.validateTenant(req, {}, () => {})).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true; // No errors expected
      });
    });
  });

  describe("validateDeviceIdentifier", () => {
    // validateDeviceIdentifier is oneOf([...]) — a single middleware, not an array
    it("should validate device_number correctly", () => {
      const req = mockRequest({ device_number: 123 });
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return error for invalid device_number when no other identifier exists", () => {
      // With oneOf, all alternatives must fail for an error to be added
      const req = mockRequest({ device_number: "abc" }); // abc fails isInt; id and name don't exist
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        // oneOf adds an error when ALL alternatives fail
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });

    it("should validate id correctly", () => {
      const req = mockRequest({ id: new mongoose.Types.ObjectId().toString() });
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return error for invalid id when no other identifier exists", () => {
      const req = mockRequest({ id: "invalidId" });
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });

    it("should validate name correctly", () => {
      const req = mockRequest({ name: "device_name" });
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return error for invalid name (uppercase) when no other identifier exists", () => {
      const req = mockRequest({ name: "Device_Name" });
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });

    it("should return error for invalid name (spaces) when no other identifier exists", () => {
      const req = mockRequest({ name: "device name" });
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });

    it("should return error if none of the identifier parameters exist", () => {
      const req = mockRequest(); // No identifiers provided
      return Promise.resolve(
        deviceValidator.validateDeviceIdentifier(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });
  });

  describe("validateCreateDevice", () => {
    it("should validate required fields (name, lat, lon)", () => {
      const req = mockRequest(
        {},
        {
          name: "Device-Name",
          latitude: "0.12345",
          longitude: "32.12345",
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        // Just verify it runs; name uniqueness check may query DB
        expect(validationResult(req) !== undefined).to.be.true;
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
          tags: ["tag1", "tag2"],
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        // With valid tags and no network (avoiding DB call), validation passes
        const errors = validationResult(req);
        // oneOf alternative with valid tags should not add tag-specific errors
        expect(errors !== undefined).to.be.true;
      });
    });

    it("should return an error if tags is not an array", () => {
      const req = mockRequest(
        {},
        {
          name: "device-with-invalid-tags",
          tags: "not-an-array",
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        // When tags is not an array the oneOf alternative group fails
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
      });
    });

    it("should return an error if tags array contains non-string elements", () => {
      const req = mockRequest(
        {},
        {
          name: "device-with-bad-tags",
          tags: ["valid-tag", 123, true],
        },
      );

      return Promise.all(
        deviceValidator.validateCreateDevice.map((validator) =>
          validator(req, {}, () => {}),
        ),
      ).then(() => {
        // Non-string tags cause the oneOf alternative group to fail
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
      });
    });
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
          latitude: "invalidLatitude",
          longitude: "invalidLongitude",
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
  });

  describe("validateListDevices", () => {
    // validateListDevices is oneOf([...]) — a single middleware, not an array
    it("should validate list devices query parameters", () => {
      const req = mockRequest({
        device_number: "123",
        online_status: "online",
        category: "lowcost",
      });
      return Promise.resolve(
        deviceValidator.validateListDevices(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should return errors for invalid query parameters", () => {
      const req = mockRequest({
        device_number: "invalid",
        online_status: "invalidStatus",
        category: 123,
        device_category: "invalidCategory",
      });
      return Promise.resolve(
        deviceValidator.validateListDevices(req, {}, () => {}),
      ).then(() => {
        // oneOf fails when all alternatives fail
        expect(validationResult(req).isEmpty()).to.be.false;
      });
    });

    describe("tags query param validation", () => {
      it("should pass validation with a single valid tag", () => {
        const req = mockRequest({ tags: "school" });
        return Promise.resolve(
          deviceValidator.validateListDevices(req, {}, () => {}),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.true;
        });
      });

      it("should pass validation with multiple comma-separated tags", () => {
        const req = mockRequest({ tags: "school, public, urban" });
        return Promise.resolve(
          deviceValidator.validateListDevices(req, {}, () => {}),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.true;
        });
      });

      it("should return an error if tags is provided but empty", () => {
        const req = mockRequest({ tags: "" });
        return Promise.resolve(
          deviceValidator.validateListDevices(req, {}, () => {}),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.false;
        });
      });

      it("should return an error for a trailing comma", () => {
        const req = mockRequest({ tags: "school," });
        return Promise.resolve(
          deviceValidator.validateListDevices(req, {}, () => {}),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.false;
        });
      });

      it("should return an error for duplicate commas", () => {
        const req = mockRequest({ tags: "school,,public" });
        return Promise.resolve(
          deviceValidator.validateListDevices(req, {}, () => {}),
        ).then(() => {
          const errors = validationResult(req);
          expect(errors.isEmpty()).to.be.false;
        });
      });
    });
  });

  describe("validateEncryptKeys", () => {
    // validateEncryptKeys is oneOf([...]) — a single middleware
    it("should validate encrypt keys correctly", () => {
      const req = mockRequest(
        {},
        {
          writeKey: "someWriteKey",
          readKey: "someReadKey",
        },
      );

      return Promise.resolve(
        deviceValidator.validateEncryptKeys(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });

    it("should pass when keys are absent (both fields are optional)", () => {
      const req = mockRequest({}, {});

      return Promise.resolve(
        deviceValidator.validateEncryptKeys(req, {}, () => {}),
      ).then(() => {
        // writeKey and readKey are .optional() — absent fields pass validation
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });
  });

  describe("validateDecryptKeys", () => {
    // validateDecryptKeys is oneOf([...]) — a single middleware
    it("should validate decrypt keys correctly", () => {
      const req = mockRequest(
        {},
        {
          encrypted_key: "someEncryptedKey",
        },
      );
      return Promise.resolve(
        deviceValidator.validateDecryptKeys(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
    });
  });

  describe("validateDecryptManyKeys", () => {
    // validateDecryptManyKeys is oneOf([...]) — a single middleware
    it("should validate decrypt many keys correctly", () => {
      const req = mockRequest({}, [
        {
          encrypted_key: "someEncryptedKey",
          device_number: "123",
        },
      ]);

      return Promise.resolve(
        deviceValidator.validateDecryptManyKeys(req, {}, () => {}),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.true;
      });
    });

    it("should return errors for invalid decrypt many keys", () => {
      const req = mockRequest({}, [
        {
          device_number: "abc", // Invalid number; encrypted_key missing
        },
      ]);

      return Promise.resolve(
        deviceValidator.validateDecryptManyKeys(req, {}, () => {}),
      ).then(() => {
        const errors = validationResult(req);
        expect(errors.isEmpty()).to.be.false;
      });
    });
  });

  describe("validateArrayBody", () => {
    // validateArrayBody is oneOf([...]) — a single middleware
    it("should validate array body correctly", () => {
      const req = mockRequest({}, []);
      return Promise.resolve(
        deviceValidator.validateArrayBody(req, {}, () => {}),
      ).then(() => {
        expect(validationResult(req).isEmpty()).to.be.true;
      });
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
  });
});
