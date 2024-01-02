const mongoose = require("mongoose");

const functions = {
  GET_GPS: (channel) => {
    return `${channel}`;
  },
};
module.exports = functions;
