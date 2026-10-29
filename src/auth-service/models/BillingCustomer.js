const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getModelByTenant } = require("@config/database");

/**
 * Who invoices are addressed to. A customer can be linked to a platform
 * organisation (group_id) so its members see their invoices and receipts in
 * Nexus, or stand alone for clients billed outside the platform.
 */
const BillingCustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    contact_name: { type: String, trim: true },
    billing_emails: { type: [String], default: [] },
    phone: { type: String, trim: true },
    address_lines: { type: [String], default: [] },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    postal_code: { type: String, trim: true },
    tax_id: { type: String, trim: true },
    currency: { type: String, uppercase: true, trim: true, default: "USD" },
    group_id: { type: Schema.Types.ObjectId, ref: "group", default: null },
    user_id: { type: Schema.Types.ObjectId, ref: "user", default: null },
    notes: { type: String },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    created_by: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

BillingCustomerSchema.index({ status: 1, name: 1 });
BillingCustomerSchema.index({ group_id: 1 });

module.exports = (tenant) =>
  getModelByTenant(tenant, "billing_customer", BillingCustomerSchema);
