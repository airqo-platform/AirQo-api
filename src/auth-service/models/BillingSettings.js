const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getModelByTenant } = require("@config/database");

/**
 * One document per tenant (key "default") holding the seller details, bank /
 * payment instructions and defaults printed on invoices and receipts. Issued
 * invoices keep a snapshot, so editing these never rewrites past documents.
 */
const LabelValueSchema = new Schema(
  { label: { type: String, trim: true }, value: { type: String, trim: true } },
  { _id: false },
);

const BillingSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    seller: {
      name: { type: String, trim: true },
      address_lines: { type: [String], default: undefined },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      website: { type: String, trim: true },
      tax_id: { type: String, trim: true },
    },
    payment_instructions: { type: [LabelValueSchema], default: undefined },
    default_currency: { type: String, uppercase: true, trim: true },
    default_payment_terms_days: { type: Number, min: 0 },
    default_terms: { type: [String], default: undefined },
    default_notes: { type: String },
    footer: { type: String },
    tax_label: { type: String, trim: true },
    default_tax_rate: { type: Number, min: 0, max: 100 },
    number_prefix: { type: String, trim: true },
    number_format: { type: String, trim: true },
    sequence_reset: { type: String, enum: ["yearly", "never"] },
    sequence_starts: {
      invoice: { type: Number, min: 1 },
      proforma: { type: Number, min: 1 },
      receipt: { type: Number, min: 1 },
    },
    catalog: {
      type: [
        {
          _id: false,
          item: { type: String, trim: true },
          description: { type: String, trim: true },
          unit_price: { type: Number, min: 0 },
          currency: { type: String, uppercase: true, trim: true },
        },
      ],
      default: undefined,
    },
    // Finance inboxes copied on every invoice, receipt and reminder email.
    billing_cc_emails: { type: [String], default: undefined },
    reminders_enabled: { type: Boolean },
    reminder_days_before_due: { type: [Number], default: undefined },
    reminder_days_after_due: { type: [Number], default: undefined },
    updated_by: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

module.exports = (tenant) =>
  getModelByTenant(tenant, "billing_setting", BillingSettingsSchema);
