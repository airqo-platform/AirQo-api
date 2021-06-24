const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const settingSchema = new Schema(
  {
    maintenance_window: {
      type: Number,
      required: [true, "The name is required"],
      trim: true,
    },
    overdue_window: {
      type: Number,
      required: [true, "The name is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

settingSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

settingSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

settingSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      maintenance_window: this.maintenance_window,
      overdue_window: this.maintenance_window,
      createdAt: this.createdAt,
    };
  },
};

settingSchema.statics = {
  createSetting(args) {
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

module.exports = settingSchema;
