const express = require("express");
const PaymentController = require("@controllers/create-payment");
const validateTransaction = require("@middleware/validateTransaction");
const validateTenant = require("@middleware/validateTenant");
const router = express.Router();
const validatePagination = require("@middleware/validatePagination");

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
  PaymentController.createCheckoutSession
);

router.post(
  "/webhook",
  validateTenant(),
  express.raw({ type: "application/json" }),
  PaymentController.handleWebhook
);

router.get("/list", validateTenant(), PaymentController.listTransactions);

router.patch("/update", validateTenant(), PaymentController.updateTransaction);

router.get("/stats", validateTenant(), PaymentController.getTransactionStats);

router.delete("/delete", validateTenant(), PaymentController.deleteTransaction);

module.exports = router;
