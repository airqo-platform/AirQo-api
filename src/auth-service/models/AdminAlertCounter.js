const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

const AdminAlertCounterSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  emailType: { type: String, required: true },
  count: { type: Number, default: 0 },
  createdAt: { type: Date, expires: "3d", default: Date.now }, // TTL for 3 days
});

AdminAlertCounterSchema.index({ date: 1, emailType: 1 }, { unique: true });

const AdminAlertCounterModel = (tenant) => {
  try {
    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

    return getModelByTenant(
      dbTenant,
      "admin_alert_counter",
      AdminAlertCounterSchema,
    );
  } catch (error) {
    throw error;
  }
};

module.exports = AdminAlertCounterModel;
