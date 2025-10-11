const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- subscriptions-model`
);
const { logObject } = require("@utils/shared");

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const SubscriptionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    subscribed: {
      type: Boolean,
      default: true,
    },
    isSystemUser: {
      type: Boolean,
      required: true,
    },
    notifications: {
      twitter: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: true,
      },
      phone: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

SubscriptionSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

SubscriptionSchema.pre("save", function (next) {
  return next();
});

SubscriptionSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      email: this.subscribed,
      isSystemUser: this.isSystemUser,
      notifications: this.notifications,
    };
  },
};

SubscriptionSchema.statics = {
  async register(args, next) {
    try {
      let createBody = args;
      logObject("args", args);

      // Remove _id if present
      if (createBody._id) {
        delete createBody._id;
      }

      logObject("createBody", createBody);
      const data = await this.create({
        ...createBody,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "subscription", {
          message: "subscription created successfully with no issues detected",
        });
      } else {
        return createEmptySuccessResponse(
          "subscription",
          "subscription not created despite successful operation"
        );
      }
    } catch (err) {
      logObject("error in the object", err);
      logger.error(`Data conflicts detected -- ${err.message}`);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      return createErrorResponse(err, "create", logger, "subscription");
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const subscriptions = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      return createSuccessResponse("list", subscriptions, "subscription", {
        message: "Successfully listed the subscriptions",
        emptyMessage: "No subscriptions found for this search",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "subscription");
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const updateBody = update;

      // Remove _id from update if present
      if (updateBody._id) {
        delete updateBody._id;
      }

      const updatedSubscription = await this.findOneAndUpdate(
        filter,
        updateBody,
        options
      ).exec();

      if (!isEmpty(updatedSubscription)) {
        return createSuccessResponse(
          "update",
          updatedSubscription._doc,
          "subscription"
        );
      } else {
        return createNotFoundResponse(
          "subscription",
          "update",
          "the User Subscription you are trying to UPDATE does not exist, please crosscheck"
        );
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);

      // Handle specific duplicate errors
      if (err.code == 11000) {
        return {
          success: false,
          message: "duplicate values provided",
          status: httpStatus.CONFLICT,
          errors: err.keyValue || { message: err.message },
        };
      } else {
        return createErrorResponse(err, "update", logger, "subscription");
      }
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
        },
      };

      const removedSubscription = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedSubscription)) {
        return createSuccessResponse(
          "delete",
          removedSubscription._doc,
          "subscription"
        );
      } else {
        return createNotFoundResponse(
          "subscription",
          "delete",
          "the User Subscription you are trying to DELETE does not exist, please crosscheck"
        );
      }
    } catch (error) {
      logger.error(`Data conflicts detected -- ${error.message}`);
      return {
        success: false,
        message: "Data conflicts detected",
        status: httpStatus.CONFLICT,
        errors: { message: error.message },
      };
    }
  },
  async unsubscribe(email, type) {
    try {
      const result = await this.updateOne(
        { email },
        { [`notifications.${type}`]: false }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          message: "Subscription not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `No subscription found for email: ${email}` },
        };
      }

      return {
        success: true,
        message: `Successfully unsubscribed from ${type} notifications`,
        data: { email, type, unsubscribed: true },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Unsubscribe error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  async checkNotificationStatus({ email, type }, next) {
    try {
      const subscription = await this.findOne({ email });

      if (!subscription) {
        return {
          success: false,
          message: "No subscription record found",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: `No subscription found for email: ${email}`,
          },
        };
      }

      // Check if the notification type exists and its value
      const notificationSetting = subscription.notifications[type];

      if (notificationSetting === undefined || notificationSetting === null) {
        // Notification type not configured - default to allow
        return {
          success: true, // Allow by default for undefined types
          message: `Notification type ${type} not configured, allowing by default`,
          data: {
            email,
            type,
            subscribed: true,
            defaulted: true,
            notifications: subscription.notifications,
          },
          status: httpStatus.OK,
        };
      } else if (notificationSetting === false) {
        // User explicitly unsubscribed from this notification type
        return {
          success: false,
          message: "User unsubscribed from notifications",
          status: httpStatus.FORBIDDEN,
          errors: {
            message: `User unsubscribed from ${type} notifications`,
          },
        };
      } else if (notificationSetting === true) {
        // User is subscribed
        return {
          success: true,
          message: `User is subscribed to ${type} notifications`,
          data: {
            email,
            type,
            subscribed: true,
            notifications: subscription.notifications,
          },
          status: httpStatus.OK,
        };
      } else {
        // Unexpected value
        logger.warn(
          `Unexpected notification setting value for ${email}, type ${type}: ${notificationSetting}`
        );
        return {
          success: true, // Fail open - allow the email
          message: `Unexpected notification setting, allowing by default`,
          data: {
            email,
            type,
            subscribed: true,
            fallback: true,
            notifications: subscription.notifications,
          },
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Notification status check error -- ${error.message}`);
      return {
        success: false,
        message: "Database error during subscription check",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  async createDefaultSubscription(email, isSystemUser = false) {
    try {
      const subscription = await this.create({
        email,
        subscribed: true,
        isSystemUser,
        notifications: {
          twitter: true,
          email: true,
          phone: true,
          sms: true,
        },
      });

      return {
        success: true,
        message: "Default subscription created",
        data: subscription,
        status: httpStatus.CREATED,
      };
    } catch (error) {
      if (error.code === 11000) {
        // Subscription already exists - not an error
        return {
          success: true,
          message: "Subscription already exists",
          status: httpStatus.OK,
          data: { email, alreadyExists: true },
        };
      }

      logger.error(`Error creating default subscription -- ${error.message}`);
      return {
        success: false,
        message: "Error creating subscription",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

const SubscriptionModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let subscriptions = mongoose.model("subscriptions");
    return subscriptions;
  } catch (error) {
    let subscriptions = getModelByTenant(
      dbTenant,
      "subscription",
      SubscriptionSchema
    );
    return subscriptions;
  }
};

module.exports = SubscriptionModel;
