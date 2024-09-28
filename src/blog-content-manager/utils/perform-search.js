const mongoose = require("mongoose");
const AuthorModel = require("@models/author");
const CategoryModel = require("@models/category");
const TagModel = require("@models/tag");
const PostModel = require("@models/post");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- perform-search`);
const { HttpError } = require("@utils/errors");

const searchUtil = {
  search: async (query, request, next) => {
    try {
      const { tenant } = request.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";

      // Convert query to lowercase for consistency
      query = query.toLowerCase();

      // Perform search across all models
      const results = {};

      // Search Posts
      const postQuery = {
        $or: [
          { title: { $regex: new RegExp(query, "i") } },
          { content: { $regex: new RegExp(query, "i") } },
          { author: { name: { $regex: new RegExp(query, "i") } } },
          { categories: { name: { $regex: new RegExp(query, "i") } } },
          { tags: { name: { $regex: new RegExp(query, "i") } } },
        ],
      };

      const posts = await PostModel(tenant).find(postQuery);

      // Search Authors
      const authorQuery = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      };
      const authors = await AuthorModel(tenant).find(authorQuery);

      // Search Categories
      const categoryQuery = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { slug: { $regex: query, $options: "i" } },
        ],
      };
      const categories = await CategoryModel(tenant).find(categoryQuery);

      // Search Tags
      const tagQuery = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { slug: { $regex: query, $options: "i" } },
        ],
      };
      const tags = await TagModel(tenant).find(tagQuery);

      // Combine results
      results.posts = posts.map((post) => ({
        ...post.toJSON(),
        url: `/posts/${post.slug}`,
      }));
      results.authors = authors.map((author) => ({
        ...author.toJSON(),
        url: `/authors/${author._id}`,
      }));
      results.categories = categories.map((category) => ({
        ...category.toJSON(),
        url: `/categories/${category.slug}`,
      }));
      results.tags = tags.map((tag) => ({
        ...tag.toJSON(),
        url: `/tags/${tag.slug}`,
      }));

      return {
        success: true,
        message: "Search results found",
        data: results,
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

  autocomplete: async (query, request, next) => {
    try {
      const { tenant } = request.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";

      // Perform autocomplete for Posts, Authors, Categories, and Tags
      const results = {};

      // Autocomplete Posts
      const postResults = await PostModel(tenant).aggregate([
        {
          $project: {
            title: 1,
            content: 1,
            author: 1,
            categories: 1,
            tags: 1,
            slug: 1,
          },
        },
        {
          $addFields: {
            score: {
              $meta: "textMatchCount",
            },
          },
        },
        {
          $sort: {
            score: { $multi: -1 },
          },
        },
        {
          $limit: 10,
        },
      ]);

      results.posts = postResults.map((doc) => ({
        ...doc,
        url: `/posts/${doc.slug}`,
      }));

      // Autocomplete Authors
      const authorResults = await AuthorModel(tenant).aggregate([
        {
          $project: {
            name: 1,
            email: 1,
          },
        },
        {
          $addFields: {
            score: {
              $meta: "textMatchCount",
            },
          },
        },
        {
          $sort: {
            score: { $multi: -1 },
          },
        },
        {
          $limit: 10,
        },
      ]);

      results.authors = authorResults.map((doc) => ({
        ...doc,
        url: `/authors/${doc._id}`,
      }));

      // Autocomplete Categories
      const categoryResults = await CategoryModel(tenant).aggregate([
        {
          $project: {
            name: 1,
            slug: 1,
          },
        },
        {
          $addFields: {
            score: {
              $meta: "textMatchCount",
            },
          },
        },
        {
          $sort: {
            score: { $multi: -1 },
          },
        },
        {
          $limit: 10,
        },
      ]);

      results.categories = categoryResults.map((doc) => ({
        ...doc,
        url: `/categories/${doc.slug}`,
      }));

      // Autocomplete Tags
      const tagResults = await TagModel(tenant).aggregate([
        {
          $project: {
            name: 1,
            slug: 1,
          },
        },
        {
          $addFields: {
            score: {
              $meta: "textMatchCount",
            },
          },
        },
        {
          $sort: {
            score: { $multi: -1 },
          },
        },
        {
          $limit: 10,
        },
      ]);

      results.tags = tagResults.map((doc) => ({
        ...doc,
        url: `/tags/${doc.slug}`,
      }));

      return {
        success: true,
        message: "Autocomplete results found",
        data: results,
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

  filter: async (query, request, next) => {
    try {
      const { tenant } = request.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";

      // Parse query parameters
      const params = Object.fromEntries(
        Object.entries(request.query).map(([key, value]) => [
          key,
          value.toLowerCase(),
        ])
      );

      // Filter Posts
      let filteredPosts = await PostModel(tenant).find(params);

      // Filter Authors
      let filteredAuthors = await AuthorModel(tenant).find(params);

      // Filter Categories
      let filteredCategories = await CategoryModel(tenant).find(params);

      // Filter Tags
      let filteredTags = await TagModel(tenant).find(params);

      // Combine and return results
      return {
        success: true,
        message: "Filtered results found",
        data: {
          posts: filteredPosts,
          authors: filteredAuthors,
          categories: filteredCategories,
          tags: filteredTags,
        },
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

  paginate: async (query, request, next) => {
    try {
      const { tenant } = request.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";

      // Parse query parameters
      const params = Object.fromEntries(
        Object.entries(request.query).map(([key, value]) => [
          key,
          value.toLowerCase(),
        ])
      );

      // Paginate Posts
      const postsPerPage = 10; // Adjust this value as needed
      const page = parseInt(request.query.page) || 1;
      const skip = (page - 1) * postsPerPage;
      const paginatedPosts = await PostModel(tenant)
        .find(params)
        .skip(skip)
        .limit(postsPerPage);

      // Paginate Authors
      const paginatedAuthors = await AuthorModel(tenant)
        .find(params)
        .skip(skip)
        .limit(postsPerPage);

      // Paginate Categories
      const paginatedCategories = await CategoryModel(tenant)
        .find(params)
        .skip(skip)
        .limit(postsPerPage);

      // Paginate Tags
      const paginatedTags = await TagModel(tenant)
        .find(params)
        .skip(skip)
        .limit(postsPerPage);

      // Calculate total count for pagination
      const totalCount = await Promise.all([
        PostModel(tenant).countDocuments(params),
        AuthorModel(tenant).countDocuments(params),
        CategoryModel(tenant).countDocuments(params),
        TagModel(tenant).countDocuments(params),
      ]).then((results) => ({
        posts: results[0],
        authors: results[1],
        categories: results[2],
        tags: results[3],
      }));

      return {
        success: true,
        message: "Paginated results found",
        data: {
          posts: paginatedPosts,
          authors: paginatedAuthors,
          categories: paginatedCategories,
          tags: paginatedTags,
          totalCount: totalCount,
        },
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

module.exports = searchUtil;
