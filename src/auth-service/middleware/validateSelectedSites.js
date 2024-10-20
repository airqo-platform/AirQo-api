const { isMongoId } = require("validator");
const { logText } = require("@utils/log");
const isEmpty = require("is-empty");

const validateSelectedSites = (requiredFields, allowId = false) => {
  return (req, res, next) => {
    const selectedSites = req.body.selected_sites;
    const errors = {}; // Object to hold error messages

    if (!Array.isArray(selectedSites) || selectedSites.length === 0) {
      logText("selected_sites should be a non-empty array");
      return res.status(400).json({
        success: false,
        message: "selected_sites should be a non-empty array",
      });
    }

    selectedSites.forEach((site, index) => {
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

      // Check for missing required fields
      const missingFields = requiredFields.filter((field) => !(field in site));
      if (missingFields.length > 0) {
        logText(
          `Missing required fields at index ${index}: ${missingFields.join(
            ", "
          )}`
        );
        siteErrors.push(`Missing required fields: ${missingFields.join(", ")}`);
      }

      // Validate _id if allowed
      if (allowId && site._id && !isMongoId(site._id)) {
        logText(`_id must be a valid MongoDB ObjectId at index ${index}`);
        siteErrors.push("_id must be a valid MongoDB ObjectId");
      }

      // Validate site_id if not allowing _id
      if (!allowId && site.site_id && !isMongoId(site.site_id)) {
        logText(`site_id must be a valid MongoDB ObjectId at index ${index}`);
        siteErrors.push("site_id must be a valid MongoDB ObjectId");
      }

      // Validate numeric fields
      const numericFields = [
        "latitude",
        "longitude",
        "approximate_latitude",
        "approximate_longitude",
      ];

      numericFields.forEach((field) => {
        if (field in site) {
          const numValue = parseFloat(site[field]);
          if (Number.isNaN(numValue)) {
            logText(`${field} must be a valid number at index ${index}`);
            siteErrors.push(`${field} must be a valid number`);
          }
          if (
            [
              "latitude",
              "longitude",
              "approximate_latitude",
              "approximate_longitude",
            ].includes(field)
          ) {
            if (Math.abs(numValue) > 90) {
              logText(`${field} must be between -90 and 90 at index ${index}`);
              siteErrors.push(`${field} must be between -90 and 90`);
            }
          }
          if (field === "search_radius" && numValue <= 0) {
            logText(`${field} must be greater than 0 at index ${index}`);
            siteErrors.push(`${field} must be greater than 0`);
          }
        }
      });

      // Validate string fields
      const stringFields = ["name", "search_name"];
      stringFields.forEach((field) => {
        if (!(field in site)) {
          logText(`Field "${field}" is missing at index ${index}`);
          // Only add this error once, as it's already captured in missingFields
          // No need to add it again here.
        } else if (
          typeof site[field] !== "string" ||
          site[field].trim() === ""
        ) {
          logText(`${field} must be a non-empty string at index ${index}`);
          siteErrors.push(`${field} must be a non-empty string`);
        }
      });

      // Validate tags
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

      // If there are any errors for this site, add them to the main errors object
      if (siteErrors.length > 0) {
        errors[`selected_sites[${index}]`] = siteErrors;
      }
    });

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
