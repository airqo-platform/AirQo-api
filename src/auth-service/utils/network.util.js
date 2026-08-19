const constants = require("@config/constants");
const NetworkModel = require("@models/Network");
const PermissionModel = require("@models/Permission");
const RoleModel = require("@models/Role");
const UserModel = require("@models/User");
const {
  generateFilter,
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
const { logObject, HttpError } = require("@utils/shared");

const createNetwork = {
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
        return next(
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
        return next(
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
          return next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to retrieve the network Id of created network",
              },
            ),
          );
        }

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
          logObject("responseFromCreateRole", responseFromCreateRole);
          const role_id = responseFromCreateRole.data._id;
          if (isEmpty(role_id)) {
            return next(
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
              return next(
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
};

module.exports = createNetwork;
