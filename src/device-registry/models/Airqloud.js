const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("../utils/log");
const jsonify = require("../utils/jsonify");
const isEmpty = require("is-empty");
const constants = require("../config/constants");

const airqloudSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
    },
    generated_name: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "generated name is required!"],
    },
    description: {
      type: String,
      trim: true,
    },
    airqloud_tags: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

airqloudSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

airqloudSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

airqloudSchema.index({ generated_name: 1 }, { unique: true });

airqloudSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

airqloudSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      generated_name: this.generated_name,
      description: this.description,
      airqloud_tags: this.airqloud_tags,
    };
  },
  createAirqloud(args) {
    return this.create({
      ...args,
    });
  },
};

airqloudSchema.statics = {
  async register(args) {
    try {
      let data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "airqloud created",
        };
      } else {
        return {
          success: false,
          message: "airqloud not created despite successful operation",
        };
      }
    } catch (error) {
      return {
        error: error.message,
        message: "Airqloud model server error - register",
        success: false,
      };
    }
  },
  async list({
    _skip = 0,
    _limit = constants.DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS,
    filter = {},
  } = {}) {
    try {
      return this.aggregate()
        .match(filter)
        .lookup({
          from: "airqlouds",
          localField: "_id",
          foreignField: "airqloud_id",
          as: "airqlouds",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          generated_name: 1,
          description: 1,
          airqloud_tags: 1,
          airqlouds: "$airqlouds",
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);
    } catch (error) {
      return {
        success: false,
        message: "Airqloud model server error - list",
        error: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdateBody = update;
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }
      let udpatedUser = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      ).exec();
      let data = jsonify(udpatedUser);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the airqloud",
          data,
        };
      } else {
        return {
          success: false,
          message: "airqloud does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Airqloud model server error - modify",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          name: 1,
          generated_name: 1,
          lat_long: 1,
          country: 1,
        },
      };
      let removedAirqloud = await this.findOneAndRemove(filter, options).exec();
      let data = jsonify(removedAirqloud);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the airqloud",
          data,
        };
      } else {
        return {
          success: false,
          message: "airqloud does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Airqloud model server error - remove",
        error: error.message,
      };
    }
  },
};

airqloudSchema.methods = {};

module.exports = airqloudSchema;
