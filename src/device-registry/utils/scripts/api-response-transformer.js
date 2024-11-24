/**
 * Transforms API response data into the required format for the second API
 * @param {Object} inputData - The response from the first API
 * @returns {Object} Formatted data for the second API
 *
 */
const axios = require("axios");
const isEmpty = require("is-empty");

function transformApiResponse(inputData) {
  // Extract site-category data for direct mapping
  const siteCategory = inputData.site["site-category"];

  // Initialize the base structure with direct mappings
  const result = {
    area_name: siteCategory.area_name,
    category: siteCategory.category,
    highway: siteCategory.highway,
    landuse: siteCategory.landuse,
    latitude: siteCategory.latitude,
    longitude: siteCategory.longitude,
    natural: siteCategory.natural,
    search_radius: siteCategory.search_radius,
    waterway: siteCategory.waterway,
    tags: [],
  };

  // Process OSM_info array to extract unique values
  const osmInfoArray = inputData.site.OSM_info;
  const uniqueValues = new Map();

  // Helper function to clean and extract value from OSM info line
  const extractValue = (line) => {
    const [key, value] = line.trim().split(": ");
    return { key: key.trim(), value: value.trim() };
  };

  // Process each entry in OSM_info
  for (let i = 0; i < osmInfoArray.length; i++) {
    const line = osmInfoArray[i];

    // Skip the "Found OSM data:" lines
    if (line.includes("Found OSM data:")) continue;

    const { key, value } = extractValue(line);

    // Skip empty or "unknown" values
    if (!value || value === "unknown") continue;

    // For Location, format it as a string
    if (key === "Location") {
      const locationStr = value.replace(/[()]/g, "");
      uniqueValues.set(key, locationStr);
    }
    // For other keys, store if not already present or if current value is more specific
    else if (
      !uniqueValues.has(key) ||
      (uniqueValues.get(key) === "unknown" && value !== "unknown")
    ) {
      uniqueValues.set(key, value);
    }
  }

  // Convert unique values to tags array
  uniqueValues.forEach((value, key) => {
    // Format the tag as "key: value"
    const tag = `${key}: ${value}`;
    result.tags.push(tag);
  });

  return result;
}

// Example usage:
const createRequestBody = (apiResponse) => {
  try {
    return transformApiResponse(apiResponse);
  } catch (error) {
    console.error("Error transforming API response:", error);
    throw error;
  }
};

// Make a GET request
const url = "http://localhost:3000/api/v2/devices/sites/summary";
const config = {
  headers: {
    Authorization: "",
  },
};
axios
  .get(url, config)
  .then((response) => {
    console.log("GET response site name" + ": ");
    console.dir(response.data);
    for (let i = 0; i < response.data.sites.length; i += 10) {
      const batch = response.data.sites.slice(i, i + 10);
      // Process batch of 10 items
      batch.forEach(async (site) => {
        // console.log("the site _id", site._id);
        const url = `http://localhost:3000/api/v2/spatial/categorize_site?latitude=${site.latitude}&longitude=${site.longitude}`;

        //***MAKE THE GET REQUEST */
        axios
          .get(url, config)
          .then((response) => {
            // console.log("PUT response:", response.data);
            const apiResponse = response.data;
            const requestBody = createRequestBody(apiResponse);
            // console.log("requestBody", requestBody);
            const updateURL = `http://localhost:3000/api/v2/devices/sites?id=${site._id}`;
            const data = {
              site_category: requestBody,
            };

            // Make a PUT request
            axios
              .put(updateURL, data, config)
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

module.exports = {
  createRequestBody,
  transformApiResponse,
};
