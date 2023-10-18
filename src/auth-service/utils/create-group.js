const UserModel = require("@models/User");
const PermissionModel = require("@models/Permission");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const { logObject, logElement, logText } = require("@utils/log");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-group-util`
);
const controlAccessUtil = require("@utils/control-access");

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

const createGroup = {
  create: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = Object.assign({}, body);

      logText("We are now creating the function.....");

      const user = request.user;
      logObject("the user making the request", user);
      if (!isEmpty(user)) {
        modifiedBody.grp_manager = ObjectId(user._id);
        modifiedBody.grp_manager_username = user.email;
        modifiedBody.grp_manager_firstname = user.firstName;
        modifiedBody.grp_manager_lastname = user.lastName;
      } else if (isEmpty(user)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "creator's details are not provided" },
          status: httpStatus.BAD_REQUEST,
        };
      }
      const responseFromRegisterGroup = await GroupModel(
        tenant.toLowerCase()
      ).register(modifiedBody);

      logObject("responseFromRegisterGroup", responseFromRegisterGroup);

      if (responseFromRegisterGroup.success === true) {
        const grp_id = responseFromRegisterGroup.data._doc._id;
        if (isEmpty(grp_id)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message: "Unable to retrieve the group Id of created group",
            },
          };
        }

        /**
         ************** STEPS:
         * create the SUPER_ADMIN role for this group
         * create the SUPER_ADMIN  permissions IF they do not yet exist
         * assign the these SUPER_ADMIN permissions to the SUPER_ADMIN role
         * assign the creating User to this new SUPER_ADMIN role of their Network
         */

        let requestForRole = {};
        requestForRole.query = {};
        requestForRole.query.tenant = tenant;
        requestForRole.body = {
          role_code: "SUPER_ADMIN",
          role_name: "SUPER_ADMIN",
          group_id: grp_id,
        };

        const responseFromCreateRole = await controlAccessUtil.createRole(
          requestForRole
        );

        if (responseFromCreateRole.success === false) {
          return responseFromCreateRole;
        } else if (responseFromCreateRole.success === true) {
          /**
           *  * assign the main permissions to the role
           */
          logObject("responseFromCreateRole", responseFromCreateRole);
          const role_id = responseFromCreateRole.data._id;
          if (isEmpty(role_id)) {
            return {
              success: false,
              message: "Internal Server Error",
              errors: {
                message:
                  "Unable to retrieve the role id of the newly create super admin of this group",
              },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }

          logObject(
            "constants.SUPER_ADMIN_PERMISSIONS",
            constants.SUPER_ADMIN_PERMISSIONS
          );

          const superAdminPermissions = constants.SUPER_ADMIN_PERMISSIONS
            ? constants.SUPER_ADMIN_PERMISSIONS
            : [];
          const trimmedPermissions = superAdminPermissions.map((permission) =>
            permission.trim()
          );

          const uniquePermissions = [...new Set(trimmedPermissions)];

          const existingPermissionIds = await PermissionModel(tenant)
            .find({
              permission: { $in: uniquePermissions },
            })
            .distinct("_id");

          const existingPermissionNames = await PermissionModel(tenant)
            .find({
              permission: { $in: uniquePermissions },
            })
            .distinct("permission");

          logObject("existingPermissionIds", existingPermissionIds);

          const newPermissionDocuments = uniquePermissions
            .filter(
              (permission) => !existingPermissionNames.includes(permission)
            )
            .map((permission) => ({
              permission: permission
                .replace(/[^A-Za-z]/g, " ")
                .toUpperCase()
                .replace(/ /g, "_"),
              description: permission
                .replace(/[^A-Za-z]/g, " ")
                .toUpperCase()
                .replace(/ /g, "_"),
            }));

          logObject("newPermissionDocuments", newPermissionDocuments);

          // Step 3: Insert the filtered permissions
          const insertedPermissions = await PermissionModel(tenant).insertMany(
            newPermissionDocuments
          );
          logObject("insertedPermissions", insertedPermissions);
          const allPermissionIds = [
            ...existingPermissionIds,
            ...insertedPermissions.map((permission) => permission._id),
          ];

          logObject("allPermissionIds", allPermissionIds);

          let requestToAssignPermissions = {};
          requestToAssignPermissions.body = {};
          requestToAssignPermissions.query = {};
          requestToAssignPermissions.params = {};
          requestToAssignPermissions.body.permissions = allPermissionIds;
          requestToAssignPermissions.query.tenant = tenant;
          requestToAssignPermissions.params = { role_id };

          const responseFromAssignPermissionsToRole =
            await controlAccessUtil.assignPermissionsToRole(
              requestToAssignPermissions
            );
          if (responseFromAssignPermissionsToRole.success === false) {
            return responseFromAssignPermissionsToRole;
          } else if (responseFromAssignPermissionsToRole.success === true) {
            /**
             * assign this user to this new super ADMIN role and this new group
             */
            const updatedUser = await UserModel(tenant).findByIdAndUpdate(
              user._id,
              {
                $addToSet: {
                  group_roles: {
                    group: grp_id,
                    role: role_id,
                  },
                },
              },
              { new: true }
            );

            if (isEmpty(updatedUser)) {
              return {
                success: false,
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
                errors: {
                  message: `Unable to assign the group to the User ${user._id}`,
                },
              };
            }

            return responseFromRegisterGroup;
          }
        }
      } else if (responseFromRegisterGroup.success === false) {
        return responseFromRegisterGroup;
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Errors",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      const { body, query, params } = request;
      const { grp_id } = params;
      const { tenant } = query;
      let update = Object.assign({}, body);

      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });

      if (!groupExists) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Group ${grp_id} not found` },
        };
      }

      const responseFromGeneratefilter = generateFilter.groups(request);
      if (responseFromGeneratefilter.success === false) {
        return responseFromGeneratefilter;
      }
      const filter = responseFromGeneratefilter;

      const responseFromModifyGroup = await GroupModel(
        tenant.toLowerCase()
      ).modify({ update, filter });
      logObject("responseFromModifyGroup", responseFromModifyGroup);
      return responseFromModifyGroup;
    } catch (error) {
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { grp_id } = params;

      /**
       * Does that provided Group ID even exist?
       */

      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });

      if (!groupExists) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Group ${grp_id} not found` },
        };
      }

      let filter = {};
      const responseFromGenerateFilter = generateFilter.groups(request);
      logObject("responseFromGenerateFilter", responseFromGenerateFilter);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter.data;
      }

      logObject("the filter", filter);

      const responseFromRemoveGroup = await GroupModel(
        tenant.toLowerCase()
      ).remove({ filter });

      logObject("responseFromRemoveGroup", responseFromRemoveGroup);

      return responseFromRemoveGroup;
    } catch (error) {
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return {
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
        success: false,
      };
    }
  },
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      let filter = {};
      const responseFromGenerateFilter = generateFilter.groups(request);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter;
        logObject("filter", filter);
      }

      const responseFromListGroups = await GroupModel(
        tenant.toLowerCase()
      ).list({ filter, limit, skip });
      return responseFromListGroups;
    } catch (error) {
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      logElement("internal server error", error.message);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  assignUsers: async (request) => {
    try {
      const { params, body, query } = request;
      const { grp_id } = params;
      const { user_ids } = body;
      const { tenant } = query;

      const group = await GroupModel(tenant).findById(grp_id).lean();

      if (!group) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Invalid group ID ${grp_id}` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      for (const user_id of user_ids) {
        const user = await UserModel(tenant).findById(ObjectId(user_id)).lean();

        if (!user) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Invalid User ID ${user_id}, please crosscheck`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        const existingAssignment = user.group_roles.find((assignment) => {
          return assignment.group.toString() === grp_id.toString();
        });

        if (existingAssignment) {
          return {
            userId: user_id,
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user_id} is already assigned to the Group ${grp_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const totalUsers = user_ids.length;
      const assignments = user_ids.map((user_id) => {
        return {
          updateOne: {
            filter: {
              _id: user_id,
            },
            update: {
              $addToSet: {
                group_roles: {
                  group: grp_id,
                },
              },
            },
          },
        };
      });

      const { nModified, n } = await UserModel(tenant).bulkWrite(assignments);

      const notFoundCount = totalUsers - nModified;
      if (nModified === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "No matching User found in the system" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (notFoundCount > 0) {
        return {
          success: true,
          message: `Operation partially successful; some ${notFoundCount} of the provided users were not found in the system`,
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "Successfully assigned all the provided users to the Group",
        status: httpStatus.OK,
        data: [],
      };
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  assignOneUser: async (request) => {
    try {
      const { grp_id, user_id } = request.params;
      const { tenant } = request.query;

      const userExists = await UserModel(tenant).exists({ _id: user_id });
      const groupExists = await GroupModel(tenant).exists({ _id: grp_id });

      if (!userExists || !groupExists) {
        return {
          success: false,
          message: "User or Group not found",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "User or Group not found" },
        };
      }

      const user = await UserModel(tenant).findById(user_id).lean();

      logObject("user", user);

      const isAlreadyAssigned = isUserAssignedToGroup(user, grp_id);

      if (isAlreadyAssigned) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Group already assigned to User" },
          status: httpStatus.BAD_REQUEST,
        };
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

      return {
        success: true,
        message: "User assigned to the Group",
        data: updatedUser,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  unAssignUser: async (request) => {
    try {
      const { grp_id, user_id } = request.params;
      const { tenant } = request.query;

      const group = await GroupModel(tenant).findById(grp_id);
      let user = await UserModel(tenant).findById(user_id);
      if (!group || !user) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Group ${grp_id} or User ${user_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const groupAssignmentIndex = findGroupAssignmentIndex(user, grp_id);

      if (groupAssignmentIndex === -1) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Group ${grp_id.toString()} is not assigned to the user`,
          },
        };
      }

      // Remove the group assignment from the user's groups array
      user.group_roles.splice(groupAssignmentIndex, 1);

      // Update the user with the modified groups array
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { group_roles: user.group_roles },
        { new: true }
      );

      return {
        success: true,
        message: "Successfully unassigned User from the Group",
        data: updatedUser,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  unAssignManyUsers: async (request) => {
    try {
      const { user_ids } = request.body;
      const { grp_id } = request.params;
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

      //check of all these provided users actually do exist?
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      if (existingUsers.length !== user_ids.length) {
        const nonExistentUsers = user_ids.filter(
          (user_id) => !existingUsers.find((user) => user._id.equals(user_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following users do not exist: ${nonExistentUsers}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if all the provided user_ids are assigned to the group in groups
      const users = await UserModel(tenant).find({
        _id: { $in: user_ids },
        "group_roles.group": grp_id,
      });

      if (users.length !== user_ids.length) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some of the provided User IDs are not assigned to this group ${grp_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
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
          return {
            success: false,
            message: "Bad Request Error",
            errors: { message: "No matching User found in the system" },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (notFoundCount > 0) {
          return {
            success: true,
            message: `Operation partially successful since ${notFoundCount} of the provided users were not found in the system`,
            status: httpStatus.OK,
          };
        }
      } catch (error) {
        logger.error(`Internal Server Error ${error.message}`);
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: error.message },
        };
      }

      return {
        success: true,
        message: `Successfully unassigned all the provided users from the group ${grp_id}`,
        status: httpStatus.OK,
        data: [],
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  listAvailableUsers: async (request) => {
    try {
      const { tenant } = request.query;
      const { grp_id } = request.params;

      const group = await GroupModel(tenant).findById(grp_id);

      if (!group) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid group ID ${grp_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
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
      logElement("internal server error", error.message);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  listAssignedUsers: async (request) => {
    try {
      const { tenant } = request.query;
      const { grp_id } = request.params;

      const group = await GroupModel(tenant).findById(grp_id);

      if (!group) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid group ID ${grp_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              "group_roles.group": group._id,
            },
          },
          {
            $lookup: {
              from: "roles",
              localField: "group_roles.role",
              foreignField: "_id",
              as: "role",
            },
          },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              userName: 1,
              profilePicture: 1,
              status: 1,
              jobTitle: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              email: 1,
              role_name: { $arrayElemAt: ["$role.role_name", 0] },
              role_id: { $arrayElemAt: ["$role._id", 0] },
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
      logElement("internal server error", error.message);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createGroup;
