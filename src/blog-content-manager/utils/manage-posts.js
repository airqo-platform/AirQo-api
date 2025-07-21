const mongoose = require("mongoose");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- manage-posts`);
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const PostModel = require("@models/Post");
const TagModel = require("@models/Tag");
const CategoryModel = require("@models/Category");
const ReplyModel = require("@models/Reply");
const AuthorModel = require("@models/Author");

/***
  createPost,
  updatePostFeaturedImage,
  updatePostCategories,
  updatePostTags,
  updatePostTitleAndSlug,
  updatePostContent,
  updatePostAuthor,
  updatePostPublishDate,
  updatePostFeatured,
  updatePostStatusAndFeatured,
  updatePostCategoriesAndTags
 */

const managePosts = {
  createPost: async (args, next) => {
    try {
      const {
        title,
        content,
        authorId,
        categories,
        tags,
        status,
        publishDate,
        featuredImage,
        slug,
      } = args;

      const newPost = {
        title,
        content,
        author: authorId,
        categories: categories.map((category) => category.toString()),
        tags: tags.map((tag) => tag.toString()),
        status,
        publishDate,
        featuredImage,
        slug,
      };

      const post = await PostModel(
        getModelByTenant(args.tenant, "post")
      ).create(newPost, next);

      if (!isEmpty(post)) {
        return {
          success: true,
          data: post,
          message: "Post created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        throw new HttpError(
          "Failed to create post",
          httpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  list: async ({ skip = 0, limit = 20, filter = {} } = {}, next) => {
    try {
      const posts = await PostModel(getModelByTenant(filter.tenant, "post"))
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await PostModel(
        getModelByTenant(filter.tenant, "post")
      ).countDocuments(filter);

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          total,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found",
          data: [],
          total: 0,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  findById: async (id, next) => {
    try {
      const post = await PostModel(getModelByTenant(null, "post"))
        .findOne({ _id: id })
        .exec();

      if (!isEmpty(post)) {
        return {
          success: true,
          data: post,
          message: "Successfully retrieved post",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  update: async ({ id, update = {} } = {}, next) => {
    try {
      const options = { new: true, runValidators: true };
      if (update._id) {
        delete update._id;
      }
      const updatedPost = await PostModel(
        getModelByTenant(update.tenant, "post")
      )
        .findByIdAndUpdate(id, update, options)
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Successfully updated the post",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  remove: async (id, next) => {
    try {
      const removedPost = await PostModel(getModelByTenant(null, "post"))
        .findByIdAndRemove(id)
        .exec();

      if (!isEmpty(removedPost)) {
        return {
          success: true,
          message: "Successfully removed the post",
          data: removedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  addTags: async (postId, tags, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $addToSet: { tags: { $each: tags } } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Tags added successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  removeTag: async (postId, tagId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $pull: { tags: tagId } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Tag removed successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  addCategory: async (postId, categoryId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $addToSet: { categories: categoryId } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Category added successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  removeCategory: async (postId, categoryId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $pull: { categories: categoryId } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Category removed successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  addAuthor: async (postId, authorId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $set: { author: authorId } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Author added successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  removeAuthor: async (postId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $unset: { author: "" } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Author removed successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateFeaturedImage: async ({ id, featuredImage } = {}, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findByIdAndUpdate(id, { $set: { featuredImage } }, { new: true })
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Featured image updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateSlug: async ({ id, slug } = {}, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findByIdAndUpdate(id, { $set: { slug } }, { new: true })
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Slug updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePublishDate: async ({ id, publishDate } = {}, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findByIdAndUpdate(id, { $set: { publishDate } }, { new: true })
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Publish date updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateStatus: async ({ id, status } = {}, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findByIdAndUpdate(id, { $set: { status } }, { new: true })
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Status updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getTags: async (next) => {
    try {
      const tags = await TagModel(getModelByTenant(null, "tag"))
        .find()
        .select("_id name")
        .exec();

      if (!isEmpty(tags)) {
        return {
          success: true,
          data: tags,
          message: "Successfully retrieved tags",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No tags found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getCategories: async (next) => {
    try {
      const categories = await CategoryModel(getModelByTenant(null, "category"))
        .find()
        .select("_id name")
        .exec();

      if (!isEmpty(categories)) {
        return {
          success: true,
          data: categories,
          message: "Successfully retrieved categories",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No categories found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getAuthors: async (next) => {
    try {
      const authors = await AuthorModel(getModelByTenant(null, "author"))
        .find()
        .select("_id name email")
        .exec();

      if (!isEmpty(authors)) {
        return {
          success: true,
          data: authors,
          message: "Successfully retrieved authors",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No authors found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getComments: async (postId, next) => {
    try {
      const comments = await CommentModel(getModelByTenant(null, "comment"))
        .find({ post: postId })
        .populate("author")
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      if (!isEmpty(comments)) {
        return {
          success: true,
          data: comments,
          message: "Successfully retrieved comments",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No comments found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  deleteComment: async (commentId, next) => {
    try {
      const deletedComment = await CommentModel(
        getModelByTenant(null, "comment")
      )
        .deleteOne({ _id: commentId })
        .exec();

      if (deletedComment.deletedCount > 0) {
        return {
          success: true,
          message: "Comment deleted successfully",
          status: httpStatus.NO_CONTENT,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateComment: async (commentId, update, next) => {
    try {
      const options = { new: true, runValidators: true };
      if (update._id) {
        delete update._id;
      }
      const updatedComment = await CommentModel(
        getModelByTenant(update.tenant, "comment")
      )
        .findByIdAndUpdate(commentId, update, options)
        .exec();

      if (!isEmpty(updatedComment)) {
        return {
          success: true,
          message: "Comment updated successfully",
          data: updatedComment,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  getReplies: async (commentId, next) => {
    try {
      const replies = await ReplyModel(getModelByTenant(null, "reply"))
        .find({ parent: commentId })
        .populate("parent author")
        .sort({ createdAt: -1 })
        .limit(5)
        .exec();

      if (!isEmpty(replies)) {
        return {
          success: true,
          data: replies,
          message: "Successfully retrieved replies",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No replies found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  addReply: async (parentId, replyContent, next) => {
    try {
      const newReply = {
        parent: parentId,
        content: replyContent,
        author: null, // Assuming the author is set automatically based on the current user
      };

      const createdReply = await ReplyModel(
        getModelByTenant(null, "reply")
      ).create(newReply, next);

      if (!isEmpty(createdReply)) {
        return {
          success: true,
          message: "Reply created successfully",
          data: createdReply,
          status: httpStatus.CREATED,
        };
      } else {
        next(
          new HttpError(
            "Failed to create reply",
            httpStatus.INTERNAL_SERVER_ERROR
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateReply: async (replyId, update, next) => {
    try {
      const options = { new: true, runValidators: true };
      if (update._id) {
        delete update._id;
      }
      const updatedReply = await ReplyModel(
        getModelByTenant(update.tenant, "reply")
      )
        .findByIdAndUpdate(replyId, update, options)
        .exec();

      if (!isEmpty(updatedReply)) {
        return {
          success: true,
          message: "Reply updated successfully",
          data: updatedReply,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Reply not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  deleteReply: async (replyId, next) => {
    try {
      const deletedReply = await ReplyModel(getModelByTenant(null, "reply"))
        .deleteOne({ _id: replyId })
        .exec();

      if (deletedReply.deletedCount > 0) {
        return {
          success: true,
          message: "Reply deleted successfully",
          status: httpStatus.NO_CONTENT,
        };
      } else {
        next(new HttpError("Reply not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostStatistics: async (postId, next) => {
    try {
      const statistics = await PostModel(getModelByTenant(null, "post"))
        .aggregate([
          {
            $match: { _id: postId },
          },
          {
            $lookup: {
              from: "comments",
              localField: "_id",
              foreignField: "post",
              as: "comments",
            },
          },
          {
            $project: {
              views: 1,
              likes: 1,
              dislikes: 1,
              comments: { $size: "$comments" },
            },
          },
        ])
        .next();

      if (!isEmpty(statistics)) {
        return {
          success: true,
          data: statistics,
          message: "Successfully retrieved post statistics",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No statistics available",
          data: {},
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateViewCount: async (postId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $inc: { views: 1 } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "View count updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateLikeCount: async (postId, like, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $inc: { likes: like ? 1 : -1 } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Like count updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateDislikeCount: async (postId, dislike, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $inc: { dislikes: dislike ? 1 : -1 } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Dislike count updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateEngagement: async (postId, engagement, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          {
            $inc: {
              likes: engagement.likes || 0,
              dislikes: engagement.dislikes || 0,
              views: engagement.views || 0,
            },
          },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Engagement updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateTimestamps: async (postId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(null, "post"))
        .findOneAndUpdate(
          { _id: postId },
          {
            updatedAt: new Date(),
            lastModified: new Date(),
          },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Timestamps updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostBySlug: async (slug, next) => {
    try {
      const post = await PostModel(getModelByTenant(null, "post"))
        .findOne({ slug })
        .populate("author")
        .exec();

      if (!isEmpty(post)) {
        return {
          success: true,
          data: post,
          message: "Successfully retrieved post",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No post found with the given slug",
          data: null,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByTag: async (tagId, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({ tags: tagId })
        .select(
          "_id title slug author publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found with the given tag",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByCategory: async (categoryId, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({ categories: categoryId })
        .select(
          "_id title slug author publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found with the given category",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByAuthor: async (authorId, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({ author: authorId })
        .select(
          "_id title slug publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found for the given author",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByDateRange: async (startDate, endDate, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({
          publishDate: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .select(
          "_id title slug author publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ publishDate: 1 })
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found in the given date range",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostCount: async (next) => {
    try {
      const count = await PostModel(getModelByTenant(null, "post"))
        .countDocuments()
        .exec();

      return {
        success: true,
        data: { count },
        message: "Successfully retrieved post count",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPopularPosts: async (limit, next) => {
    try {
      const popularPosts = await PostModel(getModelByTenant(null, "post"))
        .aggregate([
          {
            $lookup: {
              from: "comments",
              localField: "_id",
              foreignField: "post",
              as: "commentCount",
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              slug: 1,
              author: 1,
              publishDate: 1,
              createdAt: 1,
              updatedAt: 1,
              lastModified: 1,
              categories: 1,
              featuredImage: 1,
              status: 1,
              views: 1,
              likes: 1,
              dislikes: 1,
              commentCount: { $size: "$commentCount" },
            },
          },
          {
            $sort: { commentCount: -1, createdAt: -1 },
          },
          {
            $limit: limit,
          },
        ])
        .allowDiskUse(true)
        .exec();

      if (!isEmpty(popularPosts)) {
        return {
          success: true,
          data: popularPosts,
          message: "Successfully retrieved popular posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No popular posts found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostByAuthorAndDateRange: async (authorId, startDate, endDate, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({
          author: authorId,
          publishDate: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .select(
          "_id title slug publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ publishDate: 1 })
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found for the given author and date range",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByCategoryAndDateRange: async (
    categoryId,
    startDate,
    endDate,
    next
  ) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({
          categories: categoryId,
          publishDate: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .select(
          "_id title slug publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ publishDate: 1 })
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found for the given category and date range",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByTagAndDateRange: async (tagId, startDate, endDate, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({
          tags: tagId,
          publishDate: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .select(
          "_id title slug publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ publishDate: 1 })
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found for the given tag and date range",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByCategoryAndAuthor: async (categoryId, authorId, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({
          categories: categoryId,
          author: authorId,
        })
        .select(
          "_id title slug publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ publishDate: 1 })
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found for the given category and author",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByTagAndAuthor: async (tagId, authorId, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({
          tags: tagId,
          author: authorId,
        })
        .select(
          "_id title slug publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ publishDate: 1 })
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found for the given tag and author",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostsByDateRangeAndLimit: async (startDate, endDate, limit, next) => {
    try {
      const posts = await PostModel(getModelByTenant(null, "post"))
        .find({
          publishDate: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .select(
          "_id title slug author publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ publishDate: 1 })
        .limit(limit)
        .exec();

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found in the given date range",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getFeaturedPosts: async (limit, next) => {
    try {
      const featuredPosts = await PostModel(getModelByTenant(null, "post"))
        .find({ featured: true })
        .select(
          "_id title slug author publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();

      if (!isEmpty(featuredPosts)) {
        return {
          success: true,
          data: featuredPosts,
          message: "Successfully retrieved featured posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No featured posts found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getDrafts: async (userId, next) => {
    try {
      const drafts = await PostModel(getModelByTenant(userId, "post"))
        .find({ status: "draft" })
        .select(
          "_id title slug author publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ createdAt: -1 })
        .exec();

      if (!isEmpty(drafts)) {
        return {
          success: true,
          data: drafts,
          message: "Successfully retrieved drafts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No drafts found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getTrash: async (userId, next) => {
    try {
      const trashedPosts = await PostModel(getModelByTenant(userId, "post"))
        .find({ status: "trashed" })
        .select(
          "_id title slug author publishDate createdAt updatedAt lastModified categories featuredImage status views likes dislikes comments"
        )
        .sort({ createdAt: -1 })
        .exec();

      if (!isEmpty(trashedPosts)) {
        return {
          success: true,
          data: trashedPosts,
          message: "Successfully retrieved trashed posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found in trash",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  restoreFromTrash: async (postId, userId, next) => {
    try {
      const restoredPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId, status: "trashed" },
          { status: "draft" },
          { new: true }
        )
        .exec();

      if (!isEmpty(restoredPost)) {
        return {
          success: true,
          message: "Post restored from trash successfully",
          data: restoredPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found in trash", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  permanentlyDelete: async (postId, userId, next) => {
    try {
      const deletedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndDelete({ _id: postId })
        .exec();

      if (!isEmpty(deletedPost)) {
        return {
          success: true,
          message: "Post permanently deleted",
          status: httpStatus.NO_CONTENT,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  bulkUpdatePosts: async (updates, userId, next) => {
    try {
      const updatedPosts = await PostModel(getModelByTenant(userId, "post"))
        .updateMany(updates, { multi: true })
        .exec();

      if (!isEmpty(updatedPosts)) {
        return {
          success: true,
          message: "Posts updated successfully",
          data: updatedPosts,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("No posts found to update", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostCategories: async (next) => {
    try {
      const categories = await CategoryModel(getModelByTenant(null, "category"))
        .distinct("name")
        .exec();

      if (!isEmpty(categories)) {
        return {
          success: true,
          data: categories,
          message: "Successfully retrieved post categories",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No categories found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostTags: async (next) => {
    try {
      const tags = await TagModel(getModelByTenant(null, "tag"))
        .distinct("name")
        .exec();

      if (!isEmpty(tags)) {
        return {
          success: true,
          data: tags,
          message: "Successfully retrieved post tags",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No tags found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostAuthors: async (next) => {
    try {
      const authors = await AuthorModel(getModelByTenant(null, "author"))
        .distinct("username")
        .exec();

      if (!isEmpty(authors)) {
        return {
          success: true,
          data: authors,
          message: "Successfully retrieved post authors",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No authors found",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getPostComments: async (postId, next) => {
    try {
      const comments = await CommentModel(getModelByTenant(null, "comment"))
        .find({ post: postId })
        .select("_id content createdAt updatedAt author")
        .sort({ createdAt: -1 })
        .exec();

      if (!isEmpty(comments)) {
        return {
          success: true,
          data: comments,
          message: "Successfully retrieved comments",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No comments found for this post",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  createComment: async (postId, userId, content, next) => {
    try {
      const newComment = new CommentModel(getModelByTenant(userId, "comment"));
      newComment.post = postId;
      newComment.author = userId;
      newComment.content = content;

      const savedComment = await newComment.save();

      if (!isEmpty(savedComment)) {
        return {
          success: true,
          message: "Comment created successfully",
          data: savedComment,
          status: httpStatus.CREATED,
        };
      } else {
        next(
          new HttpError(
            "Failed to create comment",
            httpStatus.INTERNAL_SERVER_ERROR
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateComment: async (commentId, userId, content, next) => {
    try {
      const updatedComment = await CommentModel(
        getModelByTenant(userId, "comment")
      )
        .findOneAndUpdate(
          { _id: commentId },
          { $set: { content } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedComment)) {
        return {
          success: true,
          message: "Comment updated successfully",
          data: updatedComment,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  deleteComment: async (commentId, userId, next) => {
    try {
      const deletedComment = await CommentModel(
        getModelByTenant(userId, "comment")
      )
        .findOneAndDelete({ _id: commentId })
        .exec();

      if (!isEmpty(deletedComment)) {
        return {
          success: true,
          message: "Comment deleted successfully",
          status: httpStatus.NO_CONTENT,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  toggleLike: async (postId, userId, next) => {
    try {
      const post = await PostModel(getModelByTenant(null, "post"))
        .findOne({ _id: postId })
        .exec();

      if (!isEmpty(post)) {
        let likes;
        if (post.likes.includes(userId)) {
          likes = post.likes.filter((id) => id !== userId);
        } else {
          likes = [...post.likes, userId];
        }

        const updatedPost = await PostModel(getModelByTenant(null, "post"))
          .findOneAndUpdate({ _id: postId }, { likes: likes }, { new: true })
          .exec();

        if (!isEmpty(updatedPost)) {
          return {
            success: true,
            message: "Like toggled successfully",
            data: updatedPost,
            status: httpStatus.OK,
          };
        } else {
          next(
            new HttpError(
              "Failed to update post likes",
              httpStatus.INTERNAL_SERVER_ERROR
            )
          );
        }
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  toggleDislike: async (postId, userId, next) => {
    try {
      const post = await PostModel(getModelByTenant(null, "post"))
        .findOne({ _id: postId })
        .exec();

      if (!isEmpty(post)) {
        let dislikes;
        if (post.dislikes.includes(userId)) {
          dislikes = post.dislikes.filter((id) => id !== userId);
        } else {
          dislikes = [...post.dislikes, userId];
        }

        const updatedPost = await PostModel(getModelByTenant(null, "post"))
          .findOneAndUpdate(
            { _id: postId },
            { dislikes: dislikes },
            { new: true }
          )
          .exec();

        if (!isEmpty(updatedPost)) {
          return {
            success: true,
            message: "Dislike toggled successfully",
            data: updatedPost,
            status: httpStatus.OK,
          };
        } else {
          next(
            new HttpError(
              "Failed to update post dislikes",
              httpStatus.INTERNAL_SERVER_ERROR
            )
          );
        }
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  incrementViewCount: async (postId, userId, next) => {
    try {
      const post = await PostModel(getModelByTenant(null, "post"))
        .findOne({ _id: postId })
        .exec();

      if (!isEmpty(post)) {
        const updatedPost = await PostModel(getModelByTenant(null, "post"))
          .findOneAndUpdate(
            { _id: postId },
            { $inc: { views: 1 } },
            { new: true }
          )
          .exec();

        if (!isEmpty(updatedPost)) {
          return {
            success: true,
            message: "View count incremented successfully",
            data: updatedPost,
            status: httpStatus.OK,
          };
        } else {
          next(
            new HttpError(
              "Failed to increment view count",
              httpStatus.INTERNAL_SERVER_ERROR
            )
          );
        }
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostStatus: async (postId, userId, status, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate({ _id: postId }, { status: status }, { new: true })
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post status updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostFeaturedImage: async (postId, userId, featuredImage, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { featuredImage: featuredImage },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Featured image updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostCategories: async (postId, userId, categories, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $set: { categories: categories } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post categories updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostTags: async (postId, userId, tags, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { $set: { tags: tags } },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post tags updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostTitleAndSlug: async (postId, userId, title, slug, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          {
            $set: {
              title: title,
              slug: slug,
            },
          },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post title and slug updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostAuthor: async (postId, userId, authorId, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate({ _id: postId }, { author: authorId }, { new: true })
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post author updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostPublishDate: async (postId, userId, publishDate, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { publishDate: publishDate },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post publish date updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostFeatured: async (postId, userId, featured, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          { featured: featured },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post featured status updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostStatusAndFeatured: async (
    postId,
    userId,
    status,
    featured,
    next
  ) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          {
            status: status,
            featured: featured,
          },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post status and featured status updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostCategoriesAndTags: async (
    postId,
    userId,
    categories,
    tags,
    next
  ) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate(
          { _id: postId },
          {
            categories: categories,
            tags: tags,
          },
          { new: true }
        )
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post categories and tags updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updatePostContent: async (postId, userId, content, next) => {
    try {
      const updatedPost = await PostModel(getModelByTenant(userId, "post"))
        .findOneAndUpdate({ _id: postId }, { content: content }, { new: true })
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Post content updated successfully",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = managePosts;
