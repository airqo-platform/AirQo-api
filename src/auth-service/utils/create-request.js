const UserModel = require("@models/User");
const AccessRequestModel = require("@models/AccessRequest");
const NetworkModel = require("@models/Network");
const { logObject, logElement, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("@utils/generate-filter");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-request-util`
);
const accessCodeGenerator = require("generate-password");

// Helper function to check if the user is authorized to approve the request
const isUserAuthorizedToApprove = (user, accessRequest) => {
  // Implement your authorization logic here.
  // Check if the user has the necessary role or permissions to approve this request.
  // You can customize this logic based on your application's requirements.
  // Example: Check if the user is the administrator of the group associated with the request.
  // Return true if authorized, false otherwise.
  return user.isAdmin && user.groups.includes(accessRequest.group);
};

const createAccessRequest = {
  requestAccessToGroup: async (request) => {
    try {
      /***
       * Important to note that the user making this
       * access request must be an existing user
       */
      const { user, query } = request;
      const { tenant } = query;
      const { group_id } = request.params;

      const group = await GroupModel(tenant).findById(group_id);
      if (isEmpty(group) || isEmpty(user._id)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Group or User not found" },
        };
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user: user._id,
        group: group_id,
      });

      if (!isEmpty(existingRequest)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Access request already exists for this group" },
        };
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant
      ).register({
        user_id: user._id,
        targetId: group_id,
        status: "pending",
        requestType: "group",
      });

      if (responseFromCreateAccessRequest.success === true) {
        const createdAccessRequest = await responseFromCreateAccessRequest.data;
        const firstName = user.firstName ? user.firstName : "";
        const lastName = user.lastName ? user.lastName : "";
        if (isEmpty(user.email)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message:
                "Unable to retrieve the requester's email address, please crosscheck security token details",
            },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
        const responseFromSendEmail = await mailer.request({
          firstName,
          lastName,
          email: user.email,
          tenant,
          entity_title: group.grp_title,
        });

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: "access request successfully created",
            data: createdAccessRequest,
            status: responseFromSendEmail.status
              ? responseFromSendEmail.status
              : httpStatus.OK,
          };
        } else if (responseFromSendEmail.success === false) {
          logger.error(`${responseFromSendEmail.message}`);
          return responseFromSendEmail;
        }
      } else {
        logger.error(`${responseFromCreateAccessRequest.message}`);
        return responseFromCreateAccessRequest;
      }
    } catch (e) {
      logger.error(`Internal Server Error ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: e.message },
      };
    }
  },
  requestAccessToNetwork: async (request) => {
    try {
      /***
       * Important to note that the user making this
       * access request must be an existing user
       */
      const { user, query } = request;
      const { tenant } = query;
      const { network_id } = request.params;

      const network = await NetworkModel(tenant).findById(network_id);
      if (isEmpty(network) || isEmpty(user._id)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Network or User not found" },
        };
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user: user._id,
        network: network_id,
      });

      if (!isEmpty(existingRequest)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Access request already exists for this network" },
        };
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant
      ).register({
        user_id: user._id,
        targetId: network_id,
        status: "pending",
        requestType: "network",
      });

      if (responseFromCreateAccessRequest.success === true) {
        const createdAccessRequest = await responseFromCreateAccessRequest.data;
        const firstName = user.firstName ? user.firstName : "";
        const lastName = user.lastName ? user.lastName : "";
        if (isEmpty(user.email)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message:
                "Unable to retrieve the requester's email address, please crosscheck security token details",
            },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }

        const responseFromSendEmail = await mailer.request({
          firstName,
          lastName,
          email: user.email,
          tenant,
          entity_title: network.net_name,
        });

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: "Access request successfully created",
            data: createdAccessRequest,
            status: responseFromSendEmail.status
              ? responseFromSendEmail.status
              : httpStatus.OK,
          };
        } else if (responseFromSendEmail.success === false) {
          logger.error(`${responseFromSendEmail.message}`);
          return responseFromSendEmail;
        }
      } else {
        logger.error(`${responseFromCreateAccessRequest.message}`);
        return responseFromCreateAccessRequest;
      }
    } catch (e) {
      logger.error(`Internal Server Error ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: e.message },
      };
    }
  },
  approveAccessRequest: async (request) => {
    try {
      /**
       * During the approval process, check the request Type
       * to then target the right Collection for creation
       * we have 2 types:
       * 1. Network
       * 2. Group
       */
      const { user, query } = request;
      const { tenant } = query;
      const { request_id } = request.params;
      const accessRequest = await AccessRequestModel(tenant).findById(
        request_id
      );

      if (!accessRequest) {
        return {
          success: false,
          message: "Not Found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Access request not found" },
        };
      }

      const userDetails = await UserModel(tenant).findById(
        accessRequest.user_id
      );

      if (isEmpty(userDetails)) {
        return {
          success: false,
          message: "Not Found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "User Details in Access Request Not Found" },
        };
      }

      // if (!isUserAuthorizedToApprove(user, accessRequest)) {
      //   return {
      //     success: false,
      //     message: "Forbidden!",
      //     status: httpStatus.FORBIDDEN,
      //     errors: { message: "User is not authorized to approve this request" },
      //   };
      // }

      const update = { status: "approved" };
      const filter = { _id: ObjectId(accessRequest._id) };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant
      ).modify({
        filter,
        update,
      });

      if (responseFromUpdateAccessRequest.success === true) {
        const { firstName, lastName, email } = userDetails;
        const password = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(10)
        );

        const newUser = {
          firstName,
          lastName,
          email,
          userName: email,
          password,
        };

        const responseFromCreateUser = await UserModel(tenant).register(
          newUser
        );

        if (responseFromCreateUser.success === true) {
          const responseFromSendEmail = await mailer.user(
            firstName,
            lastName,
            email,
            password,
            tenant,
            "confirm"
          );

          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "Access request approved successfully",
              status: httpStatus.OK,
            };
          } else {
            return {
              success: false,
              message: "Internal Server Error",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: { message: "Failed to send email to the user" },
            };
          }
        } else {
          return {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { message: "Failed to create user" },
          };
        }
      } else if (responseFromUpdateAccessRequest.success === false) {
        return responseFromUpdateAccessRequest;
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const responseFromFilter = generateFilter.requests(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      const responseFromRegisterAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });
      return responseFromRegisterAccessRequest;
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const responseFromFilter = generateFilter.requests(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      const responseFromListAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });
      return responseFromListAccessRequest;
    } catch (e) {
      logger.error(`${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      const { query, body } = request;

      const responseFromFilter = generateFilter.requests(request);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }

      const filter = responseFromFilter.data;
      const update = body;
      const tenant = query.tenant;

      const responseFromModifyAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });
      logObject(
        "responseFromModifyAccessRequest",
        responseFromModifyAccessRequest
      );
      return responseFromModifyAccessRequest;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      };
    }
  },
  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const responseFromFilter = generateFilter.requests(request);

      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;
      const responseFromRemoveAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromRemoveAccessRequest;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createAccessRequest;
