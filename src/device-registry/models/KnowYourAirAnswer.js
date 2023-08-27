const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const { logElement, logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const HTTPStatus = require("http-status");

const knowYourAirAnswerSchema = new Schema(
    {
        title: {
            type: String,
            required: [true, "the title is required!"],
            unique: true,
        },
        content: {
            required: [true, "the content is required!"],
            type: [String],
            trim: true,
        },
        kya_question: {
            type: ObjectId,
            trim: true,
            ref: "kyaquestion",
        },
    },
    {
        timestamps: true,
    }
);

knowYourAirAnswerSchema.pre("save", function (next) {
    next();
});

knowYourAirAnswerSchema.plugin(uniqueValidator, {
    message: `{VALUE} already taken!`,
});

knowYourAirAnswerSchema.methods = {
    toJSON() {
        return {
            title: this.title,
            content: this.content,
            image: this.image,
            _id: this._id,
        };
    },
};

knowYourAirAnswerSchema.statics = {
    async register(args) {
        try {
            logText("registering a new answer....");
            let modifiedArgs = Object.assign({}, args);
            const createdKnowYourAirAnswer = await this.create({ ...modifiedArgs });
            if (!isEmpty(createdKnowYourAirAnswer)) {
                return {
                    success: true,
                    data: createdKnowYourAirAnswer._doc,
                    message: "answer created",
                    status: HTTPStatus.CREATED,
                };
            } else if (isEmpty(createdKnowYourAirAnswer)) {
                return {
                    success: false,
                    message: "answer not created despite successful operation",
                    status: HTTPStatus.INTERNAL_SERVER_ERROR,
                    errors: { message: "answer not created despite successful operation" },
                };
            }
        } catch (err) {
            logObject("the error", err);
            let response = {};
            let message = "validation errors for some of the provided fields";
            let status = HTTPStatus.CONFLICT;
            if (!isEmpty(err.keyPattern) && err.code === 11000) {
                Object.entries(err.keyPattern).forEach(([key, value]) => {
                    response[key] = "duplicate value";
                    response["message"] = "duplicate value";
                    return response;
                });
            } else if (!isEmpty(err.errors)) {
                Object.entries(err.errors).forEach(([key, value]) => {
                    response.message = value.message;
                    response[key] = value.message;
                    return response;
                });
            }
            return {
                errors: response,
                message,
                success: false,
                status,
            };
        }
    },
    async list({ skip = 0, limit = 1000, filter = {} } = {}) {
        try {
            const inclusionProjection = constants.KYA_ANSWERS_INCLUSION_PROJECTION;
            const exclusionProjection = constants.KYA_ANSWERS_EXCLUSION_PROJECTION(
                filter.category ? filter.category : "none"
            );
            const pipeline = await this.aggregate()
                .match(filter)
                .sort({ createdAt: -1 })
                .lookup({
                    from: "kyaquestions",
                    localField: "kya_question",
                    foreignField: "_id",
                    as: "kyaquestion",
                })
                .project(inclusionProjection)
                .project(exclusionProjection)
                .skip(skip ? skip : 0)
                .limit(
                    limit
                        ? limit
                        : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_KYA_ANSWERS)
                )
                .allowDiskUse(true);

            const response = pipeline;

            if (!isEmpty(response)) {
                logObject("response", response);
                return {
                    success: true,
                    message: "successfully retrieved the answers",
                    data: response,
                    status: HTTPStatus.OK,
                };
            } else if (isEmpty(response)) {
                return {
                    success: true,
                    message: "No answers found for this operation",
                    status: HTTPStatus.OK,
                    data: [],
                };
            }
        } catch (err) {
            logObject("the error", err);
            let response = { message: err.message };
            let message = "validation errors for some of the provided fields";
            let status = HTTPStatus.CONFLICT;
            if (err.code === 11000) {
                if (!isEmpty(err.keyPattern)) {
                    Object.entries(err.keyPattern).forEach(([key, value]) => {
                        response["message"] = "duplicate value";
                        response[key] = "duplicate value";
                        return response;
                    });
                } else {
                    response.message = "duplicate value";
                }
            } else if (!isEmpty(err.errors)) {
                Object.entries(err.errors).forEach(([key, value]) => {
                    response[key] = value.message;
                    response["message"] = value.message;
                    return response;
                });
            }
            return {
                errors: response,
                message,
                success: false,
                status,
            };
        }
    },
    async modify({ filter = {}, update = {}, opts = { new: true } } = {}) {
        try {
            logObject("the filter in the model", filter);
            logObject("the update in the model", update);
            logObject("the opts in the model", opts);
            let modifiedUpdateBody = Object.assign({}, update);
            if (modifiedUpdateBody._id) {
                delete modifiedUpdateBody._id;
            }

            let options = opts;

            logObject("the new modifiedUpdateBody", modifiedUpdateBody);

            const updatedKnowYourAirAnswer = await this.findOneAndUpdate(
                filter,
                modifiedUpdateBody,
                options
            );
            logObject("updatedKnowYourAirAnswer", updatedKnowYourAirAnswer);
            if (!isEmpty(updatedKnowYourAirAnswer)) {
                return {
                    success: true,
                    message: "successfully modified the answer",
                    data: updatedKnowYourAirAnswer._doc,
                    status: HTTPStatus.OK,
                };
            } else if (isEmpty(updatedKnowYourAirAnswer)) {
                return {
                    success: false,
                    message: "No answers found for this operation",
                    status: HTTPStatus.BAD_REQUEST,
                    errors: { message: "No answers found for this operation" },
                };
            }
        } catch (err) {
            logObject("the error", err);
            let response = {};
            let message = "validation errors for some of the provided fields";
            let status = HTTPStatus.CONFLICT;
            if (!isEmpty(err.code) && err.code === 11000) {
                Object.entries(err.keyPattern).forEach(([key, value]) => {
                    response[key] = "duplicate value";
                    response["message"] = "duplicate value";
                    return response;
                });
            } else if (!isEmpty(err.errors)) {
                Object.entries(err.errors).forEach(([key, value]) => {
                    response[key] = value.message;
                    response["message"] = value.message;
                    return response;
                });
            }
            return {
                errors: response,
                message,
                success: false,
                status,
            };
        }
    },
    async remove({ filter = {} } = {}) {
        try {
            const options = {
                projection: {
                    _id: 1,
                    title: 1,
                    content: 1,
                    image: 1,
                },
            };
            const removedKnowYourAirAnswer = await this.findOneAndRemove(
                filter,
                options
            ).exec();
            if (!isEmpty(removedKnowYourAirAnswer)) {
                return {
                    success: true,
                    message: "successfully removed the answer",
                    data: removedKnowYourAirAnswer._doc,
                    status: HTTPStatus.OK,
                };
            } else if (isEmpty(removedKnowYourAirAnswer)) {
                return {
                    success: false,
                    message: "No answers found for this operation",
                    status: HTTPStatus.BAD_REQUEST,
                    errors: { message: "No answers found for this operation" },
                };
            }
        } catch (err) {
            logObject("the error", err);
            let response = {};
            let message = "validation errors for some of the provided fields";
            let status = HTTPStatus.CONFLICT;
            if (!isEmpty(err.code) && err.code === 11000) {
                Object.entries(err.keyPattern).forEach(([key, value]) => {
                    response[key] = "duplicate value";
                    response["message"] = "duplicate value";
                    return response;
                });
            } else if (!isEmpty(err.errors)) {
                Object.entries(err.errors).forEach(([key, value]) => {
                    response[key] = value.message;
                    response["message"] = value.message;
                    return response;
                });
            }
            return {
                errors: response,
                message,
                success: false,
                status,
            };
        }
    },
};

module.exports = knowYourAirAnswerSchema;
