const axios = require("axios");
const BASE_URL = "http://34.78.78.202:31002/api/v1/devices/";
// const BASE_URL = "http://localhost:3000/api/v1/devices/";
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

/**
 * First get all the AirQo devices/channels from the network
 * Going channel ID by channel ID:
 * Get the device names using the channel ID
 * create the component types if not existent --- using the component types array
 * Afterwards, use the device name and component types to create new components accordingly
 */

const ctypes = [
  "pm2_5",
  "pm10",
  "s2_pm2_5",
  "s2_pm10",
  "temperature",
  "battery",
  "humidity",
];

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

const getDeviceName = async (channel) => {
  /**
   * get the device name
   */
  axios
    .get(BASE_URL, {
      params: {
        chid: channel,
        tenant: "airqo",
      },
    })
    .then(function (response) {
      // console.log(response.data);
      return response.data.device.name;
    })
    .catch((e) => {
      console.log("error: ", e);
      return false;
    });
};

const generateMeasurementUnit = async (type) => {
  switch (type) {
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

const main = {
  createComponents: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        // const channels = await getChannels();
        // channels.map(async (channel) => {
        //   let deviceName = await getDeviceName(channel.id);
        /**
         * then proceed to create the components for each ctype and device
         */

        // if (deviceName) {
        const numbers = [...Array(100).keys()];
        numbers.map((number) => {
          ctypes.map(async (type, index) => {
            console.log("this is the ctype", type);
            // console.log("this is the device name", deviceName);
            const CREATE_CTYPE_URL = `${BASE_URL}/add/components/types?name=${type}&tenant=${tenant}`;
            const CREATE_COMPONENT_URL = `${BASE_URL}/add/components?device=aq_${number}&ctype=${type}`;
            /**
             * then using the device Names and component types,
             * proceed to create the component from here
             */
            let measurement = {
              quantityKind: type,
              measurementUnit: await generateMeasurementUnit(type),
            };

            const componentBody = {
              measurement: [measurement],
              description: type,
            };

            console.log("component body", componentBody);

            /**
             * then just create the component using the component type - just in case it does not exist
             * please remember to include the right organisation/tenant in the post request
             */

            axios
              .post(CREATE_COMPONENT_URL, componentBody, {
                params: {
                  tenant: tenant,
                },
              })
              .then((res) => {
                console.log(`statusCode: ${res.statusCode}`);
                console.log(res.data);
              })
              .catch((error) => {
                console.log(error.response.data);
              });
          });
          //  }
          // else {
          //   res
          //     .status(400)
          //     .json({ success: false, message: "unable to get device name" });
          // }
          // });
        });
      } else {
        res.status(400).json({
          success: false,
          message: "organisation is missing in the request",
        });
      }
    } catch (e) {
      console.log("error: ", e.message);
    }
  },
  createComponentTypes: (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        ctypes.map(async (type, index) => {
          const CREATE_CTYPE_URL = `${BASE_URL}/add/components/types?name=${type}&tenant=${tenant}`;
          axios
            .post(CREATE_CTYPE_URL)
            .then(async (res) => {
              res.status(200).json({
                success: false,
                message: "successfully created the component type",
              });
            })
            .catch((error) => {
              console.log(error.response);
            });
        });
      } else {
        res.status(400).json({
          success: false,
          message: "tenant is missing in request body",
        });
      }
    } catch (e) {}
  },
};

module.exports = main;
