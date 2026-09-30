// billing.routes.js
const express = require("express");
const router = express.Router();
const billingController = require("@controllers/billing.controller");
const billingValidations = require("@validators/billing.validators");
const constants = require("@config/constants");
const { enhancedJWTAuth } = require("@middleware/passport");
const {
  requirePermissions,
  requireGroupMembership,
} = require("@middleware/permissionAuth");
const { headers } = require("@validators/common");

router.use(headers);

// Issuing invoices and recording payments is a platform-admin task; it is
// gated on platform-only permissions so organisation super admins (who hold
// every non-system permission) cannot bill themselves.
const requireBillingAdmin = requirePermissions([
  constants.SUPER_ADMIN,
  constants.SYSTEM_ADMIN,
]);
const admin = [enhancedJWTAuth, requireBillingAdmin];

// ── Settings & summary ─────────────────────────────────────────────────────
router.get("/settings", billingValidations.tenant, ...admin, billingController.getSettings);
router.put("/settings", billingValidations.updateSettings, ...admin, billingController.updateSettings);
router.get("/summary", billingValidations.summary, ...admin, billingController.summary);

// ── Customers ─────────────────────────────────────────────────────────────
router.post("/customers", billingValidations.createCustomer, ...admin, billingController.createCustomer);
router.get("/customers", billingValidations.listCustomers, ...admin, billingController.listCustomers);
router.get("/customers/:customerId", billingValidations.getCustomer, ...admin, billingController.getCustomer);
router.put("/customers/:customerId", billingValidations.updateCustomer, ...admin, billingController.updateCustomer);

// ── Invoices & pro formas ──────────────────────────────────────────────────
router.post("/invoices", billingValidations.createInvoice, ...admin, billingController.createInvoice);
router.get("/invoices", billingValidations.listInvoices, ...admin, billingController.listInvoices);
router.get("/invoices/:invoiceId", billingValidations.invoiceOnly, ...admin, billingController.getInvoice);
router.put("/invoices/:invoiceId", billingValidations.updateInvoice, ...admin, billingController.updateInvoice);
router.delete("/invoices/:invoiceId", billingValidations.invoiceOnly, ...admin, billingController.deleteInvoice);
router.get("/invoices/:invoiceId/pdf", billingValidations.invoiceOnly, ...admin, billingController.getInvoicePdf);
router.post("/invoices/:invoiceId/finalize", billingValidations.finalizeInvoice, ...admin, billingController.finalizeInvoice);
router.post("/invoices/:invoiceId/send", billingValidations.sendInvoice, ...admin, billingController.sendInvoice);
router.post("/invoices/:invoiceId/mark-sent", billingValidations.markInvoiceSent, ...admin, billingController.markInvoiceSent);
router.post("/invoices/:invoiceId/remind", billingValidations.remindInvoice, ...admin, billingController.remindInvoice);
router.post("/invoices/:invoiceId/void", billingValidations.voidInvoice, ...admin, billingController.voidInvoice);
router.post("/invoices/:invoiceId/convert", billingValidations.invoiceOnly, ...admin, billingController.convertProforma);
router.post("/invoices/:invoiceId/payments", billingValidations.recordPayment, ...admin, billingController.recordPayment);

// ── Payments & receipts ────────────────────────────────────────────────────
router.get("/payments", billingValidations.listPayments, ...admin, billingController.listPayments);
router.get("/payments/:paymentId", billingValidations.paymentOnly, ...admin, billingController.getPayment);
router.get("/payments/:paymentId/receipt", billingValidations.paymentOnly, ...admin, billingController.getReceiptPdf);
router.post("/payments/:paymentId/send-receipt", billingValidations.sendReceipt, ...admin, billingController.sendReceipt);
router.post("/payments/:paymentId/void", billingValidations.voidPayment, ...admin, billingController.voidPayment);

// ── Organisation members: read-only views of their issued documents ────────
const member = [enhancedJWTAuth, requireGroupMembership("grp_id")];
router.get("/groups/:grp_id/invoices", billingValidations.groupInvoices, ...member, billingController.groupInvoices);
router.get("/groups/:grp_id/invoices/:invoiceId", billingValidations.groupInvoice, ...member, billingController.groupInvoice);
router.get("/groups/:grp_id/invoices/:invoiceId/pdf", billingValidations.groupInvoice, ...member, billingController.groupInvoicePdf);
router.get("/groups/:grp_id/payments", billingValidations.groupPayments, ...member, billingController.groupPayments);
router.get("/groups/:grp_id/payments/:paymentId/receipt", billingValidations.groupReceipt, ...member, billingController.groupReceiptPdf);

module.exports = router;
