const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("../utils/multitenancy");

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
});

TransactionSchema.pre("update", function (next) {
  return next();
});

TransactionSchema.statics = {
  async register(args) {
    logObject("the args", args);
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "transaction created",
      };
    } catch (error) {
      return {
        error: { message: error.message },
        message: "Transaction model server error - register",
        success: false,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let transactions = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      let data = jsonify(transactions);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the transactions",
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "no transactions exist",
          data,
        };
      }
      return {
        success: false,
        message: "unable to retrieve transactions",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: "Transaction model server error - list",
        error: { message: error.message },
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      let updatedTransaction = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      let data = jsonify(updatedTransaction);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the transaction",
          data,
        };
      } else {
        return {
          success: false,
          message: "transaction does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Transaction model server error - modify",
        error: { message: error.message },
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedTransaction = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      let data = jsonify(removedTransaction);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the transaction",
          data,
        };
      } else {
        return {
          success: false,
          message: "transaction does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Transaction model server error - remove",
        error: { message: error.message },
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
