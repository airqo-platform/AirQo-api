const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Schema.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");

const DefaultsSchema = new mongoose.Schema({
  pollutant: {
    type: String,
    trim: true,
    required: [true, "pollutant is required!"],
  },
  frequency: {
    type: String,
    required: [true, "frequency is required!"],
  },
  startDate: {
    type: Date,
    required: [true, "startDate is required!"],
  },
  endDate: {
    type: Date,
    required: [true, "endDate is required!"],
  },
  default: {
    type: ObjectId,
    required: [true, "default is required!"],
    unique: false,
  },
  chartType: {
    type: String,
    required: [true, "chartTyoe is required!"],
  },
  chartTitle: {
    type: String,
    required: [true, "chartTitle is required!"],
    unique: false,
  },
  locations: [
    {
      type: String,
    },
  ],
  period: { type: String, required: [true, "period is required!"] },
});

DefaultsSchema.plugin(uniqueValidator);

DefaultsSchema.index(
  {
    chartTitle: 1,
    default: 1,
  },
  {
    unique: true,
  }
);

DefaultsSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      pollutant: this.pollutant,
      frequency: this.frequency,
      startDate: this.startDate,
      endDate: this.endDate,
      default: this.default,
      chartType: this.chartType,
      chartTitle: this.chartTitle,
      locations: this.locations,
      period: this.period,
    };
  },
};

DefaultsSchema.statics = {
  async register(args) {
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "default created",
      };
    } catch (error) {
      return {
        error: error.message,
        message: "Default model server error",
        success: false,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let defaults = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      let data = jsonify(defaults);
      return {
        success: true,
        data,
        message: "successfully listed the defaults",
      };
    } catch (error) {
      return {
        success: false,
        message: "unable to list the defaults",
        error: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let udpatedDefault = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      let data = jsonify(udpatedDefault);
      logObject("updatedDefault", data);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the default",
          data,
        };
      } else {
        return {
          success: false,
          message: "default does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedDefault = await this.findOneAndRemove(filter, options).exec();
      logElement("removedDefault", removedDefault);
      let data = jsonify(removedDefault);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the default",
          data,
        };
      } else {
        return {
          success: false,
          message: "default does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
      };
    }
  },
};

module.exports = DefaultsSchema;
