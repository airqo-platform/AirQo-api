const express = require("express");
const TransactionController = require("@controllers/transaction.controller");
const transactionValidations = require("@validators/transactions.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { headers, pagination } = require("@validators/common");

const router = express.Router();

router.use(headers);
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
  pagination(100, 1000), // Apply pagination here
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
  // No pagination for stats, usually aggregated
  TransactionController.getTransactionStats
);

// Delete Transaction
router.delete(
  "/:id/delete",
  transactionValidations.idOperation,
  enhancedJWTAuth,
  TransactionController.deleteTransaction
);

// Enable Auto-Renewal (user-scoped, no transaction ID needed)
router.post(
  "/enable-auto-renew",
  transactionValidations.tenantOperation,
  enhancedJWTAuth,
  TransactionController.optInForAutomaticRenewal
);

// Disable Auto-Renewal (user-scoped, no transaction ID needed)
router.post(
  "/disable-auto-renew",
  transactionValidations.tenantOperation,
  enhancedJWTAuth,
  TransactionController.disableAutoRenewal
);

// Create Subscription Transaction
router.post(
  "/create-subscription",
  transactionValidations.subscription,
  enhancedJWTAuth,
  TransactionController.createSubscriptionTransaction
);

// Cancel Subscription (user-scoped, no transaction ID needed)
router.post(
  "/cancel-subscription",
  transactionValidations.tenantOperation,
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

// Get Subscription Status (user-scoped, no transaction ID needed)
router.get(
  "/subscription-status",
  transactionValidations.tenantOperation,
  enhancedJWTAuth,
  TransactionController.getSubscriptionStatus
);

// Manual Subscription Renewal (user-scoped, no transaction ID needed)
router.post(
  "/renew-subscription",
  transactionValidations.tenantOperation,
  enhancedJWTAuth,
  TransactionController.manualSubscriptionRenewal
);

// Extended Transaction History
router.get(
  "/transaction-history",
  transactionValidations.history,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
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
