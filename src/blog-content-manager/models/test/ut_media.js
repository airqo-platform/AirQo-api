require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const MediaModel = require("@models/Media");

describe("Media Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("MediaSchema", () => {
    it("should define the schema correctly", () => {
      const schema = MediaSchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.title).to.exist;
      expect(schema.paths.type).to.exist;
      expect(schema.paths.url).to.exist;
      expect(schema.paths.fileSize).to.exist;
      expect(schema.paths.mimeType).to.exist;
      expect(schema.paths.alt).to.exist;
      expect(schema.paths.caption).to.exist;
      expect(schema.paths.author).to.exist;
      expect(schema.paths.post).to.exist;
      expect(schema.paths.status).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validMedia = {
        title: "Some media title",
        type: "image",
        url: "https://example.com/image.jpg",
        fileSize: 1000000,
        mimeType: "image/jpeg",
        alt: "Alt text",
        author: "some-author-id",
      };

      const invalidMedia = {};

      expect(MediaSchema.validate(validMedia)).to.not.throw();
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /Title is required/
      );
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /Type is required/
      );
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /URL is required/
      );
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /File size is required/
      );
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /MIME type is required/
      );
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /Author is required/
      );
    });

    it("should validate field lengths", () => {
      const validMedia = {
        title: "Some media title",
        type: "image",
        url: "https://example.com/image.jpg",
        fileSize: 1000000,
        mimeType: "image/jpeg",
        alt: "Alt text",
        caption: "This is a short caption",
      };

      const invalidMedia = {
        title: "a".repeat(201),
        alt: "a".repeat(201),
        caption: "a".repeat(501),
      };

      expect(MediaSchema.validate(validMedia)).to.not.throw();
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /Title cannot be more than 200 characters/
      );
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /Alt text cannot be more than 200 characters/
      );
      expect(() => MediaSchema.validate(invalidMedia)).to.throw(
        /Caption cannot be more than 500 characters/
      );
    });
  });

  describe("MediaSchema methods", () => {
    it("should export toJSON method", () => {
      const media = new MediaModel()
        .schema({
          _id: "123",
          title: "Test Title",
          type: "image",
          url: "https://example.com/test-image.jpg",
          fileSize: 1000000,
          mimeType: "image/jpeg",
          alt: "Test Alt Text",
          caption: "Test Caption",
          author: "author-id",
          post: "post-id",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .toObject();

      const jsonResult = media.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: "123",
        title: "Test Title",
        type: "image",
        url: "https://example.com/test-image.jpg",
        fileSize: 1000000,
        mimeType: "image/jpeg",
        alt: "Test Alt Text",
        caption: "Test Caption",
        author: "author-id",
        post: "post-id",
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
      it("should create a new media item", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({
            _id: "123",
            title: "Test Title",
            type: "image",
            url: "https://example.com/test-image.jpg",
          });

        const result = await MediaModel.create(
          {
            title: "Test Title",
            type: "image",
            url: "https://example.com/test-image.jpg",
          },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Media created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          title: "Test Title",
          type: "image",
          url: "https://example.com/test-image.jpg",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await MediaModel.create({}, {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create media");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list media items", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              title: "Media 1",
              type: "image",
              url: "https://example.com/media1.jpg",
            },
            {
              _id: "2",
              title: "Media 2",
              type: "video",
              url: "https://example.com/media2.mp4",
            },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await MediaModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved media");
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

        const result = await MediaModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("No media found");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a media item by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({
            _id: "123",
            title: "Test Title",
            type: "image",
            url: "https://example.com/test-image.jpg",
          });

        const result = await MediaModel.findById("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully retrieved media");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledOnceWith({ _id: "123" });
      });

      it("should return not found when media does not exist", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await MediaModel.findById("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Media not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("update method", () => {
      it("should update an existing media item", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            title: "Updated Title",
            type: "image",
            url: "https://example.com/update-image.jpg",
          });

        const result = await MediaModel.update(
          {
            id: "123",
            update: {
              title: "Updated Title",
              url: "https://example.com/update-image.jpg",
            },
          },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully updated the media");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          {
            title: "Updated Title",
            url: "https://example.com/update-image.jpg",
          },
          { new: true, runValidators: true }
        );
      });

      it("should fail to update when media not found", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Media not found"));

        const result = await MediaModel.update(
          {
            id: "nonexistent-id",
            update: {
              title: "Non-existent media title",
              url: "https://example.com/nonexistent-media.jpg",
            },
          },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Media not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          {
            title: "Non-existent media title",
            url: "https://example.com/nonexistent-media.jpg",
          },
          { new: true, runValidators: true }
        );
      });
    });

    describe("remove method", () => {
      it("should remove an existing media item", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves({
            _id: "123",
            title: "Test Title",
            type: "image",
            url: "https://example.com/test-image.jpg",
          });

        const result = await MediaModel.remove("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully removed the media");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "123",
        });
      });

      it("should return not found when media does not exist", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves(null);

        const result = await MediaModel.remove("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Media not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("findByPost method", () => {
      it("should retrieve media items associated with a post", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              title: "Media 1",
              type: "image",
              url: "https://example.com/media1.jpg",
              post: "post-1",
            },
            {
              _id: "2",
              title: "Media 2",
              type: "video",
              url: "https://example.com/media2.mp4",
              post: "post-1",
            },
          ]);

        const result = await MediaModel.findByPost("post-1", {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.message).to.equal(
          "Successfully retrieved media for the post"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({ post: "post-1" });
      });

      it("should handle empty results", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(0);

        const result = await MediaModel.findByPost("nonexistent-post", {});

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("No media found for this post");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({
          post: "nonexistent-post",
        });
        expect(mockCountDocuments).to.have.been.calledOnceWith({
          post: "nonexistent-post",
        });
      });
    });

    describe("getMediaStats method", () => {
      it("should aggregate media stats", async () => {
        const mockAggregate = sandbox
          .stub(mongoose.Model.prototype.aggregate, "exec")
          .resolves([
            { _id: "image", count: 10, totalSize: 10000000 },
            { _id: "video", count: 5, totalSize: 5000000 },
          ]);

        const result = await MediaModel.getMediaStats({});

        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal([
          { _id: "image", count: 10, totalSize: 10000000 },
          { _id: "video", count: 5, totalSize: 5000000 },
        ]);
        expect(result.message).to.equal("Successfully retrieved media stats");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockAggregate).to.have.been.calledOnceWith([
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
              totalSize: { $sum: "$fileSize" },
            },
          },
        ]);
      });
    });
  });
});
