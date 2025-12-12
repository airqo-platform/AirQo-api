const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- selected-sites-model`
);

const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { logObject, logText } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

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
        return createSuccessResponse("create", data, "selected site", {
          message: "selected site created",
        });
      } else {
        return createEmptySuccessResponse(
          "selected site",
          "Operation successful but selected site NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

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
      } else {
        response = { message: err.message };
      }

      return {
        success: false,
        message,
        status,
        errors: response,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);

      return {
        success: true,
        data: response,
        message: "successfully retrieved the selected site details",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "selected site");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      logText("the selected site modification function........");
      const options = { new: true };

      // Preserve dynamic field selection logic
      const fieldNames = Object.keys(update);
      const fieldsString = fieldNames.join(" ");
      const modifiedUpdate = update;

      const updatedSelectedSite = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).select(fieldsString);

      if (!isEmpty(updatedSelectedSite)) {
        return createSuccessResponse(
          "update",
          updatedSelectedSite._doc,
          "selected site"
        );
      } else {
        return createNotFoundResponse(
          "selected site",
          "update",
          "selected site does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "selected site");
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
        return createSuccessResponse(
          "delete",
          removedSelectedSite._doc,
          "selected site",
          {
            message: "Successfully removed the selected site",
          }
        );
      } else {
        return createNotFoundResponse(
          "selected site",
          "delete",
          "Selected site does not exist, please crosscheck"
        );
      }
    } catch (error) {
      logObject("the models error", error);
      return createErrorResponse(error, "delete", logger, "selected site");
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
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let sites = mongoose.model("selected_sites");
    return sites;
  } catch (error) {
    let sites = getModelByTenant(dbTenant, "selected_site", SelectedSiteSchema);
    return sites;
  }
};

module.exports = SelectedSiteModel;
