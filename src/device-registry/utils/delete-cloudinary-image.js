const cloudinary = require("../config/cloudinary");
const { logObject, logElement, logText } = require("./log");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const deleteFromCloudinary = async (imageIDs) => {
  try {
    logText(".....deleting image from cloudinary......");
    cloudinary.api.delete_resources(imageIDs, (error, result) => {
      if (result) {
        logObject("response from cloudinary", result);
        return {
          success: true,
          message: "image delete successfully",
        };
      } else if (error) {
        logObject("unable to delete from cloudinary", error);
        return {
          success: false,
          message: "unable to delete from cloudinary",
          error: error,
        };
      } else {
        logText("we are not sure tsup in the cloudinary deletion util");
        return {
          success: false,
          message: "we are not sure tsup in the cloudinary deletion util",
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
