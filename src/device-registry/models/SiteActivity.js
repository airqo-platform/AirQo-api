const { Schema, model } = require("mongoose");
function threeMonthsFromNow() {
  let d = new Date();
  let targetMonth = d.getMonth() + 3;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const activitySchema = new Schema(
  {
    device: { type: String, trim: true },
    siteID: { type: String, trim: true },
    date: { type: Date },
    description: { type: String, trim: true },
    activityType: { type: String, trim: true },
    tags: [{ type: String }],
    nextMaintenance: { type: Date, default: threeMonthsFromNow },
    maintenanceType: { type: String },
    createdAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      device: this.device,
      site: this.siteID,
      date: this.date,
      description: this.description,
      activityType: this.activityType,
      maintenanceType: this.maintenanceType,
      nextMaintenance: this.nextMaintenance,
      createdAt: this.createdAt,
      tags: this.tags,
    };
  },
};

activitySchema.statics = {
  createLocationActivity(args) {
    return this.create({
      ...args,
    });
  },

  list({ skip = 0, limit = 5, filter = {} } = {}) {
    return this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
};

module.exports = activitySchema;
