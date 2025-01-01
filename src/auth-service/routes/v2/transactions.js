const express = require("express");
const TransactionController = require("@controllers/create-transaction");
const validateTransaction = require("@middleware/validateTransaction");
const validateTenant = require("@middleware/validateTenant");
const router = express.Router();
const validatePagination = require("@middleware/validatePagination");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
router.use(validatePagination(100, 1000));

router.post(
  "/checkout",
  validateTenant(),
  validateTransaction,
  setJWTAuth,
  authJWT,
  TransactionController.createCheckoutSession
);

router.post(
  "/webhook",
  validateTenant(),
  express.raw({ type: "application/json" }),
  TransactionController.handleWebhook
);

router.get("/list", validateTenant(), TransactionController.listTransactions);

router.patch(
  "/update",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.updateTransaction
);

router.get(
  "/stats",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.getTransactionStats
);

router.delete(
  "/delete",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.deleteTransaction
);

router.post(
  "/enable-auto-renewal",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.optInForAutomaticRenewal
);

// Route for creating a subscription transaction
router.post(
  "/subscribe",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.createSubscriptionTransaction
);

// Route for cancelling a user's subscription
router.post(
  "/cancel-subscription",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.cancelSubscription
);

// Route for generating a dynamic price for flexible donations
router.post(
  "/generate-price",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.generateDynamicPrice
);

// Route for retrieving user's subscription status
router.get(
  "/subscription-status",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.getSubscriptionStatus
);

// Route for handling subscription renewals manually
router.post(
  "/renew-subscription",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.manualSubscriptionRenewal
);

// Route for retrieving transaction history with advanced filtering
router.get(
  "/transaction-history",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.getExtendedTransactionHistory
);

// Route for generating financial reports
router.get(
  "/financial-report",
  validateTenant(),
  setJWTAuth,
  authJWT,
  TransactionController.generateFinancialReport
);

module.exports = router;
