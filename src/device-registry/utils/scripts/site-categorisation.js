const axios = require("axios");

// Configuration
const baseUrl = "BASE_URL";
const token = "YOUR_TOKEN_VALUE"; // Replace with your actual token
const batchSize = 50;

// Clean the token to remove any problematic characters
const cleanToken = token.trim().replace(/[\r\n\t\0]/g, "");

// Create a reusable axios instance with all configurations
const apiClient = axios.create({
  baseURL: baseUrl,
  timeout: 30000, // 30 second timeout
});

/**
 * 
 * // Replace the apiClient creation with:
const apiClient = createApiClientWithBearerAuth();

// Replace the apiClient creation with:
const apiClient = createApiClientWithCustomHeader();
 */

// Add default query parameters (including token) to all requests
apiClient.interceptors.request.use(
  (config) => {
    // Add token to all requests as query parameter
    config.params = {
      ...config.params,
      token: cleanToken,
    };

    // Debug logging (remove in production)
    console.log(
      `Making request: ${config.method?.toUpperCase()} ${config.url}`
    );

    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor for centralized error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.code === "ECONNABORTED") {
      console.error("Request timeout:", error.config?.url);
    } else if (error.response?.status === 401) {
      console.error("Authentication failed - check your token");
    } else if (error.response?.status >= 500) {
      console.error(
        "Server error:",
        error.response?.status,
        error.response?.statusText
      );
    }
    return Promise.reject(error);
  }
);

// Helper function to validate coordinates
function validateCoordinates(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: "Invalid coordinate format" };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, error: "Coordinates out of valid range" };
  }

  return { valid: true, lat, lng };
}

// Extract tags function
function extractTags(osmInfo) {
  if (!osmInfo || !Array.isArray(osmInfo)) {
    return [];
  }

  return osmInfo.map((line) => line.trim()).filter((line) => line.length > 0);
}

// Main function
async function main() {
  try {
    console.log("Fetching all sites...");

    // Fetch all sites using the configured client
    let sites = [];
    try {
      const response = await apiClient.get("/api/v2/devices/sites/summary");
      sites = response.data.sites || [];
    } catch (error) {
      console.error("Failed to fetch sites:", error.message);
      return;
    }

    console.log(`Total sites: ${sites.length}`);

    if (sites.length === 0) {
      console.log("No sites found. Exiting.");
      return;
    }

    // Process sites in batches
    for (let i = 0; i < sites.length; i += batchSize) {
      const batch = sites.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
          sites.length / batchSize
        )} (${batch.length} sites)...`
      );

      // Categorize sites in this batch
      const categorizedSites = await Promise.all(
        batch.map(async (site) => {
          try {
            // Validate coordinates
            const validation = validateCoordinates(
              site.latitude,
              site.longitude
            );
            if (!validation.valid) {
              console.log(`Skipping site ${site._id}: ${validation.error}`);
              return site;
            }

            // Make request using the configured client (token is automatically added)
            const response = await apiClient.get(
              "/api/v2/spatial/categorize_site",
              {
                params: {
                  latitude: validation.lat,
                  longitude: validation.lng,
                },
              }
            );

            const osmInfo = response.data.site?.OSM_info;
            const siteCategoryInfo = response.data.site?.["site-category"];

            if (!siteCategoryInfo) {
              console.log(`No site category info found for site ${site._id}`);
              return site;
            }

            const tags = extractTags(osmInfo);
            const siteCategory = JSON.parse(JSON.stringify(site));

            siteCategory.site_category = {
              area_name: siteCategoryInfo.area_name || "Unknown",
              category: siteCategoryInfo.category || "Unknown",
              highway: siteCategoryInfo.highway || "Unknown",
              landuse: siteCategoryInfo.landuse || "Unknown",
              latitude: siteCategoryInfo.latitude || validation.lat,
              longitude: siteCategoryInfo.longitude || validation.lng,
              natural: siteCategoryInfo.natural || "Unknown",
              search_radius: siteCategoryInfo.search_radius || 0,
              waterway: siteCategoryInfo.waterway || "Unknown",
              tags,
            };

            return siteCategory;
          } catch (error) {
            console.error(`Error processing site ${site._id}:`, error.message);
            return site; // Return original site on error
          }
        })
      );

      // Filter out any failed sites and update site categories
      const validSites = categorizedSites.filter(
        (site) =>
          site &&
          site.site_category &&
          site.site_category.category !== "Unknown"
      );

      console.log(
        `Successfully categorized ${validSites.length} out of ${batch.length} sites in this batch`
      );

      // Update site categories using the configured client
      const updatePromises = validSites.map(async (site) => {
        try {
          const response = await apiClient.put(
            `/api/v2/devices/sites`,
            site.site_category,
            {
              params: {
                id: site._id,
              },
            }
          );
          console.log(
            `✓ Updated site ${site._id}: ${response.data.message || "Success"}`
          );
          return { success: true, siteId: site._id };
        } catch (error) {
          console.error(
            `✗ Failed to update site ${site._id}:`,
            error.response?.data?.message || error.message
          );
          return { success: false, siteId: site._id, error: error.message };
        }
      });

      const updateResults = await Promise.all(updatePromises);
      const successCount = updateResults.filter((result) => result.success)
        .length;
      const failCount = updateResults.filter((result) => !result.success)
        .length;

      console.log(
        `Batch ${Math.floor(i / batchSize) +
          1} complete: ${successCount} updated, ${failCount} failed`
      );

      // Add a small delay between batches to avoid overwhelming the API
      if (i + batchSize < sites.length) {
        console.log("Waiting 2 seconds before next batch...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log("All batches processed successfully!");
  } catch (error) {
    console.error("Script error:", error.message);
  }
}

// Alternative: If your API uses Bearer token in headers instead of query params
function createApiClientWithBearerAuth() {
  return axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${cleanToken}`,
      "User-Agent": "AirQo-Site-Categorization-Script/1.0",
    },
  });
}

// Alternative: If your API uses custom header for token
function createApiClientWithCustomHeader() {
  return axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": cleanToken, // or whatever header name your API expects
      "User-Agent": "AirQo-Site-Categorization-Script/1.0",
    },
  });
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}
