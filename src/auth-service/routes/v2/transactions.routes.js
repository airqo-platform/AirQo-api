const express = require("express");
const TransactionController = require("@controllers/transaction.controller");
const transactionValidations = require("@validators/transactions.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

const router = express.Router();

// CORS headers middleware
const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);
router.use(transactionValidations.pagination(100, 1000));

// Checkout Session
router.post(
  "/checkout",
  transactionValidations.checkout,
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
  TransactionController.listTransactions
);

// Update Transaction
router.patch(
  "/:id/update",
  transactionValidations.idOperation,
  setJWTAuth,
  authJWT,
  TransactionController.updateTransaction
);

// Get Transaction Stats
router.get(
  "/stats",
  transactionValidations.tenantOperation,
  setJWTAuth,
  authJWT,
  TransactionController.getTransactionStats
);

// Delete Transaction
router.delete(
  "/:id/delete",
  transactionValidations.idOperation,
  setJWTAuth,
  authJWT,
  TransactionController.deleteTransaction
);

// Enable Auto-Renewal
router.post(
  "/:id/enable-auto-renew",
  transactionValidations.idOperation,
  setJWTAuth,
  authJWT,
  TransactionController.optInForAutomaticRenewal
);

// Create Subscription Transaction
router.post(
  "/create-subscription",
  transactionValidations.subscription,
  setJWTAuth,
  authJWT,
  TransactionController.createSubscriptionTransaction
);

// Cancel Subscription
router.post(
  "/:id/cancel-subscription",
  transactionValidations.idOperation,
  setJWTAuth,
  authJWT,
  TransactionController.cancelSubscription
);

// Generate Dynamic Price
router.post(
  "/pricing/generate",
  transactionValidations.dynamicPrice,
  setJWTAuth,
  authJWT,
  TransactionController.generateDynamicPrice
);

// Get Subscription Status
router.get(
  "/:id/subscription-status",
  transactionValidations.idOperation,
  setJWTAuth,
  authJWT,
  TransactionController.getSubscriptionStatus
);

// Manual Subscription Renewal
router.post(
  "/:id/renew-subscription",
  transactionValidations.idOperation,
  setJWTAuth,
  authJWT,
  TransactionController.manualSubscriptionRenewal
);

// Extended Transaction History
router.get(
  "/transaction-history",
  transactionValidations.history,
  setJWTAuth,
  authJWT,
  TransactionController.getExtendedTransactionHistory
);

// Generate Financial Report
router.get(
  "/reports/financial-report",
  transactionValidations.tenantOperation,
  setJWTAuth,
  authJWT,
  TransactionController.generateFinancialReport
);

module.exports = router;
