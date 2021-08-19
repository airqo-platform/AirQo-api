const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const HTTPStatus = require("http-status");

const photoSchema = new Schema(
  {
    photo_tags: [{ type: String }],
    image_url: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const albumSchema = new Schema({
  device_id: { type: ObjectId },
  site_id: { type: ObjectId },
  user_id: { type: ObjectId },
  user: { type: String },
  device: { type: String },
  site: { type: String },
  name: { type: String },
  photos: [photoSchema],
});

albumSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

albumSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

albumSchema.methods = {
  toJSON() {
    return {
      img: this.img,
    };
  },
};

albumSchema.statics = {
  async register(args) {
    try {
      let createdPhoto = await this.create({
        ...args,
      });
      let data = jsonify(createdPhoto);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "photo created",
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(data)) {
        return {
          success: true,
          message: "photo not created despite successful operation",
          status: HTTPStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      let response = {};
      logObject("the err", e);
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
        errors = err.errors;
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
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
  async list({ filter = {}, _limit = 1000, _skip = 0 } = {}) {
    try {
      logElement("the limit in the model", _limit);
      let data = await this.aggregate()
        .match(filter)
        .lookup({
          from: "devices",
          localField: "_id",
          foreignField: "device_id",
          as: "devices",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          generated_name: 1,
          description: 1,
          airqloud_tags: 1,
          location: 1,
          sites: "$devices",
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully fetched the Photo(s)",
          data,
          status: HTTPStatus.OK,
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "there are no records for this search",
          data,
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      let errors = { message: err.message };
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      }
      return {
        errors,
        message,
        success: false,
        status,
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
      if (modifiedUpdateBody.generated_name) {
        delete modifiedUpdateBody.generated_name;
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
          message: "successfully modified the photo",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "photo does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      }
      return {
        errors,
        message,
        success: false,
        status,
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
          airqloud_tags: 1,
          description: 1,
        },
      };
      let removedAirqloud = await this.findOneAndRemove(filter, options).exec();
      let data = jsonify(removedAirqloud);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the photo",
          data,
          status: HTTPStatus.OK,
        };
      }

      if (isEmpty(data)) {
        return {
          success: false,
          message: "photo does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      let errors = {};
      let message = err.message;
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      }
      return {
        success: false,
        message,
        errors,
        status,
      };
    }
  },
};

module.exports = albumSchema;
