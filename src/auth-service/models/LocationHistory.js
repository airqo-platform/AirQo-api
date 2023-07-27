const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
    `${constants.ENVIRONMENT} -- create-location-history-model`
);

const LocationHistorySchema = new mongoose.Schema(
    {
        place_id: {
            type: String,
            required: [true, "place_id is required"],
        },
        name: {
            type: String,
            trim: true,
            required: [true, "name is required"],
        },
        location: {
            type: String,
            trim: true,
            required: [true, "location is required"],
        },
        latitude: {
            type: Number,
            required: [true, "latitude is required!"],
        },
        longitude: {
            type: Number,
            required: [true, "longitude is required!"],
        },
        reference_site: {
            type: ObjectId,
            trim: true,
        },
        firebase_user_id: {
            type: String,
            trim: true,
            required: [true, "firebase_user_id is required!"],
        },
        date_time: {
            type: Date,
            required: [true, "the date_time is required"],
        }
    },
    { timestamps: true }
);

LocationHistorySchema.index({ firebase_user_id: 1, date_time: 1 }, { unique: true });

LocationHistorySchema.pre("save", function (next) {
    return next();
});

LocationHistorySchema.pre("update", function (next) {
    return next();
});

LocationHistorySchema.statics = {
    async register(args) {
        try {
            data = await this.create({
                ...args,
            });
            if (!isEmpty(data)) {
                return {
                    success: true,
                    data,
                    message: "Location History created",
                    status: httpStatus.OK,
                };
            } else if (isEmpty(data)) {
                return {
                    success: true,
                    data: [],
                    message: "operation successful but Location History NOT successfully created",
                    status: httpStatus.ACCEPTED,
                };
            }
        } catch (err) {
            logObject("the error", err);
            logger.error(`Internal Server Error -- ${JSON.stringify(err)}`);
            let response = {};
            if (err.keyValue) {
                Object.entries(err.keyValue).forEach(([key, value]) => {
                    return (response[key] = `the ${key} must be unique`);
                });
            }
            return {
                success: false,
                error: response,
                errors: response,
                message: "validation errors for some of the provided fields",
                status: httpStatus.CONFLICT,
            };
        }
    },

    async list({ skip = 0, limit = 100, filter = {} } = {}) {
        try {
            const inclusionProjection = constants.LOCATION_HISTORIES_INCLUSION_PROJECTION;
            const exclusionProjection = constants.LOCATION_HISTORIES_EXCLUSION_PROJECTION(
                filter.category ? filter.category : "none"
            );
            let pipeline = await this.aggregate()
                .match(filter)
                .sort({ createdAt: -1 })
                .project(inclusionProjection)
                .project(exclusionProjection)
                .skip(skip ? skip : 0)
                .limit(limit ? limit : 100)
                .allowDiskUse(true);

            const location_histories = pipeline;
            if (!isEmpty(location_histories)) {
                return {
                    success: true,
                    data: location_histories,
                    message: "successfully listed the Location Histories",
                    status: httpStatus.OK,
                };
            } else if (isEmpty(location_histories)) {
                return {
                    success: true,
                    message: "no Location Histories exist",
                    data: [],
                    status: httpStatus.OK,
                };
            }
        } catch (error) {
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return {
                success: false,
                message: "internal server error",
                errors: { message: error.message },
                status: httpStatus.INTERNAL_SERVER_ERROR,
            };
        }
    },
    async modify({ filter = {}, update = {} } = {}) {
        try {
            let options = { new: true };
            let modifiedUpdate = update;

            const updatedLocationHistory = await this.findOneAndUpdate(
                filter,
                modifiedUpdate,
                options
            ).exec();

            if (!isEmpty(updatedLocationHistory)) {
                return {
                    success: true,
                    message: "successfully modified the Location History",
                    data: updatedLocationHistory._doc,
                    status: httpStatus.OK,
                };
            } else if (isEmpty(updatedLocationHistory)) {
                return {
                    success: false,
                    message: "Location History does not exist, please crosscheck",
                    errors: { message: "Location History does not exist, please crosscheck" },
                    status: httpStatus.BAD_REQUEST,
                };
            }
        } catch (error) {
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return {
                success: false,
                message: "Internal Server Error",
                errors: { message: error.message },
                status: httpStatus.INTERNAL_SERVER_ERROR,
            };
        }
    },
    async remove({ filter = {} } = {}) {
        try {
            const options = {
                projection: {
                    _id: 1,
                    place_id: 1,
                    name: 1,
                    location: 1,
                    latitude: 1,
                    longitude: 1,
                    firebase_user_id: 1,
                    date_time: 1,
                },
            };
            const removedLocationHistory = await this.findOneAndRemove(
                filter,
                options
            ).exec();

            if (!isEmpty(removedLocationHistory)) {
                return {
                    success: true,
                    message: "successfully removed the Location History",
                    data: removedLocationHistory._doc,
                    status: httpStatus.OK,
                };
            } else if (isEmpty(removedLocationHistory)) {
                return {
                    success: false,
                    message: "Location History does not exist, please crosscheck",
                    errors: { message: "Location History does not exist, please crosscheck" },
                    status: httpStatus.BAD_REQUEST,
                };
            }
        } catch (error) {
            logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
            return {
                success: false,
                message: "Internal Server Error",
                errors: { message: error.message },
                status: httpStatus.INTERNAL_SERVER_ERROR,
            };
        }
    },
};

LocationHistorySchema.methods = {
    toJSON() {
        return {
            _id: this._id,
            name: this.name,
            location: this.location,
            latitude: this.latitude,
            longitude: this.longitude,
            place_id: this.place_id,
            reference_site: this.reference_site,
            firebase_user_id: this.firebase_user_id,
            date_time: this.date_time,
        };
    },
};

module.exports = LocationHistorySchema;
