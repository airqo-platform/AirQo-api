const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");

const DashboardAnalyticsSchema = new Schema(
  {
    tenant: {
      type: String,
      required: true,
      unique: true, // Only one analytics document per tenant
    },
    userSatisfaction: { type: Number },
    dailyActiveUsers: { type: Number },
    dailyActiveUsersChange: { type: Number },
    featureAdoptionRate: { type: Number },
    featureAdoptionRateChange: { type: Number },
    extendedUserSessionDuration: { type: Number },
    increasedUserDataContribution: { type: Number },
    stakeholderDecisionMaking: { type: Number },
    userSegments: { type: Array },
    behavioralInsights: { type: Object },
    lastUpdated: { type: Date },
  },
  { timestamps: true }
);

DashboardAnalyticsSchema.statics = {
  async findOneOrCreate(tenant, data) {
    try {
      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      };
      return await this.findOneAndUpdate({ tenant }, data, options);
    } catch (error) {
      throw error;
    }
  },
};

const DashboardAnalyticsModel = (tenant) => {
  return getModelByTenant(
    tenant,
    "dashboard_analytic",
    DashboardAnalyticsSchema
  );
};

module.exports = DashboardAnalyticsModel;
