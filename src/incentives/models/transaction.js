const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transaction-model`
);
const { HttpError } = require("@utils/errors");

const successResponse = {
  success: true,
  status: httpStatus.OK,
};

const transactionSchemaOptions = {
  timestamps: true,
};

const TransactionSchema = new Schema(
  {
    amount: { type: Number, required: true },
    host_id: { type: ObjectId, required: true },
    description: { type: String },
    ext_transaction_id: { type: String, required: true },
    status: { type: String, required: true },
    batch_id: { type: String, required: true },
    request_id: { type: String, required: true },
  },
  transactionSchemaOptions
);

TransactionSchema.pre("save", function (next) {
  return next();
});

TransactionSchema.pre("update", function (next) {
  return next();
});

TransactionSchema.statics.register = async function (args, next) {
  logObject("the args", args);
  try {
    const data = await this.create(args);
    return {
      ...successResponse,
      data,
      message: "transaction created",
    };
  } catch (error) {
    let errors = {};
    let message = "validation errors for some of the provided fields";
    if (error.code === 11000) {
      errors = Object.entries(error.keyPattern).reduce((acc, [key, value]) => {
        acc[key] = "duplicate value";
        return acc;
      }, {});
    }
    if (error.errors) {
      errors = Object.entries(error.errors).reduce((acc, [key, value]) => {
        acc[value.path] = value.message;
        return acc;
      }, {});
    }

    logObject("error", error);
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(new HttpError(message, httpStatus.INTERNAL_SERVER_ERROR, errors));
    return;
  }
};

TransactionSchema.statics.list = async function (
  { skip = 0, limit = 5, filter = {} } = {},
  next
) {
  try {
    const transactions = await this.aggregate()
      .match(filter)
      .addFields({
        createdAt: {
          $dateToString: {
            format: "%Y-%m-%d %H:%M:%S",
            date: "$_id",
          },
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (!isEmpty(transactions)) {
      return {
        ...successResponse,
        data: transactions,
        message: "successfully listed the transactions",
      };
    } else {
      return {
        ...successResponse,
        data: [],
        message: "no transactions exist for this search",
      };
    }
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};

TransactionSchema.statics.modify = async function (
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const modifiedUpdate = update;
    const projection = { _id: 1 };
    Object.keys(modifiedUpdate).forEach((key) => {
      projection[key] = 1;
    });
    const options = { new: true, projection };

    const updatedTransaction = await this.findOneAndUpdate(
      filter,
      modifiedUpdate,
      options
    );

    if (isEmpty(updatedTransaction)) {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          ...filter,
          message: "transaction does not exist, please crosscheck",
        })
      );
      return;
    } else {
      return {
        ...successResponse,
        message: "successfully modified the transaction",
        data: updatedTransaction,
      };
    }
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};

TransactionSchema.statics.remove = async function ({ filter = {} } = {}, next) {
  try {
    const projection = {
      _id: 1,
      amount: 1,
      host_id: 1,
      description: 1,
      status: 1,
    };
    const options = {
      projection,
    };

    const removedTransaction = await this.findOneAndRemove(filter, options);

    if (isEmpty(removedTransaction)) {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          ...filter,
          message: "transaction does not exist, please crosscheck",
        })
      );
      return;
    } else {
      return {
        ...successResponse,
        message: "successfully removed the transaction",
        data: removedTransaction._doc,
      };
    }
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};

TransactionSchema.methods.toJSON = function () {
  const {
    _id,
    amount,
    host_id,
    description,
    ext_transaction_id,
    status,
    batch_id,
    request,
  } = this;

  return {
    _id,
    amount,
    host_id,
    description,
    ext_transaction_id,
    status,
    batch_id,
    request_id: request,
  };
};

const TransactionModel = (tenant) => {
  try {
    return mongoose.model("transactions");
  } catch (error) {
    return getModelByTenant(tenant, "transaction", TransactionSchema);
  }
};

module.exports = TransactionModel;
