require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const AuthorModel = require("@models/Author");

describe("Author Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("AuthorSchema", () => {
    it("should define the schema correctly", () => {
      const schema = AuthorSchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.name).to.exist;
      expect(schema.paths.email).to.exist;
      expect(schema.paths.bio).to.exist;
      expect(schema.paths.avatar).to.exist;
      expect(schema.paths.socialMedia).to.exist;
      expect(schema.paths.website).to.exist;
      expect(schema.paths.role).to.exist;
      expect(schema.paths.status).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validAuthor = {
        name: "John Doe",
        email: "john@example.com",
        bio: "A brief bio",
        avatar: "avatar.jpg",
        website: "https://example.com",
        role: "author",
        status: "active",
      };

      const invalidAuthor = {};

      expect(AuthorSchema.validate(validAuthor)).to.not.throw();
      expect(() => AuthorSchema.validate(invalidAuthor)).to.throw(
        /Author name is required/
      );
      expect(() => AuthorSchema.validate(invalidAuthor)).to.throw(
        /Email is required/
      );
    });

    it("should validate field lengths", () => {
      const validAuthor = {
        name: "John Doe",
        email: "john@example.com",
        bio: "A brief bio",
        avatar: "avatar.jpg",
        website: "https://example.com",
        role: "author",
        status: "active",
      };

      const invalidAuthor = {
        name: "a".repeat(101),
        email: "too.long@email.com",
        bio: " ".repeat(501),
        avatar: "avatar.jpg",
        website: "https://example.com",
        role: "author",
        status: "active",
      };

      expect(AuthorSchema.validate(validAuthor)).to.not.throw();
      expect(() => AuthorSchema.validate(invalidAuthor)).to.throw(
        /Author name cannot be more than 100 characters/
      );
      expect(() => AuthorSchema.validate(invalidAuthor)).to.throw(
        /Bio cannot be more than 500 characters/
      );
    });
  });

  describe("AuthorSchema methods", () => {
    it("should export toJSON method", () => {
      const author = new AuthorModel({
        name: "Test Author",
        email: "test@example.com",
      });
      const jsonResult = author.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: expect.any(String),
        name: "Test Author",
        email: "test@example.com",
        bio: undefined,
        avatar: undefined,
        socialMedia: {},
        website: undefined,
        role: "author",
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
      it("should create a new author", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({ _id: "123", name: "New Author" });

        const result = await AuthorModel.create({
          name: "New Author",
          email: "new.author@example.com",
        });

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal({ _id: "123", name: "New Author" });
        expect(result.message).to.equal("Author created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          name: "New Author",
          email: "new.author@example.com",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await AuthorModel.create({});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create author");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list authors", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            { _id: "1", name: "Author 1" },
            { _id: "2", name: "Author 2" },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await AuthorModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved authors");
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

        const result = await AuthorModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("Successfully retrieved authors");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find an author by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({ _id: "123", name: "Found Author" });

        const result = await AuthorModel.findById("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.name).to.equal("Found Author");
        expect(result.message).to.equal("Successfully retrieved author");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledWith({ _id: "123" });
      });

      it("should return not found when no author exists", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await AuthorModel.findById("nonexistent_id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Author not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledWith({ _id: "nonexistent_id" });
      });
    });

    describe("update method", () => {
      it("should update an existing author", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.updateOne, "exec")
          .resolves({ matchedCount: 1, modifiedCount: 1 });
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({ _id: "123", name: "Updated Author" });

        const result = await AuthorModel.update(
          { id: "123", update: { name: "Updated Author" } },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.message).to.equal("Successfully updated the author");
        expect(result.data._id).to.equal("123");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          { _id: "123" },
          { $set: { name: "Updated Author" } }
        );
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { name: "Updated Author" },
          { new: true, runValidators: true }
        );
      });

      it("should fail to update when author not found", async () => {
        const mockUpdateOne = sandbox
          .stub(mongoose.Model.prototype.updateOne, "exec")
          .resolves({ matchedCount: 0, modifiedCount: 0 });
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Author not found"));

        const result = await AuthorModel.update(
          { id: "nonexistent_id", update: { name: "Non-existent Author" } },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Author not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockUpdateOne).to.have.been.calledOnceWith(
          { _id: "nonexistent_id" },
          { $set: { name: "Non-existent Author" } }
        );
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent_id",
          { name: "Non-existent Author" },
          { new: true, runValidators: true }
        );
      });
    });

    describe("remove method", () => {
      it("should remove an existing author", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.remove, "exec")
          .resolves({ _id: "123", name: "Removed Author" });

        const result = await AuthorModel.remove("123");

        expect(result.success).to.be.true;
        expect(result.message).to.equal("Successfully removed the author");
        expect(result.data._id).to.equal("123");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockRemove).to.have.been.calledOnceWith({ _id: "123" });
      });

      it("should return not found when author does not exist", async () => {
        const mockRemove = sandbox
          .stub(mongoose.Model.prototype.remove, "exec")
          .resolves(null);

        const result = await AuthorModel.remove("nonexistent_id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Author not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockRemove).to.have.been.calledOnceWith({
          _id: "nonexistent_id",
        });
      });
    });

    describe("findByEmail method", () => {
      it("should find an author by email", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({ _id: "123", name: "Found Author" });

        const result = await AuthorModel.findByEmail(
          "found.author@example.com"
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.name).to.equal("Found Author");
        expect(result.message).to.equal("Successfully retrieved author");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledWith({
          email: "found.author@example.com",
        });
      });

      it("should return not found when no author exists", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await AuthorModel.findByEmail(
          "nonexistent.email@example.com"
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Author not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledWith({
          email: "nonexistent.email@example.com",
        });
      });
    });

    describe("getAuthorStats method", () => {
      let mockPostModel, mockCommentModel;

      beforeEach(() => {
        mockPostModel = sinon.mock(mongoose.Model);
        mockCommentModel = sinon.mock(mongoose.Model);
      });

      afterEach(() => {
        mockPostModel.restore();
        mockCommentModel.restore();
      });

      it("should get author stats", async () => {
        const mockCountDocuments = [
          sandbox.stub(mockPostModel.find, "countDocuments").resolves(10),
          sandbox.stub(mockCommentModel.find, "countDocuments").resolves(20),
        ];

        const result = await AuthorModel.getAuthorStats("author_id");

        expect(result.success).to.be.true;
        expect(result.data.postCount).to.equal(10);
        expect(result.data.commentCount).to.equal(20);
        expect(result.message).to.equal("Successfully retrieved author stats");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockCountDocuments[0]).to.have.been.calledOnceWith({
          author: "author_id",
        });
        expect(mockCountDocuments[1]).to.have.been.calledOnceWith({
          author: "author_id",
        });
      });

      it("should handle errors when getting post count", async () => {
        const mockCountDocuments = [
          sandbox
            .stub(mockPostModel.find, "countDocuments")
            .rejects(new Error("Error counting posts")),
          sandbox.stub(mockCommentModel.find, "countDocuments").resolves(20),
        ];

        const result = await AuthorModel.getAuthorStats("author_id");

        expect(result.success).to.be.false;
        expect(result.message).to.include("Internal Server Error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCountDocuments[0]).to.have.been.calledOnceWith({
          author: "author_id",
        });
        expect(mockCountDocuments[1]).to.have.been.calledOnceWith({
          author: "author_id",
        });
      });
    });
  });
});
