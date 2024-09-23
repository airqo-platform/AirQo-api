const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- category-model`);
const { HttpError } = require("@utils/errors");

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      maxlength: [50, "Category name cannot be more than 50 characters"],
    },
    slug: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot be more than 200 characters"],
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

CategorySchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

CategorySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      parent: this.parent,
      order: this.order,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

CategorySchema.statics = {
  async create(args, next) {
    try {
      let body = args;
      if (body._id) {
        delete body._id;
      }
      let data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Category created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create category",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          data: null,
        };
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async list({ skip = 0, limit = 20, filter = {} } = {}, next) {
    try {
      const categories = await this.find(filter)
        .sort({ order: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .populate("parent", "name")
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(categories)) {
        return {
          success: true,
          data: categories,
          total,
          message: "Successfully retrieved categories",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No categories found",
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

  async findById(id, next) {
    try {
      const category = await this.findOne({ _id: id })
        .populate("parent", "name")
        .exec();

      if (!isEmpty(category)) {
        return {
          success: true,
          data: category,
          message: "Successfully retrieved category",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Category not found", httpStatus.NOT_FOUND));
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

  async update({ id, update = {} } = {}, next) {
    try {
      const options = { new: true, runValidators: true };
      if (update._id) {
        delete update._id;
      }
      const updatedCategory = await this.findByIdAndUpdate(id, update, options)
        .populate("parent", "name")
        .exec();

      if (!isEmpty(updatedCategory)) {
        return {
          success: true,
          message: "Successfully updated the category",
          data: updatedCategory,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Category not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      // Check if category has children
      const hasChildren = await this.exists({ parent: id });
      if (hasChildren) {
        return next(
          new HttpError(
            "Cannot delete category with subcategories",
            httpStatus.BAD_REQUEST
          )
        );
      }

      const removedCategory = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedCategory)) {
        return {
          success: true,
          message: "Successfully removed the category",
          data: removedCategory,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Category not found", httpStatus.NOT_FOUND));
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

  async getHierarchy(next) {
    try {
      const categories = await this.find({})
        .sort({ order: 1, name: 1 })
        .lean()
        .exec();

      const buildHierarchy = (parent = null) => {
        return categories
          .filter(
            (c) =>
              c.parent &&
              c.parent.toString() === (parent ? parent.toString() : null)
          )
          .map((c) => ({
            ...c,
            children: buildHierarchy(c._id),
          }));
      };

      const hierarchy = buildHierarchy();

      return {
        success: true,
        data: hierarchy,
        message: "Successfully retrieved category hierarchy",
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

  async updateOrder(categories, next) {
    try {
      const updateOperations = categories.map(({ _id, order }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { order } },
        },
      }));

      await this.bulkWrite(updateOperations);

      return {
        success: true,
        message: "Successfully updated category order",
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

const CategoryModel = (tenant) => {
  try {
    let categories = mongoose.model("categories");
    return categories;
  } catch (error) {
    let categories = getModelByTenant(tenant, "category", CategorySchema);
    return categories;
  }
};

module.exports = CategoryModel;
