const axios = require("axios");
// const base_url = "http://34.78.78.202:31002/api/v1/devices/";
const base_url = "http://localhost:3000/api/v1/devices/";
/***
 * NOTE:
 * In this sample code, please note that ctypes (component types) are now the actual sensors within
 * the AirQo devices, these are:
 *
 * 1. pm2_5
 * 2. pm10,
 * 3. s2_pm2_5
 * 4. s2_pm10,
 * 5. temperature
 * 6. battery.
 * 7. humidity
 *
 *
 * The platform expects the user (network manager) to first create component types
 * for their network before they proceed with adding any component to the network.
 *
 * With regard to our data pipeline, these component types can be a source of inspiration
 * when creating Apache Kafka topics.
 *
 * Using the component type, the endpoint for addding a new component generates
 * a new component name for each device
 *
 */

/***
 * Using the Bulk insert endpoint of the AirQo platform, this sample code (Node/JS) demonstrates
 * the bulk insertion of measurements for many component values of many devices within
 * the same network at the same time. Reference is the sample file whose link is shared below:
 */

const sample_file =
  "https://docs.google.com/spreadsheets/d/1ItQiF5LXhMLq4dRKRX6PqbM3cNMOt0SVtFU3_Zw0OmY/edit#gid=1433489674";

/***
 * Using data structure to represent the content in the above sample file
 * It represent many rows where the unique ID of each row of data is the channel ID
 */
const AirQoNetwork = {
  1020598: {
    pm2_5: [
      {
        value: 1,
        calibratedValue: 1,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "day",
      },
    ],
    pm10: [
      {
        value: 1,
        calibratedValue: 1,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "day",
      },
    ],
    s2_pm2_5: [
      {
        value: 1,
        calibratedValue: 1,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "day",
      },
    ],
    s2_pm10: [
      {
        value: 1,
        calibratedValue: 1,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "day",
      },
    ],
    battery: [
      {
        value: 1,
        calibratedValue: 1,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "day",
      },
    ],
    temperature: [
      {
        value: 1,
        calibratedValue: 1,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "day",
      },
    ],
    humidity: [
      {
        value: 1,
        calibratedValue: 1,
        frequency: "day",
        time: "2020-10-04T04:10:33.950Z",
      },
    ],
  },
  967602: {
    pm2_5: [
      {
        value: 2,
        calibratedValue: 2,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "hour",
      },
    ],
    pm10: [
      {
        value: 2,
        calibratedValue: 2,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "hour",
      },
    ],
    s2_pm2_5: [
      {
        value: 2,
        calibratedValue: 2,
        frequency: "hour",
        time: "2020-10-04T04:10:33.950Z",
      },
    ],
    s2_pm10: [
      {
        value: 2,
        calibratedValue: 2,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "hour",
      },
    ],
    battery: [
      {
        value: 2,
        calibratedValue: 2,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "hour",
      },
    ],
    temperature: [
      {
        value: 2,
        calibratedValue: 2,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "hour",
      },
    ],
    humidity: [
      {
        value: 2,
        calibratedValue: 2,
        time: "2020-10-04T04:10:33.950Z",
        frequency: "hour",
      },
    ],
  },
};

try {
  /**
   * Using the device-registry bulk insert endpoint,
   * iterate through each AirQo network channel and push the values of the components
   */
  Object.entries(AirQoNetwork).map(async ([channel, ctypes]) => {
    /**
     * Using the Get All Devices endpoint,
     * get the device names using their corresponding channel IDs:
     *please remember to include the right organisation/tenant in the post request
     * */
    axios
      .get(base_url, {
        params: {
          chid: channel,
          tenant: "airqo",
        },
      })
      .then(function(response) {
        // console.log(response.data);
        let deviceName = response.data.device.name;
        /**
         * using the returned device names, proceed with data insertion which requires device name
         * and component name
         */
        const generateMeasurementUnit = async (key) => {
          switch (key) {
            case "humidity":
              return "grams per kg";
            case "temperature":
              return "degree celsius";
            case "battery":
              return "volts";
            case "s2_pm10":
              return "microns";
            case "s2_pm2_5":
              return "microns";
            case "pm10":
              return "microns";
            case "pm2_5":
              return "microns";
          }
        };

        const generateQuantityKind = async (key) => {
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
          }
        };

        Object.entries(ctypes).map(async ([key, values]) => {
          const url = `${base_url}/components/add/values/bulk?device=${deviceName}&component=${deviceName}_${key}`;

          /***
           * just in case you wish to generate the measurement from other request parameters
           */
          let measurement = {};
          measurement.quantityKind = await generateQuantityKind(key);
          measurement.measurementUnit = await generateMeasurementUnit(key);

          let valuesToSend = {
            measurement,
            ...values[0],
          };

          /****
           * now make the actual bulk insert POST request
           * please remember to include the right organisation/tenant in the post request
           */

          let body = {
            values: [valuesToSend],
            time: "2020-10-04T04:10:33.950Z",
          };

          axios
            .post(url, body, {
              params: {
                tenant: "airqo",
              },
            })
            .then((res) => {
              // console.log(`statusCode: ${res.statusCode}`);
              console.log(res.data);
            })
            .catch((error) => {
              console.log(error.response.data);
            });
        });
      })
      .catch(function(error) {
        console.log(error.response.data);
      });
  });
} catch (e) {
  console.log("error: ", e.message);
}
