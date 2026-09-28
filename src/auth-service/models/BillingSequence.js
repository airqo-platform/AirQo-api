const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getModelByTenant } = require("@config/database");

/**
 * Atomic counters for document numbers, one per (kind, year), e.g.
 * "invoice:2026" -> 12 gives AQ-INV-2026-0012. Numbers are drawn only when a
 * document is issued, so drafts never consume one.
 */
const BillingSequenceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = (tenant) =>
  getModelByTenant(tenant, "billing_sequence", BillingSequenceSchema);
