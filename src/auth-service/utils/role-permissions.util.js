const PermissionModel = require("@models/Permission");
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const { logObject, logText, HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- role-permissions util`
);

const convertToUpperCaseWithUnderscore = (inputString, next) => {
  try {
    const uppercaseString = inputString.toUpperCase();
    const transformedString = uppercaseString.replace(/ /g, "_");
    return transformedString;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
const isGroupRoleOrNetworkRole = (role) => {
  logObject("role", role);
  if (role && (role.group_id || role.network_id)) {
    if (role.group_id && !role.network_id) {
      return "group";
    } else if (!role.group_id && role.network_id) {
      return "network";
    } else {
      return "none";
    }
  }
  return "none";
};
const findAssociatedIdForRole = async ({
  role_id,
  tenant = "airqo",
  roles,
} = {}) => {
  for (const role of roles) {
    const RoleDetails = await RoleModel(tenant).findById(role_id).lean();
    logObject("RoleDetails", RoleDetails);
    if (
      role.network &&
      role.network.toString() === RoleDetails.network_id.toString()
    ) {
      return role.network;
    } else if (
      role.group &&
      role.group.toString() === RoleDetails.group_id.toString()
    ) {
      return role.group;
    }
  }
  return null;
};

const isAssignedUserSuperAdmin = async ({
  associatedId,
  roles = [],
  tenant = "airqo",
}) => {
  for (const role of roles) {
    if (
      (role.network && role.network.toString() === associatedId.toString()) ||
      (role.group && role.group.toString() === associatedId.toString())
    ) {
      const RoleDetails = await RoleModel(tenant)
        .findById(ObjectId(role.role))
        .lean();
      if (
        RoleDetails &&
        RoleDetails.role_name &&
        RoleDetails.role_name.endsWith("SUPER_ADMIN")
      ) {
        return true;
      }
    }
  }

  return false;
};
const isRoleAlreadyAssigned = (roles, role_id) => {
  if (isEmpty(roles) || !Array.isArray(roles)) {
    return false;
  } else {
    return roles.some((role) => {
      if (isEmpty(role.role)) {
        return false;
      }
      logObject("role.role.toString()", role.role.toString());
      logObject("role_id.toString()", role_id.toString());
      return role.role.toString() === role_id.toString();
    });
  }
};

const role = {
  /******* roles *******************************************/
  listRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);
      const responseFromListRole = await RoleModel(tenant.toLowerCase()).list(
        {
          filter,
        },
        next
      );
      return responseFromListRole;
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

  listRolesForGroup: async (request, next) => {
    try {
      const { query, params } = request;
      const { grp_id, tenant } = { ...query, ...params };

      const group = await GroupModel(tenant).findById(grp_id);
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} Not Found`,
          })
        );
      }

      const roleResponse = await RoleModel(tenant).aggregate([
        {
          $match: {
            group_id: ObjectId(grp_id),
          },
        },
        {
          $lookup: {
            from: "permissions",
            localField: "role_permissions",
            foreignField: "_id",
            as: "role_permissions",
          },
        },
        {
          $project: {
            _id: 1,
            role_name: 1,
            role_permissions: {
              $map: {
                input: "$role_permissions",
                as: "role_permission",
                in: {
                  _id: "$$role_permission._id",
                  permission: "$$role_permission.permission",
                },
              },
            },
          },
        },
      ]);

      if (!isEmpty(roleResponse)) {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: roleResponse,
        };
      } else if (isEmpty(roleResponse)) {
        return {
          success: true,
          message: "No roles for this Group",
          status: httpStatus.OK,
          data: [],
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
  },
  deleteRole: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);

      if (isEmpty(filter._id)) {
        next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message:
              "the role ID is missing -- required when updating corresponding users",
          })
        );
      }

      const result = await UserModel(tenant).updateMany(
        {
          $or: [
            { "network_roles.role": filter._id },
            { "group_roles.role": filter._id },
          ],
        },
        { $set: { "network_roles.$.role": null, "group_roles.$.role": null } }
      );

      if (result.nModified > 0) {
        logger.info(
          `Removed role ${filter._id} from ${result.nModified} users.`
        );
      }

      if (result.n === 0) {
        logger.info(
          `Role ${filter._id} was not found in any users' network_roles or group_roles.`
        );
      }
      const responseFromDeleteRole = await RoleModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      logObject("responseFromDeleteRole", responseFromDeleteRole);
      return responseFromDeleteRole;
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
  updateRole: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);
      const update = Object.assign({}, body);

      const responseFromUpdateRole = await RoleModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateRole;
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
  createRole: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      let newBody = Object.assign({}, body);
      let organizationName;

      if (body.group_id) {
        const group = await GroupModel(tenant).findById(body.group_id);
        if (isEmpty(group)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided group ${body.group_id} is invalid, please crosscheck`,
            })
          );
        }
        organizationName = group.grp_title.toUpperCase();
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Either network_id or group_id must be provided",
          })
        );
      }

      const transformedRoleName = convertToUpperCaseWithUnderscore(
        body.role_name
      );
      const availableRoleCode = body.role_code
        ? body.role_code
        : body.role_name;
      const transformedRoleCode =
        convertToUpperCaseWithUnderscore(availableRoleCode);

      newBody.role_name = `${organizationName}_${transformedRoleName}`;
      newBody.role_code = `${organizationName}_${transformedRoleCode}`;

      const responseFromCreateRole = await RoleModel(
        tenant.toLowerCase()
      ).register(newBody, next);

      return responseFromCreateRole;
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
  listAvailableUsersForRole: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { role_id } = request.params;

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid role ID ${role_id}, please crosscheck`,
          })
        );
      }

      const roleType = role.network_id ? "Network" : "Group";
      const query = roleType === "Network" ? "network_roles" : "group_roles";

      const responseFromListAvailableUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              [query]: {
                $not: {
                  $elemMatch: {
                    role: role_id,
                  },
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      return {
        success: true,
        message: `Retrieved all available users for the ${roleType} role ${role_id}`,
        data: responseFromListAvailableUsers,
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
  assignUserToRole: async (request, next) => {
    try {
      const { role_id, user_id } = request.params;
      const { tenant, user } = { ...request.body, ...request.query };
      const userIdFromBody = user;
      const userIdFromQuery = user_id;

      if (!isEmpty(userIdFromBody) && !isEmpty(userIdFromQuery)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          })
        );
      }

      const userId = userIdFromQuery || userIdFromBody;
      logObject("userId", userId);

      const role = await RoleModel(tenant).findById(role_id).lean();

      const userExists = await UserModel(tenant).exists({ _id: userId });
      const roleExists = await RoleModel(tenant).exists({ _id: role_id });

      if (!userExists || !roleExists) {
        next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const isNetworkRole = roleType === "network";

      const userObject = await UserModel(tenant)
        .findById(userId)
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      const userRoles = isNetworkRole
        ? userObject.network_roles
        : userObject.group_roles;
      logObject("userRoles", userRoles);
      const roles = userRoles || [];
      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

      logObject("isRoleAssigned", isRoleAssigned);

      if (isRoleAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${userObject._id.toString()} is already assigned to the role ${role_id.toString()}`,
          })
        );
      }

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The ROLE ${role_id} is not associated with any of the ${
              isNetworkRole ? "networks" : "groups"
            } already assigned to USER ${userObject._id}`,
          })
        );
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles: userRoles,
        tenant,
      });

      if (isSuperAdmin) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER ADMIN user ${userObject._id} cannot be reassigned to a different role`,
          })
        );
      }

      const updateQuery = {
        $addToSet: {
          [isNetworkRole ? "network_roles" : "group_roles"]: {
            ...(isNetworkRole
              ? { network: associatedId }
              : { group: associatedId }),
            role: role_id,
            userType: "guest", // Optional: adding default user type
            createdAt: new Date(),
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userObject._id },
        updateQuery,
        { new: true, runValidators: true }
      );

      if (updatedUser) {
        return {
          success: true,
          message: "User assigned to the Role",
          data: updatedUser,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Failed to assign user" }
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
  assignManyUsersToRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, user_ids } = { ...body, ...query, ...params };
      const roleObject = await RoleModel(tenant).findById(role_id).lean();

      if (isEmpty(roleObject)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} does not exist`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(roleObject);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const assignUserPromises = [];
      const isNetworkRole = roleType === "network";

      const users = await UserModel(tenant)
        .find({ _id: { $in: user_ids } })
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      for (const user of users) {
        if (isEmpty(user)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: { message: `One of the Users does not exist` },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const userRoles = isNetworkRole ? user.network_roles : user.group_roles;

        const roles = userRoles || [];
        logObject("roles", roles);

        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (isRoleAssigned) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user._id.toString()} is already assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (isEmpty(associatedId)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${
                isNetworkRole ? "networks" : "groups"
              } already assigned to USER ${user._id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles: userRoles,
          tenant,
        });

        if (isSuperAdmin) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER ADMIN user ${user._id} can not be reassigned to a different role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: {
            [isNetworkRole ? "network_roles" : "group_roles"]: {
              [isNetworkRole ? "network" : "group"]: associatedId,
              role: role_id,
            },
          },
        };

        await UserModel(tenant).updateOne({ _id: user._id }, updateQuery);

        assignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(assignUserPromises);
      const successfulAssignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      if (
        successfulAssignments.length > 0 &&
        unsuccessfulAssignments.length > 0
      ) {
        return {
          success: true,
          message: "Some users were successfully assigned to the role.",
          data: { unsuccessfulAssignments },
          status: httpStatus.OK,
        };
      } else if (
        unsuccessfulAssignments.length > 0 &&
        successfulAssignments.length === 0
      ) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "None of the provided users could be assigned to the role.",
            unsuccessfulAssignments,
          })
        );
      } else {
        return {
          success: true,
          message: "All provided users were successfully assigned to the role.",
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
  },
  listUsersWithRole: async (request, next) => {
    try {
      logText("listUsersWithRole...");
      const { query, params } = request;
      const { role_id, tenant } = { ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid role ID ${role_id.toString()}, please crosscheck`,
          })
        );
      }

      const networkRoleFilter = { "network_roles.role": ObjectId(role_id) };
      const groupRoleFilter = { "group_roles.role": ObjectId(role_id) };

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              $or: [networkRoleFilter, groupRoleFilter],
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      return {
        success: true,
        message: `retrieved all assigned users for role ${role_id}`,
        data: responseFromListAssignedUsers,
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
  unAssignUserFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, user_id, tenant } = { ...query, ...params };

      const [userObject, role, userExists, roleExists] = await Promise.all([
        UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean(),
        RoleModel(tenant).findById(role_id).lean(),
        UserModel(tenant).exists({ _id: user_id }),
        RoleModel(tenant).exists({ _id: role_id }),
      ]);

      if (!userExists || !roleExists) {
        next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const { network_roles, group_roles } = userObject;
      const roles = roleType === "network" ? network_roles : group_roles;

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
          })
        );
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles,
        tenant,
      });

      if (isSuperAdmin) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
          })
        );
      }

      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

      if (!isRoleAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
          })
        );
      }

      const filter = {
        _id: user_id,
        [`${roleType}_roles.${roleType}`]: associatedId,
      };
      const update = {
        $set: { [`${roleType}_roles.$[elem].role`]: null },
      };

      const arrayFilters = [{ "elem.role": role_id }];

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        filter,
        update,
        { new: true, arrayFilters }
      );

      if (isEmpty(updatedUser)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "User not found or not assigned to the specified Role in the Network or Group provided",
          })
        );
      }

      return {
        success: true,
        message: "User unassigned from the role",
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
  unAssignManyUsersFromRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, user_ids } = { ...body, ...query, ...params };
      const roleObject = await RoleModel(tenant).findById(role_id).lean();
      if (isEmpty(roleObject)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if all provided users actually exist
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      const nonExistentUsers = user_ids.filter(
        (user_id) => !existingUsers.some((user) => user._id.equals(user_id))
      );

      if (nonExistentUsers.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The following users do not exist: ${nonExistentUsers.join(
              ", "
            )}`,
          })
        );
      }

      const unAssignUserPromises = [];

      for (const user_id of user_ids) {
        const userObject = await UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean();

        const { network_roles, group_roles } = userObject;
        logObject("roleObject", roleObject);
        const roleType = isGroupRoleOrNetworkRole(roleObject);
        logObject("roleType", roleType);

        if (roleType === "none") {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Role ${role_id.toString()} is not associated with any network or group`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const roles = roleType === "network" ? network_roles : group_roles;
        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (!isRoleAssigned) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (!associatedId) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles,
          tenant,
        });

        if (isSuperAdmin) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: { [`${roleType}_roles.$[elem].role`]: null },
        };

        const updateResult = await UserModel(tenant).updateOne(
          { _id: user_id },
          updateQuery,
          { arrayFilters: [{ "elem.role": role_id }] }
        );

        if (updateResult.nModified !== 1) {
          unAssignUserPromises.push({
            success: false,
            message: "Could not unassign all users from the role.",
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
          continue;
        }

        unAssignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(unAssignUserPromises);

      const successfulUnassignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulUnAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      let success, message, status;

      if (
        successfulUnassignments.length > 0 &&
        unsuccessfulUnAssignments.length > 0
      ) {
        success = true;
        message = "Some users were successfully unassigned from the role";
        status = httpStatus.OK;
      } else if (
        unsuccessfulUnAssignments.length > 0 &&
        successfulUnassignments.length === 0
      ) {
        success = false;
        message = "Bad Request Error";
        status = httpStatus.BAD_REQUEST;
      } else {
        success = true;
        message =
          "All provided users were successfully unassigned from the role.";
        status = httpStatus.OK;
      }

      const response = {
        success,
        message,
        status,
      };

      if (success) {
        response.data = { unsuccessfulUnAssignments };
      } else {
        response.errors = {
          message:
            "None of the provided users could be unassigned from the role.",
          unsuccessfulUnAssignments,
        };
      }
      return response;
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
  listPermissionsForRole: async (request, next) => {
    try {
      logText("listPermissionsForRole...");
      const { query, params } = request;
      const { role_id, tenant, limit, skip } = { ...query, ...params };
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;
      const filter = generateFilter.roles(newRequest, next);
      const listRoleResponse = await RoleModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (listRoleResponse.success === true) {
        if (
          listRoleResponse.message === "roles not found for this operation" ||
          isEmpty(listRoleResponse.data)
        ) {
          return listRoleResponse;
        }

        const permissions = listRoleResponse.data[0].role_permissions;
        const permissionsArray = permissions.map((obj) => obj.permission);
        filter = { permission: { $in: permissionsArray } };
        let responseFromListPermissions = await PermissionModel(tenant).list(
          {
            skip,
            limit,
            filter,
          },
          next
        );
        return responseFromListPermissions;
      } else if (listRoleResponse.success === false) {
        return listRoleResponse;
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
  listAvailablePermissionsForRole: async (request, next) => {
    try {
      logText("listAvailablePermissionsForRole...");
      const { query, params } = request;
      const { role_id, tenant, limit, skip } = { ...query, ...params };
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;
      const filter = generateFilter.roles(newRequest, next);
      const listRoleResponse = await RoleModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (listRoleResponse.success === true) {
        if (
          listRoleResponse.message === "roles not found for this operation" ||
          isEmpty(listRoleResponse.data)
        ) {
          return listRoleResponse;
        }

        const permissions = listRoleResponse.data[0].role_permissions;
        const permissionsArray = permissions.map((obj) => obj.permission);
        filter = { permission: { $nin: permissionsArray } };
        let responseFromListPermissions = await PermissionModel(tenant).list(
          {
            skip,
            limit,
            filter,
          },
          next
        );
        return responseFromListPermissions;
      } else if (listRoleResponse.success === false) {
        return listRoleResponse;
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
  assignPermissionsToRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permissions } = { ...body, ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} Not Found`,
          })
        );
      }

      const permissionsResponse = await PermissionModel(tenant).find({
        _id: { $in: permissions.map((id) => ObjectId(id)) },
      });

      if (permissionsResponse.length !== permissions.length) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "not all provided permissions exist, please crosscheck",
          })
        );
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      logObject("assignedPermissions", assignedPermissions);

      const alreadyAssigned = permissions.filter((permission) =>
        assignedPermissions.includes(permission)
      );

      logObject("alreadyAssigned", alreadyAssigned);

      if (alreadyAssigned.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Some permissions already assigned to the Role ${role_id.toString()}, they include: ${alreadyAssigned.join(
              ","
            )}`,
          })
        );
      }
      const updatedRole = await RoleModel(tenant).findOneAndUpdate(
        { _id: role_id },
        { $addToSet: { role_permissions: { $each: permissions } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions added successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to update Role",
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
  getDefaultGroupRole: async (tenant, groupId) => {
    try {
      const group = await GroupModel(tenant).findById(groupId).lean();

      if (!group) {
        return null;
      }

      const organizationName = group.grp_title.toUpperCase();
      const defaultRoleCode = `${organizationName}_DEFAULT_MEMBER`; //  dynamically create the role code
      let role = await RoleModel(tenant).findOne({
        role_code: defaultRoleCode,
      });

      if (!role) {
        const roleDocument = {
          role_code: defaultRoleCode,
          role_name: defaultRoleCode, // Use the same naming convention as other group roles
          description: "Default role for new group members",
          group_id: groupId, // Associate the role with the group.
        };
        role = await RoleModel(tenant).create(roleDocument);

        // Assign some default permissions to the newly created role here. For Example:
        const defaultPermissions = await PermissionModel(tenant).find({
          permission: { $in: constants.DEFAULT_MEMBER_PERMISSIONS },
        });

        if (defaultPermissions.length > 0) {
          await RoleModel(tenant).findByIdAndUpdate(role._id, {
            $addToSet: {
              role_permissions: {
                $each: defaultPermissions.map((permission) => permission._id),
              },
            },
          });
        }
      }

      return role;
    } catch (error) {
      logger.error("Error getting default group role:", error);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  unAssignPermissionFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, permission_id, tenant } = { ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} Not Found`,
          })
        );
      }

      const filter = { _id: role_id };
      const update = { $pull: { role_permissions: permission_id } };

      const permission = await PermissionModel(tenant).findById(permission_id);
      if (!permission) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permission ${permission_id.toString()} Not Found`,
          })
        );
      }

      const roleResponse = await RoleModel(tenant).findOne({
        _id: role_id,
        role_permissions: permission_id,
      });

      if (!roleResponse) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permission ${permission_id.toString()} is not assigned to the Role ${role_id.toString()}`,
          })
        );
      }

      const responseFromUnAssignPermissionFromRole = await RoleModel(
        tenant
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUnAssignPermissionFromRole.success === true) {
        let modifiedResponse = Object.assign(
          {},
          responseFromUnAssignPermissionFromRole
        );
        if (
          responseFromUnAssignPermissionFromRole.message ===
          "successfully modified the Permission"
        ) {
          modifiedResponse.message = "permission has been unassigned from role";
        }
        return modifiedResponse;
      } else if (responseFromUnAssignPermissionFromRole.success === false) {
        return responseFromUnAssignPermissionFromRole;
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
  unAssignManyPermissionsFromRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permission_ids } = {
        ...body,
        ...query,
        ...params,
      };

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          })
        );
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      const notAssigned = permission_ids.filter(
        (permission) => !assignedPermissions.includes(permission)
      );

      if (notAssigned.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Some of the provided permissions are not assigned to the Role ${role_id.toString()}, they include: ${notAssigned.join(
              ", "
            )}`,
          })
        );
      }

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { $pull: { role_permissions: { $in: permission_ids } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions removed successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to remove the permissions",
          })
        );
      }

      return {
        success: true,
        message: `permissions successfully unassigned from the role.`,
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
  updateRolePermissions: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permission_ids } = {
        ...body,
        ...query,
        ...params,
      };

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          })
        );
      }

      const uniquePermissions = [...new Set(permission_ids)];

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { role_permissions: uniquePermissions },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions updated successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to update the permissions",
          })
        );
      }

      return {
        success: true,
        message: `permissions successfully updated.`,
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

  /******* permissions *******************************************/
  listPermission: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request, next);
      const responseFromListPermissions = await PermissionModel(
        tenant.toLowerCase()
      ).list(
        {
          filter,
        },
        next
      );
      return responseFromListPermissions;
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
  deletePermission: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request, next);
      const responseFromDeletePermission = await PermissionModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromDeletePermission;
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
  updatePermission: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const update = body;
      const filter = generateFilter.permissions(request, next);
      const responseFromUpdatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdatePermission;
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
  createPermission: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreatePermission;
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
   * Get detailed role summary for a user
   */
  getUserRoleSummary: async (userId, tenant) => {
    try {
      const user = await UserModel(tenant)
        .findById(userId)
        .populate("network_roles.role")
        .populate("group_roles.role")
        .populate("network_roles.network")
        .populate("group_roles.group")
        .lean();

      if (!user) {
        return null;
      }

      const networkRoles = (user.network_roles || []).map((nr) => ({
        role_id: nr.role?._id,
        role_name: nr.role?.role_name,
        network_id: nr.network?._id,
        network_name: nr.network?.net_name,
        userType: nr.userType,
        createdAt: nr.createdAt,
      }));

      const groupRoles = (user.group_roles || []).map((gr) => ({
        role_id: gr.role?._id,
        role_name: gr.role?.role_name,
        group_id: gr.group?._id,
        group_name: gr.group?.grp_title,
        userType: gr.userType,
        createdAt: gr.createdAt,
      }));

      return {
        user_id: userId,
        network_roles: {
          count: networkRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - networkRoles.length,
          roles: networkRoles,
        },
        group_roles: {
          count: groupRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - groupRoles.length,
          roles: groupRoles,
        },
        total_roles: networkRoles.length + groupRoles.length,
      };
    } catch (error) {
      logger.error(`Error getting user role summary: ${error.message}`);
      return null;
    }
  },

  /**
   * Enhanced assign user to role with detailed response
   */
  enhancedAssignUserToRole: async (request, next) => {
    try {
      const { role_id, user_id } = request.params;
      const { tenant, user } = { ...request.body, ...request.query };
      const userIdFromBody = user;
      const userIdFromQuery = user_id;

      if (!isEmpty(userIdFromBody) && !isEmpty(userIdFromQuery)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          })
        );
      }

      const userId = userIdFromQuery || userIdFromBody;

      // Get initial role summary
      const initialSummary = await newUtilFunctions.getUserRoleSummary(
        userId,
        tenant
      );
      if (!initialSummary) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} not found`,
          })
        );
      }

      const role = await RoleModel(tenant).findById(role_id).lean();
      const roleExists = await RoleModel(tenant).exists({ _id: role_id });

      if (!roleExists) {
        return next(
          new HttpError("Role not found", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);
      if (roleType === "none") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const isNetworkRole = roleType === "network";
      const currentRoles = isNetworkRole
        ? initialSummary.network_roles
        : initialSummary.group_roles;

      // Check if user has space for this role type
      if (currentRoles.count >= ORGANISATIONS_LIMIT) {
        return next(
          new HttpError("Role Limit Exceeded", httpStatus.BAD_REQUEST, {
            message: `Cannot assign ${roleType} role. User has reached the maximum limit of ${ORGANISATIONS_LIMIT} ${roleType} roles.`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: 0,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Check if role is already assigned
      const isRoleAssigned = currentRoles.roles.some(
        (r) => r.role_id && r.role_id.toString() === role_id.toString()
      );

      if (isRoleAssigned) {
        return next(
          new HttpError("Role Already Assigned", httpStatus.BAD_REQUEST, {
            message: `User already has this ${roleType} role assigned`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Find the associated network/group ID
      const userObject = await UserModel(tenant).findById(userId).lean();
      const userRoles = isNetworkRole
        ? userObject.network_roles
        : userObject.group_roles;
      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles: userRoles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The role ${role_id} is not associated with any of the ${
              isNetworkRole ? "networks" : "groups"
            } already assigned to user ${userId}`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Check for super admin restrictions
      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles: userRoles,
        tenant,
      });

      if (isSuperAdmin) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER ADMIN user ${userId} cannot be reassigned to a different role`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Perform the assignment
      const updateQuery = {
        $addToSet: {
          [isNetworkRole ? "network_roles" : "group_roles"]: {
            ...(isNetworkRole
              ? { network: associatedId }
              : { group: associatedId }),
            role: role_id,
            userType: "guest",
            createdAt: new Date(),
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userId },
        updateQuery,
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Failed to assign user to role",
            }
          )
        );
      }

      // Get updated role summary
      const updatedSummary = await newUtilFunctions.getUserRoleSummary(
        userId,
        tenant
      );

      return {
        success: true,
        message: `User successfully assigned to ${roleType} role`,
        operation: "assign_role",
        role_info: {
          role_id: role_id,
          role_name: role.role_name,
          role_type: roleType,
          associated_id: associatedId,
        },
        before_assignment: initialSummary,
        after_assignment: updatedSummary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  /**
   * Enhanced unassign user from role with detailed response
   */
  enhancedUnAssignUserFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, user_id, tenant } = { ...query, ...params };

      // Get initial role summary
      const initialSummary = await newUtilFunctions.getUserRoleSummary(
        user_id,
        tenant
      );
      if (!initialSummary) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      const [userObject, role, userExists, roleExists] = await Promise.all([
        UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean(),
        RoleModel(tenant).findById(role_id).lean(),
        UserModel(tenant).exists({ _id: user_id }),
        RoleModel(tenant).exists({ _id: role_id }),
      ]);

      if (!userExists || !roleExists) {
        return next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);
      if (roleType === "none") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const { network_roles, group_roles } = userObject;
      const roles = roleType === "network" ? network_roles : group_roles;
      const currentRoles =
        roleType === "network"
          ? initialSummary.network_roles
          : initialSummary.group_roles;

      // Check if role is actually assigned
      const isRoleAssigned = currentRoles.roles.some(
        (r) => r.role_id && r.role_id.toString() === role_id.toString()
      );

      if (!isRoleAssigned) {
        return next(
          new HttpError("Role Not Assigned", httpStatus.BAD_REQUEST, {
            message: `User is not assigned to this ${roleType} role`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The role ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to user ${user_id}`,
          })
        );
      }

      // Check for super admin restrictions
      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles,
        tenant,
      });

      if (isSuperAdmin) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Perform the unassignment
      const filter = {
        _id: user_id,
        [`${roleType}_roles.${roleType}`]: associatedId,
      };
      const update = {
        $set: { [`${roleType}_roles.$[elem].role`]: null },
      };
      const arrayFilters = [{ "elem.role": role_id }];

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        filter,
        update,
        { new: true, arrayFilters }
      );

      if (isEmpty(updatedUser)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "User not found or not assigned to the specified Role in the Network or Group provided",
          })
        );
      }

      // Get updated role summary
      const updatedSummary = await newUtilFunctions.getUserRoleSummary(
        user_id,
        tenant
      );

      return {
        success: true,
        message: `User successfully unassigned from ${roleType} role`,
        operation: "unassign_role",
        role_info: {
          role_id: role_id,
          role_name: role.role_name,
          role_type: roleType,
          associated_id: associatedId,
        },
        before_unassignment: initialSummary,
        after_unassignment: updatedSummary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  /**
   * Get user's network roles only
   */
  getUserNetworkRoles: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant } = request.query;

      const user = await UserModel(tenant)
        .findById(user_id)
        .populate("network_roles.role")
        .populate("network_roles.network")
        .lean();

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      const networkRoles = (user.network_roles || []).map((nr) => ({
        role_id: nr.role?._id,
        role_name: nr.role?.role_name,
        network_id: nr.network?._id,
        network_name: nr.network?.net_name,
        userType: nr.userType,
        createdAt: nr.createdAt,
      }));

      return {
        success: true,
        message: "Successfully retrieved user's network roles",
        data: {
          user_id: user_id,
          role_type: "network",
          count: networkRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - networkRoles.length,
          roles: networkRoles,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  /**
   * Get user's group roles only
   */
  getUserGroupRoles: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant } = request.query;

      const user = await UserModel(tenant)
        .findById(user_id)
        .populate("group_roles.role")
        .populate("group_roles.group")
        .lean();

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      const groupRoles = (user.group_roles || []).map((gr) => ({
        role_id: gr.role?._id,
        role_name: gr.role?.role_name,
        group_id: gr.group?._id,
        group_name: gr.group?.grp_title,
        userType: gr.userType,
        createdAt: gr.createdAt,
      }));

      return {
        success: true,
        message: "Successfully retrieved user's group roles",
        data: {
          user_id: user_id,
          role_type: "group",
          count: groupRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - groupRoles.length,
          roles: groupRoles,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  /**
   * Audit deprecated field usage across all users
   */
  auditDeprecatedFieldUsage: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, include_user_details, export_format } = query;

      // Get the audit report from the User model
      const auditResult = await UserModel(tenant).auditDeprecatedFieldUsage(
        next
      );

      if (!auditResult || auditResult.success === false) {
        return auditResult;
      }

      let enhancedReport = auditResult.data;

      // If detailed user information is requested, fetch users with deprecated fields
      if (include_user_details) {
        const usersWithDeprecatedFields = await UserModel(tenant)
          .find({
            $or: [
              { role: { $exists: true, $ne: null } },
              { privilege: { $exists: true, $ne: null } },
              { organization: { $exists: true, $ne: null } },
              { long_organization: { $exists: true, $ne: null } },
            ],
          })
          .select(
            "_id email firstName lastName role privilege organization long_organization createdAt"
          )
          .lean();

        enhancedReport.users_with_deprecated_fields =
          usersWithDeprecatedFields.map((user) => ({
            user_id: user._id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            deprecated_fields_present: {
              role: !!user.role,
              privilege: !!user.privilege,
              organization: !!user.organization,
              long_organization: !!user.long_organization,
            },
            created_at: user.createdAt,
          }));
      }

      // Add migration recommendations
      enhancedReport.migration_recommendations = {
        immediate_actions: [],
        next_steps: [],
        timeline_suggestion: "",
      };

      const { deprecated_field_usage, migration_readiness } = enhancedReport;

      if (migration_readiness.safe_to_migrate) {
        enhancedReport.migration_recommendations.immediate_actions.push(
          "✅ Safe to remove deprecated fields - no users are using them"
        );
        enhancedReport.migration_recommendations.next_steps.push(
          "Update database schema to remove deprecated fields",
          "Update API documentation to reflect changes",
          "Deploy changes to production"
        );
        enhancedReport.migration_recommendations.timeline_suggestion =
          "Can proceed immediately";
      } else {
        const percentage =
          migration_readiness.percentage_using_deprecated_fields;

        if (percentage > 50) {
          enhancedReport.migration_recommendations.immediate_actions.push(
            "⚠️ High usage of deprecated fields detected",
            "Identify and update frontend applications using deprecated fields",
            "Create migration plan for affected users"
          );
          enhancedReport.migration_recommendations.timeline_suggestion =
            "3-6 months migration period recommended";
        } else if (percentage > 10) {
          enhancedReport.migration_recommendations.immediate_actions.push(
            "🔄 Moderate usage of deprecated fields detected",
            "Update remaining frontend applications",
            "Prepare migration notices for affected users"
          );
          enhancedReport.migration_recommendations.timeline_suggestion =
            "1-3 months migration period recommended";
        } else {
          enhancedReport.migration_recommendations.immediate_actions.push(
            "✨ Low usage of deprecated fields detected",
            "Complete final frontend updates",
            "Schedule deprecated field removal"
          );
          enhancedReport.migration_recommendations.timeline_suggestion =
            "2-4 weeks migration period recommended";
        }

        enhancedReport.migration_recommendations.next_steps.push(
          "Send migration notices to affected users",
          "Update API documentation with deprecation warnings",
          "Set up monitoring for deprecated field usage",
          "Plan phased removal of deprecated fields"
        );
      }

      // Add timestamp and audit metadata
      enhancedReport.audit_metadata = {
        audit_timestamp: new Date().toISOString(),
        audited_by: request.user ? request.user.email : "system",
        tenant: tenant,
        total_users_scanned: enhancedReport.total_users,
        audit_scope: include_user_details ? "detailed" : "summary",
      };

      return {
        success: true,
        message: "Deprecated field usage audit completed successfully",
        data: enhancedReport,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
};

module.exports = role;
