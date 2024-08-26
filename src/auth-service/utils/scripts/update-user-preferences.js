/**
 * A script to assist in the mass update of unique user preferences
 * based on specific criteria
 */
const axios = require("axios");

// Define your JWT token here
const jwtToken = "JWT_TOKEN";

// Create an Axios instance
const apiClient = axios.create({
  baseURL: "https://staging-platform.airqo.net", // Replace with your API base URL
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

// Function to fetch user IDs
async function fetchUserIds(skip = 0, limit = 100) {
  try {
    const response = await apiClient.get(`/api/v2/users`, {
      params: {
        skip: skip,
        limit: limit,
      },
    });
    const users = response.data.users;
    if (users.length > 0) {
      // If there are more users, recursively fetch the next page
      const nextSkip = skip + limit;
      const nextUserIds = await fetchUserIds(nextSkip, limit);
      return users.map((user) => user._id).concat(nextUserIds);
    } else {
      // Base case: No more users, return an empty array
      return [];
    }
  } catch (error) {
    console.error("Error fetching user IDs:", error);
    return []; // Return an empty array in case of error
  }
}

// Function to fetch user preferences by ID
async function fetchUserPreferences(userId) {
  try {
    const response = await apiClient.get(`/api/v2/users/preferences/${userId}`);
    return response.data.preferences[0]; // Assuming each user has only one set of preferences
  } catch (error) {
    console.error(`Error fetching preferences for user ${userId}:`, error);
  }
}

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

// Function to update the search_name in user preferences
function updateSearchNameInPreferences(preferences, siteDetails) {
  const updatedPreference = preferences;
  for (const site of updatedPreference.selected_sites) {
    // console.log("the OLD search_name", site.search_name);
    // console.log("the OLD search_id", site._id);
    // console.log("the NEW search_name", siteDetails.search_name);
    // console.log("the NEW search_id", siteDetails._id);
    // console.log("--------------");
    site.search_name = siteDetails.search_name; // Update the search_name with the new name
  }
  return updatedPreference;
}

// Main function to orchestrate the process
async function updateUserPreferences() {
  const allPreferences = await fetchAllUserPreferences();
  // console.log("the userIds:");
  // console.dir(userIds);

  // Define the size of each batch
  const batchSize = 50;

  // Calculate the number of batches needed
  const numBatches = Math.ceil(allPreferences.length / batchSize);
  console.log("numBatches", numBatches);

  // Process each batch
  for (let i = 0; i < numBatches; i++) {
    const startIdx = i * batchSize;
    const endIdx = Math.min(startIdx + batchSize, allPreferences.length);

    // Extract the current batch of preferences
    const batchPreferences = allPreferences.slice(startIdx, endIdx);

    // Process each preference in the current batch

    for (const preference of batchPreferences) {
      let updatedPreference = {};

      if (preference && preference.selected_sites) {
        const siteUpdates = await Promise.all(
          preference.selected_sites.map(async (site) => {
            const siteDetails = await fetchSiteDetails(site._id);
            const hasPlus = /[+]/.test(site.search_name);
            if (hasPlus) {
              updatedPreference = preference;
              console.log("the OLD search_name", site.search_name);
              console.log("the OLD search_id", site._id);
              console.log("the NEW search_name", siteDetails.search_name);
              console.log("the NEW search_id", siteDetails._id);
              console.log(
                "the search_names are not the same and the current one has a number!"
              );
              console.log("--------------");
              return { ...site, search_name: siteDetails.search_name };
            }
            return site;
          })
        );

        updatedPreference = {
          ...updatedPreference,
          selected_sites: siteUpdates,
        };
      }

      // if (updatedPreference) {
      //   for (const site of updatedPreference.selected_sites) {
      //     const siteDetails = await fetchSiteDetails(site._id);
      //     if (siteDetails) {
      //       if (site.search_name !== siteDetails.search_name) {
      //         console.log("the OLD search_name", site.search_name);
      //         console.log("the OLD search_id", site._id);
      //         console.log("the NEW search_name", siteDetails.search_name);
      //         console.log("the NEW search_id", siteDetails._id);
      //         console.log("the search_names are not the same");
      //         console.log("--------------");
      //         site.search_name = siteDetails.search_name;
      //       }
      //       // Update the search_name with the new name
      //     }
      //   }
      // }
      // console.log("the updatedPreference:");
      // console.dir(updatedPreference);
      //  Replace the user's preferences with the updated ones
      // try {
      //   await apiClient.patch(`/api/v2/users/preferences/replace`, {
      //     updatedPreference,
      //   });
      //   console.log(`Updated preferences for user ${userId}`);
      // } catch (error) {
      //   console.error(`Error updating preferences for user ${userId}:`, error);
      // }
    }
  }
}

updateUserPreferences().then(() => console.log("All done!"));
