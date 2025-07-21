require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const CategoryModel = require("@models/Category");

describe("Category Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("CategorySchema", () => {
    it("should define the schema correctly", () => {
      const schema = CategorySchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.name).to.exist;
      expect(schema.paths.slug).to.exist;
      expect(schema.paths.description).to.exist;
      expect(schema.paths.parent).to.exist;
      expect(schema.paths.order).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validCategory = {
        name: "Test Category",
        slug: "test-category",
        description: "A test category",
        parent: null,
        order: 0,
      };

      const invalidCategory = {};

      expect(CategorySchema.validate(validCategory)).to.not.throw();
      expect(() => CategorySchema.validate(invalidCategory)).to.throw(
        /Category name is required/
      );
      expect(() => CategorySchema.validate(invalidCategory)).to.throw(
        /Slug is required/
      );
    });

    it("should validate field lengths", () => {
      const validCategory = {
        name: "Test Category",
        slug: "test-category",
        description: "A test category",
        parent: null,
        order: 0,
      };

      const invalidCategory = {
        name: "a".repeat(51),
        slug: "invalid-slug",
        description: " ".repeat(201),
        parent: null,
        order: 0,
      };

      expect(CategorySchema.validate(validCategory)).to.not.throw();
      expect(() => CategorySchema.validate(invalidCategory)).to.throw(
        /Category name cannot be more than 50 characters/
      );
      expect(() => CategorySchema.validate(invalidCategory)).to.throw(
        /Slug cannot be more than 50 characters/
      );
      expect(() => CategorySchema.validate(invalidCategory)).to.throw(
        /Description cannot be more than 200 characters/
      );
    });
  });

  describe("CategorySchema methods", () => {
    it("should export toJSON method", () => {
      const category = new CategoryModel({
        name: "Test Category",
        slug: "test-category",
      });
      const jsonResult = category.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: expect.any(String),
        name: "Test Category",
        slug: "test-category",
        description: undefined,
        parent: undefined,
        order: 0,
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
      it("should create a new category", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({ _id: "123", name: "New Category" });

        const result = await CategoryModel.create({
          name: "New Category",
          slug: "new-category",
          description: "A new category",
        });

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal({
          _id: "123",
          name: "New Category",
          slug: "new-category",
          description: "A new category",
        });
        expect(result.message).to.equal("Category created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          name: "New Category",
          slug: "new-category",
          description: "A new category",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await CategoryModel.create({});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create category");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list categories", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            { _id: "1", name: "Category 1", slug: "cat-1" },
            { _id: "2", name: "Category 2", slug: "cat-2" },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await CategoryModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved categories");
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

        const result = await CategoryModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("Successfully retrieved categories");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a category by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({ _id: "123", name: "Found Category" });

        const result = await CategoryModel.findById("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.name).to.equal("Found Category");
        expect(result.message).to.equal("Successfully retrieved category");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledWith({ _id: "123" });
      });

      it("should return not found when no category exists", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await CategoryModel.findById("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Category not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledWith({ _id: "nonexistent-id" });
      });
    });

    describe("update method", () => {
      it("should update an existing category", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.updateOne, "exec")
          .resolves({ matchedCount: 1, modifiedCount: 1 });
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({ _id: "123", name: "Updated Category" });

        const result = await CategoryModel.update(
          { id: "123", update: { name: "Updated Category" } },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.message).to.equal("Successfully updated the category");
        expect(result.data._id).to.equal("123");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          { _id: "123" },
          { $set: { name: "Updated Category" } }
        );
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { name: "Updated Category" },
          { new: true, runValidators: true }
        );
      });

      it("should fail to update when category not found", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.updateOne, "exec")
          .resolves({ matchedCount: 0, modifiedCount: 0 });
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Category not found"));

        const result = await CategoryModel.update(
          { id: "nonexistent-id", update: { name: "Non-existent Category" } },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Category not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          { _id: "nonexistent-id" },
          { $set: { name: "Non-existent Category" } }
        );
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          { name: "Non-existent Category" },
          { new: true, runValidators: true }
        );
      });
    });

    describe("remove method", () => {
      it("should remove an existing category", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.remove, "exec")
          .resolves({ _id: "123", name: "Removed Category" });

        const result = await CategoryModel.remove("123");

        expect(result.success).to.be.true;
        expect(result.message).to.equal("Successfully removed the category");
        expect(result.data._id).to.equal("123");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockRemove).to.have.been.calledOnceWith({ _id: "123" });
      });

      it("should return not found when category does not exist", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.remove, "exec")
          .resolves(null);

        const result = await CategoryModel.remove("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Category not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockRemove).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("getHierarchy method", () => {
      let mockFind;

      beforeEach(() => {
        mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              name: "Parent Category",
              slug: "parent-category",
              parent: null,
              order: 0,
            },
            {
              _id: "2",
              name: "Child Category",
              slug: "child-category",
              parent: "1",
              order: 10,
            },
            {
              _id: "3",
              name: "Grandchild Category",
              slug: "grandchild-category",
              parent: "2",
              order: 20,
            },
          ]);
      });

      afterEach(() => {
        mockFind.restore();
      });

      it("should retrieve category hierarchy", async () => {
        const result = await CategoryModel.getHierarchy();

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal([
          {
            _id: "1",
            name: "Parent Category",
            slug: "parent-category",
            description: undefined,
            parent: null,
            order: 0,
            children: [
              {
                _id: "2",
                name: "Child Category",
                slug: "child-category",
                description: undefined,
                parent: "1",
                order: 10,
                children: [
                  {
                    _id: "3",
                    name: "Grandchild Category",
                    slug: "grandchild-category",
                    description: undefined,
                    parent: "2",
                    order: 20,
                    children: [],
                  },
                ],
              },
            ],
          },
        ]);
        expect(result.message).to.equal(
          "Successfully retrieved category hierarchy"
        );
        expect(result.status).to.equal(httpStatus.OK);
      });
    });

    describe("updateOrder method", () => {
      let mockBulkWrite;

      beforeEach(() => {
        mockBulkWrite = sandbox
          .stub(mongoose.Model.prototype.bulkWrite, "exec")
          .resolves({ nModified: 2 });
      });

      afterEach(() => {
        mockBulkWrite.restore();
      });

      it("should update category orders", async () => {
        const categories = [
          { _id: "1", order: 1 },
          { _id: "2", order: 2 },
          { _id: "3", order: 3 },
        ];

        const result = await CategoryModel.updateOrder(categories);

        expect(result.success).to.be.true;
        expect(result.message).to.equal("Successfully updated category order");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockBulkWrite).to.have.been.calledWith([
          {
            updateOne: { filter: { _id: "1" }, update: { $set: { order: 1 } } },
          },
          {
            updateOne: { filter: { _id: "2" }, update: { $set: { order: 2 } } },
          },
          {
            updateOne: { filter: { _id: "3" }, update: { $set: { order: 3 } } },
          },
        ]);
      });

      it("should fail if bulkWrite fails", async () => {
        const mockBulkWrite = sandbox
          .stub(mongoose.Model.prototype.bulkWrite, "exec")
          .rejects(new Error("Bulk write failed"));

        const result = await CategoryModel.updateOrder([]);

        expect(result.success).to.be.false;
        expect(result.message).to.include("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockBulkWrite).to.have.been.calledWith([]);
      });
    });
  });
});
