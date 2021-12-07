const axios = require("axios");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("./log");
const jsonify = require("./jsonify");
const constants = require("../config/constants");

const device = {
  getAPIKey: async (channel, callback) => {
    logText("GET_API_KEY...........");
    const tenant = "airqo";
    let url = constants.GET_DEVICES_URL({ tenant, channel });
    logElement("the url inside GET API KEY", url);
    return axios
      .get(url)
      .then(async (response) => {
        let responseJSON = response.data;
        logObject("the response", responseJSON);
        if (responseJSON.success === true) {
          let deviceDetails = responseJSON.devices[0];
          let readKey = deviceDetails.readKey;
          if (!isEmpty(readKey)) {
            const url = constants.DECYPT_DEVICE_KEY_URL;
            return axios
              .post(url, {
                encrypted_key: readKey,
              })
              .then((response) => {
                let decrypted_key = response.data.decrypted_key;
                return callback({
                  success: true,
                  data: decrypted_key,
                  message: "read key successfully retrieved",
                });
              });
          } else {
            return callback({
              success: false,
              message: "readKey unavailable, please update device details",
            });
          }
        } else if (responseJSON.success === false) {
          logObject("GET API false success", responseJSON);
          if (responseJSON.errors) {
            return callback({
              success: false,
              errors: { message: responseJSON.errors },
              message: responseJSON.message,
            });
          } else {
            return callback({
              success: false,
              message: responseJSON.message,
            });
          }
        }
      })
      .catch((error) => {
        logObject("the server error for GET_API _KEY", error.response.data);
        return callback(error.response.data);
      });
  },
};
module.exports = device;
