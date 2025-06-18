const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const AccessRequestModel = require("@models/AccessRequest");
const PermissionModel = require("@models/Permission");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const SLUG_MAX_LENGTH = 20;
const ObjectId = mongoose.Types.ObjectId;
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-group-util`
);
const rolePermissionsUtil = require("@utils/role-permissions.util");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const isUserAssignedToGroup = (user, grp_id) => {
  if (user && user.group_roles && user.group_roles.length > 0) {
    return user.group_roles.some((assignment) => {
      return assignment.group.equals(grp_id);
    });
  }
  return false;
};
const findGroupAssignmentIndex = (user, grp_id) => {
  if (!user.group_roles || !Array.isArray(user.group_roles)) {
    return -1;
  }
  return user.group_roles.findIndex((assignment) =>
    assignment.group.equals(grp_id)
  );
};

// Improved getSuperAdminPermissions function
const assignPermissionsToRole = async (tenant, role_id, next) => {
  const superAdminPermissions = getSuperAdminPermissions(tenant);
  const permissionIds = await getPermissionIds(
    tenant,
    superAdminPermissions,
    next
  );

  try {
    await RoleModel(tenant).findByIdAndUpdate(role_id, {
      $addToSet: { role_permissions: { $each: permissionIds } },
    });
  } catch (error) {
    const errorMessage = `Error assigning permissions to role ${role_id}: ${error.message}`;
    throw new HttpError(
      "Internal Server Error",
      httpStatus.INTERNAL_SERVER_ERROR,
      { message: errorMessage }
    );
  }
};

const getSuperAdminPermissions = (tenant) => {
  const superAdminPermissions = (
    process.env[`SUPER_ADMIN_PERMISSIONS_${tenant.toUpperCase()}`] ||
    process.env.SUPER_ADMIN_PERMISSIONS
  )
    ?.split(",")
    .map((p) => p.trim())
    .filter((p) => p); // Filter out empty strings

  if (!superAdminPermissions || superAdminPermissions.length === 0) {
    throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
      message: "SUPER_ADMIN_PERMISSIONS environment variable is not set",
    });
  }
  return superAdminPermissions;
};

const getPermissionIds = async (tenant, permissions, next) => {
  try {
    const existingPermissions = await PermissionModel(tenant)
      .find({ permission: { $in: permissions } })
      .lean()
      .exec();

    const existingPermissionIds = existingPermissions.map((p) => p._id);
    const existingPermissionNames = existingPermissions.map(
      (p) => p.permission
    );

    const missingPermissions = permissions.filter(
      (permission) => !existingPermissionNames.includes(permission)
    );

    if (missingPermissions.length > 0) {
      const errorMessage = `The following permissions do not exist for tenant '${tenant}': ${missingPermissions.join(
        ", "
      )}. Please create them using the appropriate API endpoint.`;
      throw new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        message: errorMessage,
      });
    }

    return existingPermissionIds;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    logger.error(`Error in getPermissionIds: ${error.message}`);
    throw new HttpError(
      "Internal Server Error",
      httpStatus.INTERNAL_SERVER_ERROR,
      { message: "Failed to retrieve permission IDs" }
    );
  }
};
const groupUtil = {
  getDashboard: async (request, next) => {
    try {
      const { userGroupContext } = request;
      const { group, role } = userGroupContext;
      const { tenant } = request.query;

      // Get group information
      const groupDetails = await GroupModel(tenant)
        .findById(group._id)
        .populate("grp_manager", "firstName lastName email")
        .lean();

      if (!groupDetails) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${group._id} not found`,
          })
        );
      }

      // Get user count for the group
      const userCount = await UserModel(tenant).countDocuments({
        "group_roles.group": group._id,
      });

      // Get most recent users
      const recentUsers = await UserModel(tenant)
        .find({ "group_roles.group": group._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("firstName lastName email profilePicture")
        .lean();

      // Compile dashboard data
      const dashboardData = {
        groupName: group.grp_title,
        groupDescription: group.grp_description,
        profilePicture: group.grp_profile_picture,
        manager: groupDetails.grp_manager,
        createdAt: group.createdAt,
        userCount,
        recentUsers,
        userRole: role.role_name,
      };

      return {
        success: true,
        message: "Dashboard data retrieved successfully",
        data: dashboardData,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getMembers: async (request, next) => {
    try {
      const { userGroupContext } = request;
      const { group } = userGroupContext;
      const { tenant, limit = 100, skip = 0 } = request.query;

      // This leverages the existing listAssignedUsers function with some modifications
      const groupMembers = await UserModel(tenant)
        .aggregate([
          { $match: { "group_roles.group": ObjectId(group._id) } },
          { $unwind: "$group_roles" },
          { $match: { "group_roles.group": ObjectId(group._id) } },
          {
            $lookup: {
              from: "roles",
              let: {
                groupId: ObjectId(group._id),
                roleId: "$group_roles.role",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$group_id", "$$groupId"] },
                        { $eq: ["$_id", "$$roleId"] },
                      ],
                    },
                  },
                },
              ],
              as: "role",
            },
          },
          { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              userName: 1,
              profilePicture: 1,
              isActive: 1,
              lastLogin: 1,
              email: 1,
              role_name: { $ifNull: ["$role.role_name", "No Role"] },
              role_id: { $ifNull: ["$role._id", null] },
              userType: { $ifNull: ["$group_roles.userType", "guest"] },
              joined: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $ifNull: ["$group_roles.createdAt", "$_id"] },
                },
              },
            },
          },
          { $sort: { joined: -1 } },
          { $skip: parseInt(skip) },
          { $limit: parseInt(limit) },
        ])
        .exec();

      // Get total count for pagination
      const totalCount = await UserModel(tenant).countDocuments({
        "group_roles.group": group._id,
      });

      return {
        success: true,
        message: "Members retrieved successfully",
        data: {
          groupName: group.grp_title,
          members: groupMembers,
          totalCount,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getSettings: async (request, next) => {
    try {
      const { userGroupContext } = request;
      const { group } = userGroupContext;
      const { tenant } = request.query;

      // Get full group details
      const groupDetails = await GroupModel(tenant)
        .findById(group._id)
        .populate("grp_manager", "firstName lastName email profilePicture")
        .lean();

      if (!groupDetails) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${group._id} not found`,
          })
        );
      }

      // Extract settings
      const settings = {
        name: groupDetails.grp_title,
        slug: groupDetails.organization_slug,
        description: groupDetails.grp_description,
        profilePicture: groupDetails.grp_profile_picture,
        website: groupDetails.grp_website,
        manager: groupDetails.grp_manager,
        createdAt: groupDetails.createdAt,
        updatedAt: groupDetails.updatedAt,
      };

      return {
        success: true,
        message: "Group settings retrieved successfully",
        data: settings,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateSettings: async (request, next) => {
    try {
      const { userGroupContext, body } = request;
      const { group } = userGroupContext;
      const { tenant } = request.query;
      const { name, description, profilePicture, website } = body;

      // Create update object with only provided fields
      const updateFields = {};
      if (name !== undefined) updateFields.grp_title = name;
      if (description !== undefined) updateFields.grp_description = description;
      if (profilePicture !== undefined)
        updateFields.grp_profile_picture = profilePicture;
      if (website !== undefined) updateFields.grp_website = website;

      // Only proceed if there are fields to update
      if (Object.keys(updateFields).length === 0) {
        return {
          success: true,
          message: "No changes to update",
          data: {
            name: group.grp_title,
            description: group.grp_description,
            profilePicture: group.grp_profile_picture,
            website: group.grp_website,
          },
          status: httpStatus.OK,
        };
      }

      // Update the group
      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        group._id,
        updateFields,
        { new: true }
      );

      if (!updatedGroup) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${group._id} not found`,
          })
        );
      }

      return {
        success: true,
        message: "Group settings updated successfully",
        data: {
          name: updatedGroup.grp_title,
          description: updatedGroup.grp_description,
          profilePicture: updatedGroup.grp_profile_picture,
          website: updatedGroup.grp_website,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  /**
   * Generate a slug from a group title
   * @param {string} title - The group title
   * @returns {string} - The generated slug
   */
  generateSlugFromTitle: (title) => {
    if (!title) return "";

    // Convert to lowercase and replace spaces/underscores with hyphens
    let slug = title
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars except hyphens
      .replace(/\-\-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-+/, "") // Trim hyphens from start
      .replace(/-+$/, ""); // Trim hyphens from end

    if (!slug) {
      throw new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
        message: "Unable to generate a valid slug from title",
      });
    }
    slug = slug.slice(0, SLUG_MAX_LENGTH);

    return slug;
  },

  /**
   * Check if a slug already exists in the database
   * @param {string} tenant - The tenant
   * @param {string} slug - The slug to check
   * @param {string} excludeId - Group ID to exclude from check (for updates)
   * @returns {Promise<boolean>} - True if slug exists
   */
  checkSlugExists: async (tenant, slug, excludeId = null) => {
    const filter = { organization_slug: slug };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const existingGroup = await GroupModel(tenant).findOne(filter).lean();
    return !!existingGroup;
  },

  /**
   * Generate a unique slug by appending numbers if necessary
   * @param {string} tenant - The tenant
   * @param {string} baseSlug - The base slug
   * @param {string} excludeId - Group ID to exclude from check
   * @returns {Promise<string>} - The unique slug
   */
  generateUniqueSlug: async (tenant, baseSlug, excludeId = null) => {
    let slug = baseSlug;
    let counter = 1;
    const maxAttempts = 100;

    while (await groupUtil.checkSlugExists(tenant, slug, excludeId)) {
      if (counter > maxAttempts) {
        // Use timestamp as last resort
        slug = `${baseSlug}-${Date.now()}`;
        break;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  },

  /**
   * Populate slugs for all groups that don't have one
   * @param {Object} request - The request object
   * @param {Function} next - The next middleware function
   * @returns {Promise<Object>} - The response object
   */
  populateSlugs: async (request, next) => {
    try {
      const { tenant, limit = 100 } = request.query;
      const dryRun = ["true", "1", true].includes(request.query.dryRun);

      // Find all groups without organization_slug
      const groupsWithoutSlug = await GroupModel(tenant)
        .find({
          $or: [
            { organization_slug: { $exists: false } },
            { organization_slug: null },
            { organization_slug: "" },
          ],
        })
        .limit(parseInt(limit))
        .lean();

      if (groupsWithoutSlug.length === 0) {
        return {
          success: true,
          message: "All groups already have organization slugs",
          data: {
            totalProcessed: 0,
            updated: 0,
            skipped: 0,
          },
          status: httpStatus.OK,
        };
      }

      const results = {
        totalProcessed: groupsWithoutSlug.length,
        updated: 0,
        skipped: 0,
        errors: [],
        updatedGroups: [],
      };

      // Process each group
      for (const group of groupsWithoutSlug) {
        try {
          // Skip if group has no title
          if (!group.grp_title) {
            results.skipped++;
            results.errors.push({
              groupId: group._id,
              error: "Group has no title",
            });
            continue;
          }

          // Generate slug from title
          const baseSlug = groupUtil.generateSlugFromTitle(group.grp_title);
          const uniqueSlug = await groupUtil.generateUniqueSlug(
            tenant,
            baseSlug
          );

          if (!dryRun) {
            // Update the group with the new slug
            const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
              group._id,
              { organization_slug: uniqueSlug },
              { new: true, select: "_id grp_title organization_slug" }
            );

            if (updatedGroup) {
              results.updated++;
              results.updatedGroups.push({
                _id: updatedGroup._id,
                grp_title: updatedGroup.grp_title,
                organization_slug: updatedGroup.organization_slug,
              });
            } else {
              results.skipped++;
              results.errors.push({
                groupId: group._id,
                error: "Failed to update group",
              });
            }
          } else {
            // Dry run - just show what would be updated
            results.updatedGroups.push({
              _id: group._id,
              grp_title: group.grp_title,
              proposed_slug: uniqueSlug,
            });
          }
        } catch (error) {
          results.skipped++;
          results.errors.push({
            groupId: group._id,
            error: error.message,
          });
        }
      }

      const message = dryRun
        ? `Dry run completed. ${results.totalProcessed} groups would be updated.`
        : `Slug population completed. ${results.updated} groups updated, ${results.skipped} skipped.`;

      return {
        success: true,
        message,
        data: results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Update slug for a specific group
   * @param {Object} request - The request object
   * @param {Function} next - The next middleware function
   * @returns {Promise<Object>} - The response object
   */
  updateSlug: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { grp_id } = request.params;
      let { slug, regenerate = false } = request.body;
      // normalise regenerate to boolean
      regenerate = ["true", "1", true].includes(regenerate);

      // Find the group
      const group = await GroupModel(tenant).findById(grp_id).lean();

      if (!group) {
        return {
          success: false,
          message: `Group with ID ${grp_id} not found`,
          status: httpStatus.NOT_FOUND,
        };
      }

      // Check if group already has a slug and we're not forcing regeneration
      if (group.organization_slug && !regenerate) {
        return {
          success: true,
          message: "Group already has an organization slug",
          data: {
            _id: group._id,
            grp_title: group.grp_title,
            organization_slug: group.organization_slug,
            skipped: true,
          },
          status: httpStatus.OK,
        };
      }

      let finalSlug;

      if (slug) {
        // Validate provided slug
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug) || slug.length > SLUG_MAX_LENGTH) {
          return {
            success: false,
            message:
              "Invalid slug format. Slug must be lowercase alphanumeric with hyphens only",
            status: httpStatus.BAD_REQUEST,
          };
        }

        // Check if provided slug is already taken
        const slugExists = await groupUtil.checkSlugExists(
          tenant,
          slug,
          grp_id
        );
        if (slugExists) {
          return {
            success: false,
            message: `Slug '${slug}' is already taken by another group`,
            status: httpStatus.CONFLICT,
          };
        }

        finalSlug = slug;
      } else {
        // Generate slug from title
        if (!group.grp_title) {
          return {
            success: false,
            message: "Cannot generate slug: Group has no title",
            status: httpStatus.BAD_REQUEST,
          };
        }

        const baseSlug = groupUtil.generateSlugFromTitle(group.grp_title);
        finalSlug = await groupUtil.generateUniqueSlug(
          tenant,
          baseSlug,
          grp_id
        );
      }

      // Update the group
      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        grp_id,
        { organization_slug: finalSlug },
        { new: true, select: "_id grp_title organization_slug" }
      );

      if (!updatedGroup) {
        return {
          success: false,
          message: "Failed to update group",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        success: true,
        message: "Group slug updated successfully",
        data: updatedGroup,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  removeUniqueConstraint: async (request, next) => {
    try {
      const { tenant } = request.query;
      const responseFromRemoveUniqueConstraint = await GroupModel(
        tenant
      ).collection.dropIndex("grp_website_1");

      if (responseFromRemoveUniqueConstraint.ok === 1) {
        return {
          success: true,
          message: "Index dropped successfully",
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Index removal failed" }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { user_id } = body;

      let user;
      if (user_id) {
        user = await UserModel(tenant).findById(user_id).lean();
      } else {
        user = request.user;
      }

      if (isEmpty(request.user) && isEmpty(user_id)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "creator's account is not provided",
          })
        );
      }

      if (isEmpty(user)) {
        return next(
          new HttpError(
            "Your account is not registered",
            httpStatus.BAD_REQUEST,
            {
              message: `Your account is not registered`,
            }
          )
        );
      }

      // Generate organization_slug if not provided
      let organizationSlug = body.organization_slug;

      if (!organizationSlug && body.grp_title) {
        // Generate slug from title
        const baseSlug = groupUtil.generateSlugFromTitle(body.grp_title);
        organizationSlug = await groupUtil.generateUniqueSlug(tenant, baseSlug);
      }

      const modifiedBody = {
        ...body,
        grp_manager: ObjectId(user._id),
        grp_manager_username: user.email,
        grp_manager_firstname: user.firstName,
        grp_manager_lastname: user.lastName,
        organization_slug: organizationSlug,
      };

      logObject("the user making the request", user);
      const responseFromRegisterGroup = await GroupModel(tenant).register(
        modifiedBody,
        next
      );

      if (responseFromRegisterGroup.success === false) {
        return responseFromRegisterGroup;
      }

      const grp_id = responseFromRegisterGroup.data._id;
      if (!grp_id) {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Unable to retrieve the group Id of created group",
            }
          )
        );
      }

      const requestForRole = {
        query: { tenant },
        body: {
          role_code: "SUPER_ADMIN",
          role_name: "SUPER_ADMIN",
          group_id: grp_id,
        },
      };

      const responseFromCreateRole = await rolePermissionsUtil.createRole(
        requestForRole,
        next
      );

      if (responseFromCreateRole.success === false) {
        return responseFromCreateRole;
      }

      const role_id = responseFromCreateRole.data._id;
      if (!role_id) {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Unable to retrieve the role id of the newly created super admin of this group",
            }
          )
        );
      }

      try {
        // Attempt to assign permissions; error handling within this function
        await assignPermissionsToRole(tenant, role_id, next);

        const updatedUser = await UserModel(tenant).findByIdAndUpdate(
          user._id,
          {
            $addToSet: {
              group_roles: {
                group: grp_id,
                role: role_id,
                userType: "user",
              },
            },
          },
          { new: true }
        );

        if (!updatedUser) {
          return next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: `Unable to assign the group to the User ${user._id}`,
              }
            )
          );
        }

        return responseFromRegisterGroup;
      } catch (error) {
        //Rollback group and role creation if permission assignment fails
        await GroupModel(tenant).findByIdAndDelete(grp_id);
        await RoleModel(tenant).findByIdAndDelete(role_id);
        return next(error); // Re-throw the error for handling by the calling function
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { grp_id, tenant } = { ...query, ...params };
      const update = Object.assign({}, body);

      // Prevent updating organization_slug through regular update
      if (update.organization_slug) {
        delete update.organization_slug;
        logger.warn(
          `Attempt to update organization_slug for group ${grp_id} was blocked. Use the dedicated slug endpoint instead.`
        );
      }

      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });

      if (!groupExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id} not found`,
          })
        );
      }

      const filter = generateFilter.groups(request, next);
      const responseFromModifyGroup = await GroupModel(
        tenant.toLowerCase()
      ).modify({ update, filter }, next);
      logObject("responseFromModifyGroup", responseFromModifyGroup);
      return responseFromModifyGroup;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "Group deletion temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "Group deletion temporarily disabled" },
      };
      const { query, params } = request;
      const { tenant } = query;
      const { grp_id } = params;
      const filter = generateFilter.groups(request, next);

      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });

      if (!groupExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id} not found`,
          })
        );
      }

      const responseFromRemoveGroup = await GroupModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      return responseFromRemoveGroup;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.groups(request, next);
      const responseFromListGroups = await GroupModel(
        tenant.toLowerCase()
      ).list({ filter, limit, skip }, next);
      return responseFromListGroups;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignUsersHybrid: async (request, next) => {
    try {
      const { params, body, query } = request;
      const { grp_id, user_ids, tenant } = { ...body, ...query, ...params };
      const group = await GroupModel(tenant).findById(grp_id).lean();

      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid group ID ${grp_id}`,
          })
        );
      }

      // Fetch the default role for this group
      const defaultGroupRole = await rolePermissionsUtil.getDefaultGroupRole(
        tenant,
        grp_id
      );

      if (!defaultGroupRole || !defaultGroupRole._id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Default Role not found for group ID ${grp_id}`,
          })
        );
      }
      const defaultRoleId = defaultGroupRole._id;
      const notAssignedUsers = [];
      let assignedUsers = 0;
      const bulkWriteOperations = [];

      for (const user_id of user_ids) {
        const user = await UserModel(tenant).findById(ObjectId(user_id)).lean();

        if (!user) {
          notAssignedUsers.push({
            user_id,
            reason: `User ${user_id} not found`,
          });
          continue;
        }

        const existingAssignment = user.group_roles
          ? user.group_roles.find(
              (assignment) => assignment.group.toString() === grp_id.toString()
            )
          : undefined;

        if (!isEmpty(existingAssignment)) {
          notAssignedUsers.push({
            user_id,
            reason: `User ${user_id} is already assigned to the Group ${grp_id}`,
          });
          continue;
        } else {
          bulkWriteOperations.push({
            updateOne: {
              filter: { _id: user_id },
              update: {
                $addToSet: {
                  group_roles: {
                    group: grp_id,
                    role: defaultRoleId,
                    userType: "user",
                  },
                },
              },
            },
          });
        }
      }

      if (bulkWriteOperations.length > 0) {
        const { nModified } = await UserModel(tenant).bulkWrite(
          bulkWriteOperations
        );
        assignedUsers = nModified;
      }

      let message;
      if (assignedUsers === 0) {
        message = "No users assigned to the group.";
      } else if (assignedUsers === user_ids.length) {
        message = "All users have been assigned to the group.";
      } else {
        message = `Operation partially successful; ${assignedUsers} of ${user_ids.length} users have been assigned to the group.`;
      }

      if (notAssignedUsers.length > 0) {
        next(
          new HttpError(
            message,
            httpStatus.BAD_REQUEST,
            notAssignedUsers.reduce((errors, user) => {
              errors[user.user_id] = user.reason;
              return errors;
            }, {})
          )
        );
      }

      return {
        success: true,
        message,
        status: httpStatus.OK,
        data: assignedUsers,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  assignOneUser: async (request, next) => {
    try {
      const { grp_id, user_id, tenant } = {
        ...request.query,
        ...request.params,
      };
      const userExists = await UserModel(tenant).exists({ _id: user_id });
      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });

      if (!userExists || !groupExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User or Group not found",
          })
        );
      }

      const user = await UserModel(tenant).findById(user_id).lean();

      logObject("user", user);

      const isAlreadyAssigned = isUserAssignedToGroup(user, grp_id);

      if (isAlreadyAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group already assigned to User",
          })
        );
      }
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        {
          $addToSet: {
            group_roles: {
              group: grp_id,
            },
          },
        },
        { new: true }
      );

      logObject("updatedUser", updatedUser);

      return {
        success: true,
        message: "User assigned to the Group",
        data: updatedUser,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  unAssignUser: async (request, next) => {
    try {
      const { grp_id, user_id, tenant } = {
        ...request.query,
        ...request.params,
      };
      const group = await GroupModel(tenant).findById(grp_id);
      let user = await UserModel(tenant).findById(user_id);
      if (isEmpty(group) || isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} or User ${user_id.toString()} not found`,
          })
        );
      }

      const groupAssignmentIndex = findGroupAssignmentIndex(user, grp_id);

      logObject("groupAssignmentIndex", groupAssignmentIndex);

      if (groupAssignmentIndex === -1) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} is not assigned to the user`,
          })
        );
      }

      user.group_roles.splice(groupAssignmentIndex, 1);

      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { group_roles: user.group_roles },
        { new: true }
      );

      if (!isEmpty(updatedUser)) {
        return {
          success: true,
          message: "Successfully unassigned User from the Group",
          data: updatedUser,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Unable to unassign the User",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  unAssignManyUsers: async (request, next) => {
    try {
      const { user_ids, grp_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const group = await GroupModel(tenant).findById(grp_id);

      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id} not found`,
          })
        );
      }

      // Check if all the provided users actually exist
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      if (existingUsers.length !== user_ids.length) {
        const nonExistentUsers = user_ids.filter(
          (user_id) => !existingUsers.find((user) => user._id.equals(user_id))
        );

        const errorMessages = {};
        nonExistentUsers.forEach((user_id) => {
          errorMessages[user_id] = `User ${user_id} does not exist`;
        });

        next(
          new HttpError(
            "Bad Request Error",
            httpStatus.BAD_REQUEST,
            errorMessages
          )
        );
      }

      // Check if all the provided user_ids are assigned to the group
      const users = await UserModel(tenant).find({
        _id: { $in: user_ids },
        "group_roles.group": grp_id,
      });

      if (users.length !== user_ids.length) {
        const unassignedUsers = user_ids.filter(
          (user_id) => !users.find((user) => user._id.equals(user_id))
        );

        const errorMessages = {};
        unassignedUsers.forEach((user_id) => {
          errorMessages[
            user_id
          ] = `User ${user_id} is not assigned to this group ${grp_id}`;
        });

        next(
          new HttpError(
            "Bad Request Error",
            httpStatus.BAD_REQUEST,
            errorMessages
          )
        );
      }

      // Remove the group assignment from each user's groups array
      try {
        const totalUsers = user_ids.length;
        const { nModified, n } = await UserModel(tenant).updateMany(
          {
            _id: { $in: user_ids },
            group_roles: { $elemMatch: { group: grp_id } },
          },
          {
            $pull: {
              group_roles: { group: grp_id },
            },
          }
        );

        const notFoundCount = totalUsers - nModified;
        if (nModified === 0) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "No matching User found in the system",
            })
          );
        }

        if (notFoundCount > 0) {
          return {
            success: true,
            message: `Operation partially successful since ${notFoundCount} of the provided users were not found in the system`,
            status: httpStatus.OK,
          };
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }

      const unassignedUserIds = user_ids.map((user_id) => user_id);

      return {
        success: true,
        message: `Successfully unassigned all the provided users from the group ${grp_id}`,
        status: httpStatus.OK,
        data: unassignedUserIds,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAvailableUsers: async (request, next) => {
    try {
      const { tenant, grp_id } = { ...request.query, ...request.params };
      const group = await GroupModel(tenant).findById(grp_id);
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid group ID ${grp_id}, please crosscheck`,
          })
        );
      }

      // Retrieve users who are not part of the group or don't have the specific group role
      const responseFromListAvailableUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              "group_roles.group": { $ne: group._id },
            },
          },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              userName: 1,
              isActive: 1,
              lastLogin: 1,
              status: 1,
              jobTitle: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              email: 1,
            },
          },
        ])
        .exec();

      logObject(
        "responseFromListAvailableUsers",
        responseFromListAvailableUsers
      );

      return {
        success: true,
        message: `retrieved all available users for group ${grp_id}`,
        data: responseFromListAvailableUsers,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAssignedUsers: async (request, next) => {
    try {
      const { tenant, grp_id } = { ...request.query, ...request.params };
      const group = await GroupModel(tenant).findById(grp_id);

      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid group ID ${grp_id}, please crosscheck`,
          })
        );
      }

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          { $match: { "group_roles.group": group._id } },
          { $unwind: "$group_roles" },
          { $match: { "group_roles.group": group._id } },
          {
            $lookup: {
              from: "roles",
              let: { groupId: group._id, roleId: "$group_roles.role" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$group_id", "$$groupId"] },
                        { $eq: ["$_id", "$$roleId"] },
                      ],
                    },
                  },
                },
              ],
              as: "role",
            },
          },
          { $unwind: "$role" },
          {
            $lookup: {
              from: "permissions",
              localField: "role.role_permissions",
              foreignField: "_id",
              as: "role_permissions",
            },
          },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              userName: 1,
              profilePicture: 1,
              isActive: 1,
              lastLogin: 1,
              status: 1,
              jobTitle: 1,
              createdAt: {
                $dateToString: { format: "%Y-%m-%d %H:%M:%S", date: "$_id" },
              },
              email: 1,
              role_name: "$role.role_name",
              role_id: "$role._id",
              role_permissions: "$role_permissions",
            },
          },
          {
            $project: {
              "role_permissions.network_id": 0,
              "role_permissions.description": 0,
              "role_permissions.createdAt": 0,
              "role_permissions.updatedAt": 0,
              "role_permissions.__v": 0,
            },
          },
        ])
        .exec();

      logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      return {
        success: true,
        message: `Retrieved all assigned users for group ${grp_id}`,
        data: responseFromListAssignedUsers,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAllGroupUsers: async (request, next) => {
    try {
      const { tenant, grp_id } = { ...request.query, ...request.params };
      const group = await GroupModel(tenant).findById(grp_id);

      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid group ID ${grp_id}, please crosscheck`,
          })
        );
      }

      const users = await UserModel(tenant)
        .aggregate([
          { $match: { "group_roles.group": group._id } },
          { $unwind: "$group_roles" },
          { $match: { "group_roles.group": group._id } },
          {
            $lookup: {
              from: "roles",
              let: { groupId: group._id, roleId: "$group_roles.role" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$group_id", "$$groupId"] },
                        { $eq: ["$_id", "$$roleId"] },
                      ],
                    },
                  },
                },
              ],
              as: "role",
            },
          },
          { $unwind: "$role" }, // Unwind role after lookup
          {
            $lookup: {
              from: "permissions",
              localField: "role.role_permissions",
              foreignField: "_id",
              as: "role_permissions",
            },
          },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              userName: 1,
              profilePicture: 1,
              group_roles: 1,
              isActive: 1,
              lastLogin: 1,
              status: 1,
              jobTitle: 1,
              createdAt: {
                $dateToString: { format: "%Y-%m-%d %H:%M:%S", date: "$_id" },
              },
              email: 1,
              role_name: "$role.role_name", // Access directly after $unwind
              role_id: "$role._id", // Access directly after $unwind
              role_permissions: "$role_permissions",
            },
          },
          {
            $project: {
              "role_permissions.network_id": 0,
              "role_permissions.description": 0,
              "role_permissions.createdAt": 0,
              "role_permissions.updatedAt": 0,
              "role_permissions.__v": 0,
            },
          },
        ])
        .exec();

      logObject("users", users);

      const accessRequests = await AccessRequestModel(tenant)
        .aggregate([
          {
            $match: {
              targetId: group._id,
              requestType: "group",
              status: "pending",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "user_id",
              foreignField: "_id",
              as: "userDetails",
            },
          },
          {
            $project: {
              email: 1,
              status: 1,
              firstName: { $arrayElemAt: ["$userDetails.firstName", 0] },
              lastName: { $arrayElemAt: ["$userDetails.lastName", 0] },
              createdAt: 1,
              group_roles: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$userDetails.group_roles",
                      as: "groupRole",
                      cond: {
                        $eq: ["$$groupRole.group", group._id],
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
          {
            $project: {
              email: 1,
              status: 1,
              firstName: 1,
              lastName: 1,
              createdAt: 1,
              group_roles: 1,
              userType: {
                $ifNull: [
                  { $arrayElemAt: ["$group_roles.userType", 0] },
                  "guest",
                ],
              },
            },
          },
        ])
        .exec();

      const mergedResults = [];
      const emailSet = new Set();

      const getUserTypeByGroupId = (groupRoles, grpId) => {
        if (Array.isArray(groupRoles)) {
          for (const groupRole of groupRoles) {
            if (groupRole.group && groupRole.group.equals(grpId)) {
              return groupRole.userType || "guest";
            }
          }
        }
        return "guest";
      };

      const addUserToResults = (user) => {
        if (!emailSet.has(user.email)) {
          const userType = getUserTypeByGroupId(user.group_roles, grp_id);
          mergedResults.push({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            profilePicture: user.profilePicture,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            jobTitle: user.jobTitle,
            createdAt: user.createdAt,
            email: user.email,
            role_name: user.role_name,
            role_id: user.role_id,
            role_permissions: user.role_permissions,
            userType,
            status: user.status || "approved",
          });
          emailSet.add(user.email);
        }
      };

      users.forEach(addUserToResults);

      accessRequests.forEach((accessRequest) => {
        addUserToResults({
          email: accessRequest.email,
          firstName: accessRequest.firstName,
          lastName: accessRequest.lastName,
          group_roles: accessRequest.group_roles,
          status: accessRequest.status,
          createdAt: accessRequest.createdAt,
        });
      });

      mergedResults.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      logObject("mergedResults", mergedResults);

      return {
        success: true,
        message: `Retrieved all users (including pending invites) for group ${grp_id}`,
        data: mergedResults,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  setManager: async (request, next) => {
    try {
      const { grp_id, user_id } = request.params;
      const { tenant } = request.query;
      const user = await UserModel(tenant).findById(user_id).lean();
      const group = await GroupModel(tenant).findById(grp_id).lean();

      if (isEmpty(user)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      if (isEmpty(group)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          })
        );
      }

      if (
        group.grp_manager &&
        group.grp_manager.toString() === user_id.toString()
      ) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id.toString()} is already the group manager`,
          })
        );
      }

      logObject("the user object", user);
      // Updated check to use group_roles array
      const userGroupIds = user.group_roles.map((groupRole) =>
        groupRole.group.toString()
      );

      if (!userGroupIds.includes(grp_id.toString())) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} is not part of User's groups, not authorized to manage this group`,
          })
        );
      }

      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        grp_id,
        { grp_manager: user_id },
        { new: true }
      );

      if (!isEmpty(updatedGroup)) {
        return {
          success: true,
          message: "User assigned to Group successfully",
          status: httpStatus.OK,
          data: updatedGroup,
        };
      } else {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "No group record was updated",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = groupUtil;
