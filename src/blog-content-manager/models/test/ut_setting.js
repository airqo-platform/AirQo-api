require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const SettingModel = require("@models/Setting");

describe("Setting Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("SettingSchema", () => {
    it("should define the schema correctly", () => {
      const schema = SettingSchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.name).to.exist;
      expect(schema.paths.value).to.exist;
      expect(schema.paths.description).to.exist;
      expect(schema.paths.type).to.exist;
      expect(schema.paths.category).to.exist;
      expect(schema.paths.status).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validSetting = {
        name: "Some setting name",
        value: { key: "value" },
        category: "some-category",
      };

      const invalidSetting = {};

      expect(SettingSchema.validate(validSetting)).to.not.throw();
      expect(() => SettingSchema.validate(invalidSetting)).to.throw(
        /Setting name is required/
      );
      expect(() => SettingSchema.validate(invalidSetting)).to.throw(
        /Setting value is required/
      );
      expect(() => SettingSchema.validate(invalidSetting)).to.throw(
        /Setting category is required/
      );
    });

    it("should validate unique names", async () => {
      const validSetting = {
        name: "Unique Setting",
        value: { key: "value" },
      };

      const duplicateSetting = {
        name: "Unique Setting",
        value: { key: "different-value" },
      };

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Setting = mongoose.model("settings", SettingSchema);

      await Setting.create(validSetting);

      await expect(SettingSchema.validate(duplicateSetting)).to.be.rejectedWith(
        "Name should be unique!"
      );
    });

    it("should validate setting value based on type", async () => {
      // This test assumes we're using a custom validator function
      // You may need to adjust this based on how you've implemented the validation
      const validStringSetting = {
        name: "string-setting",
        value: "some-string",
      };
      const validBooleanSetting = { name: "boolean-setting", value: true };
      const validIntegerSetting = { name: "integer-setting", value: 42 };
      const validArraySetting = {
        name: "array-setting",
        value: ["item1", "item2"],
      };

      const invalidSettings = [
        { name: "invalid-type-setting", value: 123 }, // Should fail for string type
        { name: "invalid-type-setting", value: {} }, // Should fail for boolean type
        { name: "invalid-type-setting", value: [] }, // Should fail for integer type
        { name: "invalid-type-setting", value: "not-an-array" }, // Should fail for array type
      ];

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Setting = mongoose.model("settings", SettingSchema);

      await Promise.all([
        Setting.create(validStringSetting),
        Setting.create(validBooleanSetting),
        Setting.create(validIntegerSetting),
        Setting.create(validArraySetting),
      ]);

      await Promise.all(
        invalidSettings.map((setting) =>
          expect(SettingSchema.validate(setting)).to.throw(
            "Invalid setting value"
          )
        )
      );
    });
  });

  describe("SettingSchema methods", () => {
    it("should export toJSON method", () => {
      const setting = new SettingModel()
        .schema({
          _id: "123",
          name: "Test Name",
          value: { key: "value" },
          description: "Test Description",
          type: "string",
          category: "test-category",
          status: "active",
        })
        .toObject();

      const jsonResult = setting.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: "123",
        name: "Test Name",
        value: { key: "value" },
        description: "Test Description",
        type: "string",
        category: "test-category",
        status: "active",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("static methods", () => {
    let mockMongooseModel;

    beforeEach(() => {
      mockMongooseModel = sinon.mock(mongoose.Model);
    });

    afterEach(() => {
      mockMongooseModel.restore();
    });

    describe("create method", () => {
      it("should create a new setting item", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({ _id: "123", name: "Test Name", value: { key: "value" } });

        const result = await SettingModel.create(
          { name: "Test Name", value: { key: "value" } },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Setting created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          name: "Test Name",
          value: { key: "value" },
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await SettingModel.create({}, {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create setting");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list settings", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              name: "Setting 1",
              value: { key: "value1" },
              category: "category1",
            },
            {
              _id: "2",
              name: "Setting 2",
              value: { key: "value2" },
              category: "category2",
            },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await SettingModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved settings");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });

      it("should handle empty results", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(0);

        const result = await SettingModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal([]);
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("No settings found");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a setting by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({ _id: "123", name: "Test Name", value: { key: "value" } });

        const result = await SettingModel.findById("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully retrieved setting");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledOnceWith({ _id: "123" });
      });

      it("should return not found when setting does not exist", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .rejects(new Error("Setting not found"));

        const result = await SettingModel.findById("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Setting not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("update method", () => {
      it("should update a setting", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            name: "Updated Name",
            value: { key: "updated-value" },
            category: "test-category",
          });

        const result = await SettingModel.update(
          {
            id: "123",
            update: { name: "Updated Name", value: { key: "updated-value" } },
          },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully updated the setting");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          "123",
          { name: "Updated Name", value: { key: "updated-value" } },
          { new: true, runValidators: true }
        );
      });

      it("should return not found when setting does not exist", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Setting not found"));

        const result = await SettingModel.update(
          { id: "nonexistent-id", update: {} },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Setting not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          "nonexistent-id",
          {},
          { new: true, runValidators: true }
        );
      });
    });

    describe("remove method", () => {
      it("should remove a setting", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves({
            _id: "123",
            name: "Test Name",
            value: { key: "value" },
            category: "test-category",
          });

        const result = await SettingModel.remove("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully removed the setting");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockRemove).to.have.been.calledOnceWith("123");
      });

      it("should return not found when setting does not exist", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .rejects(new Error("Setting not found"));

        const result = await SettingModel.remove("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Setting not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockRemove).to.have.been.calledOnceWith("nonexistent-id");
      });
    });

    describe("findByCategory method", () => {
      it("should find settings by category", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              name: "Setting 1",
              value: { key: "value1" },
              category: "category1",
            },
            {
              _id: "2",
              name: "Setting 2",
              value: { key: "value2" },
              category: "category1",
            },
          ]);

        const result = await SettingModel.findByCategory("category1", {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.message).to.equal(
          "Successfully retrieved settings for category"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind)
          .to.have.been.calledOnceWith({ category: "category1" })
          .sort({ name: 1 });
      });

      it("should return not found when no settings are found for the category", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([]);

        const result = await SettingModel.findByCategory(
          "nonexistent-category",
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("No settings found for this category");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFind)
          .to.have.been.calledOnceWith({ category: "nonexistent-category" })
          .sort({ name: 1 });
      });
    });
  });
});
