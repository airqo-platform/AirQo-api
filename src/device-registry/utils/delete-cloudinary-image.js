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

const deleteFromCloudinary = async (imageID) => {
  try {
    logText(".....deleting image from cloudinary......");
    cloudinary.uploader.destroy(imageID, function(error, result) {
      if (result) {
        return {
          success: true,
          message: "image delete successfully",
        };
      } else if (error) {
        logElement("unable to delete", error);
        return {
          success: false,
          message: "unable to delete from cloud",
          error: error,
        };
      }
    });
  } catch (error) {
    logElement("server error", error.message);
    return {
      success: false,
      message: "server error",
      error: error.message,
    };
  }
};

module.exports = { deleteFromCloudinary };
