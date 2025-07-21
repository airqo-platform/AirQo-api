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

const manageInteractions = {
  follow: async (userId, requestBody, next) => {
    try {
      const { tenant } = requestBody;

      // Check if the user exists
      const userExists = await SubscriptionModel(tenant).findOne({
        email: userId,
      });
      if (!userExists) {
        throw new HttpError("User not found", httpStatus.NOT_FOUND);
      }

      const subscription = await SubscriptionModel(tenant).findById(
        userExists._id
      );

      // Check if the user is already following
      if (subscription.followers && subscription.followers.includes(userId)) {
        throw new HttpError(
          "User is already following",
          httpStatus.BAD_REQUEST
        );
      }

      // Add the user to followers array
      subscription.followers.push(userId);

      const updatedSubscription = await subscription.save();

      logObject("updatedSubscription", updatedSubscription);

      return {
        success: true,
        message: "Successfully followed user",
        data: updatedSubscription,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  notifications: async (request, next) => {
    try {
      const { tenant } = request.query;

      // Fetch notifications for the user
      const notifications = await SubscriptionModel(tenant).find({
        email: userId,
      });

      logObject("notifications", notifications);

      return {
        success: true,
        message: "Successfully retrieved notifications",
        data: notifications,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  like: async (postId, requestBody, next) => {
    try {
      const { tenant } = requestBody;

      // Check if the post exists
      const postExists = await PostModel(tenant).findById(postId);
      if (!postExists) {
        throw new HttpError("Post not found", httpStatus.NOT_FOUND);
      }

      // Check if the user has liked the post
      if (postExists.likes && postExists.likes.includes(userId)) {
        throw new HttpError(
          "User has already liked this post",
          httpStatus.BAD_REQUEST
        );
      }

      // Add the user to likes array
      postExists.likes.push(userId);

      const updatedPost = await postExists.save();

      logObject("updatedPost", updatedPost);

      return {
        success: true,
        message: "Successfully liked post",
        data: updatedPost,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  bookmark: async (postId, requestBody, next) => {
    try {
      const { tenant } = requestBody;

      // Check if the post exists
      const postExists = await PostModel(tenant).findById(postId);
      if (!postExists) {
        throw new HttpError("Post not found", httpStatus.NOT_FOUND);
      }

      // Check if the user has bookmarked the post
      if (postExists.bookmarks && postExists.bookmarks.includes(userId)) {
        throw new HttpError(
          "User has already bookmarked this post",
          httpStatus.BAD_REQUEST
        );
      }

      // Add the user to bookmarks array
      postExists.bookmarks.push(userId);

      const updatedPost = await postExists.save();

      logObject("updatedPost", updatedPost);

      return {
        success: true,
        message: "Successfully bookmarked post",
        data: updatedPost,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },
};

module.exports = manageInteractions;
