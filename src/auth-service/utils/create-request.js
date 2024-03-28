const UserModel = require("@models/User");
const AccessRequestModel = require("@models/AccessRequest");
const GroupModel = require("@models/Group");
const NetworkModel = require("@models/Network");
const { logObject } = require("@utils/log");
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
const createNetworkUtil = require("@utils/create-network");
const createGroupUtil = require("@utils/create-group");
const { HttpError } = require("@utils/errors");

const createAccessRequest = {
  requestAccessToGroup: async (request, next) => {
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group or User not found",
          })
        );
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: grp_id,
        requestType: "group",
      });

      if (!isEmpty(existingRequest)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Access request already exists for this group",
          })
        );
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant
      ).register(
        {
          user_id: user._id,
          email: user.email,
          targetId: grp_id,
          status: "pending",
          requestType: "group",
        },
        next
      );

      if (responseFromCreateAccessRequest.success === true) {
        const createdAccessRequest = await responseFromCreateAccessRequest.data;
        const firstName = user.firstName ? user.firstName : "Unknown";
        const lastName = user.lastName ? user.lastName : "Unknown";
        if (isEmpty(user.email)) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: "Unable to retrieve the requester's email address" }
            )
          );
        }
        const responseFromSendEmail = await mailer.request(
          {
            firstName,
            lastName,
            email: user.email,
            tenant,
            entity_title: group.grp_title,
            user_id: user._id,
          },
          next
        );

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
  requestAccessToGroupByEmail: async (request, next) => {
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
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Inviter does not exit",
            }
          )
        );
      }

      const group = await GroupModel(tenant).findById(grp_id);
      logObject("group", group);
      if (isEmpty(group)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          })
        );
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
          ).register(
            {
              email: email,
              targetId: grp_id,
              status: "pending",
              requestType: "group",
            },
            next
          );

          logObject(
            "responseFromCreateAccessRequest",
            responseFromCreateAccessRequest
          );

          if (responseFromCreateAccessRequest.success === true) {
            const createdAccessRequest =
              await responseFromCreateAccessRequest.data;
            if (isEmpty(email)) {
              next(
                new HttpError(
                  "Internal Server Error",
                  httpStatus.INTERNAL_SERVER_ERROR,
                  {
                    message: "Unable to retrieve the requester's email address",
                  }
                )
              );
            }

            const userExists = await UserModel(tenant).exists({ email });

            logObject("userExists", userExists);

            const responseFromSendEmail =
              await mailer.requestToJoinGroupByEmail(
                {
                  email,
                  tenant,
                  entity_title: group.grp_title,
                  targetId: grp_id,
                  inviterEmail,
                  userExists,
                },
                next
              );

            logObject("responseFromSendEmail", responseFromSendEmail);

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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Access requests were already sent for the following emails",
            existingRequests,
          })
        );
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
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      logObject("error", error);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  acceptInvitation: async (request, next) => {
    try {
      const { tenant, email, firstName, lastName, password, grids, target_id } =
        {
          ...request.body,
          ...request.query,
          ...request.params,
        };

      const user = await UserModel(tenant).find({ email });
      if (!isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "The User already exists in AirQo Analytics",
          })
        );
      }

      const accessRequest = await AccessRequestModel(tenant).find({
        targetId: target_id,
        email,
        status: "pending",
      });

      logObject("accessRequest", accessRequest);
      if (isEmpty(accessRequest)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Access Request not found, please crosscheck provided details",
          })
        );
      }

      let newUser = {};
      const bodyForCreatingNewUser = {
        email,
        password,
        userName: email,
        firstName,
        lastName,
      };

      const responseFromCreateNewUser = await UserModel(tenant).register(
        bodyForCreatingNewUser,
        next
      );

      if (
        responseFromCreateNewUser.success === true &&
        responseFromCreateNewUser.status === httpStatus.OK
      ) {
        newUser = responseFromCreateNewUser.data;
        logObject("newUser", newUser);

        const update = { status: "approved" };
        const filter = { email, targetId: target_id };

        const responseFromUpdateAccessRequest = await AccessRequestModel(
          tenant
        ).modify(
          {
            filter,
            update,
          },
          next
        );

        const requestType = accessRequest[0].requestType;

        if (responseFromUpdateAccessRequest.success === true && requestType) {
          let entityKeyId;
          let organisationUtil;
          let entity_title;
          if (requestType === "group") {
            entityKeyId = "grp_id";
            organisationUtil = createGroupUtil;
            const group = await GroupModel(tenant).findById(target_id).lean();
            entity_title = group.grp_title;
          } else if (requestType === "network") {
            entityKeyId = "net_id";
            organisationUtil = createNetworkUtil;
            const network = await NetworkModel(tenant)
              .findById(target_id)
              .lean();
            entity_title = network.net_name;
          }

          const { firstName, lastName, email } = newUser;
          const request = {
            params: {
              [entityKeyId]: target_id,
              user_id: newUser._id,
            },
            query: { tenant: tenant },
          };
          const responseFromAssignUserToOrganisation =
            await organisationUtil.assignOneUser(request);

          logObject(
            "responseFromAssignUserToOrganisation",
            responseFromAssignUserToOrganisation
          );

          if (responseFromAssignUserToOrganisation.success === true) {
            const responseFromSendEmail = await mailer.afterAcceptingInvitation(
              {
                firstName,
                username: email,
                email,
                entity_title,
                user_id: newUser._id,
              },
              next
            );
            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "Organisation JOIN request accepted successfully",
                status: httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
          } else if (responseFromAssignUserToOrganisation.success === false) {
            return responseFromAssignUserToOrganisation;
          }
        } else if (responseFromUpdateAccessRequest.success === false) {
          if (isEmpty(requestType)) {
            responseFromUpdateAccessRequest.errors.more =
              "requestType is missing";
          }
          return responseFromUpdateAccessRequest;
        }
      } else {
        return responseFromCreateNewUser;
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
  requestAccessToNetwork: async (request, next) => {
    try {
      const {
        user: { _doc: user },
        query,
      } = request;
      const { tenant } = query;
      const { net_id } = request.params;

      const network = await NetworkModel(tenant).findById(net_id);
      if (isEmpty(network) || isEmpty(user._id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network or User not found",
          })
        );
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: net_id,
        requestType: "network",
      });

      if (!isEmpty(existingRequest)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Access request already exists for this network",
          })
        );
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant
      ).register(
        {
          user_id: user._id,
          targetId: net_id,
          status: "pending",
          requestType: "network",
        },
        next
      );

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

        const responseFromSendEmail = await mailer.request(
          {
            firstName,
            lastName,
            email: user.email,
            tenant,
            entity_title: network.net_name,
            user_id: user._id,
          },
          next
        );

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
  approveAccessRequest: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const { request_id } = request.params;
      const accessRequest = await AccessRequestModel(tenant).findById(
        request_id
      );
      logObject("accessRequest", accessRequest);
      if (isEmpty(accessRequest)) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Access request not found",
          })
        );
      }

      const user = await UserModel(tenant).findById(accessRequest.user_id);

      if (isEmpty(user)) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "User Details in Access Request Not Found",
          })
        );
      }

      const update = { status: "approved" };
      const filter = { _id: ObjectId(accessRequest._id) };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUpdateAccessRequest.success === true) {
        const { firstName, lastName, email } = user;
        if (accessRequest.requestType === "group") {
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
            const updatedUserDetails = { groups: 1 };
            const responseFromSendEmail = await mailer.update(
              {
                email,
                firstName,
                lastName,
                updatedUserDetails,
              },
              next
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
            const updatedUserDetails = { networks: 1 };
            const responseFromSendEmail = await mailer.update(
              { email, firstName, lastName, updatedUserDetails },
              next
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
      const filter = generateFilter.requests(request, next);
      const responseFromListAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListAccessRequest;
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
      const { query, body } = request;
      const filter = generateFilter.requests(request, next);
      const update = body;
      const tenant = query.tenant;

      const responseFromModifyAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).modify(
        {
          filter,
          update,
        },
        next
      );
      logObject(
        "responseFromModifyAccessRequest",
        responseFromModifyAccessRequest
      );
      return responseFromModifyAccessRequest;
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
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.requests(request, next);

      const responseFromRemoveAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      logObject(
        "responseFromRemoveAccessRequest",
        responseFromRemoveAccessRequest
      );
      return responseFromRemoveAccessRequest;
    } catch (error) {
      logObject("delete util error", error);
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
};

module.exports = createAccessRequest;
