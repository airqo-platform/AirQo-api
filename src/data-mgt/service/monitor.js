const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channels = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios");
const redis = require("../config/redis");
const Monitor = require("../models/Monitor");

const monitor = {
  monitorOutOfRange: () => {},
  incorrectValues: () => {},
  thingOff: () => {
    /***
     * check the last entry age at specific intervals
     * if results has not been received for more than one day, turn the boolean for active to off
     *
     * shall need to first convert the seconds into Hours/days/months and years to make comparisons
     * using a library called Moment
     *
     * store this stuff in a local DB
     *
     *
     */
  },

  dueMaintenance: (cb) => {
    /****
     *
     * first gather all the creation dates of the devices
     * afterwards,
     *
     * calculate the next maintenance dates based on device creation date -
     * input to this function is the device's creation datae
     *
     * using that next maintenance date, calculate the date when the
     *
     * check for maintenance date of the device
     * if the date is 7 days away from current date, turn the maintenance_flag ON for the Thing's schema
     *
     * alternatively, we could take in the device ID and then be able to check the next creation date.
     *
     */
    (function loop() {
      var now = new Date();
      if (
        now.getDate() === 12 &&
        now.getHours() === 12 &&
        now.getMinutes() === 0
      ) {
        cb();
      }
      now = new Date(); // allow for time passing
      var delay = 60000 - (now % 60000); // exact ms to next minute interval
      setTimeout(loop, delay);
    })();
  },
};

module.exports = monitor;
