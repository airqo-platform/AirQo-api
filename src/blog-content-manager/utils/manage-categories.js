const mongoose = require("mongoose");
const CategoryModel = require("@models/category");
const TagModel = require("@models/tag");
const PostModel = require("@models/post");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- manage-categories`
);

const categoryTagUtil = {
  async create(body, next) {
    try {
      const result = await CategoryModel(body.tenant).create(body, next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          data: result.data,
          status: result.status || httpStatus.CREATED,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },

  async list(query, next) {
    try {
      const result = await CategoryModel(query.tenant).list(query, next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          data: result.data,
          total: result.total,
          status: result.status || httpStatus.OK,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },

  async update(id, body, next) {
    try {
      const result = await CategoryModel(id, body).update(body, next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          data: result.data,
          status: result.status || httpStatus.OK,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },

  async delete(id, next) {
    try {
      const result = await CategoryModel(id).remove(next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          status: result.status || httpStatus.NO_CONTENT,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },

  async assign(postId, body, next) {
    try {
      const result = await PostModel(postId).incrementViews(body.tenant, next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          data: result.data,
          status: result.status || httpStatus.OK,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },

  async posts(id, query, next) {
    try {
      const result = await PostModel(id).list(query, next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          data: result.data,
          total: result.total,
          status: result.status || httpStatus.OK,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },

  async browseCategories(query, next) {
    try {
      const result = await CategoryModel().getHierarchy(next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          data: result.data,
          status: result.status || httpStatus.OK,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },

  async browseTags(query, next) {
    try {
      const result = await TagModel().list(query, next);
      if (result.success === true) {
        return {
          success: true,
          message: result.message,
          data: result.data,
          total: result.total,
          status: result.status || httpStatus.OK,
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new Error(error.message));
    }
  },
};

module.exports = categoryTagUtil;
