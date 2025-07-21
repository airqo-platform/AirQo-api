const axios = require("axios");
const isEmpty = require("is-empty");

function extractBeforeV2IncludingSlash(url) {
  const v2Index = url.indexOf("v2/");

  if (v2Index !== -1) {
    // Found "v2/" in the string
    return url.substring(0, v2Index + 3); // Include "v2/"
  } else {
    // "v2/" not found, return the original string
    return url;
  }
}

/**
 * Update each device to have the default network of VISIBLE_DEVICES_ONLY
 */

// Make a GET request
const url = "http://localhost:3000/api/v2/devices/summary";
const config = {
  headers: {
    Authorization: "",
  },
};
axios
  .get(url, config)
  .then((response) => {
    console.log("GET response device name" + ": ");
    console.dir(response.data);
    for (let i = 0; i < response.data.devices.length; i += 10) {
      const batch = response.data.devices.slice(i, i + 10);
      // Process batch of 10 items
      batch.forEach(async (device) => {
        // console.log("the device _id", device._id);
        const url = `http://localhost:3000/api/v2/devices/soft?id=${device._id}`;
        const new_api_code = extractBeforeV2IncludingSlash(device.api_code);

        const data = {
          api_code: new_api_code,
        };

        if (isEmpty(device.network)) {
          console.log("this device does not have a network", device.name);
        }
        // Make a PUT request
        axios
          .put(url, data, config)
          .then((response) => {
            console.log("PUT response:", response.data);
          })
          .catch((error) => {
            if (error.response) {
              console.log(error.response.status);
              console.log(error.response.data);
            } else {
              console.log(error.message);
            }
          });
      });
    }
  })
  .catch((error) => {
    console.error("GET error:", error);
  });
