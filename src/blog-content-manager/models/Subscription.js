const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- subscription-model`
);
const { HttpError } = require("@utils/errors");

const SubscriptionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot be more than 100 characters"],
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed", "bounced"],
      default: "active",
    },
    subscriptionType: {
      type: String,
      enum: ["weekly", "monthly", "all"],
      default: "all",
    },
    topics: [
      {
        type: String,
        trim: true,
      },
    ],
    lastEmailSent: {
      type: Date,
    },
    source: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

SubscriptionSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

SubscriptionSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      email: this.email,
      name: this.name,
      status: this.status,
      subscriptionType: this.subscriptionType,
      topics: this.topics,
      lastEmailSent: this.lastEmailSent,
      source: this.source,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

SubscriptionSchema.statics = {
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
          message: "Subscription created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create subscription",
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
      const subscriptions = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(subscriptions)) {
        return {
          success: true,
          data: subscriptions,
          total,
          message: "Successfully retrieved subscriptions",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No subscriptions found",
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
      const subscription = await this.findOne({ _id: id }).exec();

      if (!isEmpty(subscription)) {
        return {
          success: true,
          data: subscription,
          message: "Successfully retrieved subscription",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Subscription not found", httpStatus.NOT_FOUND));
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
      const updatedSubscription = await this.findByIdAndUpdate(
        id,
        update,
        options
      ).exec();

      if (!isEmpty(updatedSubscription)) {
        return {
          success: true,
          message: "Successfully updated the subscription",
          data: updatedSubscription,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Subscription not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedSubscription = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedSubscription)) {
        return {
          success: true,
          message: "Successfully removed the subscription",
          data: removedSubscription,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Subscription not found", httpStatus.NOT_FOUND));
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

  async findByEmail(email, next) {
    try {
      const subscription = await this.findOne({ email }).exec();

      if (!isEmpty(subscription)) {
        return {
          success: true,
          data: subscription,
          message: "Successfully retrieved subscription",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Subscription not found", httpStatus.NOT_FOUND));
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

  async getSubscriptionStats(next) {
    try {
      const stats = await this.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$count" },
            statuses: { $push: { status: "$_id", count: "$count" } },
          },
        },
        {
          $project: {
            _id: 0,
            total: 1,
            statuses: 1,
          },
        },
      ]).exec();

      return {
        success: true,
        data: stats[0],
        message: "Successfully retrieved subscription stats",
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

const SubscriptionModel = (tenant) => {
  try {
    let subscriptions = mongoose.model("subscriptions");
    return subscriptions;
  } catch (error) {
    let subscriptions = getModelByTenant(
      tenant,
      "subscription",
      SubscriptionSchema
    );
    return subscriptions;
  }
};

module.exports = SubscriptionModel;
