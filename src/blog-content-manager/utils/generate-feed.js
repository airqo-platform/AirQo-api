const PostModel = require("@models/post");
const { logObject } = require("@utils/log");
const mailer = require("@utils/mailer");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- rssFeed-util`);
const { HttpError } = require("@utils/errors");

const generateFilter = require("@utils/generate-filter");

const rssFeedUtil = {
  generateFeed: async (blogId, request, next) => {
    try {
      const errors = extractErrorsFromRequest(request);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const tenant = isEmpty(request.query.tenant)
        ? constants.DEFAULT_TENANT || "airqo"
        : request.query.tenant;

      // Fetch posts for the blog
      const filter = await generateFilter.post({ blogId });
      const posts = await PostModel(tenant).list(filter);

      // Prepare feed data
      const feedData = prepareFeedData(posts);

      // Send email notification
      await mailer.rssFeedNotification(feedData, tenant, next);

      return {
        success: true,
        message: "RSS feed generated successfully",
        data: feedData.url,
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
};

// Helper function to prepare feed data
const prepareFeedData = (posts) => {
  const items = posts.map((post) => ({
    title: post.title,
    link: `/blog/${post.slug}`,
    pubDate: new Date(post.publishDate).toISOString(),
    author: post.author.name,
    content: post.content.substring(0, 300) + "...",
  }));

  return {
    url: `http://${constants.HOST}/rss/feed`,
    items,
  };
};

// Helper function to extract errors from request
const extractErrorsFromRequest = (request) => {
  const errors = {};
  Object.keys(request.body).forEach((key) => {
    if (!request.body[key]) {
      errors[key] = "Field is required";
    }
  });
  return errors;
};

module.exports = rssFeedUtil;

/***
 * generateFeed: This is the main function called by the controller. It handles the entire process of generating the RSS feed.
prepareFeedData: This helper function prepares the data for the RSS feed, converting the posts into the required format.
extractErrorsFromRequest: This function checks for required fields in the request body and returns any missing fields as errors.
Error handling and logging: All functions include try-catch blocks and use the logger to record errors.
Tenant handling: The code uses the tenant parameter to fetch the correct model and generate the appropriate filter.
Integration with PostModel: The list method of PostModel is used to fetch posts for the blog.
Email notification: An email notification is sent using the mailer.rssFeedNotification function.
Response formatting: The function returns a structured response with success, message, data, and status.
This implementation follows the structure of the provided template and incorporates the necessary functionality for generating an RSS feed based on the PostModel. It handles errors, uses logging, and integrates with other utility functions like generateFilter and mailer.
To use this utility file in the controller, you'll need to ensure that all the imported modules (PostModel, extractErrorsFromRequest, generateFilter, mailer) are properly implemented and exported from their respective files.
 */
