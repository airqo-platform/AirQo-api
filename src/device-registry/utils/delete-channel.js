const axios = require("axios");
const constants = require("../config/constants");
const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("./log");

const deleteChannel = async (channel, device, error, req, res) => {
  try {
    if (!channel) {
      return {
        message: "the channel is missing in the request body",
        success: false,
      };
    }
    logText("deleting device from TS.......");
    logElement("the channel ID", channel);
    await axios
      .delete(constants.DELETE_THING_URL(channel))
      .then(async (response) => {
        logText("successfully deleted device from TS");
        logObject("TS response data", response.data);
        res.status(HTTPStatus.BAD_GATEWAY).json({
          message: "cancelled operation after failure to create device",
          success: false,
          device,
          error,
        });
      })
      .catch(function(error) {
        logElement("unable to delete device from TS", error);
        res.status(HTTPStatus.BAD_GATEWAY).json({
          message: "unable to delete device from TS",
          success: false,
          channel,
        });
      });
  } catch (e) {
    logElement("server side error", e.message);
    return {
      message: "unable to carry out the entire deletion of device",
      success: false,
    };
  }
};

module.exports = deleteChannel;
