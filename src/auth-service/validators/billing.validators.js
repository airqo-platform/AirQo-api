const { query, body, param, oneOf } = require("express-validator");
const moment = require("moment-timezone");
const constants = require("@config/constants");
const { isValidCurrency } = require("@utils/billing-money.util");

const tenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
]);

const PAYMENT_METHODS = [
  "bank_transfer",
  "card",
  "mobile_money",
  "cash",
  "cheque",
  "other",
];
const INVOICE_STATUSES = [
  "draft",
  "open",
  "partially_paid",
  "paid",
  "void",
  "converted",
  "overdue",
];

const isStrictDate = (value) => moment.utc(value, "YYYY-MM-DD", true).isValid();
const isDateTime = (value) => moment.utc(value, moment.ISO_8601, true).isValid();
const notInFuture = (value) => !moment.utc(value).isAfter(moment.utc().endOf("day"));

const mongoId = (location, name) =>
  location(name).isMongoId().withMessage(`${name} must be a valid ObjectId`);
const optionalMongoId = (location, name) =>
  location(name).optional({ nullable: true }).isMongoId().withMessage(`${name} must be a valid ObjectId`);

const text = (name, max = 500) =>
  body(name)
    .optional({ nullable: true })
    .isString()
    .withMessage(`${name} must be text`)
    .bail()
    .trim()
    .isLength({ max })
    .withMessage(`${name} must be at most ${max} characters`);

const textList = (name, { maxItems = 20, maxLength = 500 } = {}) => [
  body(name)
    .optional()
    .isArray({ max: maxItems })
    .withMessage(`${name} must be a list of at most ${maxItems} entries`),
  body(`${name}.*`)
    .isString()
    .trim()
    .isLength({ max: maxLength })
    .withMessage(`each ${name} entry must be text up to ${maxLength} characters`),
];

const emailList = (name) => [
  body(name)
    .optional()
    .isArray({ max: 20 })
    .withMessage(`${name} must be a list of at most 20 email addresses`),
  body(`${name}.*`).isEmail().withMessage(`${name} must contain valid email addresses`),
];

const currency = (location, name = "currency") =>
  location(name)
    .optional()
    .isString()
    .bail()
    .customSanitizer((value) => value.trim().toUpperCase())
    .custom(isValidCurrency)
    .withMessage(`${name} must be an ISO 4217 code such as USD or UGX`);

const date = (location, name) =>
  location(name)
    .optional({ nullable: true })
    .custom(isStrictDate)
    .withMessage(`${name} must be in YYYY-MM-DD format`);

const labelValueList = (name) => [
  body(name)
    .optional()
    .isArray({ max: 20 })
    .withMessage(`${name} must be a list of at most 20 entries`),
  body(`${name}.*.label`).optional().isString().trim().isLength({ max: 100 }),
  body(`${name}.*.value`)
    .isString()
    .withMessage(`each ${name} entry needs a value`)
    .trim()
    .isLength({ max: 500 }),
];

const pageQuery = [
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("limit must be between 1 and 200"),
  query("skip").optional().isInt({ min: 0 }).withMessage("skip must be zero or more"),
  query("search").optional().isString().trim().isLength({ max: 100 }),
  date(query, "from"),
  date(query, "to"),
  currency(query),
];

const recipients = [...emailList("to"), ...emailList("cc")];

// ── Settings ──────────────────────────────────────────────────────────────

const updateSettings = [
  tenant,
  body("seller").optional().isObject().withMessage("seller must be an object"),
  body("seller.name").optional().isString().trim().isLength({ min: 1, max: 200 }),
  ...textList("seller.address_lines", { maxItems: 6, maxLength: 200 }),
  body("seller.email").optional().isEmail().withMessage("seller.email must be a valid email"),
  body("seller.phone").optional().isString().trim().isLength({ max: 50 }),
  body("seller.website").optional().isString().trim().isLength({ max: 200 }),
  body("seller.tax_id").optional().isString().trim().isLength({ max: 100 }),
  ...labelValueList("payment_instructions"),
  currency(body, "default_currency"),
  body("default_payment_terms_days")
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage("default_payment_terms_days must be between 0 and 365")
    .toInt(),
  ...textList("default_terms"),
  text("default_notes", 2000),
  text("footer", 500),
  text("tax_label", 30),
  body("default_tax_rate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("default_tax_rate must be a percentage between 0 and 100")
    .toFloat(),
  body("number_prefix").optional().isString().trim().isLength({ max: 20 }),
  body("number_format")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 60 })
    .bail()
    .custom((value) => /\{seq4?\}/.test(value))
    .withMessage("number_format must contain {seq} or {seq4}"),
  body("sequence_reset")
    .optional()
    .isIn(["yearly", "never"])
    .withMessage("sequence_reset must be yearly or never"),
  body("sequence_starts").optional().isObject(),
  ...["invoice", "proforma", "receipt"].map((kind) =>
    body(`sequence_starts.${kind}`)
      .optional()
      .isInt({ min: 1 })
      .withMessage(`sequence_starts.${kind} must be a whole number of at least 1`)
      .toInt(),
  ),
  body("catalog")
    .optional()
    .isArray({ max: 200 })
    .withMessage("catalog must be a list of at most 200 products"),
  body("catalog.*.description")
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("each catalog product needs a description"),
  body("catalog.*.item").optional().isString().trim().isLength({ max: 200 }),
  body("catalog.*.unit_price")
    .isFloat({ min: 0 })
    .withMessage("each catalog product needs a unit_price of zero or more")
    .toFloat(),
  currency(body, "catalog.*.currency"),
  ...emailList("billing_cc_emails"),
  body("reminders_enabled").optional().isBoolean().toBoolean(),
  ...["reminder_days_before_due", "reminder_days_after_due"].flatMap((name) => [
    body(name).optional().isArray({ max: 10 }).withMessage(`${name} must be a list of days`),
    body(`${name}.*`)
      .isInt({ min: 0, max: 365 })
      .withMessage(`${name} entries must be whole days between 0 and 365`)
      .toInt(),
  ]),
];

// ── Customers ─────────────────────────────────────────────────────────────

// name may be omitted on create when group_id is given (it defaults to the
// organisation's title); the util enforces that one of the two is present.
const customerFields = [
  body("name").optional().isString().trim().isLength({ min: 1, max: 200 }),
  text("contact_name", 200),
  ...emailList("billing_emails"),
  text("phone", 50),
  ...textList("address_lines", { maxItems: 6, maxLength: 200 }),
  text("city", 100),
  text("country", 100),
  text("postal_code", 30),
  text("tax_id", 100),
  currency(body),
  optionalMongoId(body, "group_id"),
  optionalMongoId(body, "user_id"),
  text("notes", 2000),
  body("status")
    .optional()
    .isIn(["active", "archived"])
    .withMessage("status must be active or archived"),
];

const createCustomer = [tenant, ...customerFields];
const updateCustomer = [tenant, mongoId(param, "customerId"), ...customerFields];
const getCustomer = [tenant, mongoId(param, "customerId")];
const listCustomers = [
  tenant,
  ...pageQuery,
  query("status").optional().isIn(["active", "archived", "all"]),
  optionalMongoId(query, "group_id"),
];

// ── Invoices ──────────────────────────────────────────────────────────────

const invoiceFields = [
  body("kind")
    .optional()
    .isIn(["invoice", "proforma"])
    .withMessage("kind must be invoice or proforma"),
  currency(body),
  text("subject", 300),
  text("reference", 100),
  date(body, "issue_date"),
  date(body, "due_date"),
  body("payment_terms_days")
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage("payment_terms_days must be between 0 and 365")
    .toInt(),
  body("line_items")
    .optional()
    .isArray({ max: 100 })
    .withMessage("line_items must be a list of at most 100 items"),
  body("line_items.*.item").optional().isString().trim().isLength({ max: 200 }),
  body("line_items.*.description")
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("each line item needs a description"),
  body("line_items.*.quantity")
    .isFloat({ gt: 0 })
    .withMessage("each line item needs a quantity greater than zero")
    .toFloat(),
  body("line_items.*.unit_price")
    .isFloat({ min: 0 })
    .withMessage("each line item needs a unit_price of zero or more")
    .toFloat(),
  body("discount_amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("discount_amount must be zero or more")
    .toFloat(),
  body("tax_rate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("tax_rate must be a percentage between 0 and 100")
    .toFloat(),
  text("tax_label", 30),
  text("notes", 2000),
  ...textList("terms"),
  text("footer", 500),
  ...labelValueList("payment_instructions"),
  body("reminders_enabled").optional().isBoolean().toBoolean(),
  body("metadata").optional().isObject().withMessage("metadata must be an object"),
];

const invoiceId = mongoId(param, "invoiceId");

const createInvoice = [
  tenant,
  mongoId(body, "customer_id"),
  ...invoiceFields,
  body("line_items")
    .isArray({ min: 1 })
    .withMessage("line_items must contain at least one item"),
];
const updateInvoice = [tenant, invoiceId, optionalMongoId(body, "customer_id"), ...invoiceFields];
const invoiceOnly = [tenant, invoiceId];
const listInvoices = [
  tenant,
  ...pageQuery,
  query("status")
    .optional()
    .custom((value) => String(value).split(",").every((s) => INVOICE_STATUSES.includes(s)))
    .withMessage(`status must be a comma-separated list of: ${INVOICE_STATUSES.join(", ")}`),
  query("kind").optional().isIn(["invoice", "proforma"]),
  optionalMongoId(query, "customer_id"),
  optionalMongoId(query, "group_id"),
];
const finalizeInvoice = [
  tenant,
  invoiceId,
  date(body, "issue_date"),
  date(body, "due_date"),
  body("invoice_number")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage("invoice_number must be 1 to 60 characters"),
  body("send").optional().isBoolean().toBoolean(),
  text("message", 2000),
];
const sendInvoice = [tenant, invoiceId, ...recipients, text("message", 2000)];
const markInvoiceSent = [
  tenant,
  invoiceId,
  body("sent_at")
    .optional()
    .custom(isDateTime)
    .withMessage("sent_at must be an ISO 8601 date")
    .bail()
    .custom(notInFuture)
    .withMessage("sent_at cannot be in the future"),
  text("note", 500),
];
const remindInvoice = [tenant, invoiceId, ...recipients];
const voidInvoice = [tenant, invoiceId, text("reason", 500)];

// ── Payments ──────────────────────────────────────────────────────────────

const paymentId = mongoId(param, "paymentId");

const recordPayment = [
  tenant,
  invoiceId,
  body("amount")
    .exists()
    .withMessage("amount is required")
    .bail()
    .isFloat({ gt: 0 })
    .withMessage("amount must be greater than zero")
    .toFloat(),
  body("method")
    .optional()
    .isIn(PAYMENT_METHODS)
    .withMessage(`method must be one of: ${PAYMENT_METHODS.join(", ")}`),
  text("reference", 200),
  body("paid_at")
    .optional()
    .custom(isDateTime)
    .withMessage("paid_at must be an ISO 8601 date")
    .bail()
    .custom(notInFuture)
    .withMessage("paid_at cannot be in the future"),
  body("receipt_number")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage("receipt_number must be 1 to 60 characters"),
  text("notes", 2000),
  body("send_receipt").optional().isBoolean().toBoolean(),
];
const paymentOnly = [tenant, paymentId];
const sendReceipt = [tenant, paymentId, ...recipients];
const voidPayment = [tenant, paymentId, text("reason", 500)];
const listPayments = [
  tenant,
  ...pageQuery,
  query("status").optional().isIn(["succeeded", "void"]),
  query("method").optional().isIn(PAYMENT_METHODS),
  optionalMongoId(query, "invoice_id"),
  optionalMongoId(query, "customer_id"),
  optionalMongoId(query, "group_id"),
];

const summary = [tenant, date(query, "from"), date(query, "to")];

// ── Organisation views ────────────────────────────────────────────────────

const grpId = mongoId(param, "grp_id");
const groupInvoices = [tenant, grpId, ...listInvoices.slice(1)];
const groupInvoice = [tenant, grpId, invoiceId];
const groupPayments = [
  tenant,
  grpId,
  ...pageQuery,
  query("method").optional().isIn(PAYMENT_METHODS),
  optionalMongoId(query, "invoice_id"),
  optionalMongoId(query, "customer_id"),
];
const groupReceipt = [tenant, grpId, paymentId];

module.exports = {
  PAYMENT_METHODS,
  tenant,
  updateSettings,
  createCustomer,
  updateCustomer,
  getCustomer,
  listCustomers,
  createInvoice,
  updateInvoice,
  invoiceOnly,
  listInvoices,
  finalizeInvoice,
  sendInvoice,
  markInvoiceSent,
  remindInvoice,
  voidInvoice,
  recordPayment,
  paymentOnly,
  sendReceipt,
  voidPayment,
  listPayments,
  summary,
  groupInvoices,
  groupInvoice,
  groupPayments,
  groupReceipt,
};
