// utils/common/slug.util.js
const GroupModel = require("@models/Group");
const OrganizationRequestModel = require("@models/OrganizationRequest");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const slugUtils = {
  /**
   * Generate a unique slug by checking existing slugs and appending a suffix if needed
   * @param {string} baseSlug - The original slug to check
   * @param {string} tenant - The tenant to check against
   * @returns {Promise<string>} - A unique slug
   */
  async generateUniqueSlug(baseSlug, tenant) {
    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

    // First check if the base slug is available
    let slug = baseSlug;
    let isUnique = false;
    let counter = 1;

    while (!isUnique) {
      // Check if slug exists in either collection
      const existingGroup = await GroupModel(dbTenant).findOne({
        organization_slug: slug,
      });

      const existingRequest = await OrganizationRequestModel(dbTenant).findOne({
        organization_slug: slug,
      });

      if (!existingGroup && !existingRequest) {
        isUnique = true;
      } else {
        // If not unique, append counter and try again
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    return slug;
  },
};

module.exports = slugUtils;
