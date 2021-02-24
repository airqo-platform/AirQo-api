const axios = require("axios");
const { parentPort, workerData, isMainThread } = require("worker_threads");
const DEVICE_REGISTRY_BASE_URI = "http://34.78.78.202:31002/api/v1/devices";
const LOCAL_DEVICE_REGISTRY_BASE_URI = "localhost:3000/api/v1/devices";
const MOST_RECENT_FEEDS_URI_TS = (channel) => {
  return `https://api.thingspeak.com/channels/${channel}/feeds.json`;
};
const MOST_RECENT_FEEDS_URI = (channel) => {
  return `https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v1/data/feeds/recent/${channel}`;
};

const SINGLE_INSERT_PARTIAL_URI = (deviceName, ctype, organisation) => {
  return `components/add/values?device=${deviceName}&component=${deviceName}_${ctype}&tenant=${organisation}`;
};

const BULK_INSERT_PARTIAL_URI = (deviceName, ctype, organisation) => {
  return `components/add/values/bulk?device=${deviceName}&component=${deviceName}_${ctype}&tenant=${organisation}`;
};

const sample_file =
  "https://docs.google.com/spreadsheets/d/1ItQiF5LXhMLq4dRKRX6PqbM3cNMOt0SVtFU3_Zw0OmY/edit#gid=1433489674";

const getChannels = async () => {
  try {
    const channelsAPI = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;
    console.log("channelsAPI", channelsAPI);
    const response = await axios.get(channelsAPI);
    return response.data;
  } catch (e) {
    console.log(e.message);
  }
};

async function main(req, res) {
  //   try {
  //     const channels = await getChannels();
  //     let arrayCopy = [...channels];
  //     if (arrayCopy.length === 0) {
  //       console.log("finished processing");
  //     } else {
  //       console.log("processing the chunk");
  //       const subarray = arrayCopy.splice(0, 10);
  //       for (const item of subarray) {
  //         /**
  //          * add the operations for the data manipulations
  //          */
  //         await processChunk(item);
  //       }
  //       /**
  //        * putting the function back in the queue
  //        */
  //       setImmediate(main);
  //     }
  //   } catch (e) {
  //     console.log("error in main: ", e.message);
  //   }
  // };

  // const processChunk = async (channel) => {
  try {
    const dataArray = await getChannels();
    dataArray.map(async (channel) => {
      // console.log(channel.id);
      /*****************************************************************
       * ALGORITHM
       * Using the channel ID, use it to get the measurement of that channel
       * After getting the channel measurement...
       * Transform the measurement
       * After transforming these measurements....
       * search for the component type using the quantity kind detail of the device measurements.
       * check out the timestamp to ensure that it is greater than the recently stored one
       * Search for the device name using the channel ID
       * Using the device name and component type, proceed with the insertion using the bulk insert endpoint
       *
       * Go to the next channel ID and repeat the process/loop above
       ******************************************************************/

      /***
       * POLLING FOR NEW MEASUREMENTS
       * We shall handle the scheduling using the cloud tools
       */

      /***
       * GETTING THE MEASUREMENTS
       */
      const measurement = await getChannelMeasurement(channel.id);
      // console.log("the measurement", measurement);

      /***
       * ARE THE MEASUREMENTS NEW?
       * We shall just assume that this measurement is knew
       * Or just compoare with the timetamp of the previous measurement somewhere
       * Or just add validation in our database
       * We also need to know the sampling rate of the measurements on the network
       */

      /**
       * TRANSFORM THE MEASUREMENT
       */
      let transformedBody = {};
      if (measurement) {
        transformedBody = await transformMeasurement(measurement);
      } else {
        transformedBody = {};
      }

      // console.log("transformed measurement: ", transformedBody);
      // console.log("transformed measurement time: ", transformedBody.created_at);
      let measurementTime = "";
      if (transformedBody) {
        measurementTime = transformedBody.created_at;
      } else {
        measurementTime = "";
      }

      /****
       * SANITISE THE BODY
       */
      const sanitisedBody = sanitiseBody(transformedBody);
      // console.log("sanitised body: ", sanitisedBody);

      /**
       * GET DEVICE NAME
       */
      const deviceName = await getDeviceName(channel.id);
      // console.log("the device name:", deviceName);

      /***
       *COMPARE MEASUREMENT TIMESTAMP AND LAST OF COMPONENT EVENT
       */

      /***
       * GENERATE POST BODY FOR EACH MEASUREMENT FIELD AND PUSH IT
       */

      // console.log("the time in the main", time);
      pushData(sanitisedBody, deviceName, "airqo", measurementTime);
      // pushBulkData(sanitisedBody, deviceName, "airqo");
      // });
    });
  } catch (e) {
    console.log("error in process chunk", e.message);
  }
}

const getDeviceName = async (channel) => {
  try {
    // console.log("DEVICE_REGISTRY_BASE_URI", DEVICE_REGISTRY_BASE_URI);
    let response = await axios.get(DEVICE_REGISTRY_BASE_URI, {
      params: {
        chid: channel,
        tenant: "airqo",
      },
    });
    if (response.data.device) {
      return response.data.device.name;
    } else {
      return `notfound`;
    }
  } catch (e) {
    console.log("GET DEVICE NAME ERROR: ", e.message);
  }
};

const generatePostBody = (ctype, value, frequency, time) => {
  // console.log("the time", time);
  let pushBody = {};
  let {
    uncertaintyValue,
    calibratedValue,
    standardDeviationValue,
  } = calibrateValue(value);
  pushBody.calibratedValue = calibratedValue;
  pushBody.time = time;
  pushBody.raw = value;
  pushBody.weight = 1;
  pushBody.value = value;
  pushBody.frequency = frequency;
  pushBody.uncertaintyValue = uncertaintyValue;
  pushBody.standardDeviationValue = standardDeviationValue;
  pushBody.measurement = {};
  pushBody.measurement.measurementUnit = generateMeasurementUnit(ctype);
  pushBody.measurement.quantityKind = generateQuantityKind(ctype);
  return pushBody;
};

// const updateDHT11 = (ctype, value, frequency, time) => {
//   // generateComponentType(ctype);
//   // generatePostBody(ctype, value, frequency, time);
// };

// const updatePMS5003_1 = (value) => {};

// const generatePMS5003_2 = (value) => {};

// const generateBATTERY = (value) => {};

const generateBulkPostBody = (ctype, value, frequency, time) => {
  console.log("the value", value);
  /**
   * generate body for component type
   * then push it to respective component type array
   * Afterwards, just return
   *
   */

  let DHT11 = [];
  let pms5003_1 = [];
  let pms5003_2 = [];
  let battery = [];

  let response = {
    DHT11: [{}, {}],
    pms5003_1: [{}, {}],
    pms5003_2: [{}, {}],
    battery: [{}, {}],
  };

  generateComponentType(ctype);
  generatePostBody(ctype, value, frequency, time);

  switch (ctype) {
    case "DHT11":
      updateDHT11(value);
    case "pms5003_1":
      updatePMS5003_1(value);
    case "pms5003_2":
      generatePMS5003_2(value);
    case "battery":
      generateBATTERY(value);
  }
  /***
   * DHT11:
   * Internal Temperature
   * Internal Humidity
   *
   * battery:
   * Battery Voltage
   * 
   * pms5003_1:
   * PM 2.5
   * PM10
   * 
   * pms5003_2:
   * PM 2.5
   * PM10
   
   *
   */
  let sampleValues = [
    {
      value: 60,
      raw: 60,
      weight: 1,
      frequency: "day",
      // calibratedValue: 24,
      time: "2020-09-13T06:41:28.774Z",
      // uncertaintyValue: 23,
      // standardDeviationValue: 23,
      // measurement: {
      //   quantityKind: "temperature",
      //   measurementUnit: "celsius",
      // },
    },
    {},
  ];

  /**
   * iterate over each of these measurements to
   * generate the ML parameters AND the measurement object
   */
  // let accArray = [];
  // let newArray = values.reduce(
  //   accArray,
  //   (measurement) => {
  //     /**
  //      * modify a few things in the array and return the rest
  //      */
  //     return [
  //       ...accArray,
  //       ...generatePostBody(
  //         measurement.quantityKind,
  //         measurement.value,
  //         measurement.frequency,
  //         measurement.time
  //       ),
  //     ];
  //   },
  //   []
  // );
  // return newArray;
};

const calibrateValue = (value) => {
  let uncertaintyValue = value * 2 + 0.5;
  let calibratedValue = value * 3 + 0.2;
  let standardDeviationValue = value * 0.5 + 0.12;

  return { uncertaintyValue, calibratedValue, standardDeviationValue };
};

const generateDay = (ISODate) => {
  date = new Date(ISODate);
  year = date.getFullYear();
  month = date.getMonth() + 1;
  dt = date.getDate();

  if (dt < 10) {
    dt = "0" + dt;
  }
  if (month < 10) {
    month = "0" + month;
  }
  return `${year}-${month}-${dt}`;
};

const getTime = (ISODate) => {
  date = new Date(ISODate);
  time = date.getTime();
  return time;
};

const getDate = (ISODate) => {
  date = new Date(ISODate);
  return date;
};

const isMeasurementNew = async (measurement, componentName) => {
  /**
   * extract the day from the component measurement
   * On that day, get the last Event time for this component
   * compare the last event time with the one of the measurements
   */

  const getEventsURL = `${DEVICE_REGISTRY_BASE_URI}/components/values`;

  let response = await axios.get(getEventsURL, {
    params: {
      comp: componentName,
      day: generateDay(measurement.created_at),
    },
  });
  console.log("the response for component feeds", response.data);
  if (getDate(measurement.created_at) < getDate(response.data.last)) {
    return false;
  } else {
    return true;
  }
};

const getChannelMeasurement = async (channel) => {
  try {
    // console.log("the channel for most recent feeds:", channel);
    // console.log("MOST_RECENT_FEEDS_URI", await MOST_RECENT_FEEDS_URI(channel));
    let url = await MOST_RECENT_FEEDS_URI(channel);
    let response = await axios.get(url);
    let res = { channel: channel, ...response.data };
    return res;
  } catch (e) {
    console.log("get channel measurment error: ", e.response.data);
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

const transformField = (field) => {
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

const transformMeasurement = async (measurement) => {
  try {
    let newObj = await Object.entries(measurement).reduce(
      (newObj, [field, value]) => {
        let transformedField = transformField(field);
        return { ...newObj, [transformedField]: value };
      },
      {}
    );
    return newObj;
  } catch (e) {
    console.log(e.message);
  }
};

const generateMeasurementUnit = (key) => {
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

const generateQuantityKind = (key) => {
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

const generateComponentType = (ctype) => {
  switch (ctype) {
    case "pm2_5":
      return "pms5003_1";
    case "pm10":
      return "pms5003_1";
    case "s2_pm2_5":
      return "pms5003_2";
    case "s2_pm10":
      return "pms5003_2";
    case "humidity":
      return "DHT11";
    case "temperature":
      return "DHT11";
    case "battery":
      return "battery";
    default:
      return "unknown";
  }
};

const sanitiseBody = (body) => {
  let sanitisedBody = body;
  delete sanitisedBody.created_at;
  delete sanitisedBody.channel;
  delete sanitisedBody.latitude;
  delete sanitisedBody.longitude;
  // delete sanitisedBody.battery;
  delete sanitisedBody.GpsData;
  delete sanitisedBody.entry_id;

  return sanitisedBody;
};

const pushData = async (body, deviceName, organisation, time) => {
  try {
    /***
     * Using the device name and ctype, continously insert values
     */

    Object.entries(body).map(([ctype, value]) => {
      /**
       * In case we are to go with the AirQo "component types",
       * then we shall need to perform an extra step using
       * the generateComponentType function below
       * Otherwise, just the ctype directly
       */

      let preparedRequest = generatePostBody(ctype, value, "minute", time);
      // console.log("the prepared request body");
      // console.dir(preparedRequest);
      // console.log(
      //   "FUllSINGLE_INSERT_PARTIAL_URI",
      //   `${DEVICE_REGISTRY_BASE_URI}/${SINGLE_INSERT_PARTIAL_URI(
      //     deviceName,
      //     ctype,
      //     organisation
      //   )}`
      // );
      axios
        .post(
          `${DEVICE_REGISTRY_BASE_URI}/${SINGLE_INSERT_PARTIAL_URI(
            deviceName,
            ctype,
            organisation
          )}`,
          preparedRequest
        )
        .then((response) => {
          if (response) {
            console.log("the response after successful pushing of data: ");
            console.dir(response.data);
          }
        })
        .catch((error) => {
          console.log(error.response.data);
        });
    });
  } catch (e) {
    console.log("error in push Data: ", e.message);
  }
};

const pushBulkData = (body, deviceName, organisation, time) => {
  try {
    /***
     * this check of whether measurements are new or not
     * Should this be done from inside the insertion endpoint?
     */

    // const isNewEvent = isMeasurementNew(sanitisedBody, `${deviceName}_${ctype}`);
    // console.log("is new?: ", isNewEvent );

    /***
     * Using the device name and ctype, continously insert values
     */

    Object.entries(body).map(([ctype, value]) => {
      /**
       * In case we are to go with the AirQo "component types",
       * then we shall need to perform an extra step using
       * the generateComponentType function below
       * Otherwise, just the ctype directly
       */

      /**
       * if the measurement is new, proceed with the insetion
       * if not new, stop the operation
       */

      const componentType = generateComponentType(ctype);
      console.log(`component type for ${ctype} is ${componentType}`);

      /***
       * need to make an update to the endpoint to ensure that
       * the time of each measurement is considered during insertion
       * So in the bulk end, the request array is traversed in an iterative manner
       */
      let preparedBulkRequest = generateBulkPostBody(
        ctype,
        value,
        frequency,
        time
      );
      console.log("the bulk request");
      /**
       * this should return the request body and
       */

      console.log(
        "FULL_BULK_INSERT_PARTIAL_URI",
        `${DEVICE_REGISTRY_BASE_URI}/${BULK_INSERT_PARTIAL_URI(
          deviceName,
          ctype,
          organisation
        )}`
      );

      let BULK_URI = `${DEVICE_REGISTRY_BASE_URI}/${BULK_INSERT_PARTIAL_URI(
        deviceName,
        componentType,
        organisation
      )}`;

      console.log("DEVICE REGISTRY BULK INSERT URI", BULK_URI);
      /**
       * bulk insert into the current AirQo component Types
       */
      if (componentType !== "unknown") {
        axios
          .post(BULK_URI, preparedBulkRequest)
          .then((response) => {
            // console.log("the response after successful pushing of data: ");
            console.dir(response.data);
          })
          .catch((error) => {
            console.log(error.response.data);
          });
      } else {
        console.log("component type is unknown");
      }
    });
  } catch (e) {
    console.log(e.message);
  }
};

/**
 * push data to a topic
 * using the already setup Kafka server
 */

const pushToTopic = (data, topic) => {
  /**
   * Using an appropriate client library, we shall push the values to
   * the respective Kafka topic
   */
};

/**
 * subscribe to a topic
 * using the already setup Kafka server
 */
const subscribeToTopic = (topic) => {};

module.exports = main;
// check that the sorter was called as a worker thread
if (!isMainThread) {
  // make sure we got an array of data
  if (!Array.isArray(workerData)) {
    // we can throw an error to emit the "error" event from the worker
    throw new Error("workerData must be an array of numbers");
  }
  // we post a message through the parent port, to emit the "message" event
  parentPort.postMessage(main(workerData));
}
