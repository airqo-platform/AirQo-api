const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

const TransactionSchema = new Schema({
  amount: { type: Number },
  host_id: { type: ObjectId },
  description: { type: String },
  transaction_id: { type: String },
  status: { type: String },
});

TransactionSchema.pre("save", function (next) {
  if (this.isModified("password")) {
  }
  return next();
});

TransactionSchema.pre("findOneAndUpdate", function () {
  let that = this;
  const update = that.getUpdate();
  if (update) {
    if (update.__v != null) {
      delete update.__v;
    }
    const keys = ["$set", "$setOnInsert"];
    for (const key of keys) {
      if (update[key] != null && update[key].__v != null) {
        delete update[key].__v;
        if (Object.keys(update[key]).length === 0) {
          delete update[key];
        }
      }
    }
    update.$inc = update.$inc || {};
    update.$inc.__v = 1;
  }
});

TransactionSchema.pre("update", function (next) {
  return next();
});

TransactionSchema.statics = {
  async register(args) {
    logObject("the args", args);
    try {
      const data = await this.create({
        ...args,
      });
      return {
        success: true,
        data,
        message: "transaction created",
        status: httpStatus.OK,
      };
    } catch (error) {
      let response = {};
      message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (err.code === 11000) {
        Object.entries(err.keyPattern).forEach(([key, value]) => {
          return (response[key] = "duplicate value");
        });
      }
      if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[value.path] = value.message);
        });
      }

      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let transactions = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      let data = transactions;
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the transactions",
          status: httpStatus.OK,
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "no transactions exist for this search",
          data,
          status: httpStatus.NOT_FOUND,
        };
      }
      return {
        success: false,
        message: "unable to retrieve transactions",
        data,
        errors: { message: "unable to retrieve transactions" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      return {
        success: false,
        message: "Transaction model server error - list",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let modifiedUpdate = update;
      let projection = { _id: 1 };
      Object.keys(modifiedUpdate).forEach((key) => {
        projection[key] = 1;
      });
      let options = { new: true, projection };
      let updatedTransaction = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      );
      const data = updatedTransaction;
      if (!isEmpty(updatedTransaction)) {
        return {
          success: true,
          message: "successfully modified the transaction",
          data,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "transaction does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: "transaction does not exist",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let projection = {
        _id: 1,
        amount: 1,
        host_id: 1,
        description: 1,
        transaction_id: 1,
        status: 1,
      };
      let options = {
        projection,
      };

      let removedTransaction = await this.findOneAndRemove(filter, options);

      logObject("removedTransaction", removedTransaction);

      if (!isEmpty(removedTransaction)) {
        const data = removedTransaction._doc;
        return {
          success: true,
          message: "successfully removed the transaction",
          data,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "transaction does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: { message: "transaction does not exist" },
        };
      }
    } catch (error) {
      logObject("the error in transaction model", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

TransactionSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      amount: this.amount,
      host_id: this.host_id,
      description: this.description,
      transaction_id: this.transaction_id,
      status: this.status,
    };
  },
};

const transactionModel = (tenant) => {
  return getModelByTenant(tenant, "transaction", TransactionSchema);
};

module.exports = transactionModel;
