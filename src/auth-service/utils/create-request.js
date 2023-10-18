const UserModel = require("@models/User");
const AccessRequestModel = require("@models/AccessRequest");
const GroupModel = require("@models/Group");
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
const createNetworkUtil = require("@utils/create-network");
const createGroupUtil = require("@utils/create-group");

const createAccessRequest = {
  requestAccessToGroup: async (request) => {
    try {
      const {
        user: { _doc: user },
        query,
      } = request;
      const { tenant } = query;
      const { grp_id } = request.params;
      logObject("the user", user);
      logObject("grp_id", grp_id);
      const group = await GroupModel(tenant).findById(grp_id);
      logObject("group", group);
      logObject("user._id", user._id);
      if (isEmpty(group) || isEmpty(user._id)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Group or User not found" },
        };
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: grp_id,
        requestType: "group",
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
        targetId: grp_id,
        status: "pending",
        requestType: "group",
      });

      if (responseFromCreateAccessRequest.success === true) {
        const createdAccessRequest = await responseFromCreateAccessRequest.data;
        const firstName = user.firstName ? user.firstName : "Unknown";
        const lastName = user.lastName ? user.lastName : "Unknown";
        if (isEmpty(user.email)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message: "Unable to retrieve the requester's email address",
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
            message: "Access Request completed successfully",
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
  requestAccessToGroupByEmail: async (request) => {
    try {
      const { tenant, emails, user, grp_id } = {
        ...request,
        ...request.body,
        ...request.query,
        ...request.params,
      };

      logObject("grp_id", grp_id);

      const inviter = user._doc;
      const inviterEmail = inviter.email;
      const inviterId = inviter._id;
      const inviterDetails = await UserModel(tenant).findById(inviterId).lean();
      if (isEmpty(inviterDetails) || isEmpty(inviter)) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: { message: "Inviter does not exit" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const group = await GroupModel(tenant).findById(grp_id);
      logObject("group", group);
      if (isEmpty(group)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Group not found" },
        };
      }

      const existingRequests = [];
      const successResponses = [];
      const failureResponses = [];

      for (const email of emails) {
        const existingRequest = await AccessRequestModel(tenant).findOne({
          email: email,
          targetId: grp_id,
          requestType: "group",
        });

        if (!isEmpty(existingRequest)) {
          existingRequests.push(email);
        } else {
          const responseFromCreateAccessRequest = await AccessRequestModel(
            tenant
          ).register({
            email: email,
            targetId: grp_id,
            status: "pending",
            requestType: "group",
          });

          logObject(
            "responseFromCreateAccessRequest",
            responseFromCreateAccessRequest
          );

          if (responseFromCreateAccessRequest.success === true) {
            const createdAccessRequest =
              await responseFromCreateAccessRequest.data;
            if (isEmpty(email)) {
              return {
                success: false,
                message: "Internal Server Error",
                errors: {
                  message: "Unable to retrieve the requester's email address",
                },
                status: httpStatus.INTERNAL_SERVER_ERROR,
              };
            }

            const responseFromSendEmail =
              await mailer.requestToJoinGroupByEmail({
                email,
                tenant,
                entity_title: group.grp_title,
                targetId: grp_id,
                inviterEmail,
              });

            if (responseFromSendEmail.success === true) {
              successResponses.push({
                success: true,
                message: "Access Request completed successfully",
                data: createdAccessRequest,
                status: responseFromSendEmail.status
                  ? responseFromSendEmail.status
                  : httpStatus.OK,
              });
            } else if (responseFromSendEmail.success === false) {
              logger.error(`${responseFromSendEmail.message}`);
              failureResponses.push(responseFromSendEmail);
            }
          } else {
            logger.error(`${responseFromCreateAccessRequest.message}`);
            failureResponses.push(responseFromCreateAccessRequest);
          }
        }
      }

      if (existingRequests.length > 0 && successResponses.length === 0) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Access requests already exist for the following emails",
            existingRequests,
          },
        };
      }

      if (failureResponses.length > 0) {
        logger.error(
          `Internal Server Errors -- ${JSON.stringify(failureResponses)}`
        );
        return failureResponses[0];
      }

      if (successResponses.length > 0) {
        return successResponses[0];
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

  acceptGroupInvitation: async (request) => {
    try {
      /**
       * after they accept this invite, the group is part of their organisation
       */
      const { tenant, email, firstName, lastName, password, grids, grp_id } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const group = await GroupModel(tenant).findById(grp_id).lean()[0];
      logObject("group", group);

      const accessRequest = await AccessRequestModel(tenant).find({
        targetId: grp_id,
        email,
        status: "pending",
        requestType: "group",
      });

      logObject("accessRequest", accessRequest);
      if (isEmpty(accessRequest)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Access Request not found, please crosscheck provided details",
          },
        };
      }

      const newUser = await UserModel(tenant).register({
        email,
        password,
        userName: email,
        firstName,
        lastName,
      });

      logObject("newUser", newUser);
      if (isEmpty(newUser)) {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "Unable to create the new User" },
        };
      }

      const update = { status: "approved" };
      const filter = { email, requestType: "group", targetId: grp_id };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant
      ).modify({
        filter,
        update,
      });

      if (responseFromUpdateAccessRequest.success === true) {
        const { firstName, lastName, email } = newUser;
        const request = {
          params: {
            grp_id: grp_id,
            user_id: newUser._id,
          },
          query: { tenant: tenant },
        };
        const responseFromAssignUserToGroup =
          await createGroupUtil.assignOneUser(request);

        logObject(
          "responseFromAssignUserToGroup",
          responseFromAssignUserToGroup
        );

        if (responseFromAssignUserToGroup.success === true) {
          const responseFromSendEmail = await mailer.afterAcceptingInvitation({
            firstName,
            username,
            email,
            entity_title: group.grp_title,
          });
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "Group JOIN request accepted successfully",
              status: httpStatus.OK,
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromAssignUserToGroup.success === false) {
          return responseFromAssignUserToGroup;
        }
      } else if (responseFromUpdateAccessRequest.success === false) {
        return responseFromUpdateAccessRequest;
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  requestAccessToNetwork: async (request) => {
    try {
      const {
        user: { _doc: user },
        query,
      } = request;
      const { tenant } = query;
      const { net_id } = request.params;

      const network = await NetworkModel(tenant).findById(net_id);
      if (isEmpty(network) || isEmpty(user._id)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Network or User not found" },
        };
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: net_id,
        requestType: "network",
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
        targetId: net_id,
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
            message: "Access Request completed successfully",
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
      const { query } = request;
      const { tenant } = query;
      const { request_id } = request.params;
      const accessRequest = await AccessRequestModel(tenant).findById(
        request_id
      );
      logObject("accessRequest", accessRequest);
      if (isEmpty(accessRequest)) {
        return {
          success: false,
          message: "Not Found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Access request not found" },
        };
      }

      const user = await UserModel(tenant).findById(accessRequest.user_id);

      if (isEmpty(user)) {
        return {
          success: false,
          message: "Not Found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "User Details in Access Request Not Found" },
        };
      }

      const update = { status: "approved" };
      const filter = { _id: ObjectId(accessRequest._id) };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant
      ).modify({
        filter,
        update,
      });

      if (responseFromUpdateAccessRequest.success === true) {
        const { firstName, lastName, email } = user;
        if (accessRequest.requestType === "group") {
          const group = await GroupModel(tenant)
            .findById(accessRequest.targetId)
            .lean();
          const request = {
            params: {
              grp_id: accessRequest.targetId,
              user_id: accessRequest.user_id,
            },
            query: { tenant: tenant },
          };
          const responseFromAssignUserToGroup =
            await createGroupUtil.assignOneUser(request);

          logObject(
            "responseFromAssignUserToGroup",
            responseFromAssignUserToGroup
          );

          if (responseFromAssignUserToGroup.success === true) {
            const group_name = group.grp_title ? group.grp_title : "";
            const responseFromSendEmail = await mailer.update(
              email,
              firstName,
              lastName,
              { groups: 1 }
            );

            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "Access request approved successfully",
                status: httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
          } else if (responseFromAssignUserToGroup.success === false) {
            return responseFromAssignUserToGroup;
          }
        } else if (accessRequest.requestType === "network") {
          const network = await NetworkModel(tenant)
            .findById(accessRequest.targetId)
            .lean();
          const request = {
            params: {
              net_id: accessRequest.targetId,
              user_id: accessRequest.user_id,
            },
            query: { tenant: tenant },
          };
          const responseFromAssignUserToNetwork =
            await createNetworkUtil.assignOneUser(request);

          if (responseFromAssignUserToNetwork.success === true) {
            const network_name = network.net_name ? network.net_name : "";
            const responseFromSendEmail = await mailer.update(
              email,
              firstName,
              lastName,
              { networks: 1 }
            );

            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "Access request approved successfully",
                status: httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
          } else if (responseFromAssignUserToNetwork.success === false) {
            return responseFromAssignUserToNetwork;
          }
        }
      } else if (responseFromUpdateAccessRequest.success === false) {
        return responseFromUpdateAccessRequest;
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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

      logObject("listing filter", filter);

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
