const PostModel = require("@models/post");
const { logObject } = require("@utils/log");
const mailer = require("@utils/mailer");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- blog-post-util`);
const { HttpError } = require("@utils/errors");

const createBlogPostUtil = {
  create: async (request, next) => {
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
        views,
        tenant,
      } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      // Validate required fields
      if (!title || !content || !authorId) {
        throw new HttpError("Missing required fields", httpStatus.BAD_REQUEST);
      }

      // Prepare data for creation
      const postData = {
        title,
        content,
        author: authorId,
        categories: categories || [],
        tags: tags || [],
        status: status || "draft",
        publishDate: publishDate || new Date(),
        featuredImage: featuredImage || "",
        slug: slug || "",
        views: views || 0,
      };

      // Create the post
      const responseFromCreatePost = await PostModel(tenant).create(
        postData,
        next
      );

      if (responseFromCreatePost.success === true) {
        const createdPost = responseFromCreatePost.data;

        // Send email notification (if needed)
        if (createdPost.author && createdPost.author.email) {
          await mailer.postNotification(
            {
              to: createdPost.author.email,
              subject: "New Blog Post Created",
              body: `A new blog post titled '${createdPost.title}' has been published.`,
            },
            next
          );
        }

        return {
          success: true,
          message: "Blog post created successfully",
          data: createdPost,
          status: responseFromCreatePost.status || httpStatus.CREATED,
        };
      } else if (responseFromCreatePost.success === false) {
        logObject("responseFromCreatePost", responseFromCreatePost);
        return responseFromCreatePost;
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

  list: async (request, next) => {
    try {
      const { tenant, filter, limit, skip } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const responseFromListPosts = await PostModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      return responseFromListPosts;
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

  retrieve: async (request, next) => {
    try {
      const { id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const responseFromRetrievePost = await PostModel(tenant).findById(
        id,
        next
      );

      if (!isEmpty(responseFromRetrievePost)) {
        return responseFromRetrievePost;
      } else {
        throw new HttpError("Post not found", httpStatus.NOT_FOUND);
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

  update: async (request, next) => {
    try {
      const { id, update, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const filter = await generateFilter.post(request, next);

      const responseFromUpdatePost = await PostModel(tenant).update(
        {
          id,
          update,
        },
        next
      );

      if (!isEmpty(responseFromUpdatePost)) {
        return responseFromUpdatePost;
      } else {
        throw new HttpError("Post not found", httpStatus.NOT_FOUND);
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

  delete: async (request, next) => {
    try {
      const { id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const responseFromDeletePost = await PostModel(tenant).remove(id, next);

      if (!isEmpty(responseFromDeletePost)) {
        return {
          success: true,
          message: "Blog post deleted successfully",
          data: responseFromDeletePost,
          status: httpStatus.OK,
        };
      } else {
        throw new HttpError("Post not found", httpStatus.NOT_FOUND);
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

  uploadImage: async (request, next) => {
    try {
      const { image } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!image) {
        throw new HttpError("Missing image file", httpStatus.BAD_REQUEST);
      }

      // Upload image logic here
      // This is just a placeholder. You'll need to implement the actual image upload logic
      const uploadedImageUrl = `https://example.com/${Date.now()}-${
        image.originalname
      }`;

      return {
        success: true,
        message: "Image uploaded successfully",
        imageUrl: uploadedImageUrl,
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

  preview: async (request, next) => {
    try {
      const { content } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!content) {
        throw new HttpError(
          "Content is required for preview",
          httpStatus.BAD_REQUEST
        );
      }

      // Preview generation logic here
      // This is just a placeholder. You'll need to implement the actual preview generation logic
      const htmlContent = `<h1>${content}</h1><p>This is a preview of the blog post.</p>`;

      return {
        success: true,
        message: "Preview generated successfully",
        htmlContent,
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
  updateDraftStatus: async (request, next) => {
    try {
      const { id, update, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const filter = await generateFilter.draftStatus(request, next);

      const responseFromUpdatePost = await PostModel(tenant).update(
        {
          _id: id,
          status: update.status,
        },
        next
      );

      if (!isEmpty(responseFromUpdatePost)) {
        return responseFromUpdatePost;
      } else {
        throw new HttpError("Post not found", httpStatus.NOT_FOUND);
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

module.exports = createBlogPostUtil;

/***
 * This utility file implements the necessary functions for managing blog posts, including creating, listing, retrieving, updating, deleting, uploading images, and generating previews. Here's a breakdown of the key points:
We import the necessary dependencies, including the PostModel, logging utilities, and error handling.
The create function handles creating a new blog post, validating input, and sending a notification email if needed.
The list function retrieves a paginated list of blog posts based on the provided filter, limit, and skip parameters.
The retrieve function fetches a single blog post by its ID.
The update function updates an existing blog post using the provided ID and update data.
The delete function removes a blog post by its ID.
The uploadImage function handles image uploads, though the actual logic is placeholder and needs to be implemented.
The preview function generates a preview of the blog post content.
Each function follows a similar pattern of error handling and logging, using the provided HttpError class for consistent error reporting. The functions also utilize the tenant-specific PostModel for database operations.
 */
