const mongoose = require("mongoose");
const { Schema } = mongoose;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");

const JobStateSchema = new Schema(
  {
    jobName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastProcessedTime: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

JobStateSchema.statics = {
  async get(jobName) {
    try {
      const record = await this.findOne({ jobName }).lean();
      return record ? record.lastProcessedTime : null;
    } catch (error) {
      // Log error but don't crash the job
      console.error(`Error getting job state for ${jobName}:`, error);
      return null;
    }
  },

  async set(jobName, lastProcessedTime) {
    try {
      await this.updateOne(
        { jobName },
        { $set: { lastProcessedTime } },
        { upsert: true }
      );
    } catch (error) {
      // Log error but don't crash the job
      console.error(`Error setting job state for ${jobName}:`, error);
    }
  },
};

const JobStateModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = tenant ? tenant.toLowerCase() : defaultTenant;
  try {
    // Attempt to retrieve existing model
    return mongoose.model("jobstates");
  } catch (error) {
    // If model doesn't exist, create it
    return getModelByTenant(dbTenant, "jobstate", JobStateSchema);
  }
};

module.exports = JobStateModel;
