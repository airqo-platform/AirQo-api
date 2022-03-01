const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("../utils/multitenancy");
const log4js = require("log4js");
const logger = log4js.getLogger("token-model");

const tokenSchema = new Schema({
  userId: {
    type: ObjectId,
    ref: "users",
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
});

tokenSchema.index(
  {
    category: 1,
    userId: 1,
  },
  {
    unique: true,
  }
);

tokenSchema.statics = {
  async create(args) {
    try {
    } catch (err) {}
  },
};

tokenSchema.methods = {};

const tokenModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "event", eventSchema);
};

module.exports = tokenModel;
