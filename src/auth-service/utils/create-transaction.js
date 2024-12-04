const TransactionModel = require("@models/Transaction");
const UserModel = require("@models/User");
const { logElement, logText, logObject } = require("@utils/log");
const generateFilter = require("@utils/generate-filter");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transactions-util`
);
const { HttpError } = require("@utils/errors");

const transactions = {
  /**
   * List transactions with flexible filtering
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  list: async (request, next) => {
    try {
      const {
        query: { tenant },
      } = request;

      // Generate filter based on request parameters
      const filter = generateFilter.transactions(request, next);
      const { limit, skip } = request.query;

      // Retrieve transactions
      const listResponse = await TransactionModel(tenant).list(
        {
          filter,
          limit: limit ? parseInt(limit) : 100,
          skip: skip ? parseInt(skip) : 0,
        },
        next
      );

      return listResponse;
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
   * Create a new transaction (typically from a webhook)
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      // Validate and process Paddle webhook data
      const paddleEventData = body;

      // Attempt to find or create associated user
      const userIdentification = await transactions.identifyUserFromTransaction(
        paddleEventData
      );

      // Prepare transaction creation body
      const creationBody = {
        paddle_transaction_id: paddleEventData.id,
        paddle_event_type: paddleEventData.type,
        user_id: userIdentification.userId,
        paddle_customer_id: paddleEventData.customer_id,
        amount: paddleEventData.total,
        currency: paddleEventData.currency,
        status: transactions.mapTransactionStatus(paddleEventData.type),
        items: paddleEventData.items || [],
        metadata: paddleEventData,
      };

      // Register transaction
      const responseFromRegisterTransaction = await TransactionModel(
        tenant
      ).register(creationBody, next);

      // Log the registration for debugging
      logObject(
        "Transaction Registration Response",
        responseFromRegisterTransaction
      );

      // Trigger any post-transaction processing
      await transactions.processTransactionPostRegistration(
        responseFromRegisterTransaction.data
      );

      return responseFromRegisterTransaction;
    } catch (error) {
      logger.error(`Transaction Creation Error: ${error.message}`);
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
   * Update an existing transaction
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  update: async (request, next) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      // Generate filter for transaction identification
      const filter = generateFilter.transactions(request, next);

      if (isEmpty(filter)) {
        return {
          success: false,
          message: "Unable to identify which transaction to update",
          errors: {
            message: "No unique identifier provided",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Perform transaction modification
      const modifyResponse = await TransactionModel(tenant).modify(
        {
          filter,
          update: body,
        },
        next
      );

      return modifyResponse;
    } catch (error) {
      logger.error(`Transaction Update Error: ${error.message}`);
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
   * Retrieve transaction statistics
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  getStats: async (request, next) => {
    try {
      const {
        query: { tenant, ...statsFilter },
      } = request;

      // Convert query parameters to filter
      const filter = {};
      Object.entries(statsFilter).forEach(([key, value]) => {
        filter[key] = value;
      });

      // Retrieve transaction statistics
      const statsResponse = await TransactionModel(tenant).getStats(filter);

      return {
        success: true,
        data: statsResponse[0] || {
          totalAmount: 0,
          totalTransactions: 0,
          uniqueUsers: [],
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Transaction Statistics Error: ${error.message}`);
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
   * Delete/Cancel a transaction (with caution)
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  delete: async (request, next) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      // Generate filter for transaction identification
      const filter = generateFilter.transactions(request, next);

      // Soft delete or mark as cancelled based on business logic
      const modifyResponse = await TransactionModel(tenant).modify(
        {
          filter,
          update: {
            status: "cancelled",
            cancelledAt: new Date(),
          },
        },
        next
      );

      return modifyResponse;
    } catch (error) {
      logger.error(`Transaction Deletion Error: ${error.message}`);
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
   * Map Paddle event types to transaction status
   */
  mapTransactionStatus: (eventType) => {
    const statusMap = {
      "transaction.completed": "completed",
      "transaction.payment_failed": "failed",
    };
    return statusMap[eventType] || "pending";
  },

  /**
   * Additional processing after transaction registration
   */
  processTransactionPostRegistration: async (transaction) => {
    // Optional post-registration logic
  },

  /**
   * Create a checkout session for a payment
   * @param {Object} sessionData - Checkout session configuration
   * @returns {Promise<Object>} Checkout session result
   */
  createCheckoutSession: async (sessionData) => {
    try {
      const checkoutSession = await paddleClient.checkouts.create(sessionData);

      return {
        success: true,
        data: {
          id: checkoutSession.id,
          url: checkoutSession.url,
        },
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error("Checkout session creation failed", error);
      return {
        success: false,
        message: "Failed to create payment session",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * Create a dynamic price for flexible amount donations
   * @param {number} amount - Payment amount
   * @param {string} currency - Currency code
   * @returns {Promise<string>} Price ID
   */
  getDynamicPriceId: async (amount, currency) => {
    try {
      const price = await paddleClient.prices.create({
        product_id: process.env.PADDLE_PRODUCT_ID,
        currency,
        unit_price: amount,
      });
      return price.id;
    } catch (error) {
      logger.error("Failed to create dynamic price", error);
      throw new Error("Could not generate price");
    }
  },

  performAdditionalBusinessLogic: async (transactionMetadata) => {
    try {
      // Example: Update user account, grant access, etc.
      if (transactionMetadata.is_new_user) {
        // Perform actions for new user
        await UserModel.findByIdAndUpdate(transactionMetadata.user_id, {
          first_transaction_completed_at: new Date(),
        });
      }

      // Example: Credit system or apply transaction-specific logic
      if (transactionMetadata.amount >= 100) {
        // Special handling for significant transactions
        await grantPremiumFeatures(transactionMetadata.user_id);
      }
    } catch (error) {
      logger.error("Additional business logic failed", error);
    }
  },

  sendTransactionCompletionNotification: async (transactionMetadata) => {
    try {
      // Example: Send email, push notification, etc.
      await emailService.sendTransactionReceiptEmail({
        userId: transactionMetadata.user_id,
        amount: transactionMetadata.amount,
        currency: transactionMetadata.currency,
      });
    } catch (error) {
      logger.error("Transaction notification failed", error);
    }
  },
  notifyAdminOfTransactionError: async (error, eventData) => {
    try {
      // Implement admin notification mechanism
      await adminAlertService.sendErrorAlert({
        errorType: "TRANSACTION_COMPLETION_FAILED",
        details: {
          message: error.message,
          transactionId: eventData?.id,
        },
      });
    } catch (notificationError) {
      logger.error("Failed to send admin notification", notificationError);
    }
  },
  handleCompletedTransaction: async (eventData) => {
    try {
      // Log the incoming event data for debugging
      logObject("Completed Transaction Event", eventData);

      // Validate essential transaction data
      if (!eventData || !eventData.id || !eventData.customer_id) {
        logger.warn("Invalid transaction data received");
        return;
      }

      // Attempt to identify or create user associated with the transaction
      const userIdentification = await transactions.identifyUserFromTransaction(
        eventData
      );

      // Prepare detailed transaction metadata
      const transactionMetadata = {
        paddle_transaction_id: eventData.id,
        paddle_event_type: "transaction.completed",
        user_id: userIdentification.userId,
        paddle_customer_id: eventData.customer_id,
        amount: eventData.total,
        currency: eventData.currency,
        status: "completed",
        items: eventData.items || [],
        full_event_data: eventData,
        processed_at: new Date(),
        is_new_user: userIdentification.isNewUser,
      };

      // Optional: Additional business logic
      await transactions.performAdditionalBusinessLogic(transactionMetadata);

      // Log the transaction
      logger.info(`Transaction completed: ${eventData.id}`);

      // Optional: Send notification or trigger follow-up actions
      await transactions.sendTransactionCompletionNotification(
        transactionMetadata
      );
    } catch (error) {
      // Comprehensive error handling
      logger.error("Transaction completion processing failed", {
        errorMessage: error.message,
        transactionId: eventData?.id,
        stack: error.stack,
      });

      // You might want to implement retry logic or send an alert
      await transactions.notifyAdminOfTransactionError(error, eventData);
    }
  },

  /**
   * Process Paddle webhook
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   * @returns {Promise<Object>} Webhook processing result
   */
  processWebhook: async (request, next) => {
    try {
      const signature = request.headers["paddle-signature"];
      const { body, query } = request;
      const { tenant } = query;

      // Verify webhook authenticity
      const event = paddleClient.webhooks.unmarshal(
        body,
        signature,
        process.env.PADDLE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case "transaction.completed":
          await transactions.handleCompletedTransaction(event.data);
          break;
        case "transaction.payment_failed":
          await handleFailedTransaction(event.data);
          break;
        // Add more event handlers
        default:
          logger.warn(`Unhandled event type: ${event.type}`);
      }

      // Delegate to create method for handling
      const result = await transactions.create(
        {
          body: event.data,
          query: { tenant },
        },
        next
      );

      return result;
    } catch (error) {
      logger.error("Webhook processing failed", error);
      return {
        success: false,
        message: "Invalid webhook",
        errors: { message: error.message },
        status: httpStatus.BAD_REQUEST,
      };
    }
  },

  /**
   * Attempt to identify user from transaction data
   * @param {Object} transactionData - Paddle transaction data
   * @returns {Promise<Object>} User identification result
   */
  identifyUserFromTransaction: async (transactionData) => {
    try {
      // Logic to find or create user based on Paddle customer ID
      // Try to find existing user by Paddle customer ID
      const existingUser = await UserModel.findOne({
        paddle_customer_id: transactionData.customer_id,
      });

      if (existingUser) {
        return {
          userId: existingUser._id,
          isNewUser: false,
        };
      }

      // If no existing user, create a new one
      const newUser = await UserModel.create({
        paddle_customer_id: transactionData.customer_id,
        email: transactionData.email || null,
        name: transactionData.customer_name || null,
        // Add any other relevant user creation fields
      });

      return {
        userId: newUser._id,
        isNewUser: true,
      };
    } catch (error) {
      logger.error("User identification failed", error);
      throw new Error("Could not identify or create user");
    }
  },
};

module.exports = transactions;
