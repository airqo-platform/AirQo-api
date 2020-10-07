const constants = require("../config/constants");

const getChannels = async () => {
  axios
    .get(constants.GET_CHANNELS_TS_URI)
    .then((response) => {})
    .catch((e) => {});
};
const getChannelData = async () => {};

const transformData = async () => {};
