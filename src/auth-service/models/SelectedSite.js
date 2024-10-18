const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- selected-sites-model`
);
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { logText } = require("@utils/log");

const SelectedSiteSchema = new Schema(
  {
    site_id: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    site_tags: [{ type: String }],
    country: { type: String },
    district: { type: String },
    sub_county: { type: String },
    parish: { type: String },
    county: { type: String },
    generated_name: { type: String },
    name: { type: String },
    lat_long: { type: String },
    city: { type: String },
    formatted_name: { type: String },
    region: { type: String },
    search_name: { type: String },
    approximate_latitude: { type: Number },
    approximate_longitude: { type: Number },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SelectedSiteSchema.pre("save", function (next) {
  return next();
});
SelectedSiteSchema.pre("update", function (next) {
  return next();
});

SelectedSiteSchema.index({ name: 1 }, { unique: true });
SelectedSiteSchema.index({ site_id: 1 }, { unique: true });
SelectedSiteSchema.index({ search_name: 1 }, { unique: true });
SelectedSiteSchema.index({ isFeatured: 1, createdAt: -1 });

SelectedSiteSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "selected site created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data,
          message:
            "Operation successful but selected site NOT successfully created",
          status: httpStatus.OK,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (err.code === 11000) {
        logObject("the err.code again", err.code);
        const duplicate_record = args.email ? args.email : args.userName;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the email and userName must be unique for every selected site";
      } else if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the selected site details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no selected sites exist",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      logText("the selected site modification function........");
      let options = { new: true };
      const fieldNames = Object.keys(update);
      const fieldsString = fieldNames.join(" ");
      let modifiedUpdate = update;
      const updatedSelectedSite = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).select(fieldsString);

      if (!isEmpty(updatedSelectedSite)) {
        return {
          success: true,
          message: "successfully modified the selected site",
          data: updatedSelectedSite._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedSelectedSite)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "selected site does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          site_id: 1,
          name: 1,
          generated_name: 1,
          lat_long: 1,
        },
      };
      const removedSelectedSite = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedSelectedSite)) {
        return {
          success: true,
          message: "Successfully removed the selected site",
          data: removedSelectedSite._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedSelectedSite)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Provided User does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the models error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

SelectedSiteSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      site_id: this.site_id,
      latitude: this.latitude,
      longitude: this.longitude,
      site_tags: this.site_tags,
      country: this.country,
      district: this.district,
      sub_county: this.sub_county,
      parish: this.parish,
      county: this.county,
      generated_name: this.generated_name,
      name: this.name,
      lat_long: this.lat_long,
      city: this.city,
      formatted_name: this.formatted_name,
      region: this.region,
      search_name: this.search_name,
      approximate_latitude: this.approximate_latitude,
      approximate_longitude: this.approximate_longitude,
      isFeatured: this.isFeatured,
    };
  },
};

const SelectedSiteModel = (tenant) => {
  try {
    let sites = mongoose.model("selected_sites");
    return sites;
  } catch (error) {
    let sites = getModelByTenant(tenant, "selected_site", SelectedSiteSchema);
    return sites;
  }
};

module.exports = SelectedSiteModel;
