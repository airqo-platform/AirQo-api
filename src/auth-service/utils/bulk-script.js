const axios = require("axios");
const isEmpty = require("is-empty");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;

/**
 * Update each device to have the default network of VISIBLE_DEVICES_ONLY
 */

// Make a GET request
const url = "http://localhost:3000/api/v1/users/roles";
const config = {
  headers: {
    Authorization: "",
  },
};
axios
  .get(url, config)
  .then((response) => {
    // console.log("GET response device name" + ": ");
    // console.dir(response.data);
    for (let i = 0; i < response.data.roles.length; i += 10) {
      const batch = response.data.roles.slice(i, i + 10);
      // Process batch of 10 items
      batch.forEach(async (role) => {
        // console.log("the device _id", role._id);

        const url = `http://localhost:3000/api/v1/users/roles/${role._id}`;
        // console.dir(role);
        /**
         * Assign networks to the roles,
         * more of an update operation using update endpoint
         */
        const data = {
          network_id: ObjectId("user_id"),
        };

        // if (isEmpty(role.network)) {
        //   console.log("this device does not have a network", role.name);
        // }

        // console.log("data", data);

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
