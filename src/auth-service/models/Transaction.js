const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transactions-model`
);
const { getModelByTenant } = require("@config/database");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const TransactionSchema = new Schema(
  {
    // Paddle-specific identifiers
    paddle_transaction_id: {
      type: String,
      required: [true, "Paddle transaction ID is required!"],
      unique: true,
    },
    paddle_event_type: {
      type: String,
      enum: [
        "transaction.completed",
        "transaction.payment_succeeded",
        "transaction.payment_failed",
        "transaction.refunded",
      ],
      required: true,
    },

    // User and customer details
    user_id: {
      type: ObjectId,
      ref: "user",
      required: [true, "User ID is required!"],
    },
    paddle_customer_id: {
      type: String,
      required: [true, "Paddle customer ID is required!"],
    },

    // Payment details
    amount: {
      type: Number,
      required: [true, "Transaction amount is required!"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      required: [true, "Currency is required!"],
      default: "USD",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },

    // Additional transaction metadata
    payment_method: {
      type: String,
      enum: ["credit_card", "paypal", "bank_transfer", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
    },

    // Optional additional fields
    description: { type: String },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // Donation or product-specific details
    donation_campaign_id: {
      type: ObjectId,
      ref: "campaign",
      required: false,
    },
    items: [
      {
        name: String,
        unit_price: Number,
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
  },
  {
    timestamps: true,
    // Enable creating additional indexes if needed
    autoIndex: true,
  }
);

// Indexes for faster querying
TransactionSchema.index({
  user_id: 1,
  status: 1,
  createdAt: -1,
});

TransactionSchema.statics = {
  /**
   * Register a new transaction
   * @param {Object} args - Transaction details
   * @param {Function} next - Error handling callback
   */
  async register(args, next) {
    try {
      // Remove _id if present to prevent overwriting
      if (args._id) {
        delete args._id;
      }

      // Create transaction
      const data = await this.create(args);

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Transaction recorded successfully",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          data: [],
          message: "Transaction could not be recorded",
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }
    } catch (err) {
      logger.error(`Transaction Registration Error: ${err.message}`);

      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = `${key} must be unique`;
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
        });
      }

      next(
        new HttpError(
          "Validation errors for transaction",
          httpStatus.CONFLICT,
          response
        )
      );
    }
  },

  /**
   * List transactions with flexible filtering and pagination
   * @param {Object} options - Query options
   * @param {Function} next - Error handling callback
   */
  async list(
    { skip = 0, limit = 100, filter = {}, sort = { createdAt: -1 } } = {},
    next
  ) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "Successfully retrieved transactions",
          data: response,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No transactions found",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logger.error(`Transaction Listing Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Calculate transaction statistics
   * @param {Object} filter - Aggregation filter
   */
  async getStats(filter = {}) {
    return this.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          uniqueUsers: { $addToSet: "$user_id" },
        },
      },
    ]);
  },
};

TransactionSchema.methods = {
  /**
   * Custom JSON representation
   */
  toJSON() {
    return {
      _id: this._id,
      paddle_transaction_id: this.paddle_transaction_id,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      user_id: this.user_id,
      createdAt: this.createdAt,
    };
  },
};

const TransactionModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    let transactions = mongoose.model("transactions");
    return transactions;
  } catch (error) {
    let transactions = getModelByTenant(
      dbTenant,
      "transaction",
      TransactionSchema
    );
    return transactions;
  }
};

module.exports = TransactionModel;
