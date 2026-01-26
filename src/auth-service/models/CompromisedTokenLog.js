const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

const CompromisedTokenLogSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    token: { type: String, required: true },
    ip: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    processed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

CompromisedTokenLogSchema.statics = {
  async logCompromise(details) {
    try {
      const log = await this.create(details);
      return { success: true, data: log };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
};

const CompromisedTokenLogModel = (tenant) => {
  try {
    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

    return getModelByTenant(
      dbTenant,
      "compromised_token_log",
      CompromisedTokenLogSchema,
    );
  } catch (error) {
    throw error;
  }
};

module.exports = CompromisedTokenLogModel;
