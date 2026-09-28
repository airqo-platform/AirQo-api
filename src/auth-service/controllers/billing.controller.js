const httpStatus = require("http-status");
const constants = require("@config/constants");
const billingUtil = require("@utils/billing.util");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- billing-controller`);

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error && error.stack}`);
  if (error instanceof HttpError) return next(error);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message:
        process.env.NODE_ENV !== "production"
          ? error.message
          : "An unexpected error occurred",
    }),
  );
};

const prepare = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }
  req.query = req.query || {};
  req.body = req.body || {};
  req.query.tenant = req.query.tenant || constants.DEFAULT_TENANT || "airqo";
  return req;
};

const sendResult = (req, res, result) => {
  if (res.headersSent) return;
  if (result.success && result.pdf) {
    // ?download=true saves the file; otherwise browsers preview it inline.
    const disposition = String(req.query.download) === "true" ? "attachment" : "inline";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${result.filename}"`);
    return res.status(result.status).send(result.pdf);
  }
  if (result.success) {
    return res
      .status(result.status)
      .json({ success: true, message: result.message, data: result.data });
  }
  return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: result.message,
    errors: result.errors,
  });
};

const handler = (fn) => async (req, res, next) => {
  try {
    const request = prepare(req, next);
    if (!request) return;
    sendResult(req, res, await fn(request));
  } catch (error) {
    handleError(error, next);
  }
};

const billing = {
  getSettings: handler(billingUtil.settingsView),
  updateSettings: handler(billingUtil.updateSettings),
  summary: handler(billingUtil.summary),

  createCustomer: handler(billingUtil.createCustomer),
  listCustomers: handler(billingUtil.listCustomers),
  getCustomer: handler(billingUtil.getCustomer),
  updateCustomer: handler(billingUtil.updateCustomer),

  createInvoice: handler(billingUtil.createInvoice),
  listInvoices: handler(billingUtil.listInvoices),
  getInvoice: handler(billingUtil.getInvoice),
  updateInvoice: handler(billingUtil.updateInvoice),
  deleteInvoice: handler(billingUtil.deleteInvoice),
  getInvoicePdf: handler(billingUtil.getInvoicePdf),
  finalizeInvoice: handler(billingUtil.finalizeInvoice),
  sendInvoice: handler(billingUtil.sendInvoice),
  markInvoiceSent: handler(billingUtil.markInvoiceSent),
  remindInvoice: handler(billingUtil.remindInvoice),
  voidInvoice: handler(billingUtil.voidInvoice),
  convertProforma: handler(billingUtil.convertProforma),

  recordPayment: handler(billingUtil.recordPayment),
  listPayments: handler(billingUtil.listPayments),
  getPayment: handler(billingUtil.getPayment),
  getReceiptPdf: handler(billingUtil.getReceiptPdf),
  sendReceipt: handler(billingUtil.sendReceipt),
  voidPayment: handler(billingUtil.voidPayment),

  groupInvoices: handler(billingUtil.groupInvoices),
  groupInvoice: handler(billingUtil.groupInvoice),
  groupInvoicePdf: handler(billingUtil.groupInvoicePdf),
  groupPayments: handler(billingUtil.groupPayments),
  groupReceiptPdf: handler(billingUtil.groupReceiptPdf),
};

module.exports = billing;
