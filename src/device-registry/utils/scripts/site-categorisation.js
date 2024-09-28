const axios = require("axios");

async function main() {
  try {
    // Configuration
    const baseUrl = "https://your-api-base-url.com"; // Replace with your actual base URL
    const token = "your-auth-token"; // Replace with your authentication token
    const batchSize = 100; // Number of sites to process in each batch

    // Fetch all sites
    console.log("Fetching all sites...");
    const response = await axios.get(`${baseUrl}/api/v2/devices/sites/summary`);
    const sites = response.data.sites;

    // Process sites in batches
    for (let i = 0; i < sites.length; i += batchSize) {
      const batch = sites.slice(i, i + batchSize);

      console.log(`Processing batch ${i / batchSize + 1}...`);

      // Categorize sites in this batch
      const categorizedSites = await Promise.all(
        batch.map(async (site) => {
          const response = await axios.get(
            `${baseUrl}/api/v2/spatial/categorize_site?latitude=${site.latitude}&longitude=${site.longitude}&token=${token}`
          );

          const osmInfo = response.data.site.OSM_info;
          const siteCategoryInfo = response.data.site.site_category;
          const tags = extractTags(osmInfo);
          const siteCategory = JSON.parse(JSON.stringify(site));

          siteCategory.site_category = {
            area_name: siteCategoryInfo.area_name,
            category: siteCategoryInfo.category,
            highway: siteCategoryInfo.highway,
            landuse: siteCategoryInfo.landuse,
            latitude: siteCategoryInfo.latitude,
            longitude: siteCategoryInfo.longitude,
            natural: siteCategoryInfo.natural,
            search_radius: siteCategoryInfo.search_radius,
            waterway: siteCategoryInfo.waterway,
            tags,
          };
          return siteCategory;
        })
      );

      // Update site categories
      await Promise.all(
        categorizedSites.map(async (site) => {
          const response = await axios.put(
            `${baseUrl}/api/v2/devices/sites?id=${site._id}`,
            site.site_category
          );
          console.log(`Updated site ${site._id}: ${response.data.message}`);
        })
      );
    }

    console.log("Batch processing complete.");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

function extractTags(osmInfo) {
  const lines = osmInfo.split("\n");
  return lines.map((line) => line.trim()).flat();
}

main();
