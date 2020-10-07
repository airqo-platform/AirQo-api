const axios = require("axios");
const base_url = "http://34.78.78.202:31002/api/v1/devices/";
const mostRecentFeedsAPI_TS = (channel) => {
  return `https://api.thingspeak.com/channels/${channel}/feeds.json`;
};
const mostRecentFeedsAPI = (channel) => {
  return `https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v1/data/feeds/recent/${channel}`;
};

const singleInsertPartialAPI = (deviceName, ctype) => {
  return `api/v1/devices/components/add/values?device=${deviceName}&component=${deviceName}_${ctype}&tenant=airqo`;
};
const sample_file =
  "https://docs.google.com/spreadsheets/d/1ItQiF5LXhMLq4dRKRX6PqbM3cNMOt0SVtFU3_Zw0OmY/edit#gid=1433489674";

const getChannels = async () => {
  try {
    const channelsAPI = `https://api.thingspeak.com/channels.json?api_key=JQZOU97VDLX7OTDH`;
    console.log("channelsAPI", channelsAPI);
    const response = await axios.get(channelsAPI);
    return response.data;
  } catch (e) {
    console.log(e.message);
  }
};

const main = async () => {
  try {
    const channels = await getChannels();
    channels.map(async (channel) => {
      const deviceName = await getDeviceName(channel);
      console.log("the device names:", deviceName);
      //   const measurements = await getChannelMeasurement(channel);
      //   console.log("the measurements: ", measurements);
      //   const postBody = await transformMeasurements(measurements);
      //   pushData(postBody, deviceName);
    });
  } catch (e) {
    console.log(e.message);
  }
};

const getDeviceName = async (channel) => {
  try {
    console.log("base_url", base_url);
    let response = await axios.get(base_url, {
      params: {
        chid: channel,
        tenant: "airqo",
      },
    });
    console.log(response.data);
    return response.data;
  } catch (e) {
    console.log("get device name", e.message);
  }
};

const getChannelMeasurement = async (channel) => {
  try {
    console.log("the channel for most recent feeds:", channel.id);
    console.log("mostRecentFeedsAPI", await mostRecentFeedsAPI(channel.id));
    let url = await mostRecentFeedsAPI(channel.id);
    let response = await axios.get(url);
    console.log("the measurement", response.data);
    return response.data;
  } catch (e) {
    console.log("get channel measurment:", e.message);
  }
};

const channelData = {
  created_at: "2020-10-06T14:18:48Z",
  field1: " 34.65",
  field2: " 39.45",
  field3: " 35.33",
  field4: " 40.17",
  field5: "0.3577745",
  field6: "32.5842442",
  field7: " 3.22",
  field8:
    "0.000000,0.000000,00000000.00,1109367000000000000000000000.00,0.00,0.00,34.00,34.00,0.00,0.00,0.00",
};

const transformField = async (field) => {
  try {
    switch (field) {
      case "field1":
        return "pm2_5";
      case "field2":
        return "pm10";
      case "field3":
        return "s2_pm2_5";
      case "field4":
        return "s2_pm10";
      case "field5":
        return "latitude";
      case "field6":
        return "longitude";
      case "field7":
        return "battery";
      case "field8":
        return "GpsData";
      default:
        return field;
    }
  } catch (e) {
    console.log(e.message);
  }
};

const transformMeasurements = async (measurement) => {
  try {
    Object.entries(measurement).map(([field, value]) => {
      console.log(`${transformField(field)} : ${value}`);
    });
  } catch (e) {
    console.log(e.message);
  }
};

const generateMeasurementUnit = async (key) => {
  try {
    switch (key) {
      case "humidity":
        return "grams per kg";
      case "temperature":
        return "degree celsius";
      case "battery":
        return "volts";
      case "s2_pm10":
        return "ug/m3";
      case "s2_pm2_5":
        return "ug/m3";
      case "pm10":
        return "ug/m3";
      case "pm2_5":
        return "ug/m3";
      default:
        return "unknown";
    }
  } catch (e) {
    console.log(e.message);
  }
};

const generateQuantityKind = async (key) => {
  try {
    switch (key) {
      case "humidity":
        return "humidity";
      case "temperature":
        return "temperature";
      case "battery":
        return "voltage";
      case "s2_pm10":
        return "particulate matter";
      case "s2_pm2_5":
        return "particulate matter";
      case "pm10":
        return "particulate matter";
      case "pm2_5":
        return "particulate matter";
      default:
        return "unknown";
    }
  } catch (e) {
    console.log(e.message);
  }
};

const prepareRequest = async (ctype, value, frequency, time) => {
  try {
    const deviceValue = {
      value: value,
      raw: value,
      weight: 1,
      frequency: frequency,
      calibratedValue: 24,
      time: time,
      uncertaintyValue: 23,
      standardDeviationValue: 23,
      measurement: {
        quantityKind: generateQuantityKind(ctype),
        measurementUnit: generateMeasurementUnit(ctype),
      },
    };

    return deviceValue;
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
        "singleInsertPartialAPI",
        singleInsertPartialAPI(deviceName, ctype)
      );
      axios
        .post(
          `${base_url}/${singleInsertPartialAPI(deviceName, ctype)}`,
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

main();
