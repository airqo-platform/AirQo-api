const TransactionModel = require("@models/Transaction");
const UserModel = require("@models/User");
const { logElement, logText, logObject } = require("@utils/log");
const stringify = require("@utils/stringify");
const generateFilter = require("@utils/generate-filter");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transactions-util`
);
const { HttpError } = require("@utils/errors");
const paddleClient = require("@config/paddle");

const transactions = {
  /**
   * List transactions with flexible filtering
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  list: async (request, next) => {
    try {
      logText("We are in the transactions listing now");
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
      logObject("listResponse", listResponse);

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
  createCheckoutSession: async (request, sessionData) => {
    try {
      const user = request.user;
      const customerIdentification = sessionData.customer_id;
      logObject("user.email", user.email);
      logObject("user.firstName", user.firstName);
      logObject("user.lastName", user.lastName);

      if (!customerIdentification) {
        try {
          const customer = await paddleClient.customers.create({
            email: user.email,
            name: user.firstName || user.lastName,
          });
          sessionData.customer_id = customer.id; // Changed from customerId
        } catch (error) {
          logger.error(
            `Unable to generate the transaction client on Paddle -- ${stringify(
              error
            )}`
          );
          throw error; // Add this to prevent continuing with invalid customer
        }
      }

      // Ensure required fields are present
      if (
        !sessionData.settings.success_url ||
        !sessionData.settings.cancel_url
      ) {
        throw new Error("success_url and cancel_url are required in settings");
      }

      if (!sessionData.items || !sessionData.items.length) {
        throw new Error("items array with at least one item is required");
      }

      const checkoutSession = await paddleClient.transactions.create(
        sessionData
      );
      return {
        success: true,
        data: {
          id: checkoutSession.id,
          url: checkoutSession.url,
        },
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error(
        "Checkout session creation failed",
        stringify({
          message: error.message,
          type: error.type,
          code: error.code,
          detail: error.detail,
        })
      );
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
        product_id: constants.PADDLE_PRODUCT_ID,
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
        constants.PADDLE_WEBHOOK_SECRET
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

  /**
   * Create or manage a subscription transaction
   * @param {Object} request - Express request object
   * @param {Object} subscriptionData - Subscription details
   */
  createSubscriptionTransaction: async (request, subscriptionData) => {
    try {
      const user = request.user;

      // Ensure customer exists in Paddle
      let customerId = subscriptionData.customerId;
      if (!customerId) {
        try {
          const customer = await paddleClient.customers.create({
            email: user.email,
            name: user.firstName || user.lastName,
          });
          customerId = customer.id;
        } catch (error) {
          logger.error(
            `Unable to generate Paddle customer -- ${stringify(error)}`
          );
          return {
            success: false,
            message: "Failed to create Paddle customer",
            errors: { message: error.message },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      // Prepare subscription transaction data
      const transactionData = {
        customerId: customerId,
        items: subscriptionData.items || [],
        currency: subscriptionData.currency || "USD",
        description: subscriptionData.description || "Subscription Transaction",
      };

      // Create transaction
      const subscriptionTransaction = await paddleClient.transactions.create(
        transactionData
      );

      // Record transaction in local database
      const transactionRecord = await TransactionModel("airqo").register({
        paddle_transaction_id: subscriptionTransaction.id,
        paddle_event_type: "transaction.completed",
        user_id: user._id,
        paddle_customer_id: customerId,
        amount: subscriptionTransaction.total,
        currency: transactionData.currency,
        status: "completed",
        payment_method: subscriptionTransaction.paymentMethod,
        items: transactionData.items,
        metadata: {
          originalTransactionData: subscriptionTransaction,
          subscriptionDetails: subscriptionData,
        },
      });

      // Optionally update user subscription status
      await UserModel("airqo").findByIdAndUpdate(user._id, {
        $set: {
          subscriptionStatus: "active",
          currentSubscriptionId: subscriptionTransaction.id,
        },
      });

      return {
        success: true,
        data: {
          transactionId: subscriptionTransaction.id,
          localTransactionId: transactionRecord.data._id,
        },
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error("Subscription transaction creation failed", error);
      return {
        success: false,
        message: "Failed to create subscription transaction",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * Job to check and manage subscription statuses
   */
  checkSubscriptionStatuses: async () => {
    try {
      const batchSize = 100;
      let skip = 0;

      while (true) {
        // Find users with active subscriptions
        const users = await UserModel("airqo")
          .find({
            subscriptionStatus: "active",
            isActive: true,
          })
          .limit(batchSize)
          .skip(skip)
          .select("_id email currentSubscriptionId")
          .lean();

        if (users.length === 0) break;

        for (const user of users) {
          try {
            // Fetch subscription status from Paddle
            const subscriptionStatus = await paddleClient.subscriptions.get(
              user.currentSubscriptionId
            );

            // Update local user record based on Paddle subscription status
            await UserModel("airqo").findByIdAndUpdate(user._id, {
              $set: {
                subscriptionStatus: subscriptionStatus.status,
                lastSubscriptionCheck: new Date(),
              },
            });

            // Log significant status changes or actions needed
            if (subscriptionStatus.status === "past_due") {
              // Send reminder email or notification
              await mailer.sendSubscriptionReminderEmail({
                email: user.email,
                subscriptionId: user.currentSubscriptionId,
              });
            }
          } catch (error) {
            logger.error(
              `Failed to check subscription for user ${
                user.email
              } --- ${stringify(error)}`
            );
          }
        }

        skip += batchSize;
      }
    } catch (error) {
      logger.error(`Subscription status check error --- ${stringify(error)}`);
    }
  },

  /**
   * Cancel a user's subscription
   * @param {String} subscriptionId - Paddle subscription ID
   * @param {Object} user - User object
   */
  cancelSubscription: async (subscriptionId, user) => {
    try {
      // Cancel subscription in Paddle
      const cancellationResult = await paddleClient.subscriptions.cancel(
        subscriptionId
      );

      // Update local user record
      await UserModel("airqo").findByIdAndUpdate(user._id, {
        $set: {
          subscriptionStatus: "cancelled",
          subscriptionCancelledAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Subscription cancelled successfully",
        data: cancellationResult,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Subscription cancellation failed", error);
      return {
        success: false,
        message: "Failed to cancel subscription",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * Enable automatic subscription renewal for a user
   * @param {Object} request - Express request object
   * @param {Object} renewalOptions - Options for automatic renewal
   * @returns {Promise<Object>} Result of automatic renewal setup
   */
  optInForAutomaticRenewal: async (request, renewalOptions = {}) => {
    try {
      const user = request.user;

      // Validate current subscription status
      if (!user.currentSubscriptionId) {
        return {
          success: false,
          message: "No active subscription found",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Default renewal options if not provided
      const defaultRenewalOptions = {
        billingCycle: "monthly",
        currency: "USD",
        priceId: constants.PADDLE_DEFAULT_SUBSCRIPTION_PRICE_ID,
      };

      const finalRenewalOptions = {
        ...defaultRenewalOptions,
        ...renewalOptions,
      };

      // Calculate next billing date (30 days from now for monthly subscription)
      const calculateNextBillingDate = () => {
        const nextBillingDate = new Date();
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
        return nextBillingDate;
      };

      // Update user record with automatic renewal details
      const updatedUser = await UserModel("airqo").findByIdAndUpdate(
        user._id,
        {
          $set: {
            automaticRenewal: true,
            nextBillingDate: calculateNextBillingDate(),
            currentPlanDetails: {
              priceId: finalRenewalOptions.priceId,
              currency: finalRenewalOptions.currency,
              billingCycle: finalRenewalOptions.billingCycle,
            },
          },
        },
        { new: true } // Return the updated document
      );

      // Optional: Verify and update subscription in Paddle
      try {
        await paddleClient.subscriptions.update(user.currentSubscriptionId, {
          priceId: finalRenewalOptions.priceId,
          renewalCycle: finalRenewalOptions.billingCycle,
        });
      } catch (paddleUpdateError) {
        logger.warn(
          `Could not update Paddle subscription: ${stringify(
            paddleUpdateError
          )}`
        );
      }

      // Send confirmation email or notification
      try {
        await emailService.sendAutomaticRenewalConfirmationEmail({
          userId: user._id,
          email: user.email,
          nextBillingDate: calculateNextBillingDate(),
          billingCycle: finalRenewalOptions.billingCycle,
        });
      } catch (emailError) {
        logger.error(
          `Failed to send automatic renewal confirmation email: ${stringify(
            emailError
          )}`
        );
      }

      return {
        success: true,
        message: "Automatic renewal enabled successfully",
        data: {
          automaticRenewal: updatedUser.automaticRenewal,
          nextBillingDate: updatedUser.nextBillingDate,
          billingCycle: updatedUser.currentPlanDetails.billingCycle,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Automatic renewal setup failed", error);
      return {
        success: false,
        message: "Failed to set up automatic renewal",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = transactions;
