const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const isEmpty = require("is-empty");

const shippingBatchSchema = new Schema(
  {
    batch_name: { type: String, required: true, trim: true },
    devices: [{ type: ObjectId, ref: "device" }],
    device_names: [{ type: String }],
    tenant: { type: String, required: true },
    created_by: { type: ObjectId, ref: "user" },
  },
  { timestamps: true }
);

shippingBatchSchema.methods.toJSON = function() {
  return {
    _id: this._id,
    batch_name: this.batch_name,
    device_count: this.devices ? this.devices.length : 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    tenant: this.tenant,
    created_by: this.created_by,
  };
};

const ShippingBatchModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("shipping_batches");
  } catch (error) {
    return getModelByTenant(dbTenant, "shipping_batch", shippingBatchSchema);
  }
};

module.exports = ShippingBatchModel;
