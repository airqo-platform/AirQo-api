const { Schema, model } = require("mongoose");
const { generateMonthsInfront } = require("../utils/date");

const today = Date.now();

const activitySchema = new Schema(
  {
    device: { type: String, trim: true },
    site: { type: String, trim: true },
    date: { type: Date },
    description: { type: String, trim: true },
    activityType: { type: String, trim: true },
    tags: [{ type: String }],
    nextMaintenance: { type: Date, default: generateMonthsInfront(today, 3) },
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
      location: this.location,
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
