const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const AccessRequestModel = require("@models/AccessRequest");
const PermissionModel = require("@models/Permission");
const PreferenceModel = require("@models/Preference");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const SLUG_MAX_LENGTH = parseInt(constants.SLUG_MAX_LENGTH ?? 60, 10);
const ObjectId = mongoose.Types.ObjectId;
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-group-util`,
);
const rolePermissionsUtil = require("@utils/role-permissions.util");
const { logObject, HttpError, logText } = require("@utils/shared");
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});
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
    assignment.group.equals(grp_id),
  );
};

const assignPermissionsToRole = async (tenant, role_id, permissions, next) => {
  const permissionIds = await getPermissionIds(tenant, permissions, next);

  try {
    await RoleModel(tenant).findByIdAndUpdate(role_id, {
      $addToSet: { role_permissions: { $each: permissionIds } },
    });
  } catch (error) {
    const errorMessage = `Error assigning permissions to role ${role_id}: ${error.message}`;
    throw new HttpError(
      "Internal Server Error",
      httpStatus.INTERNAL_SERVER_ERROR,
      { message: errorMessage },
    );
  }
};

const getPermissionIds = async (tenant, permissions, next) => {
  try {
    const existingPermissions = await PermissionModel(tenant)
      .find({ permission: { $in: permissions } })
      .lean()
      .exec();

    const existingPermissionIds = existingPermissions.map((p) => p._id);
    const existingPermissionNames = existingPermissions.map(
      (p) => p.permission,
    );

    const missingPermissions = permissions.filter(
      (permission) => !existingPermissionNames.includes(permission),
    );

    if (missingPermissions.length > 0) {
      const errorMessage = `The following permissions do not exist for tenant '${tenant}': ${missingPermissions.join(
        ", ",
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
      { message: "Failed to retrieve permission IDs" },
    );
  }
};
const groupUtil = {
  getDashboard: async (request, next) => {
    try {
      const { userGroupContext } = request;
      const { group, role } = userGroupContext;
      const { tenant } = request.query;

      const groupDetails = await GroupModel(tenant).findById(group._id).lean();

      if (!groupDetails) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${group._id} not found`,
          }),
        );
        return;
      }

      // Manually fetch manager details if grp_manager exists
      let manager = null;
      if (groupDetails.grp_manager) {
        manager = await UserModel(tenant)
          .findById(groupDetails.grp_manager)
          .select("firstName lastName email")
          .lean();
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
        manager: manager,
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
          { message: error.message },
        ),
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
                  // biome-ignore lint/suspicious/noThenProperty: MongoDB $cond uses a "then" key by design
                  date: {
                    $ifNull: [
                      {
                        $cond: {
                          if: {
                            $eq: [{ $type: "$group_roles.createdAt" }, "date"],
                          },
                          then: "$group_roles.createdAt",
                          else: null,
                        },
                      },
                      { $ifNull: ["$createdAt", { $toDate: "$_id" }] },
                    ],
                  },
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
          { message: error.message },
        ),
      );
    }
  },
  getSettings: async (request, next) => {
    try {
      const { userGroupContext } = request;
      const { group } = userGroupContext;
      const { tenant } = request.query;

      // Get full group details without populate
      const groupDetails = await GroupModel(tenant).findById(group._id).lean();

      if (!groupDetails) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${group._id} not found`,
          }),
        );
        return;
      }

      let manager = null;
      if (groupDetails.grp_manager) {
        manager = await UserModel(tenant)
          .findById(groupDetails.grp_manager)
          .select("firstName lastName email profilePicture")
          .lean();
      }

      // Extract settings
      const settings = {
        name: groupDetails.grp_title,
        slug: groupDetails.organization_slug,
        description: groupDetails.grp_description,
        profilePicture: groupDetails.grp_profile_picture,
        website: groupDetails.grp_website,
        manager: manager,
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
          { message: error.message },
        ),
      );
    }
  },
  updateSettings: async (request, next) => {
    try {
      const { userGroupContext, body } = request;
      const { group } = userGroupContext;
      const { tenant } = request.query;
      const { name, description, profilePicture, website } = body;

      // Prevent renaming of the default "airqo" group
      if (name !== undefined) {
        const groupDetails = await GroupModel(tenant)
          .findById(group._id)
          .lean();
        if (
          groupDetails &&
          groupDetails.grp_title &&
          groupDetails.grp_title.toLowerCase() === "airqo"
        ) {
          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: "The default 'airqo' organization cannot be renamed.",
            }),
          );
        }
      }
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
        { new: true },
      );

      if (!updatedGroup) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${group._id} not found`,
          }),
        );
        return;
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
          { message: error.message },
        ),
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
      slug =
        `${baseSlug}`.slice(0, SLUG_MAX_LENGTH - `-${counter}`.length) +
        `-${counter}`;

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
            baseSlug,
          );

          if (!dryRun) {
            // Update the group with the new slug
            const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
              group._id,
              { organization_slug: uniqueSlug },
              { new: true, select: "_id grp_title organization_slug" },
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
          { message: error.message },
        ),
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
        // Validate provided slug format
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug)) {
          return {
            success: false,
            message:
              "Invalid slug format. Slug must be lowercase alphanumeric with hyphens only",
            status: httpStatus.BAD_REQUEST,
          };
        }

        // Validate slug length
        if (slug.length > SLUG_MAX_LENGTH) {
          return {
            success: false,
            message: `Slug too long. Maximum length is ${SLUG_MAX_LENGTH} characters`,
            status: httpStatus.BAD_REQUEST,
          };
        }

        // Check if provided slug is already taken
        const slugExists = await groupUtil.checkSlugExists(
          tenant,
          slug,
          grp_id,
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
          grp_id,
        );
      }

      // Update the group
      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        grp_id,
        { organization_slug: finalSlug },
        { new: true, select: "_id grp_title organization_slug" },
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
          { message: error.message },
        ),
      );
    }
  },
  removeUniqueConstraint: async (request, next) => {
    try {
      const { tenant } = request.query;
      const responseFromRemoveUniqueConstraint =
        await GroupModel(tenant).collection.dropIndex("grp_website_1");

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
            { message: "Index removal failed" },
          ),
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      const { user_id } = body;

      let user;

      // If user_id is provided, validate it exists
      if (user_id) {
        user = await UserModel(tenant).findById(user_id).lean();
        if (!user) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `User with ID ${user_id} not found in tenant ${tenant}`,
            }),
          );
          return;
        }
      } else {
        // Use authenticated user from JWT (if available)
        user = request.user;
        if (isEmpty(user)) {
          next(
            new HttpError("Authentication Error", httpStatus.UNAUTHORIZED, {
              message: "Authentication required - no user provided",
            }),
          );
          return;
        }
      }

      // ✅ ENHANCED ORGANIZATION SLUG GENERATION
      let organizationSlug = body.organization_slug;
      let slugWasGenerated = false;

      // Check if organization_slug needs to be generated
      if (!organizationSlug || organizationSlug.trim() === "") {
        if (!body.grp_title || body.grp_title.trim() === "") {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message:
                "Group title is required for automatic slug generation when organization_slug is not provided",
            }),
          );
          return;
        }

        try {
          // Generate slug from title
          const baseSlug = groupUtil.generateSlugFromTitle(body.grp_title);
          organizationSlug = await groupUtil.generateUniqueSlug(
            tenant,
            baseSlug,
          );
          slugWasGenerated = true;

          logger.info(
            `Auto-generated organization slug: ${organizationSlug} for group: ${body.grp_title}`,
          );
        } catch (slugError) {
          logger.error(
            `Error generating organization slug: ${slugError.message}`,
          );
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Failed to generate organization slug",
                errors: { slug_generation: slugError.message },
              },
            ),
          );
          return;
        }
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
        next,
      );

      if (responseFromRegisterGroup.success === false) {
        return responseFromRegisterGroup;
      }

      const grp_id = responseFromRegisterGroup.data._id;
      if (!grp_id) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Unable to retrieve the group Id of created group",
            },
          ),
        );
        return;
      }

      const requestForRole = {
        query: { tenant },
        body: {
          role_code: "ADMIN",
          role_name: "ADMIN",
          group_id: grp_id,
        },
      };

      const responseFromCreateRole = await rolePermissionsUtil.createRole(
        requestForRole,
        next,
      );

      if (responseFromCreateRole.success === false) {
        return responseFromCreateRole;
      }

      const role_id = responseFromCreateRole.data._id;
      if (!role_id) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Unable to retrieve the role id of the newly created super admin of this group",
            },
          ),
        );
        return;
      }

      try {
        // Attempt to assign permissions; error handling within this function
        const adminPermissions = [
          ...constants.DEFAULTS.DEFAULT_ADMIN,
          constants.MEMBER_VIEW,
          constants.MEMBER_INVITE,
          constants.MEMBER_SEARCH,
          constants.MEMBER_EXPORT,
          constants.MEMBER_REMOVE,
        ];

        let finalPermissions = [...adminPermissions];

        // If specific default permissions are provided, merge them with the defaults
        if (
          body.default_permissions &&
          Array.isArray(body.default_permissions)
        ) {
          // Validate and sanitize the provided permissions
          const validProvidedPermissions = body.default_permissions.filter(
            (p) => typeof p === "string" && p.trim() !== "" && constants[p],
          );

          finalPermissions = [
            ...new Set([...adminPermissions, ...validProvidedPermissions]),
          ];
        }

        await assignPermissionsToRole(tenant, role_id, finalPermissions);

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
          { new: true },
        );

        if (!updatedUser) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: `Unable to assign the group to the User ${user._id}`,
              },
            ),
          );
          return;
        }

        // Add slug generation info to response if applicable
        if (slugWasGenerated) {
          responseFromRegisterGroup.organizationSlugGenerated = true;
          responseFromRegisterGroup.generatedSlug = organizationSlug;
          if (
            !responseFromRegisterGroup.message.includes("organization slug")
          ) {
            responseFromRegisterGroup.message += ` (organization slug auto-generated: ${organizationSlug})`;
          }
        }

        // Fire-and-forget Kafka event publishing with non-blocking rollback
        (async () => {
          let kafkaProducer;
          let sendSucceeded = false;
          try {
            kafkaProducer = kafka.producer();
            await kafkaProducer.connect();
            await kafkaProducer.send({
              topic: constants.GROUPS_TOPIC,
              messages: [
                {
                  key: grp_id.toString(),
                  value: JSON.stringify({
                    type: "group.created",
                    timestamp: new Date().toISOString(),
                    payload: {
                      groupId: grp_id,
                      groupName: responseFromRegisterGroup.data.grp_title,
                      groupDescription:
                        responseFromRegisterGroup.data.grp_description,
                      tenant: tenant,
                      createdBy: user._id,
                    },
                  }),
                },
              ],
            });
            sendSucceeded = true;
            logger.info(
              `Successfully published group.created event for group ID: ${grp_id}`,
            );
          } catch (kafkaError) {
            logger.error(
              `KAFKA-SEND-ERROR: Failed to publish group.created event for group ID ${grp_id}: ${kafkaError.message}. This is a non-blocking error.`,
              { grp_id, tenant, error: kafkaError },
            );
          } finally {
            if (kafkaProducer) {
              try {
                await kafkaProducer.disconnect();
              } catch (disconnectError) {
                logger.error(
                  `KAFKA-DISCONNECT-ERROR: Failed to disconnect Kafka producer for group ID ${grp_id}: ${disconnectError.message}`,
                );
              }
            }
          }
        })();

        return responseFromRegisterGroup;
      } catch (error) {
        //Rollback group and role creation if permission assignment fails
        try {
          await Promise.all([
            GroupModel(tenant).findByIdAndDelete(grp_id),
            RoleModel(tenant).findByIdAndDelete(role_id),
          ]);
        } catch (rollbackError) {
          logger.error(
            `CRITICAL-ROLLBACK-ERROR: Failed to rollback group creation after permission error for group ID ${grp_id}: ${rollbackError.message}`,
          );
        }
        next(error);
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
          `Attempt to update organization_slug for group ${grp_id} was blocked. Use the dedicated slug endpoint instead.`,
        );
      }

      // Prevent renaming of the default "airqo" group through the general update endpoint
      const groupDetails = await GroupModel(tenant).findById(grp_id).lean();
      if (!groupDetails) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id} not found`,
          }),
        );
      }

      if (
        update.grp_title &&
        groupDetails.grp_title &&
        groupDetails.grp_title.toLowerCase() === "airqo"
      ) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message:
              "The default 'airqo' organization cannot be renamed because it is essential for system operations and is referenced throughout the application.",
          }),
        );
      }
      const filter = generateFilter.groups(request, next);
      const responseFromModifyGroup = await GroupModel(
        tenant.toLowerCase(),
      ).modify({ update, filter }, next);
      logObject("responseFromModifyGroup", responseFromModifyGroup);
      return responseFromModifyGroup;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  updateName: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant: rawTenant } = query;
      const { grp_id } = params;
      const { grp_title } = body;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = (rawTenant || defaultTenant).toLowerCase();

      const group = await GroupModel(tenant).findById(grp_id).lean();

      if (!group) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id} not found`,
          }),
        );
      }

      // Prevent renaming of the default "airqo" group
      if (group.grp_title && group.grp_title.toLowerCase() === "airqo") {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message:
              "The default 'airqo' organization cannot be renamed as it is essential for system operations and is referenced throughout the application.",
          }),
        );
      }

      const update = { grp_title };

      const filter = { _id: grp_id };

      const responseFromModifyGroup = await GroupModel(tenant).modifyName(
        { update, filter },
        next,
      );

      if (responseFromModifyGroup.success) {
        responseFromModifyGroup.message = "Group title updated successfully";
      }

      return responseFromModifyGroup;
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error on updateName: ${error.message}`,
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
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
          }),
        );
      }

      const responseFromRemoveGroup = await GroupModel(
        tenant.toLowerCase(),
      ).remove({ filter }, next);
      return responseFromRemoveGroup;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.groups(request, next);
      const responseFromListGroups = await GroupModel(
        tenant.toLowerCase(),
      ).list({ filter, limit, skip }, next);
      return responseFromListGroups;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
          }),
        );
      }

      // Fetch the default role for this group
      const defaultGroupRole = await rolePermissionsUtil.getDefaultGroupRole(
        tenant,
        grp_id,
      );

      if (!defaultGroupRole || !defaultGroupRole._id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Default Role not found for group ID ${grp_id}`,
          }),
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
              (assignment) => assignment.group.toString() === grp_id.toString(),
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
        const { nModified } =
          await UserModel(tenant).bulkWrite(bulkWriteOperations);
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
            }, {}),
          ),
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
          { message: error.message },
        ),
      );
    }
  },

  assignOneUser: async (request, next) => {
    try {
      const { grp_id, user_id, tenant } = {
        ...request.query,
        ...request.params,
      };

      // Validate required parameters
      if (!grp_id || !user_id || !tenant) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Missing required parameters: grp_id, user_id, or tenant",
          }),
        );
        return;
      }

      // Check if user and group exist
      const userExists = await UserModel(tenant).exists({ _id: user_id });
      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });

      if (!userExists || !groupExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User or Group not found",
          }),
        );
        return;
      }

      // Get user to check current assignments
      const user = await UserModel(tenant).findById(user_id).lean();

      // Check if already assigned
      const isAlreadyAssigned = isUserAssignedToGroup(user, grp_id);

      if (isAlreadyAssigned) {
        return {
          success: true,
          message: "User is already a member of this group",
          data: {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
          },
          status: httpStatus.OK,
        };
      }

      // Get default group role with error handling
      let defaultGroupRole;
      try {
        defaultGroupRole = await rolePermissionsUtil.getDefaultGroupRole(
          tenant,
          grp_id,
        );
      } catch (roleError) {
        logger.error(`Error getting default role: ${roleError.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Failed to get default role for group",
            },
          ),
        );
        return;
      }

      if (!defaultGroupRole || !defaultGroupRole._id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Default Role not found for group ID ${grp_id}`,
          }),
        );
        return;
      }

      // Use the safe assignment method
      try {
        const assignmentResult = await UserModel(tenant).assignUserToGroup(
          user_id,
          grp_id,
          defaultGroupRole._id,
          "user",
        );

        if (assignmentResult && assignmentResult.success) {
          return {
            success: true,
            message: "User assigned to the Group successfully",
            data: {
              _id: assignmentResult.data._id,
              email: assignmentResult.data.email,
              firstName: assignmentResult.data.firstName,
              lastName: assignmentResult.data.lastName,
              userName: assignmentResult.data.userName,
            },
            status: httpStatus.OK,
          };
        } else {
          const errorMessage = assignmentResult
            ? assignmentResult.message
            : "Assignment failed";
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: `Failed to assign user to group: ${errorMessage}`,
              },
            ),
          );
          return;
        }
      } catch (assignError) {
        logger.error(`Assignment error: ${assignError.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Assignment operation failed: ${assignError.message}`,
            },
          ),
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  assignMultipleUsers: async (request, next) => {
    try {
      const { grp_id, user_ids, tenant } = {
        ...request.query,
        ...request.params,
        ...request.body,
      };

      if (!grp_id || !user_ids || !Array.isArray(user_ids) || !tenant) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Missing required parameters: grp_id, user_ids array, or tenant",
          }),
        );
      }

      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });
      if (!groupExists) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
      }

      const defaultGroupRole = await rolePermissionsUtil.getDefaultGroupRole(
        tenant,
        grp_id,
      );
      if (!defaultGroupRole || !defaultGroupRole._id) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Default Role not found for group ID ${grp_id}`,
          }),
        );
      }

      const users = await UserModel(tenant)
        .find({ _id: { $in: user_ids } })
        .lean();
      const userMap = new Map(users.map((user) => [user._id.toString(), user]));

      const results = {
        successful: [],
        already_members: [],
        failed_assignments: [],
        not_found: [],
      };

      for (const user_id of user_ids) {
        const user = userMap.get(user_id);
        if (!user) {
          results.not_found.push({ user_id, reason: "User not found" });
          continue;
        }

        if (isUserAssignedToGroup(user, grp_id)) {
          results.already_members.push({
            user_id,
            reason: "User is already a member",
          });
          continue;
        }

        try {
          await UserModel(tenant).assignUserToGroup(
            user_id,
            grp_id,
            defaultGroupRole._id,
            "user",
          );
          results.successful.push(user_id);
        } catch (error) {
          results.failed_assignments.push({ user_id, reason: error.message });
          logger.error(`Failed to assign user ${user_id}: ${error.message}`);
        }
      }

      const summary = {
        total_requested: user_ids.length,
        successfully_assigned: results.successful.length,
        already_members: results.already_members.length,
        users_not_found: results.not_found.length,
        failed_assignments: results.failed_assignments.length,
      };

      let message = `Bulk assignment completed.`;
      let status = httpStatus.OK;

      if (summary.successfully_assigned === 0 && summary.already_members > 0) {
        message = "No new users assigned; all were already members.";
      } else if (
        summary.failed_assignments > 0 ||
        summary.users_not_found > 0
      ) {
        status = httpStatus.MULTI_STATUS;
      }

      return {
        success: true,
        message,
        status,
        data: {
          summary,
          ...results,
        },
      };
    } catch (error) {
      logger.error(`🐛 [GROUP UTIL] Bulk assignment error: ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  unAssignUser: async (request, next) => {
    try {
      const { grp_id, user_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const group = await GroupModel(tenant).findById(grp_id);
      let user = await UserModel(tenant).findById(user_id);
      if (isEmpty(group) || isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} or User ${user_id.toString()} not found`,
          }),
        );
        return;
      }

      // Check if the user is the manager of the group
      if (
        group.grp_manager &&
        group.grp_manager.toString() === user_id.toString()
      ) {
        // Count other members in the group
        const otherMembersCount = await UserModel(tenant).countDocuments({
          _id: { $ne: user_id },
          "group_roles.group": grp_id,
        });

        if (otherMembersCount === 0) {
          // Manager is the last member, delete the group instead of orphaning it
          try {
            await RoleModel(tenant).deleteMany({ group_id: grp_id });
            await GroupModel(tenant).findByIdAndDelete(grp_id);
          } catch (error) {
            logger.error(
              `Error during group/role cleanup for grp_id ${grp_id}: ${error.message}`,
            );
            // Decide if you want to re-throw or just log
          }
        } else {
          // There are other members, prevent the manager from leaving
          next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message:
                "You are the manager of this group. Please transfer ownership to another member before leaving, or delete the group if you are the only member.",
            }),
          );
          return;
        }
      }

      if (!isUserAssignedToGroup(user, grp_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} is not assigned to the user`,
          }),
        );
        return;
      }

      // Delete the user's preference for this group
      try {
        await PreferenceModel(tenant).deleteOne({
          user_id: user_id,
          group_id: grp_id,
        });
        logger.info(
          `Deleted preference for user ${user_id} in group ${grp_id}`,
        );
      } catch (prefError) {
        logger.error(`Failed to delete preference: ${prefError.message}`);
        // Decide if this should be a critical failure or just a warning
      }

      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { $pull: { group_roles: { group: grp_id } } },
        { new: true },
      );

      if (!isEmpty(updatedUser)) {
        return {
          success: true,
          message: "Successfully unassigned User from the Group",
          data: {
            _id: updatedUser._id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            userName: updatedUser.userName,
          },
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Unable to unassign the User",
          }),
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
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
          }),
        );
        return;
      }

      // Check if the manager is part of the unassignment list
      if (
        group.grp_manager &&
        user_ids.includes(group.grp_manager.toString())
      ) {
        // Count how many members would be left in the group after this operation
        const remainingMembersCount = await UserModel(tenant).countDocuments({
          "group_roles.group": grp_id,
          _id: { $nin: user_ids }, // Exclude users being removed
        });

        if (remainingMembersCount > 0) {
          // If members would be left, block the manager's removal
          next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: `The group manager (${group.grp_manager.toString()}) cannot be removed as part of a bulk operation while other members remain. Please transfer ownership first.`,
            }),
          );
          return;
        } else {
          // If this operation removes everyone, including the manager, proceed to delete the group and its roles
          try {
            await RoleModel(tenant).deleteMany({ group_id: grp_id });
            await GroupModel(tenant).findByIdAndDelete(grp_id);
            logger.info(
              `Group ${grp_id} and its roles were deleted as the last members, including the manager, were unassigned.`,
            );
          } catch (error) {
            logger.error(
              `Error during group/role cleanup for grp_id ${grp_id} in bulk operation: ${error.message}`,
            );
            // Continue with user un-assignment but log the cleanup failure
          }
        }
      }

      // Check if all the provided users actually exist
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id",
      );

      if (existingUsers.length !== user_ids.length) {
        const nonExistentUsers = user_ids.filter(
          (user_id) => !existingUsers.find((user) => user._id.equals(user_id)),
        );

        const errorMessages = {};
        nonExistentUsers.forEach((user_id) => {
          errorMessages[user_id] = `User ${user_id} does not exist`;
        });

        next(
          new HttpError(
            "Bad Request Error",
            httpStatus.BAD_REQUEST,
            errorMessages,
          ),
        );
        return;
      }

      // Check if all the provided user_ids are assigned to the group
      const users = await UserModel(tenant).find({
        _id: { $in: user_ids },
        "group_roles.group": grp_id,
      });

      if (users.length !== user_ids.length) {
        const unassignedUsers = user_ids.filter(
          (user_id) => !users.find((user) => user._id.equals(user_id)),
        );

        const errorMessages = {};
        unassignedUsers.forEach((user_id) => {
          errorMessages[user_id] =
            `User ${user_id} is not assigned to this group ${grp_id}`;
        });

        next(
          new HttpError(
            "Bad Request Error",
            httpStatus.BAD_REQUEST,
            errorMessages,
          ),
        );
        return;
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
            $pull: { group_roles: { group: grp_id } },
          },
        );

        const notFoundCount = totalUsers - nModified;
        if (nModified === 0) {
          // Even if no users were modified, still attempt to delete preferences
          // as a cleanup step in case of data inconsistency.
          await PreferenceModel(tenant).deleteMany({
            user_id: { $in: user_ids },
            group_id: grp_id,
          });
          logger.info(
            `Attempted cleanup of preferences for users in group ${grp_id}`,
          );

          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "No matching User found in the system",
            }),
          );
          return;
        }

        // Delete preferences for the users that were successfully unassigned
        const validUserIds = user_ids.filter((id) =>
          mongoose.Types.ObjectId.isValid(id),
        );
        const invalidUserIds = user_ids.filter(
          (id) => !mongoose.Types.ObjectId.isValid(id),
        );
        if (invalidUserIds.length > 0) {
          logger.warn(
            `Invalid user_ids found and skipped during preference deletion: ${invalidUserIds.join(", ")}`,
          );
        }
        const userObjectIds = validUserIds.map((id) => ObjectId(id));
        const deleteResult = await PreferenceModel(tenant).deleteMany({
          user_id: { $in: userObjectIds },
          group_id: grp_id,
        });
        logger.info(
          `Deleted ${deleteResult.deletedCount} preferences for users from group ${grp_id}`,
        );

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
            { message: error.message },
          ),
        );
        return;
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
          { message: error.message },
        ),
      );
      return;
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
          }),
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
        responseFromListAvailableUsers,
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
          { message: error.message },
        ),
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
          }),
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
          { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
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
              role_name: { $ifNull: ["$role.role_name", "No Role Assigned"] },
              role_id: { $ifNull: ["$role._id", null] },
              role_permissions: { $ifNull: ["$role_permissions", []] },
              userType: { $ifNull: ["$group_roles.userType", "guest"] },
            },
          },
        ])
        .exec();

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
          { message: error.message },
        ),
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
          }),
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
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
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
          { message: error.message },
        ),
      );
    }
  },

  /**
   * Enhanced setManager with automatic role assignment and permission handling
   */
  enhancedSetManager: async (request, next) => {
    try {
      logText("starting enhancedSetManager");
      const { grp_id, user_id } = request.params;
      const { tenant } = request.query;
      const { assign_manager_role = true, notify_user = true } = request.body;

      // Get current group and user details
      const [user, group] = await Promise.all([
        UserModel(tenant).findById(user_id).lean(),
        GroupModel(tenant).findById(grp_id).lean(),
      ]);

      logObject("User details", user);
      logObject("Group details", group);

      if (!user) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          }),
        );
        return;
      }

      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      // Check if user is already the manager
      if (
        group.grp_manager &&
        group.grp_manager.toString() === user_id.toString()
      ) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} is already the group manager`,
          }),
        );
        return;
      }

      // Verify user is part of the group
      const userGroupIds =
        user.group_roles?.map((gr) => gr.group.toString()) || [];
      if (!userGroupIds.includes(grp_id.toString())) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User must be a member of the group before becoming manager`,
          }),
        );
        return;
      }

      // Handle previous manager role transitions
      let previousManagerUpdate = null;
      if (group.grp_manager) {
        previousManagerUpdate = await groupUtil.removeManagerRole(
          group.grp_manager,
          grp_id,
          tenant,
        );
      }

      // Get or create the group manager role
      const managerRole = await groupUtil.ensureGroupManagerRole(
        grp_id,
        tenant,
      );

      // Update group manager
      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        grp_id,
        {
          grp_manager: user_id,
          grp_manager_username: user.email,
          grp_manager_firstname: user.firstName,
          grp_manager_lastname: user.lastName,
        },
        { new: true },
      );

      // Assign manager role to new manager if requested
      let roleAssignmentResult = null;
      if (assign_manager_role && managerRole) {
        roleAssignmentResult = await groupUtil.assignManagerRole(
          user_id,
          grp_id,
          managerRole._id,
          tenant,
        );
      }

      return {
        success: true,
        message: "Group manager successfully updated with enhanced permissions",
        data: {
          updated_group: updatedGroup,
          manager_role_assigned: !!roleAssignmentResult,
          previous_manager_updated: !!previousManagerUpdate,
          manager_permissions: managerRole?.role_permissions || [],
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Ensure group manager role exists, create if needed
   */
  ensureGroupManagerRole: async (grp_id, tenant) => {
    try {
      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) return null;

      const managerRoleName = `${group.grp_title.toUpperCase()}_GROUP_MANAGER`;

      // Check if manager role already exists
      let managerRole = await RoleModel(tenant)
        .findOne({
          group_id: grp_id,
          role_name: managerRoleName,
        })
        .lean();

      if (!managerRole) {
        // Create manager role
        const roleData = {
          role_name: managerRoleName,
          role_code: managerRoleName,
          role_description: `Group Manager role for ${group.grp_title}`,
          group_id: grp_id,
          role_status: "ACTIVE",
        };

        const createRoleResult = await RoleModel(tenant).register(roleData);
        if (createRoleResult.success) {
          managerRole = createRoleResult.data;

          // Assign manager permissions
          const managerPermissions =
            await groupUtil.getManagerPermissions(tenant);
          if (managerPermissions.length > 0) {
            await RoleModel(tenant).findByIdAndUpdate(managerRole._id, {
              $addToSet: { role_permissions: { $each: managerPermissions } },
            });
          }
        }
      }

      return managerRole;
    } catch (error) {
      logger.error(`Error ensuring group manager role: ${error.message}`);
      return null;
    }
  },

  /**
   * Get permissions that should be assigned to group managers
   */
  getManagerPermissions: async (tenant) => {
    try {
      const managerPermissionNames = [
        constants.GROUP_MANAGEMENT,
        constants.USER_MANAGEMENT,
        constants.ROLE_ASSIGNMENT,
        constants.ORG_USER_ASSIGN,
        constants.GROUP_SETTINGS,
        constants.ANALYTICS_VIEW,
        constants.MEMBER_INVITE,
        constants.CONTENT_MODERATION,
      ];

      const permissions = await PermissionModel(tenant)
        .find({ permission: { $in: managerPermissionNames } })
        .select("_id")
        .lean();

      return permissions.map((p) => p._id);
    } catch (error) {
      logger.error(`Error getting manager permissions: ${error.message}`);
      return [];
    }
  },

  /**
   * Assign manager role to user
   */
  assignManagerRole: async (user_id, grp_id, role_id, tenant) => {
    try {
      // First remove any existing manager role for this group
      await UserModel(tenant).updateOne(
        { _id: user_id },
        {
          $pull: {
            group_roles: {
              group: grp_id,
              role: {
                $in: await groupUtil.getGroupManagerRoleIds(grp_id, tenant),
              },
            },
          },
        },
      );

      // Add the new manager role
      const result = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        {
          $addToSet: {
            group_roles: {
              group: grp_id,
              role: role_id,
              userType: "user",
              createdAt: new Date(),
            },
          },
        },
        { new: true },
      );

      return result;
    } catch (error) {
      logger.error(`Error assigning manager role: ${error.message}`);
      return null;
    }
  },

  /**
   * Remove manager role from previous manager
   */
  removeManagerRole: async (user_id, grp_id, tenant) => {
    try {
      const managerRoleIds = await groupUtil.getGroupManagerRoleIds(
        grp_id,
        tenant,
      );

      const result = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        {
          $pull: {
            group_roles: {
              group: grp_id,
              role: { $in: managerRoleIds },
            },
          },
        },
        { new: true },
      );

      return result;
    } catch (error) {
      logger.error(`Error removing manager role: ${error.message}`);
      return null;
    }
  },

  /**
   * Get all manager role IDs for a group
   */
  getGroupManagerRoleIds: async (grp_id, tenant) => {
    try {
      const managerRoles = await RoleModel(tenant)
        .find({
          group_id: grp_id,
          $or: [
            { role_name: { $regex: /_GROUP_MANAGER$/ } },
            { role_name: { $regex: /_SUPER_ADMIN$/ } },
          ],
        })
        .select("_id")
        .lean();

      return managerRoles.map((role) => role._id);
    } catch (error) {
      logger.error(`Error getting group manager role IDs: ${error.message}`);
      return [];
    }
  },

  /**
   * Get enhanced dashboard data for group managers
   */
  getManagerDashboard: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant } = request.query;
      const { time_range = "30d" } = request.query;

      const group = await GroupModel(tenant).findById(grp_id).lean();

      if (!group) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${grp_id} not found`,
          }),
        );
        return;
      }

      // Manually fetch manager details if grp_manager exists
      let manager = null;
      if (group.grp_manager) {
        manager = await UserModel(tenant)
          .findById(group.grp_manager)
          .select("firstName lastName email profilePicture")
          .lean();
      }

      // Get member statistics
      const memberStats = await groupUtil.getMemberStatistics(
        grp_id,
        tenant,
        time_range,
      );

      // Get activity metrics
      const activityMetrics = await groupUtil.getActivityMetrics(
        grp_id,
        tenant,
        time_range,
      );

      // Get role distribution
      const roleDistribution = await groupUtil.getRoleDistribution(
        grp_id,
        tenant,
      );

      // Get pending access requests
      const pendingRequests = await groupUtil.getPendingAccessRequests(
        grp_id,
        tenant,
      );

      const dashboardData = {
        group_info: {
          name: group.grp_title,
          description: group.grp_description,
          manager: manager,
          created_at: group.createdAt,
          status: group.grp_status,
        },
        member_statistics: memberStats,
        activity_metrics: activityMetrics,
        role_distribution: roleDistribution,
        pending_requests: pendingRequests,
        management_insights: await groupUtil.getManagementInsights(
          grp_id,
          tenant,
          time_range,
        ),
      };

      return {
        success: true,
        message: "Manager dashboard data retrieved successfully",
        data: dashboardData,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Get member statistics for manager dashboard
   */
  getMemberStatistics: async (grp_id, tenant, timeRange) => {
    try {
      const pipeline = [
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        {
          $group: {
            _id: null,
            total_members: { $sum: 1 },
            active_members: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
            recent_logins: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      "$lastLogin",
                      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ];

      const stats = await UserModel(tenant).aggregate(pipeline);
      return (
        stats[0] || { total_members: 0, active_members: 0, recent_logins: 0 }
      );
    } catch (error) {
      logger.error(`Error getting member statistics: ${error.message}`);
      return { total_members: 0, active_members: 0, recent_logins: 0 };
    }
  },

  /**
   * Get activity metrics for the group
   */
  getActivityMetrics: async (grp_id, tenant, timeRange) => {
    try {
      // This would typically connect to your activity/audit log system
      // For now, return mock data structure
      return {
        new_members_this_period: 0,
        role_changes: 0,
        login_frequency: 0,
        engagement_score: 0,
      };
    } catch (error) {
      logger.error(`Error getting activity metrics: ${error.message}`);
      return {
        new_members_this_period: 0,
        role_changes: 0,
        login_frequency: 0,
        engagement_score: 0,
      };
    }
  },

  /**
   * Get role distribution within the group
   */
  getRoleDistribution: async (grp_id, tenant) => {
    try {
      const pipeline = [
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        { $unwind: "$group_roles" },
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        {
          $lookup: {
            from: "roles",
            localField: "group_roles.role",
            foreignField: "_id",
            as: "role_info",
          },
        },
        { $unwind: "$role_info" },
        {
          $group: {
            _id: "$role_info.role_name",
            count: { $sum: 1 },
            role_id: { $first: "$role_info._id" },
          },
        },
        { $sort: { count: -1 } },
      ];

      const distribution = await UserModel(tenant).aggregate(pipeline);
      return distribution.map((item) => ({
        role_name: item._id,
        role_id: item.role_id,
        member_count: item.count,
      }));
    } catch (error) {
      logger.error(`Error getting role distribution: ${error.message}`);
      return [];
    }
  },

  /**
   * Get pending access requests for the group
   */
  getPendingAccessRequests: async (grp_id, tenant) => {
    try {
      const requests = await AccessRequestModel(tenant).aggregate([
        {
          $match: {
            targetId: grp_id,
            requestType: "group",
            status: "pending",
          },
        },
        {
          $lookup: {
            from: "users", // Collection name for the user model
            localField: "user_id",
            foreignField: "_id",
            as: "user_details",
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  profilePicture: 1,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            user_id: {
              $cond: {
                if: { $gt: [{ $size: "$user_details" }, 0] },
                then: { $arrayElemAt: ["$user_details", 0] },
                else: null,
              },
            },
          },
        },
        {
          $project: {
            user_details: 0, // Remove the temporary field
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
      ]);

      return requests.map((req) => ({
        request_id: req._id,
        user: req.user_id,
        requested_at: req.createdAt,
        message: req.message || "",
        status: req.status,
      }));
    } catch (error) {
      logger.error(`Error getting pending access requests: ${error.message}`);
      return [];
    }
  },

  /**
   * Get management insights and recommendations
   */
  getManagementInsights: async (grp_id, tenant, timeRange) => {
    try {
      const insights = [];

      // Get member statistics for insights
      const memberStats = await groupUtil.getMemberStatistics(
        grp_id,
        tenant,
        timeRange,
      );

      // Generate insights based on data
      if (memberStats.total_members === 0) {
        insights.push({
          type: "warning",
          title: "No Members",
          message:
            "Your group has no members yet. Consider inviting users to join.",
          action: "invite_members",
        });
      }

      if (memberStats.active_members < memberStats.total_members * 0.5) {
        insights.push({
          type: "info",
          title: "Low Member Activity",
          message:
            "Less than 50% of your members are active. Consider engagement strategies.",
          action: "improve_engagement",
        });
      }

      if (memberStats.recent_logins === 0) {
        insights.push({
          type: "alert",
          title: "No Recent Activity",
          message:
            "No members have logged in recently. Check group visibility and notifications.",
          action: "check_notifications",
        });
      }

      return insights;
    } catch (error) {
      logger.error(`Error getting management insights: ${error.message}`);
      return [];
    }
  },

  /**
   * Bulk manage group members (approve/reject/assign roles)
   */
  bulkMemberManagement: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant } = request.query;
      const { actions } = request.body; // Array of { user_id, action, role_id?, reason? }

      const results = [];

      for (const action of actions) {
        const { user_id, action_type, role_id, reason } = action;

        try {
          let result = {};

          switch (action_type) {
            case "assign_role":
              if (role_id) {
                result = await groupUtil.assignRoleToMember(
                  user_id,
                  grp_id,
                  role_id,
                  tenant,
                );
              }
              break;

            case "remove_role":
              if (role_id) {
                result = await groupUtil.removeRoleFromMember(
                  user_id,
                  grp_id,
                  role_id,
                  tenant,
                );
              }
              break;

            case "remove_member":
              result = await groupUtil.removeMemberFromGroup(
                user_id,
                grp_id,
                tenant,
                reason,
              );
              break;

            default:
              result = { success: false, message: "Unknown action type" };
          }

          results.push({
            user_id,
            action_type,
            success: result.success || false,
            message: result.message || "Action completed",
          });
        } catch (error) {
          results.push({
            user_id,
            action_type,
            success: false,
            message: error.message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;

      return {
        success: true,
        message: `Bulk management completed: ${successCount}/${results.length} actions successful`,
        data: {
          results,
          summary: {
            total_actions: results.length,
            successful: successCount,
            failed: results.length - successCount,
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Helper function to assign role to member
   */
  assignRoleToMember: async (user_id, grp_id, role_id, tenant) => {
    try {
      const result = await UserModel(tenant).findOneAndUpdate(
        {
          _id: user_id,
          "group_roles.group": grp_id,
        },
        {
          $set: { "group_roles.$.role": role_id },
        },
        { new: true },
      );

      return {
        success: !!result,
        message: result ? "Role assigned" : "User not found in group",
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Helper function to remove role from member
   */
  removeRoleFromMember: async (user_id, grp_id, role_id, tenant) => {
    try {
      const result = await UserModel(tenant).findOneAndUpdate(
        {
          _id: user_id,
          "group_roles.group": grp_id,
          "group_roles.role": role_id,
        },
        {
          $set: { "group_roles.$.role": null },
        },
        { new: true },
      );

      return {
        success: !!result,
        message: result ? "Role removed" : "User/role combination not found",
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Helper function to remove member from group
   */
  removeMemberFromGroup: async (user_id, grp_id, tenant, reason) => {
    try {
      const result = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        {
          $pull: { group_roles: { group: grp_id } },
        },
        { new: true },
      );

      return {
        success: !!result,
        message: result ? "Member removed from group" : "User not found",
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Assign specific role to a group member
   */
  assignMemberRole: async (request, next) => {
    try {
      const { grp_id, user_id } = request.params;
      const { role_id, effective_date, reason } = request.body;
      const { tenant } = request.query;

      // Verify group exists
      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      // Verify user exists and is part of the group
      const user = await UserModel(tenant).findById(user_id).lean();
      if (!user) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          }),
        );
        return;
      }

      const isGroupMember = user.group_roles?.some(
        (gr) => gr.group.toString() === grp_id.toString(),
      );

      if (!isGroupMember) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User is not a member of this group",
          }),
        );
        return;
      }

      // Verify role exists and belongs to the group
      const role = await RoleModel(tenant)
        .findOne({
          _id: role_id,
          group_id: grp_id,
        })
        .lean();

      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Role not found or does not belong to this group",
          }),
        );
        return;
      }

      // Update user's role in the group
      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        {
          _id: user_id,
          "group_roles.group": grp_id,
        },
        {
          $set: {
            "group_roles.$.role": role_id,
            "group_roles.$.updatedAt": new Date(),
          },
        },
        { new: true },
      );

      return {
        success: true,
        message: `Role ${role.role_name} successfully assigned to user`,
        data: {
          user_id,
          group_id: grp_id,
          assigned_role: {
            id: role_id,
            name: role.role_name,
          },
          effective_date: effective_date || new Date(),
          assigned_by: request.user?._id,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Send group invitations via email
   */
  sendGroupInvitations: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const {
        invitations,
        expiry_hours = 72,
        auto_approve = false,
      } = request.body;
      const { tenant } = request.query;

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      const results = [];
      const inviter = request.user;

      for (const invitation of invitations) {
        const { email, role_id, message } = invitation;

        try {
          // Check if user already exists
          let existingUser = await UserModel(tenant).findOne({ email }).lean();

          // Check if already a group member
          if (existingUser) {
            const isAlreadyMember = existingUser.group_roles?.some(
              (gr) => gr.group.toString() === grp_id.toString(),
            );

            if (isAlreadyMember) {
              results.push({
                email,
                status: "skipped",
                reason: "User is already a group member",
              });
              continue;
            }
          }

          // Create access request or direct assignment
          const invitationData = {
            email,
            targetId: grp_id,
            requestType: "group",
            status: auto_approve ? "approved" : "pending",
            inviter_id: inviter._id,
            message,
            role_id,
            expiresAt: new Date(Date.now() + expiry_hours * 60 * 60 * 1000),
          };

          if (existingUser) {
            invitationData.user_id = existingUser._id;
          }

          const accessRequest =
            await AccessRequestModel(tenant).create(invitationData);

          // If auto-approve and user exists, add to group immediately
          if (auto_approve && existingUser && role_id) {
            await UserModel(tenant).findByIdAndUpdate(existingUser._id, {
              $addToSet: {
                group_roles: {
                  group: grp_id,
                  role: role_id,
                  userType: "user",
                  createdAt: new Date(),
                },
              },
            });
          }

          results.push({
            email,
            status: auto_approve ? "approved" : "invited",
            invitation_id: accessRequest._id,
            expires_at: invitationData.expiresAt,
          });
        } catch (error) {
          results.push({
            email,
            status: "failed",
            reason: error.message,
          });
        }
      }

      const successCount = results.filter(
        (r) => r.status === "invited" || r.status === "approved",
      ).length;

      return {
        success: true,
        message: `${successCount}/${invitations.length} invitations processed successfully`,
        data: {
          invitations: results,
          group_name: group.grp_title,
          invited_by: inviter.email,
          summary: {
            total: invitations.length,
            successful: successCount,
            failed: results.filter((r) => r.status === "failed").length,
            skipped: results.filter((r) => r.status === "skipped").length,
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * List group invitations and their status
   */
  listGroupInvitations: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant, status = "all", limit = 50, skip = 0 } = request.query;

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      const filter = {
        targetId: grp_id,
        requestType: "group",
      };

      if (status !== "all") {
        filter.status = status;
      }

      // Use aggregation pipeline instead of populate
      const invitations = await AccessRequestModel(tenant).aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: parseInt(skip) },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user_details",
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  profilePicture: 1,
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "inviter_id",
            foreignField: "_id",
            as: "inviter_details",
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            user_id: { $arrayElemAt: ["$user_details", 0] },
            inviter_id: { $arrayElemAt: ["$inviter_details", 0] },
          },
        },
        {
          $project: {
            user_details: 0,
            inviter_details: 0,
          },
        },
      ]);

      const totalCount =
        await AccessRequestModel(tenant).countDocuments(filter);

      return {
        success: true,
        message: "Group invitations retrieved successfully",
        data: {
          invitations: invitations.map((inv) => ({
            id: inv._id,
            email: inv.email,
            user: inv.user_id,
            inviter: inv.inviter_id,
            status: inv.status,
            message: inv.message,
            role_id: inv.role_id,
            invited_at: inv.createdAt,
            expires_at: inv.expiresAt,
            processed_at: inv.processedAt,
          })),
          total_count: totalCount,
          group_name: group.grp_title,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Update group status with audit trail
   */
  updateGroupStatus: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const {
        status,
        reason,
        notify_members = false,
        effective_date,
      } = request.body;
      const { tenant } = request.query;

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      const previousStatus = group.grp_status;
      const updateDate = effective_date ? new Date(effective_date) : new Date();

      // Update group status
      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        grp_id,
        {
          grp_status: status,
          status_updated_at: updateDate,
          status_updated_by: request.user?._id,
        },
        { new: true },
      );

      // Handle member notifications if requested
      let notificationResults = null;
      if (notify_members) {
        notificationResults = await groupUtil.notifyGroupMembers({
          tenant,
          group_id: grp_id,
          message: `Group status changed from ${previousStatus} to ${status}`,
          reason,
          type: "status_change",
        });
      }

      return {
        success: true,
        message: `Group status successfully updated to ${status}`,
        data: {
          group_id: grp_id,
          previous_status: previousStatus,
          new_status: status,
          effective_date: updateDate,
          updated_by: request.user?._id,
          reason,
          notifications_sent: notificationResults?.sent_count || 0,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Get group activity log with filtering
   */
  getGroupActivityLog: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const {
        tenant,
        start_date,
        end_date,
        activity_type,
        user_id,
        limit = 100,
        skip = 0,
      } = request.query;

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      // Build activity log filter
      const filter = { group_id: grp_id };

      if (start_date || end_date) {
        filter.createdAt = {};
        if (start_date) filter.createdAt.$gte = new Date(start_date);
        if (end_date) filter.createdAt.$lte = new Date(end_date);
      }

      if (activity_type) filter.activity_type = activity_type;
      if (user_id) filter.actor_id = user_id;

      // We will have a dedicated ActivityLog model
      const activities = await groupUtil.getActivityLogEntries(filter, {
        limit: parseInt(limit),
        skip: parseInt(skip),
        tenant,
      });

      return {
        success: true,
        message: "Activity log retrieved successfully",
        data: {
          activities,
          group_name: group.grp_title,
          filters_applied: {
            start_date,
            end_date,
            activity_type,
            user_id,
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Advanced search for group members with filtering and sorting
   */
  searchGroupMembers: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const {
        tenant,
        search,
        role_id,
        status = "all",
        sort_by = "name",
        sort_order = "asc",
        limit = 50,
        skip = 0,
      } = request.query;

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        { $unwind: "$group_roles" },
        { $match: { "group_roles.group": ObjectId(grp_id) } },
      ];

      // Add search filter if provided
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { userName: { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      // Add role lookup
      pipeline.push({
        $lookup: {
          from: "roles",
          localField: "group_roles.role",
          foreignField: "_id",
          as: "role_info",
        },
      });

      // Add role filter if provided
      if (role_id) {
        pipeline.push({
          $match: { "group_roles.role": ObjectId(role_id) },
        });
      }

      // Add status filter
      if (status !== "all") {
        const statusFilter = status === "active" ? true : false;
        pipeline.push({
          $match: { isActive: statusFilter },
        });
      }

      // Add sorting
      const sortField =
        sort_by === "name"
          ? "firstName"
          : sort_by === "joined_date"
            ? "group_roles.createdAt"
            : sort_by === "last_login"
              ? "lastLogin"
              : sort_by === "role"
                ? "role_info.role_name"
                : sort_by;

      const sortDirection = sort_order === "desc" ? -1 : 1;
      pipeline.push({ $sort: { [sortField]: sortDirection } });

      // Add projection
      pipeline.push({
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          userName: 1,
          email: 1,
          profilePicture: 1,
          isActive: 1,
          lastLogin: 1,
          jobTitle: 1,
          createdAt: {
            $dateToString: { format: "%Y-%m-%d %H:%M:%S", date: "$_id" },
          },
          role_name: { $arrayElemAt: ["$role_info.role_name", 0] },
          role_id: { $arrayElemAt: ["$role_info._id", 0] },
          joined_date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $ifNull: ["$group_roles.createdAt", "$_id"] },
            },
          },
        },
      });

      // Add pagination
      pipeline.push({ $skip: parseInt(skip) });
      pipeline.push({ $limit: parseInt(limit) });

      const members = await UserModel(tenant).aggregate(pipeline);

      // Get total count for pagination
      const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
      countPipeline.push({ $count: "total" });
      const countResult = await UserModel(tenant).aggregate(countPipeline);
      const totalCount = countResult[0]?.total || 0;

      return {
        success: true,
        message: "Group members search completed successfully",
        data: {
          members,
          pagination: {
            total_count: totalCount,
            current_page: Math.floor(skip / limit) + 1,
            total_pages: Math.ceil(totalCount / limit),
            limit: parseInt(limit),
            skip: parseInt(skip),
          },
          search_criteria: {
            search,
            role_id,
            status,
            sort_by,
            sort_order,
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Export group data in various formats
   */
  exportGroupData: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const {
        tenant,
        format = "json",
        include_members = true,
        include_roles = true,
        include_activity = false,
        date_range = "all",
      } = request.query;

      // Get group without populate
      const group = await GroupModel(tenant).findById(grp_id).lean();

      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      // Manually fetch manager details if grp_manager exists
      let manager = null;
      if (group.grp_manager) {
        manager = await UserModel(tenant)
          .findById(group.grp_manager)
          .select("firstName lastName email")
          .lean();
      }

      const exportData = {
        group_info: {
          id: group._id,
          title: group.grp_title,
          description: group.grp_description,
          status: group.grp_status,
          created_at: group.createdAt,
          manager: manager,
        },
        export_metadata: {
          exported_at: new Date(),
          exported_by: request.user?.email,
          format,
          date_range,
        },
      };

      // Include members if requested
      if (include_members) {
        const members = await UserModel(tenant).aggregate([
          { $match: { "group_roles.group": ObjectId(grp_id) } },
          { $unwind: "$group_roles" },
          { $match: { "group_roles.group": ObjectId(grp_id) } },
          {
            $lookup: {
              from: "roles",
              localField: "group_roles.role",
              foreignField: "_id",
              as: "role_info",
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              email: 1,
              userName: 1,
              isActive: 1,
              lastLogin: 1,
              role_name: { $arrayElemAt: ["$role_info.role_name", 0] },
              joined_date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $ifNull: ["$group_roles.createdAt", "$_id"] },
                },
              },
            },
          },
        ]);

        exportData.members = members;
        exportData.member_count = members.length;
      }

      // Include roles if requested
      if (include_roles) {
        // Use aggregation instead of populate for roles
        const roles = await RoleModel(tenant).aggregate([
          { $match: { group_id: grp_id } },
          {
            $lookup: {
              from: "permissions",
              localField: "role_permissions",
              foreignField: "_id",
              as: "permissions_details",
              pipeline: [
                {
                  $project: {
                    permission: 1,
                    description: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              _id: 1,
              role_name: 1,
              role_code: 1,
              role_description: 1,
              role_status: 1,
              role_permissions: "$permissions_details",
            },
          },
        ]);

        exportData.roles = roles.map((role) => ({
          id: role._id,
          name: role.role_name,
          code: role.role_code,
          description: role.role_description,
          status: role.role_status,
          permissions: role.role_permissions,
        }));
      }

      // Include activity if requested (simplified version)
      if (include_activity) {
        exportData.recent_activity = [
          {
            type: "export_generated",
            timestamp: new Date(),
            details: "Group data export generated",
          },
        ];
      }

      // Format data based on requested format
      if (format === "csv") {
        const csvData = groupUtil.convertToCSV(exportData);
        return {
          success: true,
          message: "Group data exported to CSV successfully",
          data: csvData,
          status: httpStatus.OK,
        };
      } else if (format === "xlsx") {
        // we will use library like xlsx to generate Excel files
        return {
          success: false,
          message: "Excel export format is not yet implemented",
          status: httpStatus.NOT_IMPLEMENTED,
        };
      } else {
        // Default JSON format
        return {
          success: true,
          message: "Group data exported to JSON successfully",
          data: exportData,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Get group health diagnostics
   */
  getGroupHealth: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant } = request.query;

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          }),
        );
        return;
      }

      // Get member statistics
      const memberStats = await UserModel(tenant).aggregate([
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        {
          $group: {
            _id: null,
            total_members: { $sum: 1 },
            active_members: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
            recent_logins: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      "$lastLogin",
                      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      const stats = memberStats[0] || {
        total_members: 0,
        active_members: 0,
        recent_logins: 0,
      };

      // Check for potential issues
      const healthIssues = [];
      const healthScore = groupUtil.calculateHealthScore(stats, group);

      if (stats.total_members === 0) {
        healthIssues.push({
          severity: "high",
          issue: "No members",
          description: "Group has no members assigned",
          recommendation: "Invite users to join the group",
        });
      }

      if (stats.active_members < stats.total_members * 0.5) {
        healthIssues.push({
          severity: "medium",
          issue: "Low member activity",
          description: "Less than 50% of members are active",
          recommendation:
            "Review member engagement and consider re-activation campaigns",
        });
      }

      if (stats.recent_logins === 0 && stats.total_members > 0) {
        healthIssues.push({
          severity: "medium",
          issue: "No recent activity",
          description: "No members have logged in recently",
          recommendation:
            "Check group visibility and send engagement notifications",
        });
      }

      if (!group.grp_manager) {
        healthIssues.push({
          severity: "high",
          issue: "No group manager",
          description: "Group does not have an assigned manager",
          recommendation: "Assign a group manager for proper administration",
        });
      }

      return {
        success: true,
        message: "Group health check completed successfully",
        data: {
          group_id: grp_id,
          group_name: group.grp_title,
          health_score: healthScore,
          health_status:
            healthScore >= 80
              ? "excellent"
              : healthScore >= 60
                ? "good"
                : healthScore >= 40
                  ? "fair"
                  : "poor",
          member_statistics: stats,
          health_issues: healthIssues,
          recommendations: healthIssues.map((issue) => issue.recommendation),
          last_checked: new Date(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  /**
   * Helper: Get activity log entries
   */
  getActivityLogEntries: async (filter, options) => {
    try {
      // Mock activity data for demonstration
      // In production, this would query your ActivityLog model
      return [
        {
          id: "activity_1",
          activity_type: "member_added",
          actor: { name: "John Manager", email: "john@example.com" },
          target_user: { name: "Jane Doe", email: "jane@example.com" },
          details: { role: "Member" },
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: "activity_2",
          activity_type: "role_assigned",
          actor: { name: "John Manager", email: "john@example.com" },
          target_user: { name: "Bob Smith", email: "bob@example.com" },
          details: { role: "Admin", previous_role: "Member" },
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ];
    } catch (error) {
      logger.error(`Error getting activity log entries: ${error.message}`);
      return [];
    }
  },

  /**
   * Helper: Notify group members
   */
  notifyGroupMembers: async ({ tenant, group_id, message, reason, type }) => {
    try {
      const members = await UserModel(tenant)
        .find({ "group_roles.group": group_id })
        .select("email firstName lastName")
        .lean();

      // In production, integrate with your notification service
      logger.info(`Notifying ${members.length} group members: ${message}`);

      return {
        sent_count: members.length,
        type,
        message,
      };
    } catch (error) {
      logger.error(`Error notifying group members: ${error.message}`);
      return { sent_count: 0 };
    }
  },

  /**
   * Helper: Convert data to CSV format
   */
  convertToCSV: (data) => {
    try {
      if (!data.members || data.members.length === 0) {
        return "No member data to export";
      }

      const headers = [
        "First Name",
        "Last Name",
        "Email",
        "Username",
        "Role",
        "Status",
        "Joined Date",
        "Last Login",
      ];
      const csvRows = [headers.join(",")];

      data.members.forEach((member) => {
        const row = [
          member.firstName || "",
          member.lastName || "",
          member.email || "",
          member.userName || "",
          member.role_name || "",
          member.isActive ? "Active" : "Inactive",
          member.joined_date || "",
          member.lastLogin
            ? new Date(member.lastLogin).toISOString().split("T")[0]
            : "",
        ];
        csvRows.push(row.map((field) => `"${field}"`).join(","));
      });

      return csvRows.join("\n");
    } catch (error) {
      logger.error(`Error converting to CSV: ${error.message}`);
      return "Error generating CSV data";
    }
  },

  /**
   * Helper: Calculate group health score
   */
  calculateHealthScore: (stats, group) => {
    try {
      let score = 0;
      const maxScore = 100;

      // Member count score (30 points max)
      if (stats.total_members > 0) {
        score += Math.min(30, stats.total_members * 2);
      }

      // Activity score (40 points max)
      if (stats.total_members > 0) {
        const activityRatio = stats.active_members / stats.total_members;
        score += activityRatio * 40;
      }

      // Recent engagement score (20 points max)
      if (stats.total_members > 0) {
        const engagementRatio = stats.recent_logins / stats.total_members;
        score += engagementRatio * 20;
      }

      // Management score (10 points max)
      if (group.grp_manager) {
        score += 10;
      }

      return Math.round(Math.min(score, maxScore));
    } catch (error) {
      logger.error(`Error calculating health score: ${error.message}`);
      return 0;
    }
  },
  /**
   * Get group analytics data
   */
  getGroupAnalytics: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const {
        tenant,
        time_range = "30d",
        metric_type = "overview",
      } = request.query;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const group = await GroupModel(actualTenant).findById(grp_id).lean();
      if (!group) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${grp_id} not found`,
          }),
        );
        return;
      }

      // Get various analytics based on metric_type
      let analyticsData = {};

      switch (metric_type) {
        case "members":
          analyticsData = await groupUtil.getMemberAnalyticsData(
            grp_id,
            actualTenant,
            time_range,
          );
          break;
        case "activity":
          analyticsData = await groupUtil.getActivityAnalyticsData(
            grp_id,
            actualTenant,
            time_range,
          );
          break;
        case "roles":
          analyticsData = await groupUtil.getRoleAnalyticsData(
            grp_id,
            actualTenant,
            time_range,
          );
          break;
        default:
          analyticsData = await groupUtil.getOverviewAnalyticsData(
            grp_id,
            actualTenant,
            time_range,
          );
      }

      return {
        success: true,
        message: `Group ${metric_type} analytics retrieved successfully`,
        data: {
          group_info: {
            name: group.grp_title,
            id: grp_id,
          },
          time_range,
          metric_type,
          data: analyticsData,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  /**
   * Helper: Get member analytics data
   */
  getMemberAnalyticsData: async (grp_id, tenant, timeRange) => {
    try {
      const pipeline = [
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            new_members: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ];

      const dailyGrowth = await UserModel(tenant).aggregate(pipeline);

      return {
        daily_growth: dailyGrowth,
        total_members: await UserModel(tenant).countDocuments({
          "group_roles.group": grp_id,
        }),
        active_members: await UserModel(tenant).countDocuments({
          "group_roles.group": grp_id,
          isActive: true,
        }),
      };
    } catch (error) {
      logger.error(`Error getting member analytics: ${error.message}`);
      return { daily_growth: [], total_members: 0, active_members: 0 };
    }
  },

  /**
   * Helper: Get activity analytics data
   */
  getActivityAnalyticsData: async (grp_id, tenant, timeRange) => {
    try {
      // This would connect to your activity logging system
      // For now, return structure for frontend integration
      return {
        login_frequency: {
          daily: [],
          weekly: [],
          monthly: [],
        },
        engagement_metrics: {
          average_session_duration: 0,
          feature_usage: {},
          content_interactions: 0,
        },
        trend_analysis: {
          growth_rate: 0,
          retention_rate: 0,
          churn_rate: 0,
        },
      };
    } catch (error) {
      logger.error(`Error getting activity analytics: ${error.message}`);
      return {
        login_frequency: {},
        engagement_metrics: {},
        trend_analysis: {},
      };
    }
  },

  /**
   * Helper: Get role analytics data
   */
  getRoleAnalyticsData: async (grp_id, tenant, timeRange) => {
    try {
      const roleDistribution = await UserModel(tenant).aggregate([
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        { $unwind: "$group_roles" },
        { $match: { "group_roles.group": ObjectId(grp_id) } },
        {
          $lookup: {
            from: "roles",
            localField: "group_roles.role",
            foreignField: "_id",
            as: "role_info",
          },
        },
        { $unwind: "$role_info" },
        {
          $group: {
            _id: "$role_info.role_name",
            count: { $sum: 1 },
            permissions: { $first: "$role_info.role_permissions" },
          },
        },
      ]);

      return {
        role_distribution: roleDistribution,
        role_changes: [], // Would come from audit logs
        permission_usage: {}, // Would track which permissions are most used
      };
    } catch (error) {
      logger.error(`Error getting role analytics: ${error.message}`);
      return { role_distribution: [], role_changes: [], permission_usage: {} };
    }
  },

  /**
   * Helper: Get overview analytics data
   */
  getOverviewAnalyticsData: async (grp_id, tenant, timeRange) => {
    try {
      const [memberAnalytics, roleAnalytics] = await Promise.all([
        groupUtil.getMemberAnalyticsData(grp_id, tenant, timeRange),
        groupUtil.getRoleAnalyticsData(grp_id, tenant, timeRange),
      ]);

      return {
        summary: {
          total_members: memberAnalytics.total_members,
          active_members: memberAnalytics.active_members,
          total_roles: roleAnalytics.role_distribution.length,
          engagement_score: Math.round(
            (memberAnalytics.active_members /
              Math.max(memberAnalytics.total_members, 1)) *
              100,
          ),
        },
        quick_stats: memberAnalytics,
        role_overview: roleAnalytics.role_distribution.slice(0, 5), // Top 5 roles
      };
    } catch (error) {
      logger.error(`Error getting overview analytics: ${error.message}`);
      return { summary: {}, quick_stats: {}, role_overview: [] };
    }
  },
  assignCohortsToGroup: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { cohort_ids } = request.body;
      const { tenant } = request.query;

      const group = await GroupModel(tenant).findById(grp_id);
      if (!group) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Group ${grp_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        grp_id,
        { $addToSet: { cohorts: { $each: cohort_ids } } },
        { new: true },
      );

      return {
        success: true,
        message: "Cohorts assigned to group successfully",
        data: updatedGroup,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  unassignCohortsFromGroup: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { cohort_ids } = request.body;
      const { tenant } = request.query;

      const group = await GroupModel(tenant).findById(grp_id);
      if (!group) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Group ${grp_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        grp_id,
        { $pullAll: { cohorts: cohort_ids } },
        { new: true },
      );

      return {
        success: true,
        message: "Cohorts unassigned from group successfully",
        data: updatedGroup,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  listGroupCohorts: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant } = request.query;

      const group = await GroupModel(tenant)
        .findById(grp_id)
        .select("cohorts")
        .lean();

      if (!group) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Group ${grp_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      return {
        success: true,
        message: "Successfully retrieved group cohorts",
        data: group.cohorts || [],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  leaveGroup: async (request, next) => {
    try {
      const { grp_id } = request.params;
      const { tenant } = request.query;
      const { _id: user_id } = request.user;

      if (!request.user || !request.user._id) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Authentication is required to perform this action.",
          }),
        );
      }

      // Find the user and group
      const user = await UserModel(tenant).findById(user_id);
      const group = await GroupModel(tenant).findById(grp_id);

      if (!user || !group) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "User or Group not found",
          }),
        );
      }

      // Prevent leaving the default "airqo" group
      if (group.grp_title && group.grp_title.toLowerCase() === "airqo") {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message:
              "You cannot leave the default 'airqo' organization. This group is mandatory for platform access.",
          }),
        );
      }

      // Check if the user is the manager of the group
      if (
        group.grp_manager &&
        group.grp_manager.toString() === user_id.toString()
      ) {
        // Count other members in the group
        const otherMembersCount = await UserModel(tenant).countDocuments({
          _id: { $ne: user_id },
          "group_roles.group": grp_id,
        });

        if (otherMembersCount > 0) {
          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message:
                "You are the manager of this group. Please transfer ownership to another member before leaving.",
            }),
          );
        }
      }

      if (!isUserAssignedToGroup(user, grp_id)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "You are not a member of this group",
          }),
        );
      }

      // Delete the user's preference for this group
      try {
        await PreferenceModel(tenant).deleteOne({
          user_id: user_id,
          group_id: grp_id,
        });
        logger.info(
          `Deleted preference for user ${user_id} after leaving group ${grp_id}`,
        );
      } catch (prefError) {
        logger.error(
          `Failed to delete preference on leave: ${prefError.message}`,
        );
      }

      // Use findByIdAndUpdate with $pull to atomically remove the group role
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { $pull: { group_roles: { group: grp_id } } },
        { new: true },
      );

      if (!updatedUser) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message:
              "User not found after update, possibly deleted during operation.",
          }),
        );
      }

      return {
        success: true,
        message: "Successfully left the group",
        data: {
          _id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          userName: updatedUser.userName,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error on leaveGroup: ${error.message}`,
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
};

module.exports = groupUtil;
