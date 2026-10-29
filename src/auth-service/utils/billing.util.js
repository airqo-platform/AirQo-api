const util = require("util");
const moment = require("moment-timezone");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const InvoiceModel = require("@models/Invoice");
const PaymentModel = require("@models/Payment");
const BillingCustomerModel = require("@models/BillingCustomer");
const BillingSettingsModel = require("@models/BillingSettings");
const BillingSequenceModel = require("@models/BillingSequence");
const GroupModel = require("@models/Group");
const { mailer } = require("@utils/common");
const money = require("@utils/billing-money.util");
const {
  renderInvoicePdf,
  renderReceiptPdf,
  METHOD_LABELS,
} = require("@utils/billing-pdf.util");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- billing-util`);

/**
 * Invoicing and receipts: billing settings, customers, invoices / pro forma
 * invoices, payments (each payment is a receipt), PDFs and billing emails.
 * Admin views manage everything; organisation members get read-only views of
 * their organisation's issued documents.
 */

// No addresses, contacts or bank details are committed here; all of them
// are configured through the settings endpoint.
const DEFAULT_SETTINGS = Object.freeze({
  seller: {
    name: "AirQo",
    website: "https://airqo.net",
  },
  payment_instructions: [],
  default_currency: "USD",
  default_payment_terms_days: 30,
  default_terms: [
    "Net prices, taxes exclusive.",
    "You agree to AirQo products terms and conditions https://airqo.net/legal/airqo-data",
  ],
  default_notes: "",
  footer: "Thank you for your business.",
  tax_label: "VAT",
  default_tax_rate: 0,
  number_prefix: "AQ",
  // Tokens: {prefix} {code} {yyyy} {yy} {seq} {seq4}. Lets numbering match
  // what finance already uses (e.g. "INV-{seq}/{yy}") without code changes.
  number_format: "{prefix}-{code}-{yyyy}-{seq4}",
  // "yearly" restarts each kind's counter every year; "never" keeps counting.
  sequence_reset: "yearly",
  // First number per kind, e.g. { invoice: 1002 } to continue a manual series.
  sequence_starts: { invoice: 1, proforma: 1, receipt: 1 },
  // Saved products/services Nexus can offer when adding line items.
  catalog: [],
  billing_cc_emails: [],
  reminders_enabled: true,
  reminder_days_before_due: [3],
  reminder_days_after_due: [1, 7, 14, 30],
});

const KIND_CODES = { invoice: "INV", proforma: "PF", receipt: "RCT" };
const PAYABLE_STATUSES = ["open", "partially_paid"];
const SENDABLE_STATUSES = ["open", "partially_paid", "paid"];
const EDITABLE_INVOICE_FIELDS = [
  "kind",
  "currency",
  "subject",
  "reference",
  "issue_date",
  "due_date",
  "payment_terms_days",
  "line_items",
  "discount_amount",
  "tax_rate",
  "tax_label",
  "notes",
  "terms",
  "footer",
  "payment_instructions",
  "reminders_enabled",
  "metadata",
];
const CUSTOMER_FIELDS = [
  "name",
  "contact_name",
  "billing_emails",
  "phone",
  "address_lines",
  "city",
  "country",
  "postal_code",
  "tax_id",
  "currency",
  "group_id",
  "user_id",
  "notes",
  "status",
];
// Fields organisation members never see on their own invoices.
const INTERNAL_INVOICE_FIELDS = [
  "history",
  "created_by",
  "metadata",
  "reminders_sent",
  "reminders_enabled",
];

const ok = (message, data, status = httpStatus.OK) => ({
  success: true,
  message,
  data,
  status,
});
const fail = (status, message, detail) => ({
  success: false,
  message,
  errors: { message: detail || message },
  status,
});
const notFound = (entity) =>
  fail(httpStatus.NOT_FOUND, `${entity} not found`);

const tenantOf = (request) =>
  String(
    (request.query && request.query.tenant) || constants.DEFAULT_TENANT || "airqo",
  ).toLowerCase();

const actorOf = (request) => ({
  by: (request.user && request.user._id) || null,
  by_email: request.user && request.user.email,
});

const historyEntry = (event, actor = {}, detail) => ({
  event,
  at: new Date(),
  by: actor.by || null,
  by_email: actor.by_email,
  ...(detail !== undefined && { detail }),
});

const pick = (source = {}, fields) =>
  fields.reduce((acc, field) => {
    if (source[field] !== undefined) acc[field] = source[field];
    return acc;
  }, {});

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const uniqueEmails = (emails = []) => [
  ...new Set(
    emails
      .filter(Boolean)
      .map((email) => String(email).trim().toLowerCase())
      .filter(Boolean),
  ),
];

const formatDate = (value) =>
  value ? moment.utc(value).format("MMM D, YYYY") : "";

const utcDay = (value) => moment.utc(value).startOf("day");

const pageOf = (request) => ({
  limit: Math.min(parseInt(request.query.limit, 10) || 50, 200),
  skip: Math.max(parseInt(request.query.skip, 10) || 0, 0),
});

const dateRangeFilter = (from, to) => {
  const range = {};
  if (from) range.$gte = utcDay(from).toDate();
  if (to) range.$lt = utcDay(to).add(1, "day").toDate();
  return Object.keys(range).length ? range : undefined;
};

/**
 * Wraps a PDF for the mailer. The mailer logs its params on failure, so the
 * attachment prints as a short summary instead of megabytes of base64.
 */
const pdfAttachment = (filename, buffer) => {
  const summary = { filename, bytes: buffer.length };
  return {
    filename,
    content: buffer.toString("base64"),
    toJSON: () => summary,
    [util.inspect.custom]: () => summary,
  };
};

// The mailer suppresses an identical email sent within its dedup window and
// reports it as a success flagged `duplicate`; that is not a new delivery.
const isDuplicateEmail = (result) => !!(result && result.data && result.data.duplicate);
const DUPLICATE_EMAIL = "an identical email was sent moments ago; try again in a few minutes";

const safeFilename = (value) =>
  String(value || "document").replace(/[^A-Za-z0-9._-]+/g, "_");

// ── Settings ──────────────────────────────────────────────────────────────

const isSet = (value) => value !== undefined && value !== null;

const getSettings = async (tenant) => {
  const stored =
    (await BillingSettingsModel(tenant).findOne({ key: "default" }).lean()) || {};
  const settings = { ...DEFAULT_SETTINGS, seller: { ...DEFAULT_SETTINGS.seller } };
  Object.keys(DEFAULT_SETTINGS).forEach((field) => {
    if (field === "seller") return;
    if (isSet(stored[field])) settings[field] = stored[field];
  });
  Object.entries(stored.seller || {}).forEach(([field, value]) => {
    if (isSet(value)) settings.seller[field] = value;
  });
  settings.updatedAt = stored.updatedAt || null;
  return settings;
};

const settingsView = async (request) =>
  ok("billing settings retrieved", await getSettings(tenantOf(request)));

const updateSettings = async (request) => {
  const tenant = tenantOf(request);
  const { body } = request;
  const update = pick(body, [
    "payment_instructions",
    "default_currency",
    "default_payment_terms_days",
    "default_terms",
    "default_notes",
    "footer",
    "tax_label",
    "default_tax_rate",
    "number_prefix",
    "number_format",
    "sequence_reset",
    "sequence_starts",
    "catalog",
    "billing_cc_emails",
    "reminders_enabled",
    "reminder_days_before_due",
    "reminder_days_after_due",
  ]);
  if (update.billing_cc_emails) {
    update.billing_cc_emails = uniqueEmails(update.billing_cc_emails);
  }
  Object.entries(body.seller || {}).forEach(([field, value]) => {
    update[`seller.${field}`] = value;
  });
  update.updated_by = actorOf(request).by;
  await BillingSettingsModel(tenant).updateOne(
    { key: "default" },
    { $set: update },
    { upsert: true },
  );
  return ok("billing settings updated", await getSettings(tenant));
};

// ── Numbering ─────────────────────────────────────────────────────────────

/**
 * Draws the next document number using the configured format, e.g.
 * AQ-INV-2026-0001. Counters are atomic per kind (and per year when
 * sequence_reset is "yearly"); sequence_starts offsets them.
 */
const nextNumber = async (tenant, kind, settings, date = new Date()) => {
  const year = moment.utc(date).format("YYYY");
  // Without {code} in the format, invoices and pro formas would print
  // identical numbers from separate counters, so they share one series.
  const series =
    kind !== "receipt" && !String(settings.number_format).includes("{code}")
      ? "document"
      : kind;
  const key = settings.sequence_reset === "never" ? series : `${series}:${year}`;
  const Sequence = BillingSequenceModel(tenant);
  let counter;
  try {
    counter = await Sequence.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    ).lean();
  } catch (error) {
    // Two first-of-the-year upserts can race on the unique key; the loser
    // retries against the document the winner created.
    if (error.code !== 11000) throw error;
    counter = await Sequence.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true },
    ).lean();
  }
  const starts = settings.sequence_starts || {};
  const start = Number(series === "document" ? starts.invoice : starts[kind]) || 1;
  const seq = counter.seq + start - 1;
  return formatNumber(settings.number_format, {
    prefix: settings.number_prefix,
    code: KIND_CODES[kind],
    year,
    seq,
  });
};

const formatNumber = (format, { prefix, code, year, seq }) =>
  String(format || DEFAULT_SETTINGS.number_format)
    .replace(/\{prefix\}/g, prefix || "")
    .replace(/\{code\}/g, code)
    .replace(/\{yyyy\}/g, year)
    .replace(/\{yy\}/g, year.slice(-2))
    .replace(/\{seq4\}/g, String(seq).padStart(4, "0"))
    .replace(/\{seq\}/g, String(seq));

const isDuplicateKey = (error) => error && error.code === 11000;

// ── Customers ─────────────────────────────────────────────────────────────

const billToOf = (customer) => ({
  name: customer.name,
  contact_name: customer.contact_name,
  emails: customer.billing_emails || [],
  phone: customer.phone,
  address_lines: customer.address_lines || [],
  city: customer.city,
  country: customer.country,
  postal_code: customer.postal_code,
  tax_id: customer.tax_id,
});

const findGroup = async (tenant, groupId) =>
  GroupModel(tenant).findById(groupId).select("grp_title").lean();

const createCustomer = async (request) => {
  const tenant = tenantOf(request);
  const body = pick(request.body, CUSTOMER_FIELDS);
  if (body.group_id) {
    const group = await findGroup(tenant, body.group_id);
    if (!group) return notFound("organisation");
    body.name = body.name || group.grp_title;
  }
  if (!body.name) {
    return fail(httpStatus.BAD_REQUEST, "name is required when no group_id is given");
  }
  body.billing_emails = uniqueEmails(body.billing_emails);
  body.created_by = actorOf(request).by;
  const customer = await BillingCustomerModel(tenant).create(body);
  return ok("billing customer created", customer.toObject(), httpStatus.CREATED);
};

const listCustomers = async (request) => {
  const tenant = tenantOf(request);
  const { status = "active", search, group_id } = request.query;
  const { limit, skip } = pageOf(request);
  const filter = {};
  if (status !== "all") filter.status = status;
  if (group_id) filter.group_id = group_id;
  if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
  const Customer = BillingCustomerModel(tenant);
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ]);
  return ok("billing customers retrieved", { items, meta: { total, limit, skip } });
};

const outstandingByCurrency = async (tenant, match) => {
  const rows = await InvoiceModel(tenant).aggregate([
    { $match: { ...match, kind: "invoice", status: { $in: PAYABLE_STATUSES } } },
    {
      $group: {
        _id: "$currency",
        amount_due: { $sum: "$amount_due" },
        invoices: { $sum: 1 },
      },
    },
  ]);
  return rows.map((row) => ({
    currency: row._id,
    amount_due: money.roundMoney(row.amount_due, row._id),
    invoices: row.invoices,
  }));
};

const getCustomer = async (request) => {
  const tenant = tenantOf(request);
  const customer = await BillingCustomerModel(tenant)
    .findById(request.params.customerId)
    .lean();
  if (!customer) return notFound("billing customer");
  const [invoice_count, outstanding] = await Promise.all([
    InvoiceModel(tenant).countDocuments({ customer_id: customer._id }),
    outstandingByCurrency(tenant, { customer_id: customer._id }),
  ]);
  return ok("billing customer retrieved", {
    ...customer,
    summary: { invoice_count, outstanding },
  });
};

const updateCustomer = async (request) => {
  const tenant = tenantOf(request);
  const update = pick(request.body, CUSTOMER_FIELDS);
  if (update.billing_emails) update.billing_emails = uniqueEmails(update.billing_emails);
  if (update.group_id && !(await findGroup(tenant, update.group_id))) {
    return notFound("organisation");
  }
  const Customer = BillingCustomerModel(tenant);
  const before = await Customer.findById(request.params.customerId).lean();
  if (!before) return notFound("billing customer");
  const customer = await Customer.findByIdAndUpdate(
    before._id,
    { $set: update },
    { new: true },
  ).lean();

  // Linking (or re-linking) an organisation makes the customer's existing
  // documents visible to that organisation's members.
  if (
    update.group_id !== undefined &&
    String(update.group_id || "") !== String(before.group_id || "")
  ) {
    const groupUpdate = { $set: { group_id: customer.group_id || null } };
    await Promise.all([
      InvoiceModel(tenant).updateMany({ customer_id: customer._id }, groupUpdate),
      PaymentModel(tenant).updateMany({ customer_id: customer._id }, groupUpdate),
    ]);
  }
  // Drafts follow the customer's latest details; issued invoices keep theirs.
  await InvoiceModel(tenant).updateMany(
    { customer_id: customer._id, status: "draft" },
    { $set: { bill_to: billToOf(customer) } },
  );
  return ok("billing customer updated", customer);
};

// ── Invoices ──────────────────────────────────────────────────────────────

const isOverdue = (invoice) =>
  invoice.kind === "invoice" &&
  PAYABLE_STATUSES.includes(invoice.status) &&
  !!invoice.due_date &&
  utcDay(invoice.due_date).isBefore(utcDay());

const serializeInvoice = (invoice, { internal = true } = {}) => {
  const overdue = isOverdue(invoice);
  const view = {
    ...invoice,
    is_overdue: overdue,
    days_overdue: overdue ? utcDay().diff(utcDay(invoice.due_date), "days") : 0,
  };
  if (!internal) INTERNAL_INVOICE_FIELDS.forEach((field) => delete view[field]);
  return view;
};

const serializePayment = (payment, { internal = true } = {}) => {
  const view = { ...payment, method_label: METHOD_LABELS[payment.method] || payment.method };
  if (!internal) delete view.recorded_by;
  return view;
};

/** Applies defaults and computed totals to a draft's editable fields. */
const buildDraft = (fields, customer, settings) => {
  const currency = (fields.currency || customer.currency || settings.default_currency).toUpperCase();
  const draft = {
    ...fields,
    kind: fields.kind || "invoice",
    currency,
    payment_terms_days: fields.payment_terms_days ?? settings.default_payment_terms_days,
    tax_rate: fields.tax_rate ?? settings.default_tax_rate,
    tax_label: fields.tax_label || settings.tax_label,
    terms: fields.terms ?? settings.default_terms,
    notes: fields.notes ?? settings.default_notes,
    footer: fields.footer ?? settings.footer,
    customer_id: customer._id,
    group_id: customer.group_id || null,
    bill_to: billToOf(customer),
  };
  Object.assign(
    draft,
    money.computeTotals({
      line_items: draft.line_items || [],
      discount_amount: draft.discount_amount || 0,
      tax_rate: draft.tax_rate,
      currency,
    }),
  );
  return draft;
};

const loadCustomer = async (tenant, customerId) => {
  const customer = await BillingCustomerModel(tenant).findById(customerId).lean();
  if (!customer) return { error: notFound("billing customer") };
  if (customer.status === "archived") {
    return {
      error: fail(httpStatus.BAD_REQUEST, "billing customer is archived"),
    };
  }
  return { customer };
};

const createInvoice = async (request) => {
  const tenant = tenantOf(request);
  const { customer, error } = await loadCustomer(tenant, request.body.customer_id);
  if (error) return error;
  const settings = await getSettings(tenant);
  const actor = actorOf(request);
  const draft = buildDraft(pick(request.body, EDITABLE_INVOICE_FIELDS), customer, settings);
  const invoice = await InvoiceModel(tenant).create({
    ...draft,
    status: "draft",
    created_by: actor.by,
    history: [historyEntry("created", actor)],
  });
  return ok(`${draft.kind} draft created`, serializeInvoice(invoice.toObject()), httpStatus.CREATED);
};

const updateInvoice = async (request) => {
  const tenant = tenantOf(request);
  const Invoice = InvoiceModel(tenant);
  const existing = await Invoice.findById(request.params.invoiceId).lean();
  if (!existing) return notFound("invoice");
  if (existing.status !== "draft") {
    return fail(httpStatus.CONFLICT, "only draft invoices can be edited");
  }
  const { customer, error } = await loadCustomer(
    tenant,
    request.body.customer_id || existing.customer_id,
  );
  if (error) return error;
  const settings = await getSettings(tenant);
  const fields = {
    ...pick(existing, EDITABLE_INVOICE_FIELDS),
    ...pick(request.body, EDITABLE_INVOICE_FIELDS),
  };
  // A new customer may bill in a different currency than the old one.
  if (request.body.customer_id && !request.body.currency) delete fields.currency;
  const draft = buildDraft(fields, customer, settings);
  const invoice = await Invoice.findOneAndUpdate(
    { _id: existing._id, status: "draft" },
    {
      $set: draft,
      $push: { history: historyEntry("updated", actorOf(request)) },
    },
    { new: true },
  ).lean();
  if (!invoice) return fail(httpStatus.CONFLICT, "invoice is no longer a draft");
  return ok("invoice draft updated", serializeInvoice(invoice));
};

const deleteInvoice = async (request) => {
  const tenant = tenantOf(request);
  const invoice = await InvoiceModel(tenant)
    .findOneAndDelete({ _id: request.params.invoiceId, status: "draft" })
    .lean();
  if (invoice) return ok("invoice draft deleted", { _id: invoice._id });
  const exists = await InvoiceModel(tenant).exists({ _id: request.params.invoiceId });
  return exists
    ? fail(httpStatus.CONFLICT, "only drafts can be deleted; void an issued invoice instead")
    : notFound("invoice");
};

const getInvoice = async (request) => {
  const tenant = tenantOf(request);
  const invoice = await InvoiceModel(tenant).findById(request.params.invoiceId).lean();
  if (!invoice) return notFound("invoice");
  const payments = await PaymentModel(tenant)
    .find({ invoice_id: invoice._id })
    .sort({ paid_at: 1 })
    .lean();
  return ok("invoice retrieved", {
    ...serializeInvoice(invoice),
    payments: payments.map((p) => serializePayment(p)),
  });
};

/** Filters shared by the admin and organisation invoice lists. */
const invoiceFilter = (query) => {
  const filter = {};
  const statuses = query.status ? String(query.status).split(",") : [];
  const wantsOverdue = statuses.includes("overdue");
  const plain = statuses.filter((s) => s !== "overdue");
  if (wantsOverdue) {
    filter.kind = "invoice";
    filter.status = { $in: plain.length ? plain.filter((s) => PAYABLE_STATUSES.includes(s)) : PAYABLE_STATUSES };
    filter.due_date = { $lt: utcDay().toDate() };
  } else if (plain.length) {
    filter.status = { $in: plain };
  }
  if (query.kind) filter.kind = query.kind;
  if (query.customer_id) filter.customer_id = query.customer_id;
  if (query.currency) filter.currency = String(query.currency).toUpperCase();
  const issued = dateRangeFilter(query.from, query.to);
  if (issued) filter.issue_date = issued;
  if (query.search) {
    const pattern = { $regex: escapeRegex(query.search), $options: "i" };
    filter.$or = [
      { invoice_number: pattern },
      { "bill_to.name": pattern },
      { subject: pattern },
      { reference: pattern },
    ];
  }
  return filter;
};

const listInvoicesMatching = async (tenant, filter, request, options) => {
  const { limit, skip } = pageOf(request);
  const Invoice = InvoiceModel(tenant);
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .select(options.internal ? "-history" : undefined)
      .sort({ issue_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  return ok("invoices retrieved", {
    items: items.map((inv) => serializeInvoice(inv, options)),
    meta: { total, limit, skip },
  });
};

const listInvoices = async (request) => {
  const filter = invoiceFilter(request.query);
  if (request.query.group_id) filter.group_id = request.query.group_id;
  return listInvoicesMatching(tenantOf(request), filter, request, { internal: true });
};

/**
 * Emails an issued invoice (PDF attached) to its billing contacts, or to the
 * explicit `to` list. Email failures are reported, never thrown, so that the
 * state change that triggered the email (e.g. finalize) still succeeds.
 */
const emailInvoice = async (
  tenant,
  invoice,
  { to, cc, message, actor = {}, reminder } = {},
) => {
  const recipients = uniqueEmails(to && to.length ? to : (invoice.bill_to || {}).emails);
  if (!recipients.length) {
    return { sent: false, reason: "no billing email on file for this customer" };
  }
  const settings = await getSettings(tenant);
  const copy = uniqueEmails([...(settings.billing_cc_emails || []), ...(cc || [])]).filter(
    (email) => !recipients.includes(email),
  );
  const isProforma = invoice.kind === "proforma";
  const documentTitle = isProforma ? "Pro Forma Invoice" : "Invoice";
  let result;
  try {
    const pdf = pdfAttachment(
      `${safeFilename(invoice.invoice_number)}.pdf`,
      await renderInvoicePdf(invoice),
    );
    const common = {
      email: recipients[0],
      recipients,
      cc: copy,
      pdf,
      tenant,
      customer_name: invoice.bill_to.name,
      invoice_number: invoice.invoice_number,
      amount_due: money.formatMoney(invoice.amount_due, invoice.currency),
      due_date: formatDate(invoice.due_date),
    };
    if (reminder) {
      result = await mailer.invoiceReminder({ ...common, ...reminder });
    } else {
      result = await mailer.invoiceIssued({
        ...common,
        document_title: documentTitle,
        document_label: documentTitle.toLowerCase(),
        total: money.formatMoney(invoice.total, invoice.currency),
        due_label: isProforma ? "Valid until" : "Due date",
        subject: invoice.subject,
        message,
      });
    }
  } catch (error) {
    logger.error(
      `billing email for ${invoice.invoice_number} failed: ${error.message}`,
    );
    return { sent: false, reason: "email could not be queued", to: recipients };
  }
  if (isDuplicateEmail(result)) {
    return { sent: false, duplicate: true, reason: DUPLICATE_EMAIL, to: recipients };
  }
  const event = reminder ? "reminder_sent" : "sent";
  await InvoiceModel(tenant).updateOne(
    { _id: invoice._id },
    {
      ...(!reminder && { $set: { sent_at: new Date() }, $inc: { sent_count: 1 } }),
      $push: {
        history: historyEntry(event, actor, { to: recipients, cc: copy, ...(reminder && { key: reminder.key }) }),
      },
    },
  );
  return { sent: true, to: recipients, cc: copy };
};

const finalizeInvoice = async (request) => {
  const tenant = tenantOf(request);
  const Invoice = InvoiceModel(tenant);
  const existing = await Invoice.findById(request.params.invoiceId).lean();
  if (!existing) return notFound("invoice");
  if (existing.status !== "draft") {
    return fail(httpStatus.CONFLICT, "invoice has already been finalized");
  }
  if (!existing.line_items || !existing.line_items.length) {
    return fail(httpStatus.BAD_REQUEST, "add at least one line item before finalizing");
  }
  const { customer, error } = await loadCustomer(tenant, existing.customer_id);
  if (error) return error;
  const settings = await getSettings(tenant);
  const actor = actorOf(request);

  const issueDate = utcDay(request.body.issue_date || existing.issue_date || new Date());
  const dueDate = utcDay(
    request.body.due_date ||
      existing.due_date ||
      issueDate.clone().add(existing.payment_terms_days || 0, "days"),
  );
  if (dueDate.isBefore(issueDate)) {
    return fail(httpStatus.BAD_REQUEST, "due_date cannot be before issue_date");
  }
  // A supplied number is used as-is, e.g. when recording an invoice that
  // was already issued outside the system.
  const invoiceNumber =
    request.body.invoice_number ||
    (await nextNumber(tenant, existing.kind, settings, issueDate.toDate()));
  if (
    request.body.invoice_number &&
    (await Invoice.exists({ invoice_number: invoiceNumber }))
  ) {
    return fail(httpStatus.CONFLICT, `number ${invoiceNumber} is already in use`);
  }
  const status = money.deriveStatus({
    status: "open",
    total: existing.total,
    amount_paid: 0,
    currency: existing.currency,
  });
  const now = new Date();
  let invoice;
  try {
    invoice = await Invoice.findOneAndUpdate(
      { _id: existing._id, status: "draft" },
      {
        $set: {
          status,
          invoice_number: invoiceNumber,
          issue_date: issueDate.toDate(),
          due_date: dueDate.toDate(),
          bill_to: billToOf(customer),
          group_id: customer.group_id || null,
          seller: settings.seller,
          payment_instructions:
            existing.payment_instructions && existing.payment_instructions.length
              ? existing.payment_instructions
              : settings.payment_instructions,
          amount_paid: 0,
          amount_due: existing.total,
          finalized_at: now,
          ...(status === "paid" && { paid_at: now }),
        },
        $push: { history: historyEntry("finalized", actor, { invoice_number: invoiceNumber }) },
      },
      { new: true },
    ).lean();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return fail(httpStatus.CONFLICT, `number ${invoiceNumber} is already in use`);
  }
  if (!invoice) return fail(httpStatus.CONFLICT, "invoice has already been finalized");

  const email = request.body.send
    ? await emailInvoice(tenant, invoice, { message: request.body.message, actor })
    : { sent: false, reason: "not requested" };
  return ok(`${invoice.kind} ${invoiceNumber} finalized`, {
    invoice: serializeInvoice(invoice),
    email,
  });
};

const loadIssuedInvoice = async (tenant, invoiceId, statuses) => {
  const invoice = await InvoiceModel(tenant).findById(invoiceId).lean();
  if (!invoice) return { error: notFound("invoice") };
  if (!statuses.includes(invoice.status)) {
    return {
      error: fail(
        httpStatus.CONFLICT,
        `this action is not allowed on a ${invoice.status} ${invoice.kind}`,
      ),
    };
  }
  return { invoice };
};

const sendInvoice = async (request) => {
  const tenant = tenantOf(request);
  const { invoice, error } = await loadIssuedInvoice(
    tenant,
    request.params.invoiceId,
    SENDABLE_STATUSES,
  );
  if (error) return error;
  const { to, cc, message } = request.body;
  const email = await emailInvoice(tenant, invoice, {
    to,
    cc,
    message,
    actor: actorOf(request),
  });
  return email.sent
    ? ok(`${invoice.invoice_number} sent`, email)
    : fail(httpStatus.UNPROCESSABLE_ENTITY, `${invoice.invoice_number} was not sent`, email.reason);
};

/**
 * Records that an invoice was delivered outside the system (e.g. emailed by
 * hand), so it counts as sent and becomes eligible for automatic reminders.
 */
const markInvoiceSent = async (request) => {
  const tenant = tenantOf(request);
  const { invoice, error } = await loadIssuedInvoice(
    tenant,
    request.params.invoiceId,
    SENDABLE_STATUSES,
  );
  if (error) return error;
  const sentAt = request.body.sent_at ? new Date(request.body.sent_at) : new Date();
  const updated = await InvoiceModel(tenant).findOneAndUpdate(
    { _id: invoice._id },
    {
      $set: { sent_at: sentAt },
      $inc: { sent_count: 1 },
      $push: {
        history: historyEntry("marked_sent", actorOf(request), {
          sent_at: sentAt,
          note: request.body.note,
        }),
      },
    },
    { new: true },
  ).lean();
  return ok(`${invoice.invoice_number} marked as sent`, serializeInvoice(updated));
};

const reminderContent = (invoice, key) => {
  const days = Math.abs(utcDay(invoice.due_date).diff(utcDay(), "days"));
  return { key, days, overdue: isOverdue(invoice) };
};

const remindInvoice = async (request) => {
  const tenant = tenantOf(request);
  const { invoice, error } = await loadIssuedInvoice(
    tenant,
    request.params.invoiceId,
    PAYABLE_STATUSES,
  );
  if (error) return error;
  if (invoice.kind !== "invoice") {
    return fail(httpStatus.BAD_REQUEST, "reminders apply to invoices only");
  }
  const email = await emailInvoice(tenant, invoice, {
    to: request.body.to,
    cc: request.body.cc,
    actor: actorOf(request),
    reminder: reminderContent(invoice, "manual"),
  });
  return email.sent
    ? ok(`reminder for ${invoice.invoice_number} sent`, email)
    : fail(httpStatus.UNPROCESSABLE_ENTITY, "reminder was not sent", email.reason);
};

const voidInvoice = async (request) => {
  const tenant = tenantOf(request);
  const { invoice, error } = await loadIssuedInvoice(
    tenant,
    request.params.invoiceId,
    ["open", "partially_paid", "paid"],
  );
  if (error) return error;
  if (invoice.amount_paid > 0) {
    return fail(
      httpStatus.CONFLICT,
      "invoice has payments recorded; void those payments first",
    );
  }
  const reason = request.body.reason;
  const voided = await InvoiceModel(tenant).findOneAndUpdate(
    { _id: invoice._id, status: invoice.status, amount_paid: 0 },
    {
      $set: { status: "void", voided_at: new Date(), void_reason: reason, amount_due: 0 },
      $push: { history: historyEntry("voided", actorOf(request), { reason }) },
    },
    { new: true },
  ).lean();
  if (!voided) return fail(httpStatus.CONFLICT, "invoice changed while voiding; retry");
  return ok(`${invoice.invoice_number} voided`, serializeInvoice(voided));
};

/** Turns an accepted pro forma into a new invoice draft. */
const convertProforma = async (request) => {
  const tenant = tenantOf(request);
  const Invoice = InvoiceModel(tenant);
  const { invoice: proforma, error } = await loadIssuedInvoice(
    tenant,
    request.params.invoiceId,
    ["open"],
  );
  if (error) return error;
  if (proforma.kind !== "proforma") {
    return fail(httpStatus.BAD_REQUEST, "only pro forma invoices can be converted");
  }
  const { customer, error: customerError } = await loadCustomer(tenant, proforma.customer_id);
  if (customerError) return customerError;
  const settings = await getSettings(tenant);
  const actor = actorOf(request);
  const fields = pick(proforma, EDITABLE_INVOICE_FIELDS);
  delete fields.issue_date;
  delete fields.due_date;
  const draft = buildDraft({ ...fields, kind: "invoice" }, customer, settings);
  const invoice = await Invoice.create({
    ...draft,
    status: "draft",
    converted_from: proforma._id,
    reference: draft.reference || proforma.invoice_number,
    created_by: actor.by,
    history: [historyEntry("created", actor, { from_proforma: proforma.invoice_number })],
  });
  const converted = await Invoice.findOneAndUpdate(
    { _id: proforma._id, status: "open" },
    {
      $set: { status: "converted", converted_to: invoice._id },
      $push: { history: historyEntry("converted", actor, { invoice_id: invoice._id }) },
    },
  );
  if (!converted) {
    await Invoice.deleteOne({ _id: invoice._id });
    return fail(httpStatus.CONFLICT, "pro forma changed while converting; retry");
  }
  return ok(
    `${proforma.invoice_number} converted to an invoice draft`,
    serializeInvoice(invoice.toObject()),
    httpStatus.CREATED,
  );
};

const invoicePdf = async (tenant, invoice) => ({
  success: true,
  status: httpStatus.OK,
  pdf: await renderInvoicePdf(invoice),
  filename: `${safeFilename(invoice.invoice_number || `draft-${invoice._id}`)}.pdf`,
});

const getInvoicePdf = async (request) => {
  const tenant = tenantOf(request);
  const invoice = await InvoiceModel(tenant).findById(request.params.invoiceId).lean();
  if (!invoice) return notFound("invoice");
  // Drafts have no seller snapshot yet; preview them with current settings.
  if (!invoice.seller) {
    const settings = await getSettings(tenant);
    invoice.seller = settings.seller;
    if (!invoice.payment_instructions || !invoice.payment_instructions.length) {
      invoice.payment_instructions = settings.payment_instructions;
    }
  }
  return invoicePdf(tenant, invoice);
};

// ── Payments & receipts ───────────────────────────────────────────────────

const emailReceipt = async (tenant, payment, invoice, { to, cc, actor = {} } = {}) => {
  const recipients = uniqueEmails(to && to.length ? to : (invoice.bill_to || {}).emails);
  if (!recipients.length) {
    return { sent: false, reason: "no billing email on file for this customer" };
  }
  const settings = await getSettings(tenant);
  const copy = uniqueEmails([...(settings.billing_cc_emails || []), ...(cc || [])]).filter(
    (email) => !recipients.includes(email),
  );
  let result;
  try {
    const pdf = pdfAttachment(
      `${safeFilename(payment.receipt_number)}.pdf`,
      await renderReceiptPdf({ payment, invoice }),
    );
    result = await mailer.paymentReceipt({
      email: recipients[0],
      recipients,
      cc: copy,
      pdf,
      tenant,
      customer_name: invoice.bill_to.name,
      receipt_number: payment.receipt_number,
      invoice_number: invoice.invoice_number,
      amount: money.formatMoney(payment.amount, payment.currency),
      paid_at: formatDate(payment.paid_at),
      method: METHOD_LABELS[payment.method] || payment.method,
      reference: payment.reference,
      balance: money.formatMoney(invoice.amount_due, invoice.currency),
    });
  } catch (error) {
    logger.error(`receipt email for ${payment.receipt_number} failed: ${error.message}`);
    return { sent: false, reason: "email could not be queued", to: recipients };
  }
  if (isDuplicateEmail(result)) {
    return { sent: false, duplicate: true, reason: DUPLICATE_EMAIL, to: recipients };
  }
  await Promise.all([
    PaymentModel(tenant).updateOne(
      { _id: payment._id },
      { $set: { receipt_sent_at: new Date() }, $inc: { receipt_sent_count: 1 } },
    ),
    InvoiceModel(tenant).updateOne(
      { _id: invoice._id },
      {
        $push: {
          history: historyEntry("receipt_sent", actor, {
            receipt_number: payment.receipt_number,
            to: recipients,
          }),
        },
      },
    ),
  ]);
  return { sent: true, to: recipients, cc: copy };
};

/**
 * Moves an invoice's paid amount by `deltaMinor`, guarded by the amount it
 * had when read so concurrent payment changes cannot both apply.
 */
const shiftAmountPaid = async (tenant, invoice, deltaMinor, entry, paidAt = new Date()) => {
  const { currency } = invoice;
  const paidMinor = money.toMinor(invoice.amount_paid, currency) + deltaMinor;
  const totalMinor = money.toMinor(invoice.total, currency);
  const amountPaid = money.fromMinor(paidMinor, currency);
  const status = money.deriveStatus({
    status: invoice.status,
    total: invoice.total,
    amount_paid: amountPaid,
    currency,
  });
  const update = {
    $set: {
      amount_paid: amountPaid,
      amount_due: money.fromMinor(Math.max(totalMinor - paidMinor, 0), currency),
      status,
      ...(status === "paid" && { paid_at: paidAt }),
    },
    ...(status !== "paid" && { $unset: { paid_at: "" } }),
    ...(entry && { $push: { history: entry } }),
  };
  return InvoiceModel(tenant)
    .findOneAndUpdate(
      { _id: invoice._id, status: invoice.status, amount_paid: invoice.amount_paid },
      update,
      { new: true },
    )
    .lean();
};

const recordPayment = async (request) => {
  const tenant = tenantOf(request);
  const { invoice, error } = await loadIssuedInvoice(
    tenant,
    request.params.invoiceId,
    PAYABLE_STATUSES,
  );
  if (error) return error;
  if (invoice.kind !== "invoice") {
    return fail(
      httpStatus.BAD_REQUEST,
      "payments are recorded against invoices; convert this pro forma first",
    );
  }
  const { currency } = invoice;
  const amountMinor = money.toMinor(request.body.amount, currency);
  const dueMinor = money.toMinor(invoice.amount_due, currency);
  if (amountMinor <= 0) {
    return fail(httpStatus.BAD_REQUEST, "amount must be greater than zero");
  }
  if (amountMinor > dueMinor) {
    return fail(
      httpStatus.BAD_REQUEST,
      `amount exceeds the balance due of ${money.formatMoney(invoice.amount_due, currency)}`,
    );
  }
  const settings = await getSettings(tenant);
  const actor = actorOf(request);
  const paidAt = request.body.paid_at ? new Date(request.body.paid_at) : new Date();
  const amount = money.fromMinor(amountMinor, currency);
  const receiptNumber =
    request.body.receipt_number ||
    (await nextNumber(tenant, "receipt", settings, paidAt));
  if (
    request.body.receipt_number &&
    (await PaymentModel(tenant).exists({ receipt_number: receiptNumber }))
  ) {
    return fail(httpStatus.CONFLICT, `receipt number ${receiptNumber} is already in use`);
  }

  const updated = await shiftAmountPaid(
    tenant,
    invoice,
    amountMinor,
    historyEntry("payment_recorded", actor, {
      receipt_number: receiptNumber,
      amount,
      method: request.body.method,
    }),
    paidAt,
  );
  if (!updated) {
    return fail(httpStatus.CONFLICT, "invoice changed while recording the payment; retry");
  }

  let payment;
  try {
    payment = (
      await PaymentModel(tenant).create({
        receipt_number: receiptNumber,
        invoice_id: invoice._id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        group_id: invoice.group_id || null,
        amount,
        currency,
        method: request.body.method,
        reference: request.body.reference,
        paid_at: paidAt,
        notes: request.body.notes,
        recorded_by: actor.by,
      })
    ).toObject();
  } catch (createError) {
    // Undo the invoice change so the balance matches the recorded payments.
    const reverted = await shiftAmountPaid(tenant, updated, -amountMinor, null);
    if (!reverted) {
      logger.error(
        `rollback failed: invoice ${invoice._id} still includes ${amount} ${currency} from unsaved receipt ${receiptNumber}`,
      );
    }
    if (isDuplicateKey(createError)) {
      return fail(httpStatus.CONFLICT, `receipt number ${receiptNumber} is already in use`);
    }
    throw createError;
  }

  const email =
    request.body.send_receipt === false
      ? { sent: false, reason: "not requested" }
      : await emailReceipt(tenant, payment, updated, { actor });
  return ok(
    `payment recorded; receipt ${receiptNumber} issued`,
    {
      payment: serializePayment(payment),
      invoice: serializeInvoice(updated),
      email,
    },
    httpStatus.CREATED,
  );
};

const loadPaymentWithInvoice = async (tenant, paymentId, extraFilter = {}) => {
  const payment = await PaymentModel(tenant)
    .findOne({ _id: paymentId, ...extraFilter })
    .lean();
  if (!payment) return { error: notFound("payment") };
  const invoice = await InvoiceModel(tenant).findById(payment.invoice_id).lean();
  if (!invoice) return { error: notFound("invoice for this payment") };
  return { payment, invoice };
};

const voidPayment = async (request) => {
  const tenant = tenantOf(request);
  const { payment, invoice, error } = await loadPaymentWithInvoice(
    tenant,
    request.params.paymentId,
  );
  if (error) return error;
  if (payment.status === "void") return fail(httpStatus.CONFLICT, "payment is already void");
  const actor = actorOf(request);
  const reason = request.body.reason;
  const amountMinor = money.toMinor(payment.amount, payment.currency);

  const updated = await shiftAmountPaid(
    tenant,
    invoice,
    -amountMinor,
    historyEntry("payment_voided", actor, {
      receipt_number: payment.receipt_number,
      reason,
    }),
  );
  if (!updated) {
    return fail(httpStatus.CONFLICT, "invoice changed while voiding the payment; retry");
  }
  const voided = await PaymentModel(tenant)
    .findOneAndUpdate(
      { _id: payment._id, status: "succeeded" },
      { $set: { status: "void", voided_at: new Date(), void_reason: reason } },
      { new: true },
    )
    .lean();
  if (!voided) {
    const restored = await shiftAmountPaid(tenant, updated, amountMinor, null);
    if (!restored) {
      logger.error(
        `rollback failed: invoice ${invoice._id} is missing ${payment.amount} ${payment.currency} from receipt ${payment.receipt_number}, which was not voided`,
      );
    }
    return fail(httpStatus.CONFLICT, "payment changed while voiding; retry");
  }
  return ok(`receipt ${payment.receipt_number} voided`, {
    payment: serializePayment(voided),
    invoice: serializeInvoice(updated),
  });
};

const paymentFilter = (query) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.method) filter.method = query.method;
  if (query.invoice_id) filter.invoice_id = query.invoice_id;
  if (query.customer_id) filter.customer_id = query.customer_id;
  if (query.currency) filter.currency = String(query.currency).toUpperCase();
  const paid = dateRangeFilter(query.from, query.to);
  if (paid) filter.paid_at = paid;
  if (query.search) {
    const pattern = { $regex: escapeRegex(query.search), $options: "i" };
    filter.$or = [
      { receipt_number: pattern },
      { invoice_number: pattern },
      { reference: pattern },
    ];
  }
  return filter;
};

const listPaymentsMatching = async (tenant, filter, request, options) => {
  const { limit, skip } = pageOf(request);
  const Payment = PaymentModel(tenant);
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ paid_at: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);
  return ok("payments retrieved", {
    items: items.map((p) => serializePayment(p, options)),
    meta: { total, limit, skip },
  });
};

const listPayments = async (request) => {
  const filter = paymentFilter(request.query);
  if (request.query.group_id) filter.group_id = request.query.group_id;
  return listPaymentsMatching(tenantOf(request), filter, request, { internal: true });
};

const getPayment = async (request) => {
  const tenant = tenantOf(request);
  const { payment, invoice, error } = await loadPaymentWithInvoice(
    tenant,
    request.params.paymentId,
  );
  if (error) return error;
  return ok("payment retrieved", {
    ...serializePayment(payment),
    invoice: serializeInvoice(invoice),
  });
};

const receiptPdf = async ({ payment, invoice }) => ({
  success: true,
  status: httpStatus.OK,
  pdf: await renderReceiptPdf({ payment, invoice }),
  filename: `${safeFilename(payment.receipt_number)}.pdf`,
});

const getReceiptPdf = async (request) => {
  const loaded = await loadPaymentWithInvoice(tenantOf(request), request.params.paymentId);
  return loaded.error || receiptPdf(loaded);
};

const sendReceipt = async (request) => {
  const tenant = tenantOf(request);
  const { payment, invoice, error } = await loadPaymentWithInvoice(
    tenant,
    request.params.paymentId,
    { status: "succeeded" },
  );
  if (error) return error;
  const email = await emailReceipt(tenant, payment, invoice, {
    to: request.body.to,
    cc: request.body.cc,
    actor: actorOf(request),
  });
  return email.sent
    ? ok(`receipt ${payment.receipt_number} sent`, email)
    : fail(httpStatus.UNPROCESSABLE_ENTITY, "receipt was not sent", email.reason);
};

// ── Summary ───────────────────────────────────────────────────────────────

const summary = async (request) => {
  const tenant = tenantOf(request);
  const from = request.query.from || moment.utc().startOf("month").format("YYYY-MM-DD");
  const to = request.query.to || moment.utc().format("YYYY-MM-DD");
  const period = dateRangeFilter(from, to);
  const today = utcDay().toDate();
  const Invoice = InvoiceModel(tenant);

  const [outstanding, overdue, invoiced, collected, statuses] = await Promise.all([
    outstandingByCurrency(tenant, {}),
    outstandingByCurrency(tenant, { due_date: { $lt: today } }),
    Invoice.aggregate([
      {
        $match: {
          kind: "invoice",
          status: { $nin: ["draft", "void"] },
          issue_date: period,
        },
      },
      { $group: { _id: "$currency", amount: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    PaymentModel(tenant).aggregate([
      { $match: { status: "succeeded", paid_at: period } },
      { $group: { _id: "$currency", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([{ $group: { _id: { kind: "$kind", status: "$status" }, count: { $sum: 1 } } }]),
  ]);

  const byCurrency = {};
  const row = (currency) =>
    (byCurrency[currency] = byCurrency[currency] || {
      currency,
      outstanding: 0,
      outstanding_invoices: 0,
      overdue: 0,
      overdue_invoices: 0,
      invoiced: 0,
      invoiced_count: 0,
      collected: 0,
      payments_count: 0,
    });
  outstanding.forEach((r) => {
    Object.assign(row(r.currency), { outstanding: r.amount_due, outstanding_invoices: r.invoices });
  });
  overdue.forEach((r) => {
    Object.assign(row(r.currency), { overdue: r.amount_due, overdue_invoices: r.invoices });
  });
  invoiced.forEach((r) => {
    Object.assign(row(r._id), { invoiced: money.roundMoney(r.amount, r._id), invoiced_count: r.count });
  });
  collected.forEach((r) => {
    Object.assign(row(r._id), { collected: money.roundMoney(r.amount, r._id), payments_count: r.count });
  });

  const status_counts = { invoice: {}, proforma: {} };
  statuses.forEach(({ _id, count }) => {
    status_counts[_id.kind] = status_counts[_id.kind] || {};
    status_counts[_id.kind][_id.status] = count;
  });

  return ok("billing summary retrieved", {
    period: { from, to },
    by_currency: Object.values(byCurrency),
    status_counts,
  });
};

// ── Organisation (member) views ───────────────────────────────────────────

const MEMBER_VISIBLE = { status: { $ne: "draft" } };

const groupInvoices = async (request) => {
  const filter = {
    ...invoiceFilter(request.query),
    group_id: request.params.grp_id,
  };
  if (!filter.status) filter.status = MEMBER_VISIBLE.status;
  else filter.status.$nin = ["draft"];
  return listInvoicesMatching(tenantOf(request), filter, request, { internal: false });
};

const findGroupInvoice = async (tenant, groupId, invoiceId) =>
  InvoiceModel(tenant)
    .findOne({ _id: invoiceId, group_id: groupId, ...MEMBER_VISIBLE })
    .lean();

const groupInvoice = async (request) => {
  const tenant = tenantOf(request);
  const invoice = await findGroupInvoice(tenant, request.params.grp_id, request.params.invoiceId);
  if (!invoice) return notFound("invoice");
  const payments = await PaymentModel(tenant)
    .find({ invoice_id: invoice._id, status: "succeeded" })
    .sort({ paid_at: 1 })
    .lean();
  return ok("invoice retrieved", {
    ...serializeInvoice(invoice, { internal: false }),
    payments: payments.map((p) => serializePayment(p, { internal: false })),
  });
};

const groupInvoicePdf = async (request) => {
  const tenant = tenantOf(request);
  const invoice = await findGroupInvoice(tenant, request.params.grp_id, request.params.invoiceId);
  return invoice ? invoicePdf(tenant, invoice) : notFound("invoice");
};

const groupPayments = async (request) => {
  const filter = {
    ...paymentFilter(request.query),
    group_id: request.params.grp_id,
    status: "succeeded",
  };
  return listPaymentsMatching(tenantOf(request), filter, request, { internal: false });
};

const groupReceiptPdf = async (request) => {
  const loaded = await loadPaymentWithInvoice(tenantOf(request), request.params.paymentId, {
    group_id: request.params.grp_id,
    status: "succeeded",
  });
  return loaded.error || receiptPdf(loaded);
};

// ── Reminders (cron) ──────────────────────────────────────────────────────

/**
 * Picks the reminder an invoice is due for today, if any. When the job has
 * missed days, only the most relevant threshold is sent and the skipped ones
 * are marked as done so the customer is not sent a burst of reminders.
 */
const pendingReminder = (invoice, settings, today = utcDay()) => {
  const sent = new Set((invoice.reminders_sent || []).map((r) => r.key));
  const daysUntilDue = utcDay(invoice.due_date).diff(today, "days");
  let eligible;
  if (daysUntilDue >= 0) {
    // A freshly sent invoice does not need a "due soon" nudge.
    if (invoice.sent_at && today.diff(utcDay(invoice.sent_at), "days") < 2) return null;
    eligible = (settings.reminder_days_before_due || [])
      .filter((d) => daysUntilDue <= d)
      .sort((a, b) => a - b)
      .map((d) => `before_${d}`);
  } else {
    eligible = (settings.reminder_days_after_due || [])
      .filter((d) => -daysUntilDue >= d)
      .sort((a, b) => b - a)
      .map((d) => `after_${d}`);
  }
  const unsent = eligible.filter((key) => !sent.has(key));
  if (!unsent.length) return null;
  return { key: unsent[0], markAsSent: unsent };
};

const runInvoiceReminders = async (tenant) => {
  const result = { checked: 0, sent: 0, failed: 0 };
  const settings = await getSettings(tenant);
  if (!settings.reminders_enabled) return result;
  const Invoice = InvoiceModel(tenant);
  const horizon = utcDay()
    .add(Math.max(0, ...(settings.reminder_days_before_due || [0])), "days")
    .add(1, "day")
    .toDate();
  const cursor = Invoice.find({
    kind: "invoice",
    status: { $in: PAYABLE_STATUSES },
    reminders_enabled: { $ne: false },
    // Only invoices the customer is known to have received (emailed from
    // here or marked as sent); backfilled history never triggers reminders.
    sent_at: { $exists: true },
    due_date: { $lt: horizon },
    "bill_to.emails.0": { $exists: true },
  })
    .lean()
    .cursor();

  for await (const invoice of cursor) {
    result.checked += 1;
    const reminder = pendingReminder(invoice, settings);
    if (!reminder) continue;
    // Claim the reminder first so a concurrent run cannot send it twice.
    const claimed = await Invoice.updateOne(
      { _id: invoice._id, "reminders_sent.key": { $ne: reminder.key } },
      {
        $push: {
          reminders_sent: {
            $each: reminder.markAsSent.map((key) => ({ key, sent_at: new Date() })),
          },
        },
      },
    );
    if (!(claimed.nModified ?? claimed.modifiedCount)) continue;
    const email = await emailInvoice(tenant, invoice, {
      reminder: reminderContent(invoice, reminder.key),
    });
    if (email.sent || email.duplicate) {
      result.sent += 1;
    } else {
      result.failed += 1;
      await Invoice.updateOne(
        { _id: invoice._id },
        { $pull: { reminders_sent: { key: { $in: reminder.markAsSent } } } },
      );
    }
  }
  return result;
};

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  settingsView,
  updateSettings,
  nextNumber,
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  finalizeInvoice,
  sendInvoice,
  markInvoiceSent,
  remindInvoice,
  voidInvoice,
  convertProforma,
  getInvoicePdf,
  recordPayment,
  voidPayment,
  listPayments,
  getPayment,
  getReceiptPdf,
  sendReceipt,
  summary,
  groupInvoices,
  groupInvoice,
  groupInvoicePdf,
  groupPayments,
  groupReceiptPdf,
  pendingReminder,
  runInvoiceReminders,
};
