const constants = require("@config/constants");
const NetworkModel = require("@models/Network");
const PermissionModel = require("@models/Permission");
const RoleModel = require("@models/Role");
const UserModel = require("@models/User");
const {
  generateFilter,
  stringify,
  publishKafkaEvent,
} = require("@utils/common");
const httpStatus = require("http-status");
const companyEmailValidator = require("company-email-validator");
const isEmpty = require("is-empty");
const crypto = require("crypto");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- network-util`);
const rolePermissionsUtil = require("@utils/role-permissions.util");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const isUserAssignedToNetwork = (user, networkId) => {
  if (user && user.network_roles && user.network_roles.length > 0) {
    return user.network_roles.some((assignment) => {
      return assignment.network.equals(networkId);
    });
  }
  return false;
};
const findNetworkAssignmentIndex = (user, net_id) => {
  if (!user.network_roles || !Array.isArray(user.network_roles)) {
    return -1;
  }

  return user.network_roles.findIndex((assignment) =>
    assignment.network.equals(net_id),
  );
};

const createNetwork = {
  getNetworkFromEmail: async (request, next) => {
    try {
      const responseFromExtractOneNetwork =
        createNetwork.extractOneAcronym(request);

      logObject("responseFromExtractOneNetwork", responseFromExtractOneNetwork);

      if (responseFromExtractOneNetwork.success === true) {
        const { tenant } = request.query;
        const skip = 0;
        const limit = 1;

        let modifiedRequest = Object.assign({}, request);
        modifiedRequest["query"] = {};
        modifiedRequest["query"]["net_acronym"] =
          responseFromExtractOneNetwork.data;

        const filter = generateFilter.networks(modifiedRequest, next);
        const responseFromListNetworks = await NetworkModel(tenant).list(
          {
            filter,
            limit,
            skip,
          },
          next,
        );

        if (responseFromListNetworks.success === true) {
          const data = responseFromListNetworks.data;
          const storedNetwork = data[0]
            ? data[0].net_name || data[0].net_acronym
            : "";
          return {
            success: true,
            data: storedNetwork,
            message: data[0]
              ? "successfully retrieved the network"
              : "No network exists for this operation",
            status: httpStatus.OK,
          };
        } else if (responseFromListNetworks.success === false) {
          return responseFromListNetworks;
        }
      } else if (responseFromExtractOneNetwork.success === false) {
        return responseFromExtractOneNetwork;
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
  extractOneAcronym: (request, next) => {
    try {
      const { net_email } = request.body;
      let segments = [];
      let network = "";

      if (net_email) {
        let isCompanyEmail = companyEmailValidator.isCompanyEmail(net_email);

        if (isCompanyEmail) {
          segments = net_email.split("@").filter((segment) => segment);
          network = segments[1].split(".")[0];
        } else if (!isCompanyEmail) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "You need a company email for this operation",
            }),
          );
        }
      }

      return {
        success: true,
        data: network,
        status: httpStatus.OK,
        message: "successfully removed the file extension",
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
  sanitizeName: (name) => {
    try {
      let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
      let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
      let trimmedName = shortenedName.trim();
      return trimmedName.toLowerCase();
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      logElement("the sanitise name error", error.message);
    }
  },
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { admin_secret } = body;

      // 1. Verify that the secret is configured on the server
      if (!constants.ADMIN_SETUP_SECRET) {
        logger.error(
          "CRITICAL: ADMIN_SETUP_SECRET is not configured in environment variables.",
        );
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Admin secret not configured on server",
            },
          ),
        );
      }

      // 2. Perform a constant-time comparison to prevent timing attacks
      const provided = Buffer.from(admin_secret || "");
      const expected = Buffer.from(constants.ADMIN_SETUP_SECRET);

      if (
        provided.length !== expected.length ||
        !crypto.timingSafeEqual(provided, expected)
      ) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Invalid admin secret provided",
          }),
        );
      }

      // 3. Remove the secret from the body to prevent logging or persistence
      let modifiedBody = Object.assign({}, body);
      delete modifiedBody.admin_secret;

      const responseFromExtractNetworkName =
        createNetwork.extractOneAcronym(request);

      logObject(
        "responseFromExtractNetworkName",
        responseFromExtractNetworkName,
      );

      if (responseFromExtractNetworkName.success === true) {
        modifiedBody["net_name"] = responseFromExtractNetworkName.data;
        modifiedBody["net_acronym"] = responseFromExtractNetworkName.data;
      } else if (responseFromExtractNetworkName.success === false) {
        return responseFromExtractNetworkName;
      }

      const networkObject = await NetworkModel(tenant.toLowerCase())
        .findOne({ net_website: modifiedBody.net_website })
        .lean();
      if (!isEmpty(networkObject)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Network for ${modifiedBody.net_website} already exists`,
          }),
        );
      }

      const user = request.user;
      logObject("the user making the request", user);
      if (!isEmpty(user)) {
        modifiedBody.net_manager = ObjectId(user._id);
        modifiedBody.net_manager_username = user.email;
        modifiedBody.net_manager_firstname = user.firstName;
        modifiedBody.net_manager_lastname = user.lastName;
      } else if (isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "creator's details are not provided",
          }),
        );
      }

      logObject("modifiedBody", modifiedBody);
      const responseFromRegisterNetwork = await NetworkModel(tenant).register(
        modifiedBody,
        next,
      );

      logObject("responseFromRegisterNetwork", responseFromRegisterNetwork);

      if (responseFromRegisterNetwork.success === true) {
        try {
          await publishKafkaEvent(constants.NETWORK_EVENTS_TOPIC, {
            action: "create",
            value: responseFromRegisterNetwork.data.toJSON(),
          });
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
        logObject("responseFromRegisterNetwork", responseFromRegisterNetwork);
        const net_id = responseFromRegisterNetwork.data._doc._id;
        if (isEmpty(net_id)) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to retrieve the network Id of created network",
              },
            ),
          );
        }

        /**
         ************** STEPS:
         * create the SUPER_ADMIN role for this network
         * create the SUPER_ADMIN  permissions IF they do not yet exist
         * assign the these SUPER_ADMIN permissions to the SUPER_ADMIN role
         * assign the creating User to this new SUPER_ADMIN role of their Network
         */

        let requestForRole = {};
        requestForRole.query = {};
        requestForRole.query.tenant = tenant;
        requestForRole.body = {
          role_code: "ADMIN",
          role_name: "ADMIN",
          network_id: net_id,
        };

        const responseFromCreateRole =
          await rolePermissionsUtil.createRole(requestForRole);

        if (responseFromCreateRole.success === false) {
          return responseFromCreateRole;
        } else if (responseFromCreateRole.success === true) {
          /**
           *  * assign the main permissions to the role
           */
          logObject("responseFromCreateRole", responseFromCreateRole);
          const role_id = responseFromCreateRole.data._id;
          if (isEmpty(role_id)) {
            next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                {
                  message:
                    "Unable to retrieve the role id of the newly create super admin of this network",
                },
              ),
            );
          }

          logObject(
            "constants.DEFAULTS.DEFAULT_ADMIN",
            constants.DEFAULTS.DEFAULT_ADMIN,
          );

          const adminPermissions = constants.DEFAULTS.DEFAULT_ADMIN;

          const existingPermissionIds = await PermissionModel(tenant)
            .find({
              permission: { $in: adminPermissions },
            })
            .distinct("_id");

          const existingPermissionNames = await PermissionModel(tenant)
            .find({
              permission: { $in: adminPermissions },
            })
            .distinct("permission");

          logObject("existingPermissionIds", existingPermissionIds);

          const newPermissionDocuments = adminPermissions
            .filter(
              (permission) => !existingPermissionNames.includes(permission),
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
            newPermissionDocuments,
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
            await rolePermissionsUtil.assignPermissionsToRole(
              requestToAssignPermissions,
            );
          if (responseFromAssignPermissionsToRole.success === false) {
            return responseFromAssignPermissionsToRole;
          } else if (responseFromAssignPermissionsToRole.success === true) {
            /**
             * assign this user to this new super ADMIN role and this new network
             */
            const updatedUser = await UserModel(tenant).findByIdAndUpdate(
              user._id,
              {
                $addToSet: {
                  network_roles: {
                    network: net_id,
                    role: role_id,
                    userType: "user",
                  },
                },
              },
              { new: true },
            );

            if (isEmpty(updatedUser)) {
              next(
                new HttpError(
                  "Internal Server Error",
                  httpStatus.INTERNAL_SERVER_ERROR,
                  {
                    message: `Unable to assign the network to the User ${user._id}`,
                  },
                ),
              );
            }

            return responseFromRegisterNetwork;
          }
        }
      } else if (responseFromRegisterNetwork.success === false) {
        return responseFromRegisterNetwork;
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
  assignUsersHybrid: async (request, next) => {
    try {
      const { net_id } = request.params;
      const { user_ids } = request.body;
      const { tenant } = request.query;

      const network = await NetworkModel(tenant).findById(net_id);

      if (!network) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid network ID ${net_id}`,
          }),
        );
      }

      // Fetch the default role for this network
      const defaultNetworkRole =
        await rolePermissionsUtil.getDefaultNetworkRole(tenant, net_id);

      if (!defaultNetworkRole || !defaultNetworkRole._id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Default Role not found for network ID ${net_id}`,
          }),
        );
      }
      const defaultRoleId = defaultNetworkRole._id;
      const notAssignedUsers = [];
      let assignedUsers = 0;
      const bulkOperations = [];
      const cleanupOperations = [];

      for (const user_id of user_ids) {
        const user = await UserModel(tenant).findById(ObjectId(user_id)).lean();

        if (!user) {
          notAssignedUsers.push({
            user_id,
            reason: `Invalid User ID ${user_id}, please crosscheck`,
          });
          continue; // Continue to the next user
        }

        const existingAssignment = user.network_roles.find(
          (assignment) => assignment.network.toString() === net_id.toString(),
        );

        if (existingAssignment) {
          notAssignedUsers.push({
            user_id,
            reason: `User ${user_id} is already assigned to the Network ${net_id}`,
          });
          continue;
        } else {
          bulkOperations.push({
            updateOne: {
              filter: { _id: user_id },
              update: {
                $addToSet: {
                  network_roles: {
                    network: net_id,
                    role: defaultRoleId,
                    userType: "user",
                  },
                },
              },
            },
          });

          cleanupOperations.push({
            updateOne: {
              filter: {
                _id: user_id,
                network_roles: {
                  $elemMatch: { network: { $exists: true, $eq: null } },
                },
              },
              update: {
                $pull: {
                  network_roles: { network: { $exists: true, $eq: null } },
                },
              },
            },
          });
        }
      }

      if (bulkOperations.length > 0) {
        const { nModified } = await UserModel(tenant).bulkWrite(bulkOperations);
        assignedUsers = nModified;
      }

      let message;
      if (assignedUsers === 0) {
        message = "No users assigned to the network.";
      } else if (assignedUsers === user_ids.length) {
        message = "All users have been assigned to the network.";
      } else {
        message = `Operation partially successful; ${assignedUsers} of ${user_ids.length} users have been assigned to the network.`;
      }

      if (cleanupOperations.length > 0) {
        await UserModel(tenant).bulkWrite(cleanupOperations);
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
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;

      // Validate required parameters
      if (!net_id || !user_id || !tenant) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Missing required parameters: net_id, user_id, or tenant",
          }),
        );
        return;
      }

      // Check if user and network exist
      const userExists = await UserModel(tenant).exists({ _id: user_id });
      const networkExists = await NetworkModel(tenant).exists({ _id: net_id });

      if (!userExists || !networkExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User or Network not found",
          }),
        );
        return;
      }

      // Get user to check current assignments
      const user = await UserModel(tenant).findById(user_id).lean();

      // Check if already assigned (optional - the new method handles this gracefully)
      const isAlreadyAssigned = isUserAssignedToNetwork(user, net_id);

      if (isAlreadyAssigned) {
        return {
          success: true,
          message: "User is already assigned to this network",
          data: user,
          status: httpStatus.OK,
        };
      }

      // Get default network role

      const defaultNetworkRole =
        await rolePermissionsUtil.getDefaultNetworkRole(tenant, net_id);

      if (!defaultNetworkRole || !defaultNetworkRole._id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Default Role not found for network ID ${net_id}`,
          }),
        );
        return;
      }

      // Use the new static method for safe role assignment

      const assignmentResult = await UserModel(tenant).assignUserToNetwork(
        user_id,
        net_id,
        defaultNetworkRole._id,
        "user",
      );

      if (assignmentResult.success) {
        return {
          success: true,
          message: "User assigned to the Network successfully",
          data: assignmentResult.data,
          status: httpStatus.OK,
        };
      } else {
        console.error(
          "❌ [NETWORK UTIL] Assignment failed:",
          assignmentResult.message,
        );
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Failed to assign user to network: ${assignmentResult.message}`,
            },
          ),
        );
        return;
      }
    } catch (error) {
      console.error("🐛 [NETWORK UTIL] Unexpected error:", error);
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
      const { net_id, user_ids } = request.params;
      const { tenant } = request.query;
      const { user_ids: bodyUserIds } = request.body || {};

      // user_ids can come from params or body
      const userIdsToProcess = user_ids || bodyUserIds;

      if (
        !net_id ||
        !userIdsToProcess ||
        !Array.isArray(userIdsToProcess) ||
        !tenant
      ) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Missing required parameters: net_id, user_ids array, or tenant",
          }),
        );
        return;
      }

      // Check if network exists
      const networkExists = await NetworkModel(tenant).exists({ _id: net_id });
      if (!networkExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network not found",
          }),
        );
        return;
      }

      // Get default role
      const defaultNetworkRole =
        await rolePermissionsUtil.getDefaultNetworkRole(tenant, net_id);

      if (!defaultNetworkRole || !defaultNetworkRole._id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Default Role not found for network ID ${net_id}`,
          }),
        );
        return;
      }

      const results = [];
      const errors = [];

      // Process each user
      for (const user_id of userIdsToProcess) {
        try {
          const assignmentResult = await UserModel(tenant).assignUserToNetwork(
            user_id,
            net_id,
            defaultNetworkRole._id,
            "user",
          );

          if (assignmentResult.success) {
            results.push({
              user_id,
              success: true,
              message: "User assigned successfully",
            });
          } else {
            errors.push({
              user_id,
              success: false,
              message: assignmentResult.message,
            });
            console.error(
              `❌ [NETWORK UTIL] Failed to assign user ${user_id}:`,
              assignmentResult.message,
            );
          }
        } catch (userError) {
          errors.push({
            user_id,
            success: false,
            message: userError.message,
          });
          console.error(
            `🐛 [NETWORK UTIL] Error processing user ${user_id}:`,
            userError,
          );
        }
      }

      const successCount = results.length;
      const errorCount = errors.length;

      return {
        success: true,
        message: `Bulk assignment completed: ${successCount} successful, ${errorCount} failed`,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: userIdsToProcess.length,
            successful: successCount,
            failed: errorCount,
          },
        },
        status: errorCount > 0 ? httpStatus.MULTI_STATUS : httpStatus.OK,
      };
    } catch (error) {
      console.error("🐛 [NETWORK UTIL] Bulk assignment error:", error);
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
  unAssignUser: async (request, next) => {
    try {
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;

      const [networkExists, user] = await Promise.all([
        NetworkModel(tenant).exists({ _id: net_id }),
        UserModel(tenant).findById(user_id).select("network_roles").lean(),
      ]);

      if (!networkExists) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network not found",
          }),
        );
      }

      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          }),
        );
      }

      const isAssigned = isUserAssignedToNetwork(user, net_id);

      if (!isAssigned) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User is not assigned to this network`,
          }),
        );
      }

      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { $pull: { network_roles: { network: net_id } } },
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
        message: "Successfully unassigned User from the Network",
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
  removeOneUser: async (request, next) => {
    try {
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;

      if (!net_id || !user_id || !tenant) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Missing required parameters: net_id, user_id, or tenant",
          }),
        );
        return;
      }

      // Check if user exists
      const userExists = await UserModel(tenant).exists({ _id: user_id });
      if (!userExists) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          }),
        );
        return;
      }

      // Remove user from network using safe update
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        {
          $pull: {
            network_roles: { network: net_id },
          },
        },
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
        message: "User removed from network successfully",
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
      console.error(
        "🐛 [NETWORK UTIL] Error removing user from network:",
        error,
      );
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
      const { user_ids } = request.body;
      const { net_id } = request.params;
      const { tenant } = request.query;

      // Check if network exists
      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network not found",
          }),
        );
      }

      //check of all these provided users actually do exist?
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id",
      );

      if (existingUsers.length !== user_ids.length) {
        const nonExistentUsers = user_ids.filter(
          (user_id) => !existingUsers.find((user) => user._id.equals(user_id)),
        );

        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The following users do not exist: ${nonExistentUsers}`,
          }),
        );
      }

      // Check if all the provided user_ids are assigned to the network in network_roles
      const users = await UserModel(tenant).find({
        _id: { $in: user_ids },
        "network_roles.network": net_id,
      });

      if (users.length !== user_ids.length) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Some of the provided User IDs are not assigned to this network ${net_id}`,
          }),
        );
      }

      // Remove the network assignment from each user's network_roles array
      try {
        const totalUsers = user_ids.length;
        const { nModified, n } = await UserModel(tenant).updateMany(
          {
            _id: { $in: user_ids },
            network_roles: { $elemMatch: { network: net_id } },
          },
          {
            $pull: {
              network_roles: { network: net_id },
            },
          },
        );

        const notFoundCount = totalUsers - nModified;
        if (nModified === 0) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "No matching User found in the system",
            }),
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
            { message: error.message },
          ),
        );
      }

      return {
        success: true,
        message: `Successfully unassigned all the provided users from the network ${net_id}`,
        status: httpStatus.OK,
        data: [],
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
  setManager: async (request, next) => {
    try {
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;
      const user = await UserModel(tenant).findById(user_id).lean();
      const network = await NetworkModel(tenant).findById(net_id).lean();

      if (isEmpty(user)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          }),
        );
      }

      if (isEmpty(network)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network not found",
          }),
        );
      }

      if (
        network.net_manager &&
        network.net_manager.toString() === user_id.toString()
      ) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id.toString()} is already the network manager`,
          }),
        );
      }

      // Updated check to use network_roles array
      const userNetworkIds = user.network_roles.map((networkRole) =>
        networkRole.network.toString(),
      );

      if (!userNetworkIds.includes(net_id.toString())) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Network ${net_id.toString()} is not part of User's networks, not authorized to manage this network`,
          }),
        );
      }

      const updatedNetwork = await NetworkModel(tenant).findByIdAndUpdate(
        net_id,
        { net_manager: user_id },
        { new: true },
      );

      if (!isEmpty(updatedNetwork)) {
        return {
          success: true,
          message: "User assigned to Network successfully",
          status: httpStatus.OK,
          data: updatedNetwork,
        };
      } else {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "No network record was updated",
          }),
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
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
      const { action } = request;
      const { tenant } = query;
      let update = Object.assign({}, body);
      logElement("action", action);
      update["action"] = action;

      const filter = generateFilter.networks(request, next);

      const responseFromModifyNetwork = await NetworkModel(tenant).modify(
        {
          update,
          filter,
        },
        next,
      );

      if (responseFromModifyNetwork.success === true) {
        try {
          const networkEventPayload = { ...filter, ...update };
          await publishKafkaEvent(constants.NETWORK_EVENTS_TOPIC, {
            action: "update",
            value: networkEventPayload,
          });
        } catch (error) {
          logger.error(`Kafka send error on network update: ${error.message}`);
        }
      }
      return responseFromModifyNetwork;
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
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Unavailable",
        errors: {
          message: "Service Temporarily Unavailable",
        },
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
      logText("the delete operation.....");
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.networks(request, next);

      if (isEmpty(filter._id)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "the network ID is missing -- required when updating corresponding users",
          }),
        );
      }

      // First, remove network roles from users
      const userUpdateResult = await UserModel(tenant).updateMany(
        { "network_roles.network": filter._id },
        { $pull: { network_roles: { network: filter._id } } },
      );

      if (userUpdateResult.nModified > 0) {
        logger.info(
          `Removed network ${filter._id} from ${userUpdateResult.nModified} users.`,
        );
      }

      // Find and delete permissions associated with this network
      const permissionDeleteResult = await PermissionModel(tenant).deleteMany({
        network_id: filter._id,
      });

      logger.info(
        `Deleted ${permissionDeleteResult.deletedCount} permissions associated with network ${filter._id}`,
      );

      // Find and delete roles associated with this network
      // Note: Do this after deleting permissions to avoid ref issues
      const roleDeleteResult = await RoleModel(tenant).deleteMany({
        network_id: filter._id,
      });

      logger.info(
        `Deleted ${roleDeleteResult.deletedCount} roles associated with network ${filter._id}`,
      );

      // Delete the network itself
      const networkDeleteResult = await NetworkModel(tenant).remove(
        {
          filter,
        },
        next,
      );

      if (networkDeleteResult.success === true) {
        try {
          await publishKafkaEvent(constants.NETWORK_EVENTS_TOPIC, {
            action: "delete",
            value: { _id: filter._id },
          });
        } catch (error) {
          logger.error(`Kafka send error on network delete: ${error.message}`);
        }
      }
      const data = {
        userUpdate: {
          modifiedCount: userUpdateResult.nModified,
          matchedCount: userUpdateResult.n,
        },
        permissionDelete: {
          deletedCount: permissionDeleteResult.deletedCount,
        },
        roleDelete: {
          deletedCount: roleDeleteResult.deletedCount,
        },
        networkDelete: networkDeleteResult.data,
      };

      return {
        ...networkDeleteResult,
        data,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
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
      let { skip, limit, tenant } = request.query;
      const filter = generateFilter.networks(request, next);
      const responseFromListNetworks = await NetworkModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next,
      );
      return responseFromListNetworks;
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
  refresh: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { net_id } = request.params;

      /**
       * does this network ID even exist?
       */
      const network = await NetworkModel(tenant).findById(net_id);

      if (!network) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid network ID ${net_id}, please crosscheck`,
          }),
        );
      }

      /**
       ** Find all Users which have this networkID
       * a.k.a list assigned users...
       */

      const responseFromListAssignedUsers = await UserModel(tenant)
        .find({ networks: { $in: [net_id] } })
        .lean();

      // logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      // return {
      //   success: true,
      //   status: httpStatus.OK,
      //   message: "success",
      // };

      const net_users = responseFromListAssignedUsers.map((element) => {
        return element._id;
      });

      /**
       * Do a mass update of the network's net_users using the net_users obtained from the list.
       *  ---- while doing this mass update, ensure that we do not introduce any duplicates
       */

      const updatedNetwork = await NetworkModel(tenant).findByIdAndUpdate(
        net_id,
        { $addToSet: { net_users } },
        { new: true },
      );

      if (isEmpty(updatedNetwork)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network not found",
          }),
        );
      }

      return {
        success: true,
        message: `Successfully refreshed the network ${net_id.toString()} users' details`,
        status: httpStatus.OK,
        data: updatedNetwork,
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
  listAvailableUsers: async (request, next) => {
    try {
      const { tenant, skip, limit } = request.query;
      const { net_id } = request.params;
      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid network ID ${net_id}, please crosscheck`,
          }),
        );
      }

      const usersFilter = generateFilter.users(request, next);

      const filter = {
        ...usersFilter,
        "network_roles.network": { $ne: net_id },
        category: "networks",
      };

      let responseFromListAvailableUsers = await UserModel(tenant).list(
        {
          filter,
          skip,
          limit,
        },
        next,
      );

      if (responseFromListAvailableUsers.success === true) {
        responseFromListAvailableUsers.message = `retrieved all available users for network ${net_id}`;
      }
      return responseFromListAvailableUsers;
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
      const { tenant, skip, limit } = request.query;
      const { net_id } = request.params;

      const network = await NetworkModel(tenant).findById(net_id);

      if (!network) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid network ID ${net_id}, please crosscheck`,
          }),
        );
      }

      const usersFilter = generateFilter.users(request, next);

      const filter = {
        ...usersFilter,
        "network_roles.network": net_id,
        category: "networks",
      };

      let responseFromListAssignedUsers = await UserModel(tenant).list(
        {
          filter,
          skip,
          limit,
        },
        next,
      );

      logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      if (responseFromListAssignedUsers.success === true) {
        responseFromListAssignedUsers.message = `Retrieved all assigned users for network ${net_id}`;
      }
      return responseFromListAssignedUsers;
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
};

module.exports = createNetwork;
