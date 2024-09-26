require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const ReplyModel = require("@models/Reply");

describe("Reply Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("ReplySchema", () => {
    it("should define the schema correctly", () => {
      const schema = ReplySchema;
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
      const validReply = {
        post: "some-post-id",
        author: "some-author-id",
        content: "Some reply content",
        status: "pending",
        parentComment: "some-comment-id",
      };

      const invalidReply = {};

      expect(ReplySchema.validate(validReply)).to.not.throw();
      expect(() => ReplySchema.validate(invalidReply)).to.throw(
        /Post reference is required/
      );
      expect(() => ReplySchema.validate(invalidReply)).to.throw(
        /Author is required/
      );
      expect(() => ReplySchema.validate(invalidReply)).to.throw(
        /Reply content is required/
      );
      expect(() => ReplySchema.validate(invalidReply)).to.throw(
        /Parent comment is required/
      );
    });

    it("should validate field lengths", () => {
      const validReply = {
        post: "some-post-id",
        author: "some-author-id",
        content: "Some reply content",
        status: "pending",
        parentComment: "some-comment-id",
      };

      const invalidReply = {
        content: "a".repeat(501), // Changed from 1001 to 501 to match the schema
      };

      expect(ReplySchema.validate(validReply)).to.not.throw();
      expect(() => ReplySchema.validate(invalidReply)).to.throw(
        /Reply cannot be more than 500 characters/
      );
    });
  });

  describe("ReplySchema methods", () => {
    it("should export toJSON method", () => {
      const reply = new ReplyModel({
        post: "some-post-id",
        author: "some-author-id",
        content: "Some reply content",
        status: "pending",
        parentComment: "some-comment-id",
      });
      const jsonResult = reply.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: expect.any(Object),
        post: expect.any(Object),
        author: expect.any(Object),
        content: "Some reply content",
        status: "pending",
        parentComment: expect.any(Object),
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
      it("should create a new reply", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some reply content",
            status: "pending",
            parentComment: "some-comment-id",
          });

        const result = await ReplyModel.create({
          post: "some-post-id",
          author: "some-author-id",
          content: "Some reply content",
          status: "pending",
          parentComment: "some-comment-id",
        });

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal({
          _id: "123",
          post: "some-post-id",
          author: "some-author-id",
          content: "Some reply content",
          status: "pending",
          parentComment: "some-comment-id",
        });
        expect(result.message).to.equal("Reply created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          post: "some-post-id",
          author: "some-author-id",
          content: "Some reply content",
          status: "pending",
          parentComment: "some-comment-id",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await ReplyModel.create({});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create reply");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list replies", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              post: "post-1",
              author: "author-1",
              content: "reply-1",
              status: "pending",
              parentComment: "comment-1",
            },
            {
              _id: "2",
              post: "post-2",
              author: "author-2",
              content: "reply-2",
              status: "pending",
              parentComment: "comment-2",
            },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await ReplyModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved replies");
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

        const result = await ReplyModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("Successfully retrieved replies");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a reply by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some reply content",
            status: "pending",
            parentComment: "some-comment-id",
          });

        const result = await ReplyModel.findById("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.post).to.equal("some-post-id");
        expect(result.data.author).to.equal("some-author-id");
        expect(result.data.content).to.equal("Some reply content");
        expect(result.data.status).to.equal("pending");
        expect(result.data.parentComment).to.equal("some-comment-id");
        expect(result.message).to.equal("Successfully retrieved reply");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledWith({ _id: "123" });
      });

      it("should return not found when no reply exists", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await ReplyModel.findById("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Reply not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledWith({ _id: "nonexistent-id" });
      });
    });

    describe("update method", () => {
      it("should update an existing reply", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Updated reply content",
            status: "pending",
            parentComment: "some-comment-id",
          });
        const mockPopulate = sandbox
          .stub(mongoose.Model.prototype.populate, "exec")
          .resolves([
            {
              _id: "123",
              post: "some-post-id",
              author: { name: "Author Name" },
              content: "Updated reply content",
              status: "pending",
              parentComment: {
                id: "comment-1",
                content: "Parent Comment Content",
              },
            },
          ]);

        const result = await ReplyModel.update(
          { id: "123", update: { content: "Updated reply content" } },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.content).to.equal("Updated reply content");
        expect(result.message).to.equal("Successfully updated the reply");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { $set: { content: "Updated reply content" } },
          { new: true, runValidators: true }
        );
        expect(mockPopulate).to.have.been.calledOnceWith([
          "author",
          "parentComment",
        ]);
      });

      it("should fail to update when reply not found", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Reply not found"));
        const mockPopulate = sandbox
          .stub(mongoose.Model.prototype.populate, "exec")
          .throws(new Error("Reply not found"));

        const result = await ReplyModel.update(
          {
            id: "nonexistent-id",
            update: { content: "Non-existent reply content" },
          },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Reply not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          { $set: { content: "Non-existent reply content" } },
          { new: true, runValidators: true }
        );
        expect(mockPopulate).to.have.been.calledOnceWith([
          "author",
          "parentComment",
        ]);
      });
    });

    describe("remove method", () => {
      it("should remove an existing reply and its likes", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some reply content",
            status: "pending",
            parentComment: "some-comment-id",
          });
        const mockDeleteMany = sandbox
          .stub(mongoose.Model.prototype.deleteMany, "exec")
          .resolves({ deletedCount: 1 });

        const result = await ReplyModel.remove("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal(
          "Successfully removed the reply and its likes"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "123",
        });
        expect(mockDeleteMany).to.have.been.calledOnceWith({
          parentComment: "123",
        });
      });

      it("should return not found when reply does not exist", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves(null);

        const result = await ReplyModel.remove("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Reply not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("incrementLikes method", () => {
      it("should increment likes on an existing reply", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            post: "some-post-id",
            author: "some-author-id",
            content: "Some reply content",
            likes: 0,
            status: "pending",
            parentComment: "some-comment-id",
          });

        const result = await ReplyModel.incrementLikes("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.likes).to.equal(1);
        expect(result.message).to.equal("Successfully incremented reply likes");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { $inc: { likes: 1 } },
          { new: true }
        );
      });

      it("should fail to increment likes when reply not found", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Reply not found"));

        const result = await ReplyModel.incrementLikes("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Reply not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          { $inc: { likes: 1 } },
          { new: true }
        );
      });
    });

    describe("getRepliesByComment method", () => {
      let mockFind;

      beforeEach(() => {
        mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              post: "post-1",
              author: "author-1",
              content: "reply-1",
              status: "pending",
              parentComment: "comment-1",
            },
            {
              _id: "2",
              post: "post-1",
              author: "author-2",
              content: "reply-2",
              status: "pending",
              parentComment: "comment-1",
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

      it("should retrieve replies for a comment", async () => {
        const result = await ReplyModel.getRepliesByComment(
          "comment-1",
          {},
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal(
          "Successfully retrieved replies for the comment"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({
          parentComment: "comment-1",
        });
        expect(mockCountDocuments).to.have.been.calledOnceWith({
          parentComment: "comment-1",
        });
      });

      it("should handle empty results", async () => {
        mockFind.resolves([]);
        mockCountDocuments.resolves(0);

        const result = await ReplyModel.getRepliesByComment(
          "nonexistent-comment",
          {},
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("No replies found for this comment");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({
          parentComment: "nonexistent-comment",
        });
        expect(mockCountDocuments).to.have.been.calledOnceWith({
          parentComment: "nonexistent-comment",
        });
      });
    });
  });
});
