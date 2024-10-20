const { isMongoId } = require("validator");
const { logText } = require("@utils/log");
const isEmpty = require("is-empty");

const validateSelectedSites = (requiredFields, allowId = false) => {
  return (req, res, next) => {
    const selectedSites = req.body.selected_sites || req.body; // Check for wrapper field or direct body
    const errors = {}; // Object to hold error messages

    // Helper function to validate a single site
    const validateSite = (site, index) => {
      const siteErrors = []; // Array to hold errors for the current site

      if (!site) {
        logText(`Site at index ${index} must not be null or undefined`);
        siteErrors.push("Site value must not be null or undefined");
      }

      // Edge case: Check if _id field is present
      if (!allowId && "_id" in site) {
        logText(`_id field is not allowed at index ${index}`);
        siteErrors.push("_id field is not allowed");
      }

      // Validate required fields directly
      requiredFields.forEach((field) => {
        if (!(field in site)) {
          logText(`Field "${field}" is missing at index ${index}`);
          siteErrors.push(`Field "${field}" is missing`);
        }
      });

      // Validate _id if allowed
      if (allowId && site._id && !isMongoId(site._id)) {
        logText(`_id must be a valid MongoDB ObjectId at index ${index}`);
        siteErrors.push("_id must be a valid MongoDB ObjectId");
      }

      // Validate site_id
      if (site.site_id && typeof site.site_id !== "string") {
        logText(`site_id must be a non-empty string at index ${index}`);
        siteErrors.push("site_id must be a non-empty string");
      }

      // Validate latitude
      if (site.latitude !== undefined) {
        const latValue = parseFloat(site.latitude);
        if (Number.isNaN(latValue) || latValue < -90 || latValue > 90) {
          logText(`latitude must be between -90 and 90 at index ${index}`);
          siteErrors.push("latitude must be between -90 and 90");
        }
      }

      // Validate longitude
      if (site.longitude !== undefined) {
        const longValue = parseFloat(site.longitude);
        if (Number.isNaN(longValue) || longValue < -180 || longValue > 180) {
          logText(`longitude must be between -180 and 180 at index ${index}`);
          siteErrors.push("longitude must be between -180 and 180");
        }
      }

      // Validate approximate_latitude
      if (site.approximate_latitude !== undefined) {
        const approxLatValue = parseFloat(site.approximate_latitude);
        if (
          Number.isNaN(approxLatValue) ||
          approxLatValue < -90 ||
          approxLatValue > 90
        ) {
          logText(
            `approximate_latitude must be between -90 and 90 at index ${index}`
          );
          siteErrors.push("approximate_latitude must be between -90 and 90");
        }
      }

      // Validate approximate_longitude
      if (site.approximate_longitude !== undefined) {
        const approxLongValue = parseFloat(site.approximate_longitude);
        if (
          Number.isNaN(approxLongValue) ||
          approxLongValue < -180 ||
          approxLongValue > 180
        ) {
          logText(
            `approximate_longitude must be between -180 and 180 at index ${index}`
          );
          siteErrors.push("approximate_longitude must be between -180 and 180");
        }
      }

      // Validate site_tags
      const tags = site.site_tags;
      if (!isEmpty(tags)) {
        if (!Array.isArray(tags)) {
          logText("site_tags must be an array");
          siteErrors.push("site_tags must be an array");
        }

        tags.forEach((tag, tagIndex) => {
          if (typeof tag !== "string") {
            logText(
              `site_tags[${tagIndex}] must be a string at index ${index}`
            );
            siteErrors.push(`site_tags[${tagIndex}] must be a string`);
          }
        });
      }

      // Validate optional string fields only when they are present
      const optionalStringFields = [
        "country",
        "district",
        "sub_county",
        "parish",
        "county",
        "city",
        "generated_name",
        "lat_long",
        "formatted_name",
        "region",
        "search_name",
      ];

      optionalStringFields.forEach((field) => {
        if (field in site) {
          // Only check if the field is provided
          if (typeof site[field] !== "string" || site[field].trim() === "") {
            logText(`${field} must be a non-empty string at index ${index}`);
            siteErrors.push(`${field} must be a non-empty string`);
          }
        }
      });

      // Validate isFeatured field
      if ("isFeatured" in site) {
        // Check only if provided
        if (typeof site.isFeatured !== "boolean") {
          logText(`isFeatured must be a boolean at index ${index}`);
          siteErrors.push(`isFeatured must be a boolean`);
        }
      }

      return siteErrors; // Return collected errors for this site
    };

    // Check if selectedSites is an array or a single object
    if (Array.isArray(selectedSites)) {
      selectedSites.forEach((site, index) => {
        const siteErrors = validateSite(site, index);
        if (siteErrors.length > 0) {
          errors[`selected_sites[${index}]`] = siteErrors;
        }
      });
    } else if (typeof selectedSites === "object" && selectedSites !== null) {
      const siteErrors = validateSite(selectedSites, 0); // Treat as single object with index 0
      if (siteErrors.length > 0) {
        errors[`selected_sites[0]`] = siteErrors; // Use the same key format for consistency
      }
    } else {
      logText(
        "Request body should contain either an array of sites or a single site object"
      );
      return res.status(400).json({
        success: false,
        message:
          "Request body should contain either an array of sites or a single site object",
      });
    }

    // If any errors were collected, respond with them
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "bad request errors",
        errors,
      });
    }

    next(); // Proceed to the next middleware or route handler
  };
};

module.exports = validateSelectedSites;
