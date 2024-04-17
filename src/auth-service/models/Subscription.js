const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- subscriptions-model`
);
const { HttpError } = require("@utils/errors");

const SubscriptionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
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

      mobile_push: {
        type: Boolean,
        default: true,
      },
    }
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
      email: this.email,
      notifications: this.notifications,
    };
  },
};

SubscriptionSchema.statics.register = async function (args, next) {
  try {
    let createBody = args;
    logObject("args", args);
    if (createBody._id) {
      delete createBody._id;
    }

    logObject("createBody", createBody);
    let data = await this.create({
      ...createBody,
    });

    if (!isEmpty(data)) {
      return {
        success: true,
        data,
        message: "subscription created successfully with no issues detected",
        status: httpStatus.OK,
      };
    } else if (isEmpty(data)) {
      return {
        success: true,
        message: "subscription not created despite successful operation",
        status: httpStatus.OK,
        data: [],
      };
    }
  } catch (err) {
    logObject("error in the object", err);
    logger.error(`Data conflicts detected -- ${err.message}`);
    let response = {};
    let errors = {};
    let message = "Internal Server Error";
    let status = httpStatus.INTERNAL_SERVER_ERROR;
    if (err.code === 11000 || err.code === 11001) {
      errors = err.keyValue;
      message = "duplicate values provided";
      status = httpStatus.CONFLICT;
      Object.entries(errors).forEach(([key, value]) => {
        return (response[key] = value);
      });
    } else {
      message = "validation errors for some of the provided fields";
      status = httpStatus.CONFLICT;
      errors = err.errors;
      Object.entries(errors).forEach(([key, value]) => {
        return (response[key] = value.message);
      });
    }

    logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
    next(new HttpError(message, status, response));
  }
};

SubscriptionSchema.statics.list = async function (
  { skip = 0, limit = 1000, filter = {} } = {},
  next
) {
  try {
    const subscriptions = await this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    if (!isEmpty(subscriptions)) {
      return {
        success: true,
        data: subscriptions,
        message: "Successfully listed the subscriptions",
        status: httpStatus.OK,
      };
    } else if (isEmpty(subscriptions)) {
      return {
        success: true,
        message: "No subscriptions found for this search",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

SubscriptionSchema.statics.modify = async function (
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const options = { new: true };
    const updateBody = update;

    if (updateBody._id) {
      delete updateBody._id;
    }

    const updatedSubscription = await this.findOneAndUpdate(
      filter,
      updateBody,
      options
    ).exec();

    if (!isEmpty(updatedSubscription)) {
      return {
        success: true,
        message: "successfully modified the subscription",
        data: updatedSubscription._doc,
        status: httpStatus.OK,
      };
    } else if (isEmpty(updatedSubscription)) {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message:
            "the User Subscription  you are trying to UPDATE does not exist, please crosscheck",
        })
      );
    }
  } catch (err) {
    logger.error(`Data conflicts detected -- ${err.message}`);
    let errors = { message: err.message };
    let message = "Internal Server Error";
    let status = httpStatus.INTERNAL_SERVER_ERROR;
    if (err.code == 11000) {
      errors = err.keyValue;
      message = "duplicate values provided";
      status = httpStatus.CONFLICT;
    }
    next(new HttpError(message, status, errors));
  }
};

SubscriptionSchema.statics.remove = async function (
  { filter = {} } = {},
  next
) {
  try {
    let options = {
      projection: {
        _id: 1,
      },
    };
    let removedSubscription = await this.findOneAndRemove(
      filter,
      options
    ).exec();

    if (!isEmpty(removedSubscription)) {
      return {
        success: true,
        message: "successfully removed the subscription",
        data: removedSubscription._doc,
        status: httpStatus.OK,
      };
    } else if (isEmpty(removedSubscription)) {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message:
            "the User Subscription  you are trying to DELETE does not exist, please crosscheck",
        })
      );
    }
  } catch (error) {
    logger.error(`Data conflicts detected -- ${error.message}`);
    next(
      new HttpError("Data conflicts detected", httpStatus.CONFLICT, {
        message: error.message,
      })
    );
    return;
  }
};

SubscriptionSchema.statics.subscribe = async function (email, type) {
  const updatedSubscription = await this.findOneAndUpdate(
    { email },
    { $set: { [`notifications.${type}`]: true } },
    { new: true, upsert: true }
  );

  return updatedSubscription;
};

SubscriptionSchema.statics.unsubscribe = async function (email, type) {
  const updatedSubscription = await this.findOneAndUpdate(
    { email },
    { $set: { [`notifications.${type}`]: false } },
    { new: true, upsert: true }
  );

  return updatedSubscription;
};

SubscriptionSchema.statics.checkNotificationStatus = async function (
  { email, type },
  next
) {
  try {
    const subscription = await this.findOne({ email });

    if (!subscription) {
      return {
        success: true,
        message: `Not Found`,
        status: httpStatus.OK,
        errors: {
          message: `No subscription found for email: ${email}`,
        },
      };
    }

    let isSubscribed = subscription.notifications[type];


    if (!isSubscribed) {
      return {
        success: false,
        message: `Forbidden`,
        status: httpStatus.FORBIDDEN,
        errors: {
          message: `User not subscribed to ${type} notifications.`,
        },
      };
    }

    return {
      success: true,
      message: `User is subscribed to ${type} notifications.`,
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Data conflicts detected -- ${error.message}`);
    next(
      new HttpError("Data conflicts detected", httpStatus.CONFLICT, {
        message: error.message,
      })
    );
    return;
  }
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
