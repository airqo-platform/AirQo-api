require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const expect = chai.expect;
const mongoose = require("mongoose");
const SubscriptionModel = require("@models/Subscription");
const PostModel = require("@models/Post");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- manage-interactions`
);
const { HttpError } = require("@utils/errors");

const manageInteractions = require("../path/to/manageInteractions"); // Adjust the path as needed

describe("manageInteractions", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("follow", () => {
    it("should successfully add a follower to a user's subscription", async () => {
      const userId = "testUser";
      const requestBody = { tenant: "testTenant" };
      const mockSubscription = {
        _id: "subscriptionId",
        followers: [],
        email: userId,
      };

      sandbox
        .stub(SubscriptionModel.prototype.findOne)
        .resolves(mockSubscription);
      sandbox
        .stub(SubscriptionModel.prototype.findById)
        .resolves(mockSubscription);
      sandbox.stub(mockSubscription.save).resolves({});

      const result = await manageInteractions.follow(userId, requestBody);
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully followed user");
      expect(result.data._id).to.equal(mockSubscription._id);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if the user doesn't exist", async () => {
      const userId = "nonexistentUser";
      const requestBody = { tenant: "testTenant" };

      sandbox.stub(SubscriptionModel.prototype.findOne).resolves(null);

      await expect(
        manageInteractions.follow(userId, requestBody)
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error User not found`
      );
    });

    it("should throw an error if the user is already following", async () => {
      const userId = "existingUser";
      const requestBody = { tenant: "testTenant" };
      const mockSubscription = {
        _id: "subscriptionId",
        followers: ["existingUser"],
        email: userId,
      };

      sandbox
        .stub(SubscriptionModel.prototype.findOne)
        .resolves(mockSubscription);
      sandbox
        .stub(SubscriptionModel.prototype.findById)
        .resolves(mockSubscription);

      await expect(
        manageInteractions.follow(userId, requestBody)
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error User is already following`
      );
    });
  });

  describe("notifications", () => {
    it("should successfully retrieve notifications for a user", async () => {
      const userId = "testUser";
      const mockNotifications = [
        { id: "notificationId", type: "like" },
        { id: "anotherNotificationId", type: "comment" },
      ];

      sandbox
        .stub(SubscriptionModel.prototype.find)
        .resolves(mockNotifications);

      const result = await manageInteractions.notifications({
        query: { userId },
      });
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved notifications");
      expect(result.data).to.deep.equal(mockNotifications);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if there's an issue retrieving notifications", async () => {
      const userId = "testUser";

      sandbox
        .stub(SubscriptionModel.prototype.find)
        .rejects(new Error("Database error"));

      await expect(
        manageInteractions.notifications({ query: { userId } })
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error Database error`
      );
    });
  });

  describe("like", () => {
    it("should successfully add a like to a post", async () => {
      const postId = "postId";
      const requestBody = { tenant: "testTenant" };
      const mockPost = {
        _id: postId,
        likes: [],
        id: postId,
      };

      sandbox.stub(PostModel.prototype.findById).resolves(mockPost);
      sandbox.stub(mockPost.save).resolves({});

      const result = await manageInteractions.like(postId, requestBody);
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully liked post");
      expect(result.data._id).to.equal(mockPost._id);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if the post doesn't exist", async () => {
      const postId = "nonexistentPost";
      const requestBody = { tenant: "testTenant" };

      sandbox.stub(PostModel.prototype.findById).resolves(null);

      await expect(
        manageInteractions.like(postId, requestBody)
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error Post not found`
      );
    });

    it("should throw an error if the user has already liked the post", async () => {
      const postId = "existingPost";
      const requestBody = { tenant: "testTenant" };
      const mockPost = {
        _id: postId,
        likes: ["existingUser"],
        id: postId,
      };

      sandbox.stub(PostModel.prototype.findById).resolves(mockPost);

      await expect(
        manageInteractions.like(postId, requestBody)
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error User has already liked this post`
      );
    });
  });

  // test-manage-interactions.js (continued)

  describe("bookmark", () => {
    it("should successfully add a bookmark to a post", async () => {
      const postId = "postId";
      const requestBody = { tenant: "testTenant" };
      const mockPost = {
        _id: postId,
        bookmarks: [],
        id: postId,
      };

      sandbox.stub(PostModel.prototype.findById).resolves(mockPost);
      sandbox.stub(mockPost.save).resolves({});

      const result = await manageInteractions.bookmark(postId, requestBody);
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully bookmarked post");
      expect(result.data._id).to.equal(mockPost._id);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if the post doesn't exist", async () => {
      const postId = "nonexistentPost";
      const requestBody = { tenant: "testTenant" };

      sandbox.stub(PostModel.prototype.findById).resolves(null);

      await expect(
        manageInteractions.bookmark(postId, requestBody)
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error Post not found`
      );
    });

    it("should throw an error if the user has already bookmarked the post", async () => {
      const postId = "existingPost";
      const requestBody = { tenant: "testTenant" };
      const mockPost = {
        _id: postId,
        bookmarks: ["existingUser"],
        id: postId,
      };

      sandbox.stub(PostModel.prototype.findById).resolves(mockPost);

      await expect(
        manageInteractions.bookmark(postId, requestBody)
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error User has already bookmarked this post`
      );
    });
  });

  describe("getFollowers", () => {
    it("should successfully retrieve followers for a subscription", async () => {
      const mockSubscription = {
        _id: "subscriptionId",
        followers: ["follower1", "follower2"],
      };

      sandbox
        .stub(SubscriptionModel.prototype.findById)
        .resolves(mockSubscription);

      const result = await manageInteractions.getFollowers("subscriptionId");
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved followers");
      expect(result.data).to.deep.equal(mockSubscription.followers);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if the subscription doesn't exist", async () => {
      sandbox.stub(SubscriptionModel.prototype.findById).resolves(null);

      await expect(
        manageInteractions.getFollowers("nonexistentId")
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error Subscription not found`
      );
    });
  });

  describe("getLikes", () => {
    it("should successfully retrieve likes for a post", async () => {
      const postId = "postId";
      const mockPost = {
        _id: postId,
        likes: ["like1", "like2"],
      };

      sandbox.stub(PostModel.prototype.findById).resolves(mockPost);

      const result = await manageInteractions.getLikes(postId);
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved likes");
      expect(result.data).to.deep.equal(mockPost.likes);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if the post doesn't exist", async () => {
      sandbox.stub(PostModel.prototype.findById).resolves(null);

      await expect(
        manageInteractions.getLikes("nonexistentPost")
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error Post not found`
      );
    });
  });

  describe("getBookmarks", () => {
    it("should successfully retrieve bookmarks for a post", async () => {
      const postId = "postId";
      const mockPost = {
        _id: postId,
        bookmarks: ["bookmark1", "bookmark2"],
      };

      sandbox.stub(PostModel.prototype.findById).resolves(mockPost);

      const result = await manageInteractions.getBookmarks(postId);
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved bookmarks");
      expect(result.data).to.deep.equal(mockPost.bookmarks);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if the post doesn't exist", async () => {
      sandbox.stub(PostModel.prototype.findById).resolves(null);

      await expect(
        manageInteractions.getBookmarks("nonexistentPost")
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error Post not found`
      );
    });
  });
});
