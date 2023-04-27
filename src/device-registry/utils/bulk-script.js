const axios = require("axios");
const isEmpty = require("is-empty");

/**
 * Update each device to have the default network of VISIBLE_DEVICES_ONLY
 */

// Make a GET request
const url = "http://localhost:3000/api/v1/devices?tenant=airqo";
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
        const url = `http://localhost:3000/api/v1/devices?id=${device._id}&tenant=airqo`;
        const data = {
          network: "airqo",
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
