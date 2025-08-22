const axios = require("axios");

// Configuration
const baseUrl = "BASE_URL";
const token = "YOUR_TOKEN_VALUE"; // Replace with your actual token
const batchSize = 50; // For processing categorization
const fetchBatchSize = 100; // For fetching sites (can be larger since it's lighter)

// Clean the token to remove any problematic characters
const cleanToken = token.trim().replace(/[\r\n\t\0]/g, "");

// Create a reusable axios instance with all configurations
const apiClient = axios.create({
  baseURL: baseUrl,
  timeout: 60000, // 60 second timeout
});

/**
 * 
 * // Replace the apiClient creation with:
const apiClient = createApiClientWithJWTAuth();

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

// Helper function to check if site already has category info
function hasSiteCategory(site) {
  return (
    site.site_category &&
    typeof site.site_category === "object" &&
    site.site_category.category &&
    site.site_category.category !== "Unknown"
  );
}

// Extract tags function
function extractTags(osmInfo) {
  if (!osmInfo || !Array.isArray(osmInfo)) {
    return [];
  }

  return osmInfo.map((line) => line.trim()).filter((line) => line.length > 0);
}

// Phase 1: Collect all site IDs that need categorization
async function collectSitesNeedingCategorization() {
  console.log("=== PHASE 1: Collecting sites that need categorization ===");

  const sitesNeedingCategorization = [];
  let totalSitesProcessed = 0;
  let totalSitesAlreadyCategorized = 0;
  let skip = 0;
  let hasMoreSites = true;

  while (hasMoreSites) {
    try {
      console.log(
        `Fetching sites batch: skip=${skip}, limit=${fetchBatchSize}`
      );

      const response = await apiClient.get("/api/v2/devices/sites/summary", {
        params: {
          limit: fetchBatchSize,
          skip: skip,
        },
      });

      const sites = response.data.sites || [];
      console.log(`Fetched ${sites.length} sites in this batch`);

      if (sites.length === 0) {
        hasMoreSites = false;
        break;
      }

      // Process this batch to identify sites needing categorization
      for (const site of sites) {
        totalSitesProcessed++;

        if (hasSiteCategory(site)) {
          totalSitesAlreadyCategorized++;
        } else {
          // Validate coordinates before adding to the list
          const validation = validateCoordinates(site.latitude, site.longitude);
          if (validation.valid) {
            sitesNeedingCategorization.push({
              _id: site._id,
              latitude: validation.lat,
              longitude: validation.lng,
              name: site.name,
            });
          } else {
            console.log(`Skipping site ${site._id}: ${validation.error}`);
          }
        }
      }

      console.log(
        `Progress: ${totalSitesProcessed} sites processed, ${sitesNeedingCategorization.length} need categorization, ${totalSitesAlreadyCategorized} already categorized`
      );

      // Check if we got fewer sites than requested (indicates last page)
      if (sites.length < fetchBatchSize) {
        hasMoreSites = false;
      } else {
        skip += fetchBatchSize;
      }

      // Small delay between fetching batches to be respectful to the API
      if (hasMoreSites) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error fetching sites at skip=${skip}:`, error.message);
      // Decide whether to continue or abort based on error type
      if (error.response?.status >= 500) {
        console.log("Server error encountered. Retrying in 5 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw error; // Abort on client errors or auth issues
      }
    }
  }

  console.log("\n=== PHASE 1 SUMMARY ===");
  console.log(`Total sites in system: ${totalSitesProcessed}`);
  console.log(`Sites already categorized: ${totalSitesAlreadyCategorized}`);
  console.log(
    `Sites needing categorization: ${sitesNeedingCategorization.length}`
  );
  console.dir(sitesNeedingCategorization);
  console.log(
    `Sites with invalid coordinates (skipped): ${totalSitesProcessed -
      totalSitesAlreadyCategorized -
      sitesNeedingCategorization.length}`
  );

  return sitesNeedingCategorization;
}

// Phase 2: Process collected sites for categorization
async function processSitesForCategorization(sitesToProcess) {
  console.log("\n=== PHASE 2: Processing sites for categorization ===");

  if (sitesToProcess.length === 0) {
    console.log("No sites need categorization. Exiting.");
    return;
  }

  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;

  // Process sites in batches
  for (let i = 0; i < sitesToProcess.length; i += batchSize) {
    const batch = sitesToProcess.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(sitesToProcess.length / batchSize);

    console.log(
      `\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} sites)...`
    );

    // Categorize sites in this batch
    const categorizedSites = await Promise.all(
      batch.map(async (site) => {
        try {
          // Make request using the configured client (token is automatically added)
          const response = await apiClient.get(
            "/api/v2/spatial/categorize_site",
            {
              params: {
                latitude: site.latitude,
                longitude: site.longitude,
              },
            }
          );

          const osmInfo = response.data.site?.OSM_info;
          const siteCategoryInfo = response.data.site?.["site-category"];

          if (!siteCategoryInfo) {
            console.log(`No site category info found for site ${site._id}`);
            return null;
          }

          const tags = extractTags(osmInfo);

          return {
            _id: site._id,
            site_category: {
              area_name: siteCategoryInfo.area_name || "Unknown",
              category: siteCategoryInfo.category || "Unknown",
              highway: siteCategoryInfo.highway || "Unknown",
              landuse: siteCategoryInfo.landuse || "Unknown",
              latitude: siteCategoryInfo.latitude || site.latitude,
              longitude: siteCategoryInfo.longitude || site.longitude,
              natural: siteCategoryInfo.natural || "Unknown",
              search_radius: siteCategoryInfo.search_radius || 0,
              waterway: siteCategoryInfo.waterway || "Unknown",
              tags,
            },
          };
        } catch (error) {
          console.error(`Error categorizing site ${site._id}:`, error.message);
          return null;
        }
      })
    );

    // Filter out failed categorizations
    const validSites = categorizedSites.filter(
      (site) =>
        site && site.site_category && site.site_category.category !== "Unknown"
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
    const batchSuccessCount = updateResults.filter((result) => result.success)
      .length;
    const batchFailCount = updateResults.filter((result) => !result.success)
      .length;

    totalProcessed += batch.length;
    totalSuccessful += batchSuccessCount;
    totalFailed += batch.length - validSites.length + batchFailCount;

    console.log(
      `Batch ${batchNumber} complete: ${batchSuccessCount} updated, ${batchFailCount} update failed, ${batch.length -
        validSites.length} categorization failed`
    );

    console.log(
      `Overall progress: ${totalProcessed}/${
        sitesToProcess.length
      } processed (${((totalProcessed / sitesToProcess.length) * 100).toFixed(
        1
      )}%)`
    );

    // Add a delay between batches to avoid overwhelming the API
    if (i + batchSize < sitesToProcess.length) {
      console.log("Waiting 2 seconds before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\n=== PHASE 2 SUMMARY ===");
  console.log(`Total sites processed: ${totalProcessed}`);
  console.log(`Successfully updated: ${totalSuccessful}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(
    `Success rate: ${((totalSuccessful / totalProcessed) * 100).toFixed(1)}%`
  );
}

// Main function
async function main() {
  try {
    console.log("Starting site categorization script...");
    console.log(
      `Configuration: fetchBatchSize=${fetchBatchSize}, processingBatchSize=${batchSize}\n`
    );

    // Phase 1: Collect all sites needing categorization
    const sitesToProcess = await collectSitesNeedingCategorization();

    // Phase 2: Process the collected sites
    await processSitesForCategorization(sitesToProcess);

    console.log("\n=== SCRIPT COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("Script error:", error.message);
    process.exit(1);
  }
}

// Alternative: If your API uses JWT token in headers instead of query params
function createApiClientWithJWTAuth() {
  return axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `JWT ${cleanToken}`,
      "User-Agent": "AirQo-Site-Categorization-Script/1.0",
    },
  });
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}
