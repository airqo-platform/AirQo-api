const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getModelByTenant } = require("@config/database");

/**
 * Invoices and pro forma invoices (quotations).
 *
 * Lifecycle: draft -> open -> partially_paid -> paid, or -> void. A pro forma
 * goes draft -> open -> converted (a new invoice draft is created from it) and
 * never takes payments. Drafts are freely editable and carry no number; the
 * number, seller details and payment instructions are fixed when the document
 * is finalized. "Overdue" is derived (open/partially_paid past due_date).
 */
const LineItemSchema = new Schema(
  {
    item: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit_price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PartySchema = new Schema(
  {
    name: { type: String, trim: true },
    contact_name: { type: String, trim: true },
    emails: { type: [String], default: undefined },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address_lines: { type: [String], default: undefined },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    postal_code: { type: String, trim: true },
    tax_id: { type: String, trim: true },
  },
  { _id: false },
);

const LabelValueSchema = new Schema(
  { label: { type: String, trim: true }, value: { type: String, trim: true } },
  { _id: false },
);

const HistorySchema = new Schema(
  {
    event: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, default: null },
    by_email: { type: String },
    detail: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const InvoiceSchema = new Schema(
  {
    kind: { type: String, enum: ["invoice", "proforma"], default: "invoice" },
    // Left unset on drafts so the partial unique index ignores them.
    invoice_number: { type: String, trim: true },
    status: {
      type: String,
      enum: ["draft", "open", "partially_paid", "paid", "void", "converted"],
      default: "draft",
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "billing_customer",
      required: true,
    },
    group_id: { type: Schema.Types.ObjectId, ref: "group", default: null },
    bill_to: { type: PartySchema, default: () => ({}) },
    seller: { type: PartySchema, default: undefined },
    currency: { type: String, uppercase: true, trim: true, default: "USD" },
    subject: { type: String, trim: true },
    reference: { type: String, trim: true },
    issue_date: { type: Date },
    due_date: { type: Date },
    payment_terms_days: { type: Number, min: 0 },
    line_items: { type: [LineItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    tax_label: { type: String, trim: true },
    tax_rate: { type: Number, default: 0, min: 0, max: 100 },
    tax_amount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amount_paid: { type: Number, default: 0 },
    amount_due: { type: Number, default: 0 },
    notes: { type: String },
    terms: { type: [String], default: undefined },
    footer: { type: String },
    payment_instructions: { type: [LabelValueSchema], default: undefined },
    converted_from: { type: Schema.Types.ObjectId, default: null },
    converted_to: { type: Schema.Types.ObjectId, default: null },
    finalized_at: { type: Date },
    sent_at: { type: Date },
    sent_count: { type: Number, default: 0 },
    paid_at: { type: Date },
    voided_at: { type: Date },
    void_reason: { type: String },
    reminders_enabled: { type: Boolean, default: true },
    reminders_sent: {
      type: [{ _id: false, key: String, sent_at: Date }],
      default: [],
    },
    history: { type: [HistorySchema], default: [] },
    created_by: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true },
);

InvoiceSchema.index(
  { invoice_number: 1 },
  { unique: true, partialFilterExpression: { invoice_number: { $type: "string" } } },
);
InvoiceSchema.index({ status: 1, due_date: 1 });
InvoiceSchema.index({ customer_id: 1, createdAt: -1 });
InvoiceSchema.index({ group_id: 1, status: 1, issue_date: -1 });
InvoiceSchema.index({ issue_date: -1 });

module.exports = (tenant) => getModelByTenant(tenant, "invoice", InvoiceSchema);
