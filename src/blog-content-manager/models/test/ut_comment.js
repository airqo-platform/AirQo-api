require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const CommentModel = require("@models/Comment");

describe("Comment Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("CommentSchema", () => {
    it("should define the schema correctly", () => {
      const schema = CommentSchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.post).to.exist;
      expect(schema.paths.author).to.exist;
      expect(schema.paths.content).to.exist;
      expect(schema.paths.status).to.exist;
      expect(schema.paths.parentComment).to.exist;
      expect(schema.paths.likes).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validComment = {
        post: "some-post-id",
        author: "some-author-id",
        content: "Some comment content",
        status: "pending",
      };

      const invalidComment = {};

      expect(CommentSchema.validate(validComment)).to.not.throw();
      expect(() => CommentSchema.validate(invalidComment)).to.throw(
        /Post reference is required/
      );
      expect(() => CommentSchema.validate(invalidComment)).to.throw(
        /Author is required/
      );
      expect(() => CommentSchema.validate(invalidComment)).to.throw(
        /Comment content is required/
      );
    });

    it("should validate field lengths", () => {
      const validComment = {
        post: "some-post-id",
        author: "some-author-id",
        content: "Some comment content",
        status: "pending",
      };

      const invalidComment = {
        content: "a".repeat(1001),
      };

      expect(CommentSchema.validate(validComment)).to.not.throw();
      expect(() => CommentSchema.validate(invalidComment)).to.throw(
        /Comment cannot be more than 1000 characters/
      );
    });
  });

  describe("CommentSchema methods", () => {
    it("should export toJSON method", () => {
      const comment = new CommentModel({
        post: "some-post-id",
        author: "some-author-id",
        content: "Some comment content",
      });
      const jsonResult = comment.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: expect.any(Object),
        post: expect.any(Object),
        author: expect.any(Object),
        content: "Some comment content",
        status: "pending",
        parentComment: null,
        likes: 0,
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
      it("should create a new comment", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some comment content",
          });

        const result = await CommentModel.create({
          post: "some-post-id",
          author: "some-author-id",
          content: "Some comment content",
        });

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal({
          _id: "123",
          post: "some-post-id",
          author: "some-author-id",
          content: "Some comment content",
        });
        expect(result.message).to.equal("Comment created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          post: "some-post-id",
          author: "some-author-id",
          content: "Some comment content",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await CommentModel.create({});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create comment");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list comments", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              post: "post-1",
              author: "author-1",
              content: "comment-1",
              status: "pending",
            },
            {
              _id: "2",
              post: "post-2",
              author: "author-2",
              content: "comment-2",
              status: "pending",
            },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await CommentModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved comments");
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

        const result = await CommentModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("Successfully retrieved comments");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a comment by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some comment content",
          });

        const result = await CommentModel.findById("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.post).to.equal("some-post-id");
        expect(result.data.author).to.equal("some-author-id");
        expect(result.data.content).to.equal("Some comment content");
        expect(result.message).to.equal("Successfully retrieved comment");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledWith({ _id: "123" });
      });

      it("should return not found when no comment exists", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await CommentModel.findById("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Comment not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledWith({ _id: "nonexistent-id" });
      });
    });

    describe("update method", () => {
      it("should update an existing comment", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Updated comment content",
          });
        const mockPopulate = sandbox
          .stub(mongoose.Model.prototype.populate, "exec")
          .resolves([
            {
              _id: "123",
              post: "some-post-id",
              author: { name: "Author Name" },
              content: "Updated comment content",
            },
          ]);

        const result = await CommentModel.update(
          { id: "123", update: { content: "Updated comment content" } },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.content).to.equal("Updated comment content");
        expect(result.message).to.equal("Successfully updated the comment");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { $set: { content: "Updated comment content" } },
          { new: true, runValidators: true }
        );
        expect(mockPopulate).to.have.been.calledOnceWith([
          "author",
          "post",
          "parentComment",
        ]);
      });

      it("should fail to update when comment not found", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Comment not found"));
        const mockPopulate = sandbox
          .stub(mongoose.Model.prototype.populate, "exec")
          .throws(new Error("Comment not found"));

        const result = await CommentModel.update(
          {
            id: "nonexistent-id",
            update: { content: "Non-existent comment content" },
          },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Comment not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          { $set: { content: "Non-existent comment content" } },
          { new: true, runValidators: true }
        );
        expect(mockPopulate).to.have.been.calledOnceWith([
          "author",
          "post",
          "parentComment",
        ]);
      });
    });

    describe("remove method", () => {
      it("should remove an existing comment and its replies", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some comment content",
          });
        const mockDeleteMany = sandbox
          .stub(mongoose.Model.prototype.deleteMany, "exec")
          .resolves({ deletedCount: 1 });

        const result = await CommentModel.remove("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal(
          "Successfully removed the comment and its replies"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "123",
        });
        expect(mockDeleteMany).to.have.been.calledOnceWith({
          parentComment: "123",
        });
      });

      it("should return not found when comment does not exist", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves(null);

        const result = await CommentModel.remove("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Comment not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("incrementLikes method", () => {
      it("should increment likes on an existing comment", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some comment content",
            likes: 0,
          });

        const result = await CommentModel.incrementLikes("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.likes).to.equal(1);
        expect(result.message).to.equal(
          "Successfully incremented comment likes"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { $inc: { likes: 1 } },
          { new: true }
        );
      });

      it("should fail to increment likes when comment not found", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Comment not found"));

        const result = await CommentModel.incrementLikes("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Comment not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          { $inc: { likes: 1 } },
          { new: true }
        );
      });
    });

    describe("getCommentsByPost method", () => {
      let mockFind;

      beforeEach(() => {
        mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              post: "post-1",
              author: "author-1",
              content: "comment-1",
              status: "pending",
              createdAt: new Date(),
            },
            {
              _id: "2",
              post: "post-1",
              author: "author-2",
              content: "comment-2",
              status: "approved",
              createdAt: new Date(),
            },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);
      });

      afterEach(() => {
        mockFind.restore();
        mockCountDocuments.restore();
      });

      it("should retrieve comments for a post", async () => {
        const result = await CommentModel.getCommentsByPost("post-1", {}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal(
          "Successfully retrieved comments for the post"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({
          post: "post-1",
          parentComment: null,
        });
        expect(mockCountDocuments).to.have.been.calledOnceWith({
          post: "post-1",
          parentComment: null,
        });
      });

      it("should handle empty results", async () => {
        mockFind.resolves([]);
        mockCountDocuments.resolves(0);

        const result = await CommentModel.getCommentsByPost(
          "nonexistent-post",
          {},
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("No comments found for this post");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({
          post: "nonexistent-post",
          parentComment: null,
        });
        expect(mockCountDocuments).to.have.been.calledOnceWith({
          post: "nonexistent-post",
          parentComment: null,
        });
      });
    });
  });
});
