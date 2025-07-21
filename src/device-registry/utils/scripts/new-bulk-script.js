const axios = require("axios");
const isEmpty = require("is-empty");

const url = "http://localhost:3000/api/v2/devices/sites";
const config = {
  headers: {
    Authorization: "",
  },
};

const NETWORK_MAPPINGS = {
  //   iqair: "permian-health",
  //   usembassy: "us-embassy",
  //   urbanbetter: "urban-better",
  //   kcca: "kcca",
  //   airqo: "airqo",
  // Add more mappings as needed
};

const DEFAULT_GROUP = "unknown";

axios
  .get(url, config)
  .then(async (response) => {
    const groups = response.data.sites
      .map((site) => {
        // Look up the group based on network, with a fallback to a default
        const group = NETWORK_MAPPINGS[site.network] || DEFAULT_GROUP;

        // Optionally log devices with unknown networks
        if (group === DEFAULT_GROUP) {
          console.log(
            `Unrecognized network for device ${site.name}: ${site.network}`
          );
        }

        return group;
      })
      // Remove any 'unknown' groups if you want only mapped networks
      .filter((group) => group !== DEFAULT_GROUP);

    console.log("the data:");
    console.dir({ groups });

    // Process devices in batches
    for (let i = 0; i < response.data.sites.length; i += 10) {
      const batch = response.data.sites.slice(i, i + 10);

      for (const site of batch) {
        const group = NETWORK_MAPPINGS[site.network] || DEFAULT_GROUP;

        if (group !== DEFAULT_GROUP) {
          const url = `http://localhost:3000/api/v2/devices/sites?id=${site._id}`;
          const data = { groups: [group] };
          //   console.log("the data:");
          //   console.dir(data);

          try {
            // Uncomment if you want to make the PUT request
            const putResponse = await axios.put(url, data, config);
            console.log("PUT response:", putResponse.data);
          } catch (error) {
            console.error("PUT error:", error.message);
          }
        }
      }
    }
  })
  .catch((error) => {
    console.error("GET error:", error);
  });
