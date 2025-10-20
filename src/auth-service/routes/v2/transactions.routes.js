const express = require("express");
const TransactionController = require("@controllers/transaction.controller");
const transactionValidations = require("@validators/transactions.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

const router = express.Router();

router.use(headers);
router.use(transactionValidations.pagination(100, 1000));

// Checkout Session
router.post(
  "/checkout",
  transactionValidations.checkout,
  enhancedJWTAuth,
  TransactionController.createCheckoutSession
);

// Webhook Handling
router.post(
  "/webhook",
  transactionValidations.tenantOperation,
  express.raw({ type: "application/json" }),
  TransactionController.handleWebhook
);

// List Transactions
router.get(
  "/list",
  transactionValidations.tenantOperation,
  enhancedJWTAuth,
  TransactionController.listTransactions
);

// Update Transaction
router.patch(
  "/:id/update",
  transactionValidations.idOperation,
  enhancedJWTAuth,
  TransactionController.updateTransaction
);

// Get Transaction Stats
router.get(
  "/stats",
  transactionValidations.tenantOperation,
  enhancedJWTAuth,
  TransactionController.getTransactionStats
);

// Delete Transaction
router.delete(
  "/:id/delete",
  transactionValidations.idOperation,
  enhancedJWTAuth,
  TransactionController.deleteTransaction
);

// Enable Auto-Renewal
router.post(
  "/:id/enable-auto-renew",
  transactionValidations.idOperation,
  enhancedJWTAuth,
  TransactionController.optInForAutomaticRenewal
);

// Create Subscription Transaction
router.post(
  "/create-subscription",
  transactionValidations.subscription,
  enhancedJWTAuth,
  TransactionController.createSubscriptionTransaction
);

// Cancel Subscription
router.post(
  "/:id/cancel-subscription",
  transactionValidations.idOperation,
  enhancedJWTAuth,
  TransactionController.cancelSubscription
);

// Generate Dynamic Price
router.post(
  "/pricing/generate",
  transactionValidations.dynamicPrice,
  enhancedJWTAuth,
  TransactionController.generateDynamicPrice
);

// Get Subscription Status
router.get(
  "/:id/subscription-status",
  transactionValidations.idOperation,
  enhancedJWTAuth,
  TransactionController.getSubscriptionStatus
);

// Manual Subscription Renewal
router.post(
  "/:id/renew-subscription",
  transactionValidations.idOperation,
  enhancedJWTAuth,
  TransactionController.manualSubscriptionRenewal
);

// Extended Transaction History
router.get(
  "/transaction-history",
  transactionValidations.history,
  enhancedJWTAuth,
  TransactionController.getExtendedTransactionHistory
);

// Generate Financial Report
router.get(
  "/reports/financial-report",
  transactionValidations.tenantOperation,
  enhancedJWTAuth,
  TransactionController.generateFinancialReport
);

module.exports = router;
