/**
 * A script to assist in the mass update of unique user preferences
 * based on specific criteria
 */
const axios = require("axios");

// Define your JWT token here
const jwtToken = "";

// Create an Axios instance
const apiClient = axios.create({
  baseURL: "baseURL", // Replace with your API base URL
});

// Add a request interceptor
apiClient.interceptors.request.use(
  function (config) {
    // Do something before request is sent
    config.headers.Authorization = `JWT ${jwtToken}`;
    return config;
  },
  function (error) {
    // Do something with request error
    return Promise.reject(error);
  }
);

// Function to fetch user preferences all in one go......
async function fetchAllUserPreferences() {
  try {
    const response = await apiClient.get(`/api/v2/users/preferences`);
    return response.data.preferences;
  } catch (error) {
    console.error(`Error fetching preferences`, error);
  }
}

// Function to fetch site details by ID
async function fetchSiteDetails(siteId) {
  try {
    const response = await apiClient.get(`/api/v2/devices/sites?id=${siteId}`);
    return response.data.sites.find((site) => site._id === siteId); // Find the site with the matching ID
  } catch (error) {
    console.error(`Error fetching site details for site ${siteId}:`, error);
  }
}

async function updateUserPreferences() {
  const allPreferences = await fetchAllUserPreferences();

  // Filter preferences to keep only those with at least one site having 'hasPlus'
  const filteredPreferences = allPreferences.filter((preference) => {
    return preference.selected_sites.some((site) =>
      /[+]/.test(site.search_name)
    );
  });

  // Calculate the size of each batch
  const batchSize = 50;

  // Calculate the number of batches needed
  const numBatches = Math.ceil(filteredPreferences.length / batchSize);
  console.log("numBatches", numBatches);

  // Process each batch
  for (let i = 0; i < numBatches; i++) {
    const startIdx = i * batchSize;
    const endIdx = Math.min(startIdx + batchSize, filteredPreferences.length);

    // Extract the current batch of preferences
    const batchPreferences = filteredPreferences.slice(startIdx, endIdx);

    // Process each preference in the current batch
    for (const preference of batchPreferences) {
      let updatedPreference = {};

      if (preference && preference.selected_sites) {
        const siteUpdates = await Promise.all(
          preference.selected_sites.map(async (site) => {
            const siteDetails = await fetchSiteDetails(site._id);
            const hasPlus = /[+]/.test(site.search_name);
            if (hasPlus) {
              return { ...site, search_name: siteDetails.search_name };
            }
            return site;
          })
        );

        updatedPreference = {
          ...preference,
          selected_sites: siteUpdates,
        };
      }
      console.log("the updated preference");
      console.dir(updatedPreference);
    }
  }
}

updateUserPreferences().then(() => console.log("All done!"));
