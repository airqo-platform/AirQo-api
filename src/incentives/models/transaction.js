const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger("transaction-model");

const successResponse = {
  success: true,
  status: httpStatus.OK,
};

const errorResponse = {
  success: false,
  status: httpStatus.INTERNAL_SERVER_ERROR,
};

const notFoundResponse = {
  success: false,
  status: httpStatus.NOT_FOUND,
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

const handleServerError = (error, message) => {
  logObject("error", error);
  const stingifiedMessage = JSON.stringify(error ? error : "");
  logger.error(`Internal Server Error -- ${stingifiedMessage}`);
  return {
    ...errorResponse,
    message,
    errors: { message: error.message },
  };
};

TransactionSchema.pre("save", function (next) {
  return next();
});

TransactionSchema.pre("update", function (next) {
  return next();
});

TransactionSchema.statics.register = async function (args) {
  logObject("the args", args);
  try {
    const data = await this.create(args);
    return {
      ...successResponse,
      data,
      message: "transaction created",
    };
  } catch (error) {
    if (error.code === 11000) {
      const response = Object.entries(error.keyPattern).reduce(
        (acc, [key, value]) => {
          acc[key] = "duplicate value";
          return acc;
        },
        {}
      );
      return {
        ...errorResponse,
        errors: response,
        message: "validation errors for some of the provided fields",
      };
    }
    if (error.errors) {
      const response = Object.entries(error.errors).reduce(
        (acc, [key, value]) => {
          acc[value.path] = value.message;
          return acc;
        },
        {}
      );
      return {
        ...errorResponse,
        errors: response,
        message: "validation errors for some of the provided fields",
      };
    }
    return handleServerError(error, "Internal Server Error");
  }
};

TransactionSchema.statics.list = async function ({
  skip = 0,
  limit = 5,
  filter = {},
} = {}) {
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
    }

    return {
      ...notFoundResponse,
      message: "no transactions exist for this search",
    };
  } catch (error) {
    return handleServerError(error, "Internal Server Error");
  }
};

TransactionSchema.statics.modify = async function ({
  filter = {},
  update = {},
} = {}) {
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
      return {
        ...notFoundResponse,
        message: "transaction does not exist, please crosscheck",
        errors: { message: "transaction does not exist" },
      };
    }

    return {
      ...successResponse,
      message: "successfully modified the transaction",
      data: updatedTransaction,
    };
  } catch (error) {
    return handleServerError(error, "Internal Server Error");
  }
};

TransactionSchema.statics.remove = async function ({ filter = {} } = {}) {
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
      return {
        ...notFoundResponse,
        message: "transaction does not exist, please crosscheck",
        errors: { message: "transaction does not exist" },
      };
    }

    return {
      ...successResponse,
      message: "successfully removed the transaction",
      data: removedTransaction._doc,
    };
  } catch (error) {
    return handleServerError(error, "Internal Server Error");
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

const createTransactionModel = (tenant) => {
  try {
    const transactions = mongoose.model("transactions");
    return transactions;
  } catch (error) {
    const transactions = getModelByTenant(
      tenant,
      "transaction",
      TransactionSchema
    );
    return transactions;
  }
};

const TransactionModel = createTransactionModel;

module.exports = TransactionModel;
