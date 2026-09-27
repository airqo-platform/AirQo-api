const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getModelByTenant } = require("@config/database");

/**
 * A payment received against an invoice. Each payment is also the receipt:
 * it carries its own receipt number and renders as the receipt PDF. A payment
 * recorded in error is voided (never deleted) and stops counting towards the
 * invoice's paid amount.
 */
const BillingPaymentSchema = new Schema(
  {
    receipt_number: { type: String, required: true, trim: true },
    invoice_id: { type: Schema.Types.ObjectId, ref: "invoice", required: true },
    invoice_number: { type: String, trim: true },
    customer_id: { type: Schema.Types.ObjectId, required: true },
    group_id: { type: Schema.Types.ObjectId, default: null },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, uppercase: true, trim: true, required: true },
    method: {
      type: String,
      enum: [
        "bank_transfer",
        "card",
        "mobile_money",
        "cash",
        "cheque",
        "other",
      ],
      default: "bank_transfer",
    },
    reference: { type: String, trim: true },
    paid_at: { type: Date, required: true },
    notes: { type: String },
    status: { type: String, enum: ["succeeded", "void"], default: "succeeded" },
    voided_at: { type: Date },
    void_reason: { type: String },
    receipt_sent_at: { type: Date },
    receipt_sent_count: { type: Number, default: 0 },
    recorded_by: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

BillingPaymentSchema.index({ receipt_number: 1 }, { unique: true });
BillingPaymentSchema.index({ invoice_id: 1, paid_at: 1 });
BillingPaymentSchema.index({ group_id: 1, status: 1, paid_at: -1 });
BillingPaymentSchema.index({ paid_at: -1 });

module.exports = (tenant) =>
  getModelByTenant(tenant, "billing_payment", BillingPaymentSchema);
