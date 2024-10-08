require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const TagModel = require("@models/Tag");
const { HttpError } = require("@utils/errors");

describe("Tag Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("TagSchema", () => {
    it("should define the schema correctly", () => {
      const schema = TagSchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.name).to.exist;
      expect(schema.paths.slug).to.exist;
      expect(schema.paths.description).to.exist;
      expect(schema.paths.color).to.exist;
      expect(schema.paths.status).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validTag = {
        name: "Test Tag",
        slug: "test-slug",
        description: "Test Description",
        color: "#000000",
        status: "active",
      };

      const invalidTag = {};

      expect(TagSchema.validate(validTag)).to.not.throw();
      expect(() => TagSchema.validate(invalidTag)).to.throw(/Name is required/);
      expect(() => TagSchema.validate(invalidTag)).to.throw(/Slug is required/);
      expect(() => TagSchema.validate(invalidTag)).to.throw(
        /Description is required/
      );
      expect(() => TagSchema.validate(invalidTag)).to.throw(
        /Color is required/
      );
      expect(() => TagSchema.validate(invalidTag)).to.throw(
        /Status is required/
      );
    });

    it("should validate unique fields", async () => {
      const validTag = {
        name: "UniqueTag",
        slug: "unique-slug",
      };

      const duplicateTag = {
        name: "UniqueTag",
        slug: "duplicate-slug",
      };

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Tag = mongoose.model("tags", TagSchema);

      await Tag.create(validTag);

      await expect(TagSchema.validate(duplicateTag)).to.be.rejectedWith(
        "Name should be unique!"
      );
      await expect(TagSchema.validate(duplicateTag)).to.be.rejectedWith(
        "Slug should be unique!"
      );
    });

    it("should validate name length", async () => {
      const validName = "Valid Name";
      const longName = "a".repeat(51); // 51 characters (exceeds max length of 50)
      const shortName = "a".repeat(49); // 49 characters (within max length)

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Tag = mongoose.model("tags", TagSchema);

      await Tag.create({ name: validName });

      await expect(TagSchema.validate({ name: longName })).to.be.rejectedWith(
        "Name cannot be more than 50 characters"
      );

      await expect(TagSchema.validate({ name: shortName })).to.not.throw();
    });

    it("should validate slug format", async () => {
      const validSlug = "valid-slug";
      const invalidSlugs = [
        "invalid-slug",
        "slug@with-special-characters",
        "slug-with-spaces",
      ];

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Tag = mongoose.model("tags", TagSchema);

      await Tag.create({ name: "Test Name", slug: validSlug });

      await Promise.all(
        invalidSlugs.map((slug) =>
          expect(TagSchema.validate({ slug })).to.be.rejectedWith(
            "Invalid slug format"
          )
        )
      );
    });

    it("should validate color format", async () => {
      const validColor = "#000000";
      const invalidColors = [
        "#invalid-color",
        "rgb(255, 0, 0)",
        "rgba(255, 0, 0, 0.5)",
      ];

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Tag = mongoose.model("tags", TagSchema);

      await Tag.create({ name: "Test Name", color: validColor });

      await Promise.all(
        invalidColors.map((color) =>
          expect(TagSchema.validate({ color })).to.be.rejectedWith(
            "Invalid color format"
          )
        )
      );
    });

    it("should validate status", async () => {
      const validStatuses = ["active", "inactive"];
      const invalidStatuses = ["unknown", "pending", "draft"];

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Tag = mongoose.model("tags", TagSchema);

      await Tag.create({ name: "Test Name", status: validStatuses[0] });

      await Promise.all(
        invalidStatuses.map((status) =>
          expect(TagSchema.validate({ status })).to.be.rejectedWith(
            "Invalid status"
          )
        )
      );
    });
  });

  describe("TagSchema methods", () => {
    it("should export toJSON method", () => {
      const tag = new TagModel()
        .schema({
          _id: "123",
          name: "Test Tag",
          slug: "test-slug",
          description: "Test Description",
          color: "#000000",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .toObject();

      const jsonResult = tag.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: "123",
        name: "Test Tag",
        slug: "test-slug",
        description: "Test Description",
        color: "#000000",
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
      it("should create a new tag", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({ _id: "123", name: "Test Tag" });

        const result = await TagModel.create(
          { name: "Test Tag", slug: "test-slug" },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Tag created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          name: "Test Tag",
          slug: "test-slug",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await TagModel.create({}, {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create tag");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list tags", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            { _id: "1", name: "Tag 1", slug: "tag1-slug" },
            { _id: "2", name: "Tag 2", slug: "tag2-slug" },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await TagModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved tags");
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

        const result = await TagModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(0);
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("Successfully retrieved tags");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });

      it("should apply pagination", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            { _id: "1", name: "Tag 1", slug: "tag1-slug" },
            { _id: "2", name: "Tag 2", slug: "tag2-slug" },
            { _id: "3", name: "Tag 3", slug: "tag3-slug" },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(3);

        const result = await TagModel.list({ skip: 1, limit: 2 }, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(3);
        expect(result.message).to.equal("Successfully retrieved tags");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledWith({ skip: 1, limit: 2 });
        expect(mockCountDocuments).to.have.been.calledWith({});
      });

      it("should apply filter", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            { _id: "1", name: "Tag 1", slug: "tag1-slug" },
            { _id: "2", name: "Tag 2", slug: "tag2-slug" },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await TagModel.list({ filter: { name: /Tag/ } }, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved tags");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledWith({ name: /Tag/ });
        expect(mockCountDocuments).to.have.been.calledWith({ name: /Tag/ });
      });

      it("should handle errors during query execution", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .rejects(new Error("Query execution failed"));

        const result = await TagModel.list({}, {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockFind).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a tag by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({ _id: "123", name: "Test Tag", slug: "test-slug" });

        const result = await TagModel.findById("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully retrieved tag");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledOnceWith({ _id: "123" });
      });

      it("should return not found when tag does not exist", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await TagModel.findById("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Tag not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });

      it("should handle errors during query execution", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .rejects(new Error("Query execution failed"));

        const result = await TagModel.findById("123", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockFindOne).to.have.been.calledOnceWith({ _id: "123" });
      });
    });

    describe("update method", () => {
      it("should update a tag", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({ _id: "123", name: "Updated Tag", slug: "updated-slug" });

        const result = await TagModel.update(
          { id: "123", update: { name: "Updated Tag", slug: "updated-slug" } },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully updated the tag");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          "123",
          { name: "Updated Tag", slug: "updated-slug" },
          { new: true, runValidators: true }
        );
      });

      it("should return not found when tag does not exist", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves(null);

        const result = await TagModel.update(
          { id: "nonexistent-id", update: {} },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Tag not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          "nonexistent-id",
          {},
          { new: true, runValidators: true }
        );
      });

      it("should handle errors during update operation", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Update operation failed"));

        const result = await TagModel.update({ id: "123", update: {} }, {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "Data conflicts detected -- Update operation failed"
        );
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          "123",
          {},
          { new: true, runValidators: true }
        );
      });
    });

    describe("remove method", () => {
      it("should remove a tag", async () => {
        const mockRemoveOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves({ _id: "123", name: "Removed Tag", slug: "removed-slug" });

        const result = await TagModel.remove("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully removed the tag");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockRemoveOne).to.have.been.calledOnceWith("123");
      });

      it("should return not found when tag does not exist", async () => {
        const mockRemoveOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves(null);

        const result = await TagModel.remove("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Tag not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockRemoveOne).to.have.been.calledOnceWith("nonexistent-id");
      });

      it("should handle errors during removal operation", async () => {
        const mockRemoveOne = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .rejects(new Error("Removal operation failed"));

        const result = await TagModel.remove("123", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockRemoveOne).to.have.been.calledOnceWith("123");
      });
    });

    describe("findBySlug method", () => {
      it("should find a tag by slug", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({ _id: "123", name: "Found Tag", slug: "found-slug" });

        const result = await TagModel.findBySlug("found-slug", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully retrieved tag");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledOnceWith({ slug: "found-slug" });
      });

      it("should return not found when tag does not exist", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await TagModel.findBySlug("nonexistent-slug", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Tag not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledOnceWith({
          slug: "nonexistent-slug",
        });
      });

      it("should handle errors during query execution", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .rejects(new Error("Query execution failed"));

        const result = await TagModel.findBySlug("123", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockFindOne).to.have.been.calledOnceWith({ slug: "123" });
      });
    });

    describe("getTagStats method", () => {
      it("should retrieve tag statistics", async () => {
        const mockAggregate = sandbox
          .stub(mongoose.Model.prototype.aggregate, "exec")
          .resolves([
            { _id: "tag1", count: 10 },
            { _id: "tag2", count: 8 },
            { _id: "tag3", count: 6 },
          ]);

        const result = await TagModel.getTagStats({});

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal([
          { _id: "tag1", count: 10 },
          { _id: "tag2", count: 8 },
          { _id: "tag3", count: 6 },
        ]);
        expect(result.message).to.equal("Successfully retrieved tag stats");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockAggregate).to.have.been.calledOnce();
      });

      it("should handle errors during aggregation operation", async () => {
        const mockAggregate = sandbox
          .stub(mongoose.Model.prototype.aggregate, "exec")
          .rejects(new Error("Aggregation operation failed"));

        const result = await TagModel.getTagStats({});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockAggregate).to.have.been.calledOnce();
      });
    });

    describe("TagModel factory function", () => {
      it("should return existing model", async () => {
        const mockMongooseModel = sinon.mock(mongoose.Model);
        mockMongooseModel
          .expects("findOne")
          .once()
          .returns(Promise.resolve({ schema: TagSchema }));

        const Tag = mongoose.model("tags", TagSchema);
        const tagModel = TagModel();

        expect(tagModel).to.equal(Tag);
        mockMongooseModel.verify();
      });

      it("should create new model when not found", async () => {
        const mockMongooseModel = sinon.mock(mongoose.Model);
        mockMongooseModel
          .expects("findOne")
          .once()
          .returns(Promise.reject(new Error("Model not found")));

        const Tag = mongoose.model("tags", TagSchema);
        const tagModel = TagModel();

        expect(tagModel).to.equal(Tag);
        mockMongooseModel.verify();
      });
    });
  });
});
