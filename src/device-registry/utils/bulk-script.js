const axios = require("axios");
const isEmpty = require("is-empty");

// Make a GET request
axios
  .get("URL")
  .then((response) => {
    console.log("GET response site name" + ": ");
    console.dir(response.data);

    response.data.sites.forEach(async (site) => {
      if (isEmpty(site.network)) {
        console.log("the site name without a network field", site.name);
        // Make a PUT request
        // axios
        //   .put("URL", {
        //     name: "John Doe",
        //     email: "john.doe@example.com",
        //   })
        //   .then((response) => {
        //     console.log("PUT response:", response.data);
        //   })
        //   .catch((error) => {
        //     console.error("PUT error:", error);
        //   });
      } else {
        console.log("the site with a network field", site.name);
        console.log("network", site.network);
      }
    });
  })
  .catch((error) => {
    console.error("GET error:", error);
  });
