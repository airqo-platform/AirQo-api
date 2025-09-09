const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transactions-model`
);
const { getModelByTenant } = require("@config/database");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
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
    transaction_type: { type: String },
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
          status: httpStatus.OK, // Preserve original status
        };
      } else {
        return {
          success: false,
          data: [],
          message: "Transaction could not be recorded",
          status: httpStatus.UNPROCESSABLE_ENTITY, // Preserve original status
        };
      }
    } catch (err) {
      logger.error(`Transaction Registration Error: ${err.message}`);

      // Handle validation errors specifically
      if (err.keyValue || err.errors) {
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
        return {
          success: false,
          message: "Validation errors for transaction",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "transaction");
      }
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
        .sort(sort) // Preserve flexible sort parameter
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "transaction", {
        message: "Successfully retrieved transactions",
        emptyMessage: "No transactions found",
      });
    } catch (error) {
      logger.error(`Transaction Listing Error: ${error.message}`);
      return createErrorResponse(error, "list", logger, "transaction");
    }
  },

  /**
   * Update a transaction
   * @param {Object} options - Update options
   * @param {Function} next - Error handling callback
   */
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };

      // Remove _id from update if present
      if (update._id) {
        delete update._id;
      }

      const updatedTransaction = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedTransaction)) {
        return createSuccessResponse(
          "update",
          updatedTransaction._doc,
          "transaction"
        );
      } else {
        return createNotFoundResponse(
          "transaction",
          "update",
          "Transaction does not exist, please crosscheck"
        );
      }
    } catch (err) {
      logger.error(`Transaction Update Error: ${err.message}`);
      return createErrorResponse(err, "update", logger, "transaction");
    }
  },

  /**
   * Remove a transaction
   * @param {Object} options - Remove options
   * @param {Function} next - Error handling callback
   */
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          amount: 1,
          user_id: 1,
          transaction_type: 1,
          status: 1,
          createdAt: 1,
        },
      };

      const removedTransaction = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedTransaction)) {
        return createSuccessResponse(
          "delete",
          removedTransaction._doc,
          "transaction"
        );
      } else {
        return createNotFoundResponse(
          "transaction",
          "delete",
          "Transaction does not exist, please crosscheck"
        );
      }
    } catch (error) {
      logger.error(`Transaction Removal Error: ${error.message}`);
      return createErrorResponse(error, "delete", logger, "transaction");
    }
  },

  /**
   * Calculate transaction statistics
   * @param {Object} filter - Aggregation filter
   * @returns {Promise<Object>} Transaction statistics
   */
  async getStats(filter = {}) {
    try {
      const stats = await this.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalTransactions: { $sum: 1 },
            uniqueUsers: { $addToSet: "$user_id" },
          },
        },
        {
          $addFields: {
            uniqueUserCount: { $size: "$uniqueUsers" },
            averageTransactionAmount: {
              $cond: {
                if: { $gt: ["$totalTransactions", 0] },
                then: { $divide: ["$totalAmount", "$totalTransactions"] },
                else: 0,
              },
            },
          },
        },
      ]);

      if (!isEmpty(stats)) {
        return {
          success: true,
          data: stats[0] || {},
          message: "Successfully retrieved transaction statistics",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          data: {
            totalAmount: 0,
            totalTransactions: 0,
            uniqueUsers: [],
            uniqueUserCount: 0,
            averageTransactionAmount: 0,
          },
          message: "No transaction statistics found",
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Transaction Stats Error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve transaction statistics",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
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
