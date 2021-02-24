const axios = require("axios");

const constants = ({
  GET_CHANNELS_TS_URI,
  MOST_RECENT_FEEDS_API,
  SINGLE_INSERT_PARTIAL_API,
  DEVICE_REGITRY_BASE_URL,
  SAMPLE_FILE,
  SINGLE_INSERT_PARTIAL,
  DEVICE_REGISTRY_PROD_BASE_URI,
  DEVICE_REGISTRY_STAGE_BASE_UR,
  GET_RECENT_FEEDS,
} = require("../config/constants"));

const main = async () => {
  try {
    const channels = await getChannels();
    channels.map(async (channel) => {
      const deviceName = await getDeviceName(channel);
      console.log("the device names:", deviceName);
      const measurements = await getChannelMeasurement(channel);
      console.log("the measurements: ", measurements);
      const postBody = await transformMeasurements(measurements);
      pushData(postBody, deviceName);
    });
  } catch (e) {
    console.log(e.message);
  }
};

const pushData = async (body, deviceName) => {
  try {
    /***
     * Using the device body, continously insert values
     */
    Object.entries(body).map(([ctype, value]) => {
      /***
       * prepare body for insert
       * insert
       * **/
      let preparedRequest = prepareRequest(
        ctype,
        value,
        "minutes",
        body.created_at
      );
      console.log(
        "SINGLE_INSERT_PARTIAL_API",
        SINGLE_INSERT_PARTIAL_API(deviceName, ctype)
      );
      axios
        .post(
          `${DEVICE_REGITRY_BASE_URL}/${SINGLE_INSERT_PARTIAL_API(
            deviceName,
            ctype
          )}`,
          preparedRequest
        )
        .then((response) => {
          if (response) {
            console.log(response.data);
          }
        })
        .catch((error) => {
          console.log(error.response.data);
        });
    });
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = { main, pushData };
