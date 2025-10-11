const axios = require("axios");

// Configuration
const baseUrl = "BASE_URL";
const token = "YOUR_TOKEN_VALUE"; // Replace with your actual token
const batchSize = 10; // Reduced batch size for processing categorization
const fetchBatchSize = 100; // For fetching sites (can be larger since it's lighter)
const CATEGORIZATION_DELAY = 2000; // 2 seconds delay between categorization requests
const BATCH_DELAY = 5000; // 5 seconds delay between batches
const MAX_RETRIES = 3; // Maximum retry attempts
const RETRY_DELAY = 5000; // 5 seconds delay between retries

// Logging configuration
const ENABLE_VERBOSE_LOGGING = false; // Set to false to reduce log output
const ENABLE_REQUEST_BODY_LOGGING = false; // Set to false to disable request body logging
const ENABLE_RESPONSE_LOGGING = false; // Set to false to disable response logging

// Clean the token to remove any problematic characters
const cleanToken = token.trim().replace(/[\r\n\t\0\x00-\x1f\x7f-\x9f]/g, "");

// Validate token doesn't contain invalid characters
function validateToken(token) {
  // Check for invalid characters that could cause header parsing issues
  const invalidChars = /[\r\n\t\0\x00-\x1f\x7f-\x9f]/g;
  if (invalidChars.test(token)) {
    console.error("Token contains invalid characters!");
    return false;
  }
  return true;
}

// Validate the token before using it
if (!validateToken(cleanToken)) {
  console.error(
    "Token validation failed. Please check your token for invalid characters."
  );
  process.exit(1);
}

// Create a reusable axios instance with all configurations
const apiClient = axios.create({
  baseURL: baseUrl,
  timeout: 120000, // Increased to 120 seconds timeout for better reliability
  insecureHTTPParser: true, // Helps with strict header parsing in newer Node.js versions
});

// Add default query parameters (including token) to all requests
apiClient.interceptors.request.use(
  (config) => {
    // Add token to all requests as query parameter
    config.params = {
      ...config.params,
      token: cleanToken,
    };

    // Debug logging (remove in production)
    if (ENABLE_VERBOSE_LOGGING) {
      console.log(
        `Making request: ${config.method?.toUpperCase()} ${config.url}`
      );
    }

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

// Helper function to sleep/delay
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to retry failed requests - NOW PROPERLY UTILIZED
async function retryRequest(
  requestFn,
  maxRetries = MAX_RETRIES,
  delay = RETRY_DELAY
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const isRetryableError =
        error.message.includes("timeout") ||
        error.message.includes("Invalid header value char") ||
        error.code === "ECONNABORTED" ||
        (error.response && error.response.status >= 500);

      if (!isRetryableError) {
        throw error;
      }

      console.log(
        `   Retrying in ${delay /
          1000}s... (attempt ${attempt}/${maxRetries}) - ${error.message}`
      );
      await sleep(delay);
    }
  }
}

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

// Phase 1: Collect all site IDs that need categorization - WITH RETRY LOGIC
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

      // USING RETRY LOGIC FOR SITE FETCHING
      const response = await retryRequest(() =>
        apiClient.get("/api/v2/devices/sites/summary", {
          params: {
            limit: fetchBatchSize,
            skip: skip,
          },
        })
      );

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
              name: site.name,
              latitude: validation.lat,
              longitude: validation.lng,
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
        await sleep(500);
      }
    } catch (error) {
      console.error(`Error fetching sites at skip=${skip}:`, error.message);

      // If retry logic failed after all attempts, we can still try to continue
      // with a longer delay, or abort based on error type
      if (error.response?.status >= 500) {
        console.log(
          "Server error encountered after retries. Waiting 10 seconds before continuing..."
        );
        await sleep(10000);
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
  console.log(
    `Sites with invalid coordinates (skipped): ${totalSitesProcessed -
      totalSitesAlreadyCategorized -
      sitesNeedingCategorization.length}`
  );

  return sitesNeedingCategorization;
}

// Phase 2: Process collected sites for categorization - WITH RETRY LOGIC AND SEQUENTIAL PROCESSING
async function processSitesForCategorization(sitesToProcess) {
  console.log("\n=== PHASE 2: Processing sites for categorization ===");

  if (sitesToProcess.length === 0) {
    console.log("No sites need categorization. Exiting.");
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      successfulSites: [],
      failedSites: [],
    };
  }

  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  const successfulSites = [];
  const failedSites = [];

  // Process sites in batches
  for (let i = 0; i < sitesToProcess.length; i += batchSize) {
    const batch = sitesToProcess.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(sitesToProcess.length / batchSize);

    console.log(
      `\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} sites)...`
    );

    // SEQUENTIAL PROCESSING instead of Promise.all to avoid overwhelming the API
    const categorizedSites = [];

    for (let siteIndex = 0; siteIndex < batch.length; siteIndex++) {
      const site = batch[siteIndex];

      console.log(
        `  Processing site ${siteIndex + 1}/${batch.length}: ${
          site._id
        } (${site.name || "Unnamed"})`
      );

      try {
        // USING RETRY LOGIC FOR SPATIAL CATEGORIZATION
        const categorizedSite = await retryRequest(() =>
          apiClient.get("/api/v2/spatial/categorize_site", {
            params: {
              latitude: site.latitude,
              longitude: site.longitude,
            },
          })
        );

        const osmInfo = categorizedSite.data.site?.OSM_info;
        const siteCategoryInfo = categorizedSite.data.site?.["site-category"];

        if (!siteCategoryInfo) {
          console.log(
            `    ❌ No site category info found for site ${site._id}`
          );
          failedSites.push({
            ...site,
            reason: "No site category info returned from categorization API",
          });
          totalFailed++;
        } else {
          const tags = extractTags(osmInfo);

          const siteWithCategory = {
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

          categorizedSites.push(siteWithCategory);
          console.log(`    ✅ Successfully categorized: ${site._id}`);
        }
      } catch (error) {
        console.log(
          `    ❌ Failed to categorize: ${site._id} - ${error.message}`
        );
        failedSites.push({
          ...site,
          reason: `Categorization error: ${error.message}`,
        });
        totalFailed++;
      }

      totalProcessed++;

      // Add delay between categorization requests
      if (siteIndex < batch.length - 1) {
        await sleep(CATEGORIZATION_DELAY);
      }
    }

    // Filter out failed categorizations for updating
    const validSites = categorizedSites.filter(
      (site) =>
        site && site.site_category && site.site_category.category !== "Unknown"
    );

    console.log(
      `Successfully categorized ${validSites.length} out of ${batch.length} sites in this batch`
    );

    // SEQUENTIAL SITE UPDATES with retry logic
    for (let updateIndex = 0; updateIndex < validSites.length; updateIndex++) {
      const site = validSites[updateIndex];

      console.log(
        `  Updating site ${updateIndex + 1}/${validSites.length}: ${site._id}`
      );

      try {
        // USING RETRY LOGIC FOR SITE UPDATES
        const updateResponse = await retryRequest(() =>
          apiClient.put(
            `/api/v2/devices/sites`,
            { site_category: site.site_category }, // Wrap in site_category object
            {
              params: {
                id: site._id,
              },
            }
          )
        );

        if (ENABLE_VERBOSE_LOGGING) {
          console.log(`    🔄 Updated site ${site._id}:`);
        }
        if (ENABLE_REQUEST_BODY_LOGGING) {
          console.log(
            `    📤 Request body for ${site._id}:`,
            JSON.stringify({ site_category: site.site_category }, null, 2)
          );
        }
        if (ENABLE_RESPONSE_LOGGING) {
          console.log(
            `    📥 Response status for ${site._id}: ${updateResponse.status}`
          );
          console.log(
            `    📥 Response data for ${site._id}:`,
            JSON.stringify(updateResponse.data, null, 2)
          );
        }

        // Find original site info for success tracking
        const originalSite = sitesToProcess.find((s) => s._id === site._id);
        successfulSites.push({
          _id: site._id,
          name: originalSite?.name || "Unnamed",
          latitude: originalSite?.latitude,
          longitude: originalSite?.longitude,
          category: site.site_category.category,
          area_name: site.site_category.area_name,
          responseMessage: updateResponse.data.message || "Success",
        });

        totalSuccessful++;
        console.log(
          `    ✅ Updated site ${site._id}: ${updateResponse.data.message ||
            "Success"}`
        );
      } catch (error) {
        console.log(`    ❌ Failed to update site ${site._id}:`);

        if (ENABLE_REQUEST_BODY_LOGGING) {
          console.log(
            `    📤 Request body that failed for ${site._id}:`,
            JSON.stringify({ site_category: site.site_category }, null, 2)
          );
        }
        if (error.response && ENABLE_RESPONSE_LOGGING) {
          console.log(
            `    📥 Error response status for ${site._id}: ${error.response.status}`
          );
          console.log(
            `    📥 Error response data for ${site._id}:`,
            JSON.stringify(error.response.data, null, 2)
          );
        }

        // Move to failed sites
        const originalSite = sitesToProcess.find((s) => s._id === site._id);
        failedSites.push({
          ...originalSite,
          reason: `Update error: ${error.response?.data?.message ||
            error.message}`,
        });

        console.error(
          `    ✗ Failed to update site ${site._id}:`,
          error.response?.data?.message || error.message
        );
      }

      // Small delay between updates
      if (updateIndex < validSites.length - 1) {
        await sleep(1000);
      }
    }

    // Progress logging
    const progressPercent = (
      (totalProcessed / sitesToProcess.length) *
      100
    ).toFixed(1);
    console.log(
      `Batch ${batchNumber} complete. Overall progress: ${totalProcessed}/${sitesToProcess.length} (${progressPercent}%)`
    );

    // Add delay between batches to avoid overwhelming the API
    if (i + batchSize < sitesToProcess.length) {
      console.log(`Waiting ${BATCH_DELAY / 1000} seconds before next batch...`);
      await sleep(BATCH_DELAY);
    }
  }

  // Final summary
  const successRate =
    totalProcessed > 0
      ? ((totalSuccessful / totalProcessed) * 100).toFixed(1)
      : 0;

  console.log("\n=== PHASE 2 SUMMARY ===");
  console.log(`Total sites processed: ${totalProcessed}`);
  console.log(`Successfully updated: ${totalSuccessful}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success rate: ${successRate}%`);

  return {
    processed: totalProcessed,
    successful: totalSuccessful,
    failed: totalFailed,
    successfulSites,
    failedSites,
  };
}

// Main function with comprehensive final summary
async function main() {
  try {
    console.log("Starting site categorization script...");
    console.log(
      `Configuration: fetchBatchSize=${fetchBatchSize}, processingBatchSize=${batchSize}`
    );
    console.log(
      `Retry settings: maxRetries=${MAX_RETRIES}, retryDelay=${RETRY_DELAY}ms`
    );
    console.log(
      `Processing delays: categorization=${CATEGORIZATION_DELAY}ms, batch=${BATCH_DELAY}ms\n`
    );

    // Phase 1: Collect all sites needing categorization
    const sitesToProcess = await collectSitesNeedingCategorization();

    // Phase 2: Process the collected sites
    const results = await processSitesForCategorization(sitesToProcess);

    // Comprehensive final summary
    console.log("\n" + "=".repeat(80));
    console.log("FINAL OPERATION SUMMARY");
    console.log("=".repeat(80));

    console.log("\n📊 OVERALL STATISTICS:");
    console.log(`Total sites processed: ${results.processed}`);
    console.log(`Successfully updated: ${results.successful}`);
    console.log(`Failed: ${results.failed}`);
    console.log(
      `Success rate: ${
        results.processed > 0
          ? ((results.successful / results.processed) * 100).toFixed(1)
          : 0
      }%`
    );

    if (results.successfulSites.length > 0) {
      console.log("\n✅ SUCCESSFULLY CATEGORIZED AND UPDATED SITES:");
      console.log("-".repeat(80));
      results.successfulSites.forEach((site, index) => {
        console.log(`${index + 1}. Site ID: ${site._id}`);
        console.log(`   Name: ${site.name || "Unnamed"}`);
        console.log(`   Coordinates: ${site.latitude}, ${site.longitude}`);
        console.log(`   Category: ${site.category}`);
        console.log(`   Area: ${site.area_name}`);
        console.log(`   Response: ${site.responseMessage}`);
        console.log("");
      });
    }

    if (results.failedSites.length > 0) {
      console.log("\n❌ FAILED SITES:");
      console.log("-".repeat(80));
      results.failedSites.forEach((site, index) => {
        console.log(`${index + 1}. Site ID: ${site._id}`);
        console.log(`   Name: ${site.name || "Unnamed"}`);
        console.log(`   Coordinates: ${site.latitude}, ${site.longitude}`);
        console.log(`   Reason: ${site.reason}`);
        console.log("");
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("=== SCRIPT COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("Script error:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Alternative: If your API uses JWT token in headers instead of query params
function createApiClientWithBearerAuth() {
  return axios.create({
    baseURL: baseUrl,
    timeout: 120000,
    insecureHTTPParser: true,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `JWT ${cleanToken}`,
    },
  });
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}
