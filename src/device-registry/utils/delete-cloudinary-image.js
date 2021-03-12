const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("./log");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const deleteFromCloudinary = (imageID, res, req) => {
  try {
    logText(".....deleting image from cloudinary......");
    cloudinary.v2.uploader.destroy(imageID, function(error, result) {
      if (result) {
        res.status(HTTPStatus.OK).json({
          success: true,
          message: "image deleted successfully",
        });
      } else if (error) {
        callbackErrors(error, req, res);
      }
    });
  } catch (error) {
    tryCatchErrors(res, error);
  }
};

module.exports = deleteFromCloudinary;
