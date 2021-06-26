const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const locationSchema = new mongoose.Schema(
  {
    parish: {
      type: String,
    },
    district: {
      type: String,
    },
    region: {
      type: String,
    },
    country: {
      type: String,
    },
    village: {
      type: String,
    },
    subCounty: {
      type: String,
    },
    county: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

locationSchema.pre("save", function(next) {
  return next();
});

locationSchema.pre("update", function(next) {
  return next();
});

locationSchema.pre("findByIdAndUpdate", function(next) {
  return next();
});

locationSchema.methods = {
  toJSON() {
    return {
      id: this._id,
      parish: this.parish,
      region: this.region,
      county: this.county,
      village: this.village,
      subCounty: this.subCounty,
      country: this.country,
      district: this.district,
    };
  },
};

// I will add the check for the user after setting up the communications between services
locationSchema.statics = {
  createDevice(args) {
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

module.exports = locationSchema;
