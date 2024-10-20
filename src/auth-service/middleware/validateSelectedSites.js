const { isMongoId } = require("validator");
const { logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");

const validateSelectedSites = (requiredFields, allowId = false) => {
  return (req, res, next) => {
    const selectedSites = req.body.selected_sites || req.body; // Get selected_sites directly
    const errors = {}; // Object to hold error messages

    if (allowId && !req.body.selected_sites) {
      return next();
    }
    // If selectedSites is not defined, we can skip validation
    if (selectedSites === undefined) {
      return next(); // Proceed to the next middleware or route handler
    }

    // Early check for selectedSites type
    if (!Array.isArray(selectedSites) && typeof selectedSites !== "object") {
      return res.status(400).json({
        success: false,
        message:
          "Request body(field) for Selected Sites should contain either an array of Site objects or be omitted.",
      });
    }

    // Helper function to validate a single site
    const validateSite = (site, index) => {
      const siteErrors = []; // Array to hold errors for the current site

      if (!site) {
        siteErrors.push("Site value must not be null or undefined");
      }

      // Edge case: Check if _id field is present
      if (!allowId && "_id" in site) {
        siteErrors.push("_id field is not allowed");
      }

      // Validate required fields directly
      requiredFields.forEach((field) => {
        if (!(field in site)) {
          siteErrors.push(`Field "${field}" is missing`);
        }
      });

      // Validate _id if allowed
      if (allowId && site._id && !isMongoId(site._id)) {
        siteErrors.push("_id must be a valid MongoDB ObjectId");
      }

      // Validate site_id
      if (site.site_id && typeof site.site_id !== "string") {
        siteErrors.push("site_id must be a non-empty string");
      }

      // Validate latitude
      if (site.latitude !== undefined) {
        const latValue = parseFloat(site.latitude);
        if (Number.isNaN(latValue) || latValue < -90 || latValue > 90) {
          siteErrors.push("latitude must be between -90 and 90");
        }
      }

      // Validate longitude
      if (site.longitude !== undefined) {
        const longValue = parseFloat(site.longitude);
        if (Number.isNaN(longValue) || longValue < -180 || longValue > 180) {
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
          siteErrors.push("approximate_longitude must be between -180 and 180");
        }
      }

      // Validate site_tags
      const tags = site.site_tags;
      if (!isEmpty(tags)) {
        if (!Array.isArray(tags)) {
          siteErrors.push("site_tags must be an array");
        }

        tags.forEach((tag, tagIndex) => {
          if (typeof tag !== "string") {
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
            siteErrors.push(`${field} must be a non-empty string`);
          }
        }
      });

      // Validate isFeatured field
      if ("isFeatured" in site) {
        // Check only if provided
        if (typeof site.isFeatured !== "boolean") {
          siteErrors.push(`isFeatured must be a boolean`);
        }
      }

      return siteErrors; // Return collected errors for this site
    };

    // If selectedSites is defined as an array, validate each item.
    if (Array.isArray(selectedSites)) {
      selectedSites.forEach((site, index) => {
        const siteErrors = validateSite(site, index);
        if (siteErrors.length > 0) {
          errors[`selected_sites[${index}]`] =
            errors[`selected_sites[${index}]`] || [];
          errors[`selected_sites[${index}]`].push(...siteErrors);
        }
      });

      // Unique checks after validating each item
      const uniqueSiteIds = new Set();
      const uniqueSearchNames = new Set();
      const uniqueNames = new Set();

      selectedSites.forEach((item, idx) => {
        // Check for duplicate site_id
        if (item.site_id !== undefined) {
          if (uniqueSiteIds.has(item.site_id)) {
            errors[`selected_sites[${idx}]`] =
              errors[`selected_sites[${idx}]`] || [];
            errors[`selected_sites[${idx}]`].push(
              `Duplicate site_id: ${item.site_id}`
            );
          } else {
            uniqueSiteIds.add(item.site_id);
          }
        }

        // Check for duplicate search_name
        if (item.search_name !== undefined) {
          if (uniqueSearchNames.has(item.search_name)) {
            errors[`selected_sites[${idx}]`] =
              errors[`selected_sites[${idx}]`] || [];
            errors[`selected_sites[${idx}]`].push(
              `Duplicate search_name: ${item.search_name}`
            );
          } else {
            uniqueSearchNames.add(item.search_name);
          }
        }

        // Check for duplicate name
        if (item.name !== undefined) {
          if (uniqueNames.has(item.name)) {
            errors[`selected_sites[${idx}]`] =
              errors[`selected_sites[${idx}]`] || [];
            errors[`selected_sites[${idx}]`].push(
              `Duplicate name: ${item.name}`
            );
          } else {
            uniqueNames.add(item.name);
          }
        }
      });
    } else if (typeof selectedSites === "object" && selectedSites !== null) {
      const siteErrors = validateSite(selectedSites, 0); // Treat as single object with index 0
      if (siteErrors.length > 0) {
        errors[`selected_sites[0]`] = errors[`selected_sites[0]`] || [];
        errors[`selected_sites[0]`].push(...siteErrors);
      }
    } else {
      return res.status(400).json({
        success: false,
        message:
          "Request body(field) for Selected Sites should contain either an array of Site objects or a single Site object",
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
