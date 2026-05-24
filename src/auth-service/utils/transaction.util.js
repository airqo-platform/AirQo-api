const TransactionModel = require("@models/Transaction");
const UserModel = require("@models/User");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const { mailer, stringify, generateFilter } = require("@utils/common");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { TIER_SCOPE_MAP, TIER_RATE_LIMITS } = require("@config/tier-limits");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transactions-util`,
);
const opsLogger = log4js.getLogger("ops-alerts");
const { logObject, logText, HttpError } = require("@utils/shared");
const { paddleClient, isPaddleConfigured } = require("@config/paddle");

// Standard response returned by any function that calls Paddle when credentials
// are not configured. Lets the service start and all non-Paddle endpoints work.
const PADDLE_NOT_CONFIGURED = {
  success: false,
  message: "Payment provider not configured",
  errors: {
    message:
      "Paddle credentials have not been set up on this environment. " +
      "Contact the system administrator.",
  },
  status: httpStatus.SERVICE_UNAVAILABLE,
};

/**
 * Determine subscription tier from a completed Paddle transaction.
 * Priority: customData.tier (set at checkout) > Paddle price ID > amount fallback.
 */
const resolveTierFromEvent = (eventData) => {
  // 1. Dashboard sets customData.tier at checkout time — most reliable
  const customTier = eventData?.customData?.tier;
  if (customTier && TIER_SCOPE_MAP[customTier]) return customTier;

  // 2. Match against known Paddle price IDs from env
  const priceId = eventData?.items?.[0]?.price?.id;
  if (priceId) {
    if (
      constants.PADDLE_STANDARD_PRICE_ID &&
      priceId === constants.PADDLE_STANDARD_PRICE_ID
    )
      return "Standard";
    if (
      constants.PADDLE_PREMIUM_PRICE_ID &&
      priceId === constants.PADDLE_PREMIUM_PRICE_ID
    )
      return "Premium";
  }

  // 3. Amount-based fallback (amounts in smallest currency unit, e.g. cents)
  const amount = eventData?.details?.totals?.total || eventData?.total || 0;
  const numericAmount = parseFloat(amount);
  if (numericAmount >= 15000) return "Premium"; // $150.00
  if (numericAmount >= 5000) return "Standard"; // $50.00
  return "Free";
};

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
        next,
      );
      logObject("listResponse", listResponse);

      return listResponse;
    } catch (error) {
      logger.error(`Transaction Listing Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { details: error.message },
        ),
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
      const userIdentification =
        await transactions.identifyUserFromTransaction(paddleEventData, tenant);

      // Payload has already been normalised in processWebhook (snake_case,
      // numeric total, uppercased currency). Read fields directly.
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
        tenant,
      ).register(creationBody, next);

      // Log the registration for debugging
      logObject(
        "Transaction Registration Response",
        responseFromRegisterTransaction,
      );

      // Trigger any post-transaction processing
      await transactions.processTransactionPostRegistration(
        responseFromRegisterTransaction.data,
      );

      return responseFromRegisterTransaction;
    } catch (error) {
      logger.error(`Transaction Creation Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { details: error.message },
        ),
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
        next,
      );

      return modifyResponse;
    } catch (error) {
      logger.error(`Transaction Update Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { details: error.message },
        ),
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

      if (!statsResponse.success) {
        return statsResponse;
      }

      return {
        success: true,
        data: statsResponse.data || {
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
          { details: error.message },
        ),
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
        next,
      );

      return modifyResponse;
    } catch (error) {
      logger.error(`Transaction Deletion Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { details: error.message },
        ),
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
    if (!isPaddleConfigured) return PADDLE_NOT_CONFIGURED;
    try {
      const user = request.user;
      const customerIdentification = sessionData.customer_id;
      logObject("user.email", user.email);
      logObject("user.firstName", user.firstName);
      logObject("user.lastName", user.lastName);

      // Shared helper — create or recover a Paddle customer by email.
      // Handles customer_already_exists by listing and returning the existing ID.
      const resolveOrCreateCustomer = async () => {
        try {
          const customer = await paddleClient.customers.create({
            email: user.email,
            name: user.firstName || user.lastName,
          });
          return customer.id;
        } catch (error) {
          if (error.code === "customer_already_exists") {
            // customers.list returns an async-iterable Collection; call
            // next() to fetch the first page before reading .data
            const collection = paddleClient.customers.list({
              email: [user.email],
            });
            await collection.next();
            const existingCustomer = collection.data[0];
            if (existingCustomer) {
              return existingCustomer.id;
            }
            logger.error(
              `Unable to retrieve existing Paddle customer for email: ${user.email}`,
            );
            throw error;
          }
          logger.error(
            `Unable to generate the transaction client on Paddle -- ${stringify(
              error,
            )}`,
          );
          throw error;
        }
      };

      const tenant = (request.query && request.query.tenant) || "airqo";

      if (!customerIdentification) {
        if (user.paddle_customer_id) {
          // Reuse the cached Paddle customer ID — no API call needed
          sessionData.customer_id = user.paddle_customer_id;
        } else {
          const resolvedCustomerId = await resolveOrCreateCustomer();
          sessionData.customer_id = resolvedCustomerId;
          // Persist the customer ID so future checkouts skip this lookup
          UserModel(tenant)
            .findByIdAndUpdate(
              user._id,
              { $set: { paddle_customer_id: resolvedCustomerId } },
              { new: false },
            )
            .catch((err) =>
              logger.error(
                `Non-critical: failed to persist paddle_customer_id for user ${user._id}: ${err.message}`,
              ),
            );
        }
      }

      // Ensure required fields are present
      if (
        !sessionData.settings?.success_url ||
        !sessionData.settings?.cancel_url
      ) {
        throw new Error("success_url and cancel_url are required in settings");
      }

      if (!sessionData.items || !sessionData.items.length) {
        throw new Error("items array with at least one item is required");
      }

      // Strip internal-only `settings` key — Paddle's transactions.create API
      // does not accept it (it is a Paddle.js client-side concept only).
      // Redirect URLs are configured in the Paddle dashboard.
      const { settings: _settings, ...paddlePayload } = sessionData;
      let checkoutSession;
      try {
        checkoutSession = await paddleClient.transactions.create(paddlePayload);
      } catch (txnError) {
        // Stale cached paddle_customer_id — customer was deleted or belongs to
        // a different sandbox. Use detail (structured) to confirm this specific
        // customer ID is the one Paddle cannot find, then resolve a fresh one.
        const isStaleCustomer =
          paddlePayload.customer_id &&
          txnError.detail &&
          txnError.detail.includes(paddlePayload.customer_id);
        if (isStaleCustomer) {
          UserModel(tenant)
            .findByIdAndUpdate(user._id, { $unset: { paddle_customer_id: "" } })
            .catch((err) =>
              logger.error(
                `Non-critical: failed to clear stale paddle_customer_id for user ${user._id}: ${err.message}`,
              ),
            );
          const freshCustomerId = await resolveOrCreateCustomer();
          paddlePayload.customer_id = freshCustomerId;
          UserModel(tenant)
            .findByIdAndUpdate(
              user._id,
              { $set: { paddle_customer_id: freshCustomerId } },
              { new: false },
            )
            .catch((err) =>
              logger.error(
                `Non-critical: failed to persist fresh paddle_customer_id for user ${user._id}: ${err.message}`,
              ),
            );
          checkoutSession =
            await paddleClient.transactions.create(paddlePayload);
        } else {
          throw txnError;
        }
      }
      return {
        success: true,
        data: {
          id: checkoutSession.id,
          url: checkoutSession.checkout?.url,
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
        }),
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
    if (!isPaddleConfigured) throw new Error("Payment provider not configured");
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
      const { user_id, full_event_data, is_new_user } = transactionMetadata;
      if (!user_id) return;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";

      // Determine which tier this payment corresponds to
      const tier = resolveTierFromEvent(full_event_data);
      const grantedScopes = TIER_SCOPE_MAP[tier] || TIER_SCOPE_MAP.Free;
      const rateLimits = TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free;

      // 1. Update User subscription tier and rate limits
      await UserModel(defaultTenant).findByIdAndUpdate(
        user_id,
        {
          $set: {
            subscriptionTier: tier,
            apiRateLimits: rateLimits,
            ...(is_new_user && { first_transaction_completed_at: new Date() }),
          },
        },
        { new: false }, // We don't need the updated doc
      );

      // 2. Update all active AccessTokens for this user.
      //    AccessToken.client_id references Client._id (not User._id), so we
      //    must first resolve the user's client IDs before updating tokens.
      const userClients = await ClientModel(defaultTenant)
        .find({ user_id }, { _id: 1 })
        .lean();
      if (userClients.length > 0) {
        const clientIds = userClients.map((c) => c._id);
        await AccessTokenModel(defaultTenant).updateMany(
          { client_id: { $in: clientIds } },
          { $set: { tier, scopes: grantedScopes } },
        );
      }

      logger.info(
        `Subscription upgraded: user=${user_id} tier=${tier} scopes=${grantedScopes.length}`,
      );
    } catch (error) {
      logger.error(`performAdditionalBusinessLogic failed: ${error.message}`);
      // Non-fatal — transaction is already recorded; log and continue
    }
  },

  sendTransactionCompletionNotification: async (_transactionMetadata) => {
    // Email notification not yet implemented.
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
  handleFailedTransaction: async (eventData) => {
    try {
      logObject("Failed Transaction Event", eventData);

      if (!eventData || !eventData.id || !eventData.customer_id) {
        logger.warn(
          "Invalid transaction data received for payment_failed event",
        );
        return;
      }

      logger.warn(`Payment failed for transaction: ${eventData.id}`, {
        customerId: eventData.customer_id,
        amount: eventData.total,
        currency: eventData.currency,
      });

      await transactions.notifyAdminOfTransactionError(
        new Error(`Payment failed for transaction ${eventData.id}`),
        eventData,
      );
    } catch (error) {
      logger.error("Failed transaction processing error", {
        errorMessage: error.message,
        transactionId: eventData?.id,
        stack: error.stack,
      });
    }
  },

  handleCompletedTransaction: async (eventData, tenant) => {
    try {
      // Log the incoming event data for debugging
      logObject("Completed Transaction Event", eventData);

      // Validate essential transaction data
      if (!eventData || !eventData.id || !eventData.customer_id) {
        logger.warn("Invalid transaction data received");
        return;
      }

      // Attempt to identify or create user associated with the transaction
      const userIdentification =
        await transactions.identifyUserFromTransaction(eventData, tenant);

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
        transactionMetadata,
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
    if (!isPaddleConfigured) return PADDLE_NOT_CONFIGURED;
    try {
      const signature = request.headers["paddle-signature"];
      const { body, query } = request;
      const { tenant } = query;
      const bodyString = Buffer.isBuffer(body) ? body.toString("utf8") : body;

      // Verify webhook authenticity — SDK signature: unmarshal(body, secretKey, signature)
      const event = await paddleClient.webhooks.unmarshal(
        bodyString,
        constants.PADDLE_WEBHOOK_SECRET,
        signature,
      );

      // Normalise SDK camelCase fields to snake_case once so all downstream
      // callers (handlers, identifyUserFromTransaction, create) use consistent
      // field names without each needing its own camelCase fallback.
      // SDK exposes eventType (camelCase), not type.
      const normalizedTransaction = {
        ...event.data,
        type: event.eventType,
        customer_id: event.data.customerId || event.data.customer_id,
        currency: (
          event.data.currencyCode ||
          event.data.currency ||
          "USD"
        ).toUpperCase(),
        total: parseFloat(
          event.data.details?.totals?.total || event.data.total,
        ),
      };

      // Non-transaction events are acknowledged and returned early so
      // transactions.create is never reached for them.
      switch (event.eventType) {
        case "transaction.completed":
          await transactions.handleCompletedTransaction(
            normalizedTransaction,
            tenant,
          );
          break;
        case "transaction.payment_failed":
          await transactions.handleFailedTransaction(normalizedTransaction);
          break;
        default:
          logger.info(`Paddle webhook event ${event.eventType} received but not handled`);
          return { success: true, message: "Event received", status: httpStatus.OK };
      }

      return await transactions.create(
        { body: normalizedTransaction, query: { tenant } },
        next,
      );
    } catch (error) {
      opsLogger.warn("webhook-debug", {
        bodyType: Buffer.isBuffer(request.body) ? "Buffer" : typeof request.body,
        bodyLength: Buffer.isBuffer(request.body)
          ? request.body.length
          : String(request.body).length,
        signaturePresent: !!request.headers["paddle-signature"],
        signatureLength: request.headers["paddle-signature"]
          ? request.headers["paddle-signature"].length
          : 0,
        secretConfigured: Boolean(constants.PADDLE_WEBHOOK_SECRET),
        errorMessage: error.message,
      });
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
   * @param {string} [tenant] - Tenant identifier; defaults to constants.DEFAULT_TENANT or "airqo"
   * @returns {Promise<Object>} User identification result
   */
  identifyUserFromTransaction: async (transactionData, tenant) => {
    const resolvedTenant = tenant || constants.DEFAULT_TENANT || "airqo";
    try {
      const existingUser = await UserModel(resolvedTenant).findOne({
        paddle_customer_id: transactionData.customer_id,
      });

      if (existingUser) {
        return {
          userId: existingUser._id,
          isNewUser: false,
        };
      }

      const newUser = await UserModel(resolvedTenant).create({
        paddle_customer_id: transactionData.customer_id,
        email: transactionData.email || null,
        name: transactionData.customer_name || null,
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
    if (!isPaddleConfigured) return PADDLE_NOT_CONFIGURED;
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
            `Unable to generate Paddle customer -- ${stringify(error)}`,
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
      const subscriptionTransaction =
        await paddleClient.transactions.create(transactionData);

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
              user.currentSubscriptionId,
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
              } --- ${stringify(error)}`,
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
    if (!isPaddleConfigured) return PADDLE_NOT_CONFIGURED;
    try {
      // Cancel subscription in Paddle
      const cancellationResult =
        await paddleClient.subscriptions.cancel(subscriptionId);

      const defaultTenant = "airqo";

      // Reset user to Free tier, wipe rate limits, and clear all subscription
      // linkage fields so downstream checks (e.g. getSubscription, status polls)
      // no longer treat this user as an active subscriber.
      await UserModel(defaultTenant).findByIdAndUpdate(user._id, {
        $set: {
          subscriptionStatus: "cancelled",
          subscriptionCancelledAt: new Date(),
          subscriptionTier: "Free",
          apiRateLimits: TIER_RATE_LIMITS.Free,
          currentSubscriptionId: null,
          nextBillingDate: null,
          automaticRenewal: false,
        },
      });

      // Downgrade all of this user's active tokens to Free tier scopes
      try {
        const userClients = await ClientModel(defaultTenant)
          .find({ user_id: user._id }, { _id: 1 })
          .lean();
        if (userClients.length > 0) {
          const clientIds = userClients.map((c) => c._id);
          await AccessTokenModel(defaultTenant).updateMany(
            { client_id: { $in: clientIds } },
            { $set: { tier: "Free", scopes: TIER_SCOPE_MAP.Free } },
          );
        }
      } catch (downgradeErr) {
        // Non-fatal — cancellation is already recorded; log and continue
        logger.error(
          `Non-critical: token downgrade after cancellation failed for user ${user._id}: ${downgradeErr.message}`,
        );
      }

      logger.info(
        `Subscription cancelled and tier reset to Free: user=${user._id}`,
      );

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
   * Manually renew a user's subscription
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  manualSubscriptionRenewal: async (request, next) => {
    if (!isPaddleConfigured) return PADDLE_NOT_CONFIGURED;
    try {
      const user = request.user;
      const { tenant } = request.query;

      if (!user.currentSubscriptionId) {
        return {
          success: false,
          message: "No active subscription found to renew",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "User has no subscription ID" },
        };
      }

      // Fetch current subscription details from Paddle to populate the local renewal record
      const renewalTransaction = await paddleClient.subscriptions.get(
        user.currentSubscriptionId,
      );

      // Prefer Paddle's authoritative period end date; fall back to a
      // calendar offset from now if the subscription doesn't have one yet.
      const paddleEndsAt = renewalTransaction?.currentBillingPeriod?.endsAt;
      const newExpiryDate = paddleEndsAt
        ? new Date(paddleEndsAt)
        : (() => {
            const d = new Date();
            const billingCycle =
              user.currentPlanDetails?.billingCycle || "monthly";
            d.setDate(d.getDate() + (billingCycle === "annual" ? 365 : 30));
            return d;
          })();

      const transactionRecord = await TransactionModel(tenant).register({
        paddle_transaction_id: `manual_renewal_${Date.now()}_${user._id}`,
        paddle_event_type: "transaction.completed",
        user_id: user._id,
        paddle_customer_id: renewalTransaction.customerId || "unknown",
        amount: renewalTransaction.items?.[0]?.price?.unitPrice?.amount || 0,
        currency:
          renewalTransaction.items?.[0]?.price?.unitPrice?.currencyCode ||
          "USD",
        status: "completed",
        description: "Manual subscription renewal",
        transaction_type: "subscription_renewal",
      });

      if (!transactionRecord.success || !transactionRecord.data) {
        return {
          success: false,
          message: "Failed to record renewal transaction",
          errors: transactionRecord.errors || {
            message: "Transaction registration returned no data",
          },
          status: transactionRecord.status || httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      await UserModel("airqo").findByIdAndUpdate(user._id, {
        $set: {
          subscriptionStatus: "active",
          lastRenewalDate: new Date(),
          nextBillingDate: newExpiryDate,
          lastSubscriptionCheck: new Date(),
        },
      });

      return {
        success: true,
        message: "Subscription renewed successfully",
        data: {
          newExpiryDate,
          transactionId: transactionRecord.data.paddle_transaction_id,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Manual renewal error: ${error.message}`);
      return {
        success: false,
        message: "Failed to renew subscription",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * Get detailed transaction history with date/status filtering
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  getTransactionHistory: async (request, next) => {
    try {
      const {
        query: { tenant, start_date, end_date, status, limit, skip },
      } = request;

      if (!request.user || !request.user._id) {
        return {
          success: false,
          message: "Unauthorized",
          status: httpStatus.UNAUTHORIZED,
          errors: { message: "Valid user session is required" },
        };
      }

      const filter = { user_id: request.user._id };

      if (start_date || end_date) {
        filter.createdAt = {};
        if (start_date) {
          const sd = new Date(start_date);
          if (isNaN(sd.getTime())) {
            return {
              success: false,
              message: "Invalid start_date value",
              status: httpStatus.BAD_REQUEST,
              errors: {
                message: `start_date '${start_date}' is not a valid date`,
              },
            };
          }
          filter.createdAt.$gte = sd;
        }
        if (end_date) {
          const ed = new Date(end_date);
          if (isNaN(ed.getTime())) {
            return {
              success: false,
              message: "Invalid end_date value",
              status: httpStatus.BAD_REQUEST,
              errors: { message: `end_date '${end_date}' is not a valid date` },
            };
          }
          ed.setHours(23, 59, 59, 999); // include the full end date
          filter.createdAt.$lte = ed;
        }
      }

      if (status) {
        filter.status = status;
      }

      const listResponse = await TransactionModel(tenant).list(
        {
          filter,
          limit: limit ? parseInt(limit) : 100,
          skip: skip ? parseInt(skip) : 0,
        },
        next,
      );

      if (!listResponse.success) {
        return listResponse;
      }

      const transactions = listResponse.data || [];

      const summary = transactions.reduce(
        (acc, txn) => {
          acc.total_amount += txn.amount || 0;
          acc.transaction_count += 1;
          return acc;
        },
        { total_amount: 0, transaction_count: 0 },
      );

      return {
        success: true,
        data: {
          transactions,
          summary,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Transaction history error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve transaction history",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * Generate a financial report for a date range
   * @param {Object} request - Express request object
   * @param {Function} next - Error handling middleware
   */
  generateFinancialReport: async (request, next) => {
    try {
      const {
        query: { tenant, start_date, end_date },
      } = request;

      const filter = { status: "completed" };
      const period = { start: null, end: null };

      if (start_date) {
        const sd = new Date(start_date);
        if (isNaN(sd.getTime())) {
          return {
            success: false,
            message: "Invalid start_date value",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: `start_date '${start_date}' is not a valid date`,
            },
          };
        }
        filter.createdAt = filter.createdAt || {};
        filter.createdAt.$gte = sd;
        period.start = sd.toISOString();
      }
      if (end_date) {
        const ed = new Date(end_date);
        if (isNaN(ed.getTime())) {
          return {
            success: false,
            message: "Invalid end_date value",
            status: httpStatus.BAD_REQUEST,
            errors: { message: `end_date '${end_date}' is not a valid date` },
          };
        }
        ed.setHours(23, 59, 59, 999); // include the full end date
        filter.createdAt = filter.createdAt || {};
        filter.createdAt.$lte = ed;
        period.end = ed.toISOString();
      }

      if (!period.start) period.start = new Date(0).toISOString();
      if (!period.end) period.end = new Date().toISOString();

      const statsResponse = await TransactionModel(tenant).getStats(filter);

      if (!statsResponse.success) {
        return statsResponse;
      }

      const stats = statsResponse.data || {
        totalAmount: 0,
        totalTransactions: 0,
      };

      return {
        success: true,
        data: {
          total_revenue: stats.totalAmount,
          transaction_count: stats.totalTransactions,
          average_transaction_value: stats.averageTransactionAmount || 0,
          period,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Financial report generation error: ${error.message}`);
      return {
        success: false,
        message: "Failed to generate financial report",
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
        { new: true }, // Return the updated document
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
            paddleUpdateError,
          )}`,
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
            emailError,
          )}`,
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

  /**
   * Disable automatic renewal for a user's subscription.
   * Updates the user record only — no Paddle subscription update is required
   * because we simply stop scheduling renewals rather than cancelling the plan.
   * @param {Object} request - Express request object (user populated by auth middleware)
   * @returns {Promise<Object>}
   */
  disableAutoRenewal: async (request) => {
    try {
      const user = request.user;

      if (!user.currentSubscriptionId) {
        return {
          success: false,
          message: "No active subscription found",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedUser = await UserModel("airqo").findByIdAndUpdate(
        user._id,
        { $set: { automaticRenewal: false } },
        { new: true },
      );

      return {
        success: true,
        message: "Automatic renewal disabled successfully",
        data: { automaticRenewal: updatedUser.automaticRenewal },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Disable automatic renewal failed", error);
      return {
        success: false,
        message: "Failed to disable automatic renewal",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = transactions;
